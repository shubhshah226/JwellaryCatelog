import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ContentChildren,
  HostListener,
  OnInit,
  QueryList,
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
export class DataGridComponent<T = unknown> implements OnInit {
  readonly rows = input<T[]>([]);
  readonly config = input.required<DataGridConfig<T>>();

  /** Optional external total label override (e.g. platform stats total). */
  readonly totalLabelCount = input<number | null>(null);

  readonly action = output<DataGridActionEvent<T>>();
  readonly selectionChange = output<DataGridSelectionEvent>();

  @ContentChildren(DataGridCellDirective)
  cellTemplates!: QueryList<DataGridCellDirective>;

  readonly draftFilters = signal<Record<string, string>>({});
  readonly appliedFilters = signal<Record<string, string>>({});
  readonly currentPage = signal(1);
  readonly rowsPerPage = signal(10);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly openActionsMenuId = signal<string | null>(null);
  readonly actionsMenuStyle = signal<Record<string, string>>({});
  readonly sortField = signal<string | null>(null);
  readonly sortDirection = signal<DataGridSortDirection>('asc');

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

  ngOnInit(): void {
    const defaultSize = this.config().defaultPageSize ?? 10;
    this.rowsPerPage.set(defaultSize);
    this.ensureFilterDefaults(true);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeActionsMenu();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
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

  toggleActionsMenu(row: T, event: Event): void {
    event.stopPropagation();
    const id = this.rowId(row);
    if (this.openActionsMenuId() === id) {
      this.closeActionsMenu();
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    if (!rect) {
      this.openActionsMenuId.set(id);
      return;
    }

    const menuWidth = 180;
    const estimatedHeight = Math.max(44, this.visibleActions(row).length * 42 + 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 12 && rect.top > estimatedHeight;

    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    const top = openUp ? rect.top - estimatedHeight - 6 : rect.bottom + 6;

    this.actionsMenuStyle.set({
      position: 'fixed',
      top: `${Math.max(8, top)}px`,
      left: `${left}px`,
      right: 'auto',
      zIndex: '2000',
    });
    this.openActionsMenuId.set(id);
  }

  closeActionsMenu(): void {
    this.openActionsMenuId.set(null);
    this.actionsMenuStyle.set({});
  }

  visibleActions(row: T): DataGridAction<T>[] {
    return (this.config().actions ?? []).filter((action) =>
      action.visible ? action.visible(row) : true
    );
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
          const value = String((row as Record<string, unknown>)[name] ?? '').toLowerCase();
          return value.includes(needle);
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
}
