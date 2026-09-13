import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ContentChildren,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppDatePipe } from '../../pipes/app-date.pipe';
import { formatGridDateTime, formatIndiaDateKey } from '../../utils/date-time.util';
import { DataGridCellDirective } from './data-grid-cell.directive';
import {
  DataGridAction,
  DataGridActionEvent,
  DataGridColumn,
  DataGridConfig,
  DataGridFilterField,
  DataGridSelectionEvent,
  DataGridSortDirection,
} from './data-grid.types';

@Component({
  selector: 'app-data-grid',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, NgStyle, AppDatePipe],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.css',
})
export class DataGridComponent<T = unknown> implements OnInit, OnDestroy, AfterViewChecked {
  readonly rows = input<T[]>([]);
  readonly config = input.required<DataGridConfig<T>>();

  /** Optional external total label override (e.g. platform stats total). */
  readonly totalLabelCount = input<number | null>(null);

  readonly action = output<DataGridActionEvent<T>>();
  readonly selectionChange = output<DataGridSelectionEvent>();

  @ContentChildren(DataGridCellDirective)
  cellTemplates!: QueryList<DataGridCellDirective>;

  @ViewChild('actionsPortal')
  private actionsPortal?: ElementRef<HTMLElement>;

  readonly draftFilters = signal<Record<string, string>>({});
  readonly appliedFilters = signal<Record<string, string>>({});
  readonly currentPage = signal(1);
  readonly rowsPerPage = signal(10);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly openActionsMenuId = signal<string | null>(null);
  readonly actionsMenuRow = signal<T | null>(null);
  readonly actionsMenuMode = signal<'all' | 'secondary'>('all');
  readonly actionsMenuStyle = signal<Record<string, string>>({});
  readonly sortField = signal<string | null>(null);
  readonly sortDirection = signal<DataGridSortDirection>('asc');
  private portalPinnedToBody = false;
  private readonly onAnyScroll = (): void => {
    if (this.openActionsMenuId()) {
      this.closeActionsMenu();
    }
  };

  readonly filteredRows = computed(() => {
    const rows = this.rows();
    const filters = this.appliedFilters();
    const filterConfig = this.config().filters ?? [];
    return rows.filter((row) => this.matchesFilters(row, filters, filterConfig));
  });

  readonly sortedRows = computed(() => {
    const field = this.sortField();
    const direction = this.sortDirection();
    const rows = [...this.filteredRows()];
    if (!field) {
      return rows;
    }
    const column = this.config().columns.find((col) => col.key === field);
    if (!column) {
      return rows;
    }
    return rows.sort((a, b) => {
      const left = this.resolveSortValue(a, column);
      const right = this.resolveSortValue(b, column);
      let comparison = 0;
      if (typeof left === 'number' && typeof right === 'number') {
        comparison = left - right;
      } else {
        comparison = String(left ?? '').localeCompare(String(right ?? ''), undefined, {
          sensitivity: 'base',
          numeric: true,
        });
      }
      return direction === 'asc' ? comparison : -comparison;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedRows().length / this.rowsPerPage()))
  );

  readonly paginatedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.rowsPerPage();
    return this.sortedRows().slice(start, start + this.rowsPerPage());
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    for (let page = 1; page <= Math.min(total, 5); page++) {
      pages.push(page);
    }
    if (total > 5 && !pages.includes(current) && current <= total) {
      pages.push(current);
    }
    return [...new Set(pages)].sort((a, b) => a - b);
  });

  readonly paginationStart = computed(() => {
    if (!this.sortedRows().length) {
      return 0;
    }
    return (this.currentPage() - 1) * this.rowsPerPage() + 1;
  });

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.rowsPerPage(), this.sortedRows().length)
  );

  readonly displayTotal = computed(() => {
    const override = this.totalLabelCount();
    return override != null ? override : this.sortedRows().length;
  });

  readonly pageSizeOptions = computed(
    () => this.config().pageSizeOptions ?? [10, 20, 50]
  );

  readonly showFilters = computed(() => {
    const cfg = this.config();
    return cfg.showFilters !== false && (cfg.filters?.length ?? 0) > 0;
  });

  readonly showPagination = computed(() => this.config().showPagination !== false);

  readonly hasActions = computed(() => (this.config().actions?.length ?? 0) > 0);

  /** Image / avatar column for the mobile card media. */
  readonly cardMediaColumn = computed(() => {
    const cols = this.config().columns;
    return (
      cols.find((c) => (c.cellType || 'text') === 'avatar') ||
      cols.find((c) => (c.cellType || 'text') === 'template' && (c.templateKey === 'photo' || c.key === 'image')) ||
      null
    );
  });

  /**
   * Title column for mobile cards.
   * When media is an avatar column, reuse it for name/subtitle text (circle stays in media).
   */
  readonly cardTitleColumn = computed(() => {
    const media = this.cardMediaColumn();
    if (media && (media.cellType || 'text') === 'avatar') {
      return media;
    }

    const mediaKey = media?.key;
    return (
      this.config().columns.find(
        (c) => c.key !== mediaKey && (c.cellType || 'text') !== 'badge'
      ) ?? null
    );
  });

  /** Badge columns shown in the mobile card header. */
  readonly cardBadgeColumns = computed(() =>
    this.config().columns.filter((c) => (c.cellType || 'text') === 'badge')
  );

  /** Remaining detail fields for the mobile card body (2-col meta). */
  readonly cardDetailColumns = computed(() => {
    const mediaKey = this.cardMediaColumn()?.key;
    const titleKey = this.cardTitleColumn()?.key;
    const badgeKeys = new Set(this.cardBadgeColumns().map((c) => c.key));
    return this.config().columns.filter(
      (c) => c.key !== mediaKey && c.key !== titleKey && !badgeKeys.has(c.key)
    );
  });

  /** Primary footer actions (Edit / Delete) on mobile. */
  readonly cardPrimaryActionIds = new Set(['edit', 'delete', 'revoke']);

  readonly columnCount = computed(() => {
    let count = this.config().columns.length;
    if (this.config().selectable) {
      count += 1;
    }
    if (this.hasActions()) {
      count += 1;
    }
    return count;
  });

  readonly actionsMenuItems = computed(() => {
    const row = this.actionsMenuRow();
    if (!row) {
      return [] as DataGridAction<T>[];
    }
    return this.actionsMenuMode() === 'secondary'
      ? this.secondaryCardActions(row)
      : this.visibleActions(row);
  });

  ngOnInit(): void {
    const defaultSize = this.config().defaultPageSize ?? 10;
    this.rowsPerPage.set(defaultSize);
    this.ensureFilterDefaults(true);
    document.addEventListener('scroll', this.onAnyScroll, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onAnyScroll, true);
    this.detachActionsPortal();
  }

  ngAfterViewChecked(): void {
    this.pinActionsPortalToBody();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('.dg-actions-dropdown-portal') ||
      target?.closest('.dg-menu-dots')
    ) {
      return;
    }
    this.closeActionsMenu();
  }

  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.openActionsMenuId()) {
      this.closeActionsMenu();
    }
  }

  applyFilters(): void {
    this.appliedFilters.set({ ...this.draftFilters() });
    this.currentPage.set(1);
    this.selectedIds.set(new Set());
    this.emitSelection();
  }

  resetFilters(): void {
    const next: Record<string, string> = {};
    for (const field of this.config().filters ?? []) {
      next[field.key] = field.defaultValue ?? (field.type === 'select' ? 'all' : '');
    }
    this.draftFilters.set(next);
    this.applyFilters();
  }

  setDraftFilter(key: string, value: string): void {
    this.draftFilters.update((current) => ({ ...current, [key]: value }));
  }

  onSearchChange(key: string, value: string): void {
    this.setDraftFilter(key, value ?? '');
    this.applyFilters();
  }

  onRowsPerPageChange(value: string): void {
    this.rowsPerPage.set(Number(value) || 10);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  toggleSort(column: DataGridColumn<T>): void {
    if (!column.sortable) {
      return;
    }
    if (this.sortField() === column.key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(column.key);
      this.sortDirection.set('asc');
    }
  }

  sortIndicator(columnKey: string): DataGridSortDirection | 'none' {
    if (this.sortField() !== columnKey) {
      return 'none';
    }
    return this.sortDirection();
  }

  rowId(row: T): string {
    const id = this.config().rowId;
    if (typeof id === 'function') {
      return String(id(row));
    }
    return String((row as Record<string, unknown>)[id as string] ?? '');
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.set(new Set(this.paginatedRows().map((row) => this.rowId(row))));
    } else {
      this.selectedIds.set(new Set());
    }
    this.emitSelection();
  }

  toggleSelect(row: T, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const updated = new Set(this.selectedIds());
    const id = this.rowId(row);
    if (checked) {
      updated.add(id);
    } else {
      updated.delete(id);
    }
    this.selectedIds.set(updated);
    this.emitSelection();
  }

  isSelected(row: T): boolean {
    return this.selectedIds().has(this.rowId(row));
  }

  isAllSelected(): boolean {
    const pageIds = this.paginatedRows().map((row) => this.rowId(row));
    return pageIds.length > 0 && pageIds.every((id) => this.selectedIds().has(id));
  }

  toggleActionsMenu(row: T, event: Event, mode: 'all' | 'secondary' = 'all'): void {
    event.preventDefault();
    event.stopPropagation();
    const id = this.rowId(row);
    if (this.openActionsMenuId() === id && this.actionsMenuMode() === mode) {
      this.closeActionsMenu();
      return;
    }

    const items =
      mode === 'secondary' ? this.secondaryCardActions(row) : this.visibleActions(row);
    if (!items.length) {
      this.closeActionsMenu();
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    this.actionsMenuMode.set(mode);
    this.actionsMenuRow.set(row);
    this.openActionsMenuId.set(id);

    if (!rect) {
      this.actionsMenuStyle.set({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: '5000',
      });
      return;
    }

    const menuWidth = 196;
    const estimatedHeight = Math.min(
      window.innerHeight - 16,
      Math.max(48, items.length * 44 + 10)
    );
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    let top = openUp ? rect.top - estimatedHeight - gap : rect.bottom + gap;
    top = Math.min(Math.max(8, top), Math.max(8, window.innerHeight - estimatedHeight - 8));

    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      Math.max(8, window.innerWidth - menuWidth - 8)
    );

    this.actionsMenuStyle.set({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      right: 'auto',
      bottom: 'auto',
      zIndex: '5000',
      maxHeight: `${Math.min(estimatedHeight, window.innerHeight - 16)}px`,
    });
  }

  closeActionsMenu(): void {
    this.detachActionsPortal();
    this.openActionsMenuId.set(null);
    this.actionsMenuRow.set(null);
    this.actionsMenuMode.set('all');
    this.actionsMenuStyle.set({});
  }

  private pinActionsPortalToBody(): void {
    const el = this.actionsPortal?.nativeElement;
    if (!el || !this.openActionsMenuId()) {
      return;
    }
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
      this.portalPinnedToBody = true;
    }
  }

  private detachActionsPortal(): void {
    const el = this.actionsPortal?.nativeElement;
    if (this.portalPinnedToBody && el?.parentElement === document.body) {
      el.remove();
    }
    this.portalPinnedToBody = false;
  }

  visibleActions(row: T): DataGridAction<T>[] {
    return (this.config().actions ?? []).filter((action) =>
      action.visible ? action.visible(row) : true
    );
  }

  primaryCardActions(row: T): DataGridAction<T>[] {
    return this.visibleActions(row).filter((action) => this.cardPrimaryActionIds.has(action.id));
  }

  secondaryCardActions(row: T): DataGridAction<T>[] {
    return this.visibleActions(row).filter((action) => !this.cardPrimaryActionIds.has(action.id));
  }

  actionLabel(action: DataGridAction<T>, row: T): string {
    return typeof action.label === 'function' ? action.label(row) : action.label;
  }

  actionIcon(action: DataGridAction<T>, row: T): string {
    if (!action.icon) {
      return 'fa-solid fa-circle';
    }
    return typeof action.icon === 'function' ? action.icon(row) : action.icon;
  }

  isActionDisabled(action: DataGridAction<T>, row: T): boolean {
    return action.disabled ? action.disabled(row) : false;
  }

  onAction(action: DataGridAction<T>, row: T, event: Event): void {
    event.stopPropagation();
    if (this.isActionDisabled(action, row)) {
      return;
    }
    this.closeActionsMenu();
    this.action.emit({ actionId: action.id, row });
  }

  cellTemplate(column: DataGridColumn<T>) {
    const key = column.templateKey || column.key;
    return this.cellTemplates?.find((item) => item.key === key)?.template ?? null;
  }

  displayValue(row: T, column: DataGridColumn<T>): string {
    if (column.value) {
      const value = column.value(row);
      return value == null || value === '' ? '—' : String(value);
    }
    const raw = (row as Record<string, unknown>)[column.key];
    return raw == null || raw === '' ? '—' : String(raw);
  }

  dateRawValue(row: T, column: DataGridColumn<T>): string | Date | null {
    const value: unknown = column.value
      ? column.value(row)
      : (row as Record<string, unknown>)[column.key];

    if (value == null || value === '') {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    return String(value);
  }

  filterFields(): DataGridFilterField[] {
    return this.config().filters ?? [];
  }

  draftValue(key: string): string {
    return this.draftFilters()[key] ?? '';
  }

  displaySubtitle(row: T, column: DataGridColumn<T>): string {
    if (!column.subtitle) {
      return '';
    }
    const value = column.subtitle(row);
    return value == null ? '' : String(value);
  }

  displayAvatar(row: T, column: DataGridColumn<T>): string {
    if (column.avatarText) {
      return column.avatarText(row);
    }
    const primary = this.displayValue(row, column);
    return primary.slice(0, 2).toUpperCase();
  }

  badgeClass(row: T, column: DataGridColumn<T>): string {
    return column.badgeClass ? column.badgeClass(row) : '';
  }

  trackRow = (_: number, row: T): string => this.rowId(row);

  private ensureFilterDefaults(apply = false): void {
    const next: Record<string, string> = {};
    for (const field of this.config().filters ?? []) {
      next[field.key] =
        this.draftFilters()[field.key] ??
        field.defaultValue ??
        (field.type === 'select' ? 'all' : '');
    }
    this.draftFilters.set(next);
    if (apply || Object.keys(this.appliedFilters()).length === 0) {
      this.appliedFilters.set({ ...next });
    }
  }

  private matchesFilters(
    row: T,
    filters: Record<string, string>,
    filterConfig: DataGridFilterField[]
  ): boolean {
    return filterConfig.every((field) => {
      const raw = (filters[field.key] ?? '').trim();
      if (!raw || raw === 'all') {
        return true;
      }

      if (field.type === 'search') {
        const needle = raw.toLowerCase();
        const fields = field.searchFields?.length
          ? field.searchFields
          : this.config().columns.map((col) => col.key);

        return fields.some((name) => {
          const direct = String((row as Record<string, unknown>)[name] ?? '').toLowerCase();
          if (direct.includes(needle)) {
            return true;
          }

          const column = this.config().columns.find((col) => col.key === name);
          if (column?.value) {
            const display = String(column.value(row) ?? '').toLowerCase();
            if (display.includes(needle)) {
              return true;
            }
          }
          if (column?.subtitle) {
            const subtitle = String(column.subtitle(row) ?? '').toLowerCase();
            if (subtitle.includes(needle)) {
              return true;
            }
          }
          return false;
        });
      }

      if (field.type === 'date') {
        const rowDateKey = formatIndiaDateKey(this.resolveFilterValue(row, field));
        if (!rowDateKey) {
          return false;
        }
        // HTML date input gives yyyy-mm-dd; also allow typed dd/mm/yyyy fragments.
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          return rowDateKey === raw;
        }
        const display = formatGridDateTime(this.resolveFilterValue(row, field)).toLowerCase();
        return display.includes(raw.toLowerCase()) || rowDateKey.includes(raw);
      }

      const haystack = this.resolveFilterValue(row, field);
      if (field.matchMode === 'equals') {
        return haystack.toLowerCase() === raw.toLowerCase();
      }
      return haystack.toLowerCase().includes(raw.toLowerCase());
    });
  }

  private resolveFilterValue(row: T, field: DataGridFilterField): string {
    if (field.matchValue) {
      return String(field.matchValue(row) ?? '');
    }
    if (field.matchField) {
      return String((row as Record<string, unknown>)[field.matchField] ?? '');
    }
    return String((row as Record<string, unknown>)[field.key] ?? '');
  }

  private resolveSortValue(
    row: T,
    column: DataGridColumn<T>
  ): string | number | null | undefined {
    if (column.sortValue) {
      return column.sortValue(row);
    }
    if (column.value) {
      return column.value(row);
    }
    return (row as Record<string, unknown>)[column.key] as string | number | null | undefined;
  }

  private emitSelection(): void {
    this.selectionChange.emit({ selectedIds: [...this.selectedIds()] });
  }

  /** Clears row selection (e.g. after share / parent Clear). */
  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.emitSelection();
  }

  deselectId(id: string): void {
    const updated = new Set(this.selectedIds());
    if (!updated.has(id)) {
      return;
    }
    updated.delete(id);
    this.selectedIds.set(updated);
    this.emitSelection();
  }
}
