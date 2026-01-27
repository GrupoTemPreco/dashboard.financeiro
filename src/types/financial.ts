export interface FinancialRecord {
  id: string;
  company: string;
  group: string;
  date: string;
  openingBalance: number;
  forecastedRevenue: number;
  actualRevenue: number;
  forecastedOutflows: number;
  actualOutflows: number;
  finalBalance: number;
  cogs: number;
  loans: number;
  financing: number;
}

export interface KPIData {
  initialBalance: {
    forecasted: number;
    actual: number;
    date?: string;
  };
  finalBalance: {
    forecasted: number;
    actual: number;
  };
  directRevenue: {
    forecasted: number;
    actual: number;
  };
  cogs: {
    forecasted: number;
    actual: number;
    percentageOfRevenue: number;
  };
  totalInflows: {
    forecasted: number;
    actual: number;
  };
  totalOutflows: {
    forecasted: number;
    actual: number;
    percentageOfRevenue: number;
  };
}

export interface Company {
  id: string;
  company_code: string;
  company_name: string;
  group_name: string;
  created_at: string;
  updated_at: string;
}

export interface ImportedFile {
  id: string;
  name: string;
  type:
    | 'companies'
    | 'accounts_payable'
    | 'revenues'
    | 'financial_transactions'
    | 'forecasted_entries'
    | 'transactions'
    | 'revenues_dre'
    | 'cmv_dre'
    | 'initial_balances'
    | 'faturamento_dre'
    | 'orcamento_dre';
  uploadDate: string;
  recordCount: number;
  status: 'success' | 'error' | 'processing';
  // Indica se o arquivo está na lixeira (soft delete)
  isDeleted?: boolean;
}

export interface AccountsPayable {
  id: string;
  status: 'realizado' | 'previsto';
  business_unit: string;
  chart_of_accounts: string;
  creditor: string;
  payment_date: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Revenue {
  id: string;
  status: 'realizado' | 'previsto';
  business_unit: string;
  chart_of_accounts: string;
  payment_date: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  status: 'realizado' | 'previsto';
  business_unit: string;
  chart_of_accounts: string;
  transaction_date: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Filters {
  companies: string[];
  groups: string[];
  banks: string[];
  startDate: string;
  endDate: string;
}

export interface CalendarDay {
  date: string;
  openingBalance: number;
  forecastedRevenue: number;
  actualRevenue: number;
  forecastedOutflows: number;
  actualOutflows: number;
  finalBalanceForecasted: number;
  finalBalanceActual: number;
}