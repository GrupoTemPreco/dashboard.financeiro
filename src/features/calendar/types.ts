export type CalendarHighlightMetric =
  | 'openingBalance'
  | 'revenues'
  | 'payments'
  | 'finalBalance';

export interface CalendarDayValues {
  date: string;
  dayOfMonth: number;
  openingBalance: number;
  revenues: number;
  payments: number;
  finalBalance: number;
}

export interface CalendarApRow {
  id: string | number;
  business_unit?: string | null;
  payment_date?: string | null;
  due_date?: string | null;
  amount?: number | string | null;
  status?: string | null;
}

export interface CalendarReceitaRow {
  id: string | number;
  business_unit?: string | null;
  data?: string | null;
  valor?: number | string | null;
  status?: string | null;
}

export interface CalendarSaldoRow {
  id: string | number;
  business_unit?: string | null;
  bank_name?: string | null;
  balance?: number | string | null;
  balance_date?: string | null;
  observacao?: string | null;
}

export interface CalendarMonthRawData {
  accountsPayable: CalendarApRow[];
  receitasManuais: CalendarReceitaRow[];
  saldosIniciais: CalendarSaldoRow[];
}

export const CALENDAR_HIGHLIGHT_OPTIONS: Array<{
  value: CalendarHighlightMetric;
  label: string;
}> = [
  { value: 'openingBalance', label: 'Saldo Inicial' },
  { value: 'revenues', label: 'Receitas' },
  { value: 'payments', label: 'Pagamentos' },
  { value: 'finalBalance', label: 'Saldo Final' },
];
