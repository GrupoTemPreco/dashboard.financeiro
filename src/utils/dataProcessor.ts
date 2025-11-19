import { FinancialRecord, KPIData, CalendarDay, Filters } from '../types/financial';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export const filterData = (records: FinancialRecord[], filters: Filters): FinancialRecord[] => {
  return records.filter(record => {
    const recordDate = new Date(record.date);
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    
    return (
      (filters.companies.length === 0 || filters.companies.includes(record.company)) &&
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

export const generateCalendarData = (records: FinancialRecord[], year: number, month: number): CalendarDay[] => {
  const startDate = startOfMonth(new Date(year, month));
  const endDate = endOfMonth(new Date(year, month));
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayRecords = records.filter(r => r.date === dayStr);

    const totals = dayRecords.reduce((acc, record) => ({
      openingBalance: acc.openingBalance + record.openingBalance,
      forecastedRevenue: acc.forecastedRevenue + record.forecastedRevenue,
      forecastedOutflows: acc.forecastedOutflows + record.forecastedOutflows,
      forecastedBalance: acc.forecastedBalance + record.openingBalance + record.forecastedRevenue - record.forecastedOutflows
    }), {
      openingBalance: 0,
      forecastedRevenue: 0,
      forecastedOutflows: 0,
      forecastedBalance: 0
    });

    return {
      date: dayStr,
      openingBalance: totals.openingBalance,
      forecastedRevenue: totals.forecastedRevenue,
      forecastedOutflows: totals.forecastedOutflows,
      forecastedBalance: totals.forecastedBalance
    };
  });
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }
  )
}