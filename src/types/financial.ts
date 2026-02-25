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
    hasBalance?: boolean;
    isLatestBeforePeriod?: boolean;
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
    | 'orcamento_dre'
    | 'receita_crediario';
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
  due_date?: string; // Data de vencimento (opcional para compatibilidade)
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Revenue {
  id: string;
  status: 'realizado' | 'previsto' | 'não identificado';
  business_unit: string;
  chart_of_accounts: string;
  payment_date: string;
  amount: number;
  tipo?: string;
  usuario?: string;
  conta_destino?: string;
  conciliacao_origem?: string;
  conciliacao_destino?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  status: 'realizado' | 'previsto' | null;
  business_unit: string;
  chart_of_accounts: string;
  transaction_date: string;
  amount: number;
  num_doc?: string;
  conta_corrente?: string;
  origem?: string;
  descricao?: string;
  data_hora_inclusao?: string;
  usuario?: string;
  created_at: string;
  updated_at: string;
}

export interface ReceitaCrediario {
  id: string;
  data_receb: string;
  business_unit: string;
  parcela?: string;
  recebimento: number;
  percentual_total?: number;
  juros?: number;
  percentual_juros?: number;
  multa?: number;
  percentual_multa?: number;
  taxa_conv?: number;
  percentual_taxa_conv?: number;
  dias_receb?: number;
  dias_atraso?: number;
  import_id?: string;
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