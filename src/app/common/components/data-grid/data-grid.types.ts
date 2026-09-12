export type DataGridSortDirection = 'asc' | 'desc';

export type DataGridCellType = 'text' | 'stack' | 'avatar' | 'badge' | 'date' | 'template';

export type DataGridFilterType = 'search' | 'select' | 'text' | 'date';

export interface DataGridSelectOption {
  label: string;
  value: string;
}

export interface DataGridColumn<T = unknown> {
  key: string;
  header: string;
  sortable?: boolean;
  cellType?: DataGridCellType;
  /** CSS class for the column (th/td) */
  className?: string;
  /** Primary text (or plain text for `text` cells) */
  value?: (row: T) => string | number | null | undefined;
  /** Secondary line for `stack` / `avatar` */
  subtitle?: (row: T) => string | number | null | undefined;
  /** Initials / avatar label for `avatar` */
  avatarText?: (row: T) => string;
  /** Extra class for badge cells, e.g. status-active */
  badgeClass?: (row: T) => string;
  /** Value used for sorting when different from display */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Named ng-template key when cellType is `template` */
  templateKey?: string;
}

export interface DataGridFilterField {
  key: string;
  type: DataGridFilterType;
  placeholder?: string;
  /** For select filters */
  options?: DataGridSelectOption[];
  /** Default value (select often uses `all`) */
  defaultValue?: string;
  /** Fields searched by a `search` filter */
  searchFields?: string[];
  /** Row field / getter matched by select/text filters */
  matchField?: string;
  matchValue?: (row: unknown) => string | number | null | undefined;
  /** How text filters match; default includes */
  matchMode?: 'includes' | 'equals';
}

export interface DataGridAction<T = unknown> {
  id: string;
  label: string | ((row: T) => string);
  icon?: string | ((row: T) => string);
  visible?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
}

export interface DataGridConfig<T = unknown> {
  columns: DataGridColumn<T>[];
  filters?: DataGridFilterField[];
  actions?: DataGridAction<T>[];
  /** Property or getter used as row id */
  rowId: keyof T | ((row: T) => string);
  selectable?: boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyMessage?: string;
  entityLabel?: string;
  showFilters?: boolean;
  showPagination?: boolean;
}

export interface DataGridActionEvent<T = unknown> {
  actionId: string;
  row: T;
}

export interface DataGridSelectionEvent {
  selectedIds: string[];
}
