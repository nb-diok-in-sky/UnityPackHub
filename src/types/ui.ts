export interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  count: number;
  hidden?: boolean;
}
