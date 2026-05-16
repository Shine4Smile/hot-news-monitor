export interface FilterState {
  source: string;
  importance: string;
  isReal: string;
  timeRange: string;
  sortBy: string;
  sortOrder: string;
}

export const defaultFilterState: FilterState = {
  source: '',
  importance: '',
  isReal: '',
  timeRange: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
};
