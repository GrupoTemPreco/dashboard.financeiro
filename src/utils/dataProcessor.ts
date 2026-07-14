import { FinancialRecord, KPIData, Filters } from '../types/financial';

export const filterData = (records: FinancialRecord[], filters: Filters): FinancialRecord[] => {
  return records.filter(record => {
    const recordDate = new Date(record.date);
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    
    const recordCode = (record as { company?: string; company_code?: string }).company_code ?? (record as { company?: string }).company;
    const companyMatch = filters.companies.length === 0 || filters.companies.some((code: string) =>
      String(code).trim() === String(recordCode ?? '').trim()
    );
    return (
      companyMatch &&
      (filters.groups.length === 0 || filters.groups.includes(record.group)) &&
      recordDate >= startDate &&
      recordDate <= endDate
    );
  });
};

export const calculateKPIs = (records: FinancialRecord[]): KPIData => {
  const totals = records.reduce((acc, record) => ({
    forecastedRevenue: acc.forecastedRevenue + record.forecastedRevenue,
    actualRevenue: acc.actualRevenue + record.actualRevenue,
    forecastedOutflows: acc.forecastedOutflows + record.forecastedOutflows,
    actualOutflows: acc.actualOutflows + record.actualOutflows,
    cogs: acc.cogs + record.cogs,
    openingBalance: acc.openingBalance + record.openingBalance,
    finalBalance: acc.finalBalance + record.finalBalance
  }), {
    forecastedRevenue: 0,
    actualRevenue: 0,
    forecastedOutflows: 0,
    actualOutflows: 0,
    cogs: 0,
    openingBalance: 0,
    finalBalance: 0
  });
  
  return {
    initialBalance: {
      forecasted: totals.openingBalance,
      actual: totals.openingBalance
    },
    finalBalance: {
      forecasted: totals.finalBalance,
      actual: totals.finalBalance
    },
    directRevenue: {
      forecasted: totals.forecastedRevenue,
      actual: totals.actualRevenue
    },
    cogs: {
      forecasted: totals.cogs,
      actual: totals.cogs,
      percentageOfRevenue: totals.actualRevenue ? (totals.cogs / totals.actualRevenue) * 100 : 0
    },
    totalInflows: {
      forecasted: totals.forecastedRevenue,
      actual: totals.actualRevenue
    },
    totalOutflows: {
      forecasted: totals.forecastedOutflows,
      actual: totals.actualOutflows,
      percentageOfRevenue: totals.actualRevenue ? (totals.actualOutflows / totals.actualRevenue) * 100 : 0
    }
  };
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }
  )
}
