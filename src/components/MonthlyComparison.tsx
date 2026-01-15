import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, LineChart, Legend } from 'recharts';
import { Check, BarChart3, TrendingUp, Filter, ChevronDown } from 'lucide-react';

interface MonthlyData {
  month: string;
  currentYear: {
    revenue: number;
    revenueForecasted?: number;
    revenueActual?: number;
    cogs: number;
    loans: number;
    debtRatio: number;
    revenuesByUnit?: { [unit: string]: number };
    cmvByUnit?: { [unit: string]: number };
  };
  previousYear: {
    revenue: number;
    revenueForecasted?: number;
    revenueActual?: number;
    cogs: number;
    loans: number;
    debtRatio: number;
    revenuesByUnit?: { [unit: string]: number };
    cmvByUnit?: { [unit: string]: number };
  };
}

interface RawData {
  revenues: any[];
  accountsPayable: any[];
  forecastedEntries: any[];
  transactions: any[];
  cmvDRE: any[];
  companies: any[];
  cmvChartOfAccounts: string[];
}

interface MonthlyComparisonProps {
  rawData: RawData;
  darkMode?: boolean;
}

export const MonthlyComparison: React.FC<MonthlyComparisonProps> = ({ rawData, darkMode = false }) => {
  // Period filter: defines which dates are included
  const [period, setPeriod] = useState<'3months' | '6months' | '12months' | 'currentYear' | 'custom'>('3months');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // Grouping: defines how data is aggregated
  const [grouping, setGrouping] = useState<'month' | 'week' | 'day'>('month');
  
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'cogs' | 'loans'>('revenue');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null); // 'period' | 'grouping' | 'groups' | 'companies' | null
  const [lineViewMode, setLineViewMode] = useState(false); // false = barras, true = linhas por loja/grupo
  const filtersDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filtersDropdownRef.current && !filtersDropdownRef.current.contains(event.target as Node)) {
        setFiltersDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper to normalize business unit codes
  const normalizeCode = (code: any): string => {
    if (!code) return '';
    const strCode = String(code).trim();
    const numCode = parseInt(strCode);
    return isNaN(numCode) ? strCode : String(numCode);
  };

  // Get unique groups from companies
  const uniqueGroups = useMemo(() => {
    return [...new Set(rawData.companies.map(c => c.group_name))].filter(Boolean);
  }, [rawData.companies]);

  // Get available companies based on selected groups
  const availableCompanies = useMemo(() => {
    if (selectedGroups.length === 0) {
      return rawData.companies;
    }
    return rawData.companies.filter(c => selectedGroups.includes(c.group_name));
  }, [rawData.companies, selectedGroups]);

  // Calculate date range based on period selection
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case '3months':
        // Últimos 3 meses: inclui o mês atual e os 2 meses anteriores
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case '12months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        break;
      case 'currentYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
        } else {
          // Default to 3 months if custom dates not set
          startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  }, [period, customStartDate, customEndDate]);

  // Filter data based on period, groups and companies
  const filteredData = useMemo(() => {
    // First filter by date (period)
    const filterByDate = (item: any, dateField: string) => {
      if (!item[dateField]) return false;
      const itemDate = item[dateField];
      const isInRange = itemDate >= dateRange.start && itemDate <= dateRange.end;
      return isInRange;
    };
    

    // Filter by date
    const dateFiltered = {
      revenues: rawData.revenues.filter(rev => filterByDate(rev, 'payment_date')),
      accountsPayable: rawData.accountsPayable.filter(ap => filterByDate(ap, 'payment_date')),
      forecastedEntries: rawData.forecastedEntries.filter(entry => filterByDate(entry, 'due_date')),
      transactions: rawData.transactions.filter(t => filterByDate(t, 'transaction_date')),
      cmvDRE: (rawData.cmvDRE || []).filter(cmv => filterByDate(cmv, 'issue_date'))
    };

    // Then filter by groups/companies if selected
    // When no filters are selected, show all companies (default behavior)
    const hasActiveFilters = selectedGroups.length > 0 || selectedCompanies.length > 0;

    if (!hasActiveFilters) {
      // No filters = show all companies (default: todas as lojas selecionadas)
      return dateFiltered;
    }

    const filteredCompanyCodes = rawData.companies
      .filter(c => {
        const groupMatch = selectedGroups.length === 0 || selectedGroups.includes(c.group_name);
        const companyMatch = selectedCompanies.length === 0 || selectedCompanies.includes(c.company_name);
        return groupMatch && companyMatch;
      })
      .map(c => c.company_code);

    const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));

    const filterByCompany = (item: any, businessUnitField: string = 'business_unit') => {
      const normalizedBU = normalizeCode(item[businessUnitField]);
      return normalizedCompanyCodes.includes(normalizedBU);
    };

    return {
      revenues: dateFiltered.revenues.filter(rev => filterByCompany(rev, 'business_unit')),
      accountsPayable: dateFiltered.accountsPayable.filter(ap => filterByCompany(ap, 'business_unit')),
      forecastedEntries: dateFiltered.forecastedEntries.filter(entry => filterByCompany(entry, 'business_unit')),
      transactions: dateFiltered.transactions.filter(t => filterByCompany(t, 'business_unit')),
      cmvDRE: dateFiltered.cmvDRE.filter(cmv => filterByCompany(cmv, 'business_unit'))
    };
  }, [rawData, selectedGroups, selectedCompanies, dateRange]);

  // Process data into monthly format
  const data = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const previousYear = currentYear - 1;

    const monthlyDataCurrent: { [key: string]: {
      revenues: number,
      revenuesForecasted: number,
      revenuesActual: number,
      cmv: number,
      loans: number,
      revenuesByUnit: { [unit: string]: number },
      cmvByUnit: { [unit: string]: number }
    } } = {};
    const monthlyDataPrevious: { [key: string]: {
      revenues: number,
      revenuesForecasted: number,
      revenuesActual: number,
      cmv: number,
      loans: number,
      revenuesByUnit: { [unit: string]: number },
      cmvByUnit: { [unit: string]: number }
    } } = {};

    const initMonthData = () => ({
      revenues: 0,
      revenuesForecasted: 0,
      revenuesActual: 0,
      cmv: 0,
      loans: 0,
      revenuesByUnit: {},
      cmvByUnit: {}
    });

    // Process revenues (Receita Direta) - Same logic as card (previsto/pendente + forecasted entries for forecasted, realizado for actual)
    filteredData.revenues.forEach(rev => {
      if (rev.payment_date) {
        const date = new Date(rev.payment_date);
        const year = date.getFullYear();
        const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
        const amount = rev.amount || 0;
        const status = rev.status?.toLowerCase();
        const isForecasted = status === 'previsto' || status === 'pendente';
        const isActual = status === 'realizado';

        const normalizedBU = normalizeCode(rev.business_unit);
        const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
        const unit = company?.company_name || 'Não classificado';

        if (year === currentYear) {
          if (!monthlyDataCurrent[monthKey]) monthlyDataCurrent[monthKey] = initMonthData();
          if (isActual) {
            monthlyDataCurrent[monthKey].revenues += amount;
            monthlyDataCurrent[monthKey].revenuesActual += amount;
            monthlyDataCurrent[monthKey].revenuesByUnit[unit] = (monthlyDataCurrent[monthKey].revenuesByUnit[unit] || 0) + amount;
          } else if (isForecasted) {
            monthlyDataCurrent[monthKey].revenuesForecasted += amount;
          }
        } else if (year === previousYear) {
          if (!monthlyDataPrevious[monthKey]) monthlyDataPrevious[monthKey] = initMonthData();
          if (isActual) {
            monthlyDataPrevious[monthKey].revenues += amount;
            monthlyDataPrevious[monthKey].revenuesActual += amount;
            monthlyDataPrevious[monthKey].revenuesByUnit[unit] = (monthlyDataPrevious[monthKey].revenuesByUnit[unit] || 0) + amount;
          } else if (isForecasted) {
            monthlyDataPrevious[monthKey].revenuesForecasted += amount;
          }
        }
      }
    });

    // Process revenues from forecasted entries (movimento em dinheiro) - Same as card logic
    filteredData.forecastedEntries.forEach(entry => {
      if (entry.due_date && entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro')) {
        const date = new Date(entry.due_date);
        const year = date.getFullYear();
        const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
        const amount = entry.amount || 0;
        const isPaid = entry.status?.toLowerCase() === 'paga';

        const normalizedBU = normalizeCode(entry.business_unit);
        const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
        const unit = company?.company_name || 'Não classificado';

        if (year === currentYear) {
          if (!monthlyDataCurrent[monthKey]) monthlyDataCurrent[monthKey] = initMonthData();
          if (isPaid) {
            monthlyDataCurrent[monthKey].revenues += amount;
            monthlyDataCurrent[monthKey].revenuesActual += amount;
            monthlyDataCurrent[monthKey].revenuesByUnit[unit] = (monthlyDataCurrent[monthKey].revenuesByUnit[unit] || 0) + amount;
          } else {
            monthlyDataCurrent[monthKey].revenuesForecasted += amount;
          }
        } else if (year === previousYear) {
          if (!monthlyDataPrevious[monthKey]) monthlyDataPrevious[monthKey] = initMonthData();
          if (isPaid) {
            monthlyDataPrevious[monthKey].revenues += amount;
            monthlyDataPrevious[monthKey].revenuesActual += amount;
            monthlyDataPrevious[monthKey].revenuesByUnit[unit] = (monthlyDataPrevious[monthKey].revenuesByUnit[unit] || 0) + amount;
          } else {
            monthlyDataPrevious[monthKey].revenuesForecasted += amount;
          }
        }
      }
    });

    // Process CMV - Same logic as card: ONLY from CMV DRE spreadsheet (not from accounts payable, forecasted entries, or transactions)
    // The CMV DRE spreadsheet contains only records with status 'pago' (realized)
    // There are no forecasted data in CMV DRE spreadsheet
    if (filteredData.cmvDRE && filteredData.cmvDRE.length > 0) {
      filteredData.cmvDRE.forEach(cmv => {
        if (cmv.issue_date) {
          const date = new Date(cmv.issue_date);
          const year = date.getFullYear();
          const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
          const amount = Math.abs(cmv.amount || 0);

          const normalizedBU = normalizeCode(cmv.business_unit);
          const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
          const unit = company?.company_name || 'Não classificado';

          if (year === currentYear) {
            if (!monthlyDataCurrent[monthKey]) monthlyDataCurrent[monthKey] = initMonthData();
            monthlyDataCurrent[monthKey].cmv += amount;
            monthlyDataCurrent[monthKey].cmvByUnit[unit] = (monthlyDataCurrent[monthKey].cmvByUnit[unit] || 0) + amount;
          } else if (year === previousYear) {
            if (!monthlyDataPrevious[monthKey]) monthlyDataPrevious[monthKey] = initMonthData();
            monthlyDataPrevious[monthKey].cmv += amount;
            monthlyDataPrevious[monthKey].cmvByUnit[unit] = (monthlyDataPrevious[monthKey].cmvByUnit[unit] || 0) + amount;
          }
        }
      });
    }

    // Process Loans (Empréstimos) - Same logic as Total de Pagamentos card
    // Only from accounts_payable table, where creditor contains "empréstimo" OR chart_of_accounts contains loan-related accounts
    filteredData.accountsPayable.forEach(ap => {
      if (ap.payment_date && ap.status?.toLowerCase() === 'realizado') {
        // Check if creditor name contains "empréstimo" (case insensitive)
        const creditorIsLoan = ap.credor && (
          ap.credor.toLowerCase().includes('empréstimo') || 
          ap.credor.toLowerCase().includes('emprestimo')
        );
        
        // Also check chart_of_accounts for loan-related accounts
        const chartIsLoan = ap.chart_of_accounts && (
          ap.chart_of_accounts.toLowerCase().includes('empréstimo') ||
          ap.chart_of_accounts.toLowerCase().includes('emprestimo') ||
          ap.chart_of_accounts.toLowerCase().includes('pagamento de empréstimo') ||
          ap.chart_of_accounts.toLowerCase().includes('financiamento')
        );
        
        const isLoan = creditorIsLoan || chartIsLoan;
        
        if (isLoan) {
          const date = new Date(ap.payment_date);
          const year = date.getFullYear();
          const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
          const amount = Math.abs(ap.amount || 0);

          if (year === currentYear) {
            if (!monthlyDataCurrent[monthKey]) monthlyDataCurrent[monthKey] = initMonthData();
            monthlyDataCurrent[monthKey].loans += amount;
          } else if (year === previousYear) {
            if (!monthlyDataPrevious[monthKey]) monthlyDataPrevious[monthKey] = initMonthData();
            monthlyDataPrevious[monthKey].loans += amount;
          }
        }
      }
    });

    // Convert to array format - include all months in the selected period
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const result: MonthlyData[] = [];

    // Calculate which months to include based on period
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    // Determine months to include - iterate through all months from start to end
    const monthsToInclude: Array<{ month: number; year: number }> = [];
    let currentIterDate = new Date(startDate);
    currentIterDate.setDate(1); // Start from first day of month
    currentIterDate.setHours(0, 0, 0, 0); // Normalize time
    const endDateForIter = new Date(endDate);
    endDateForIter.setDate(1); // Compare by month, not day
    endDateForIter.setHours(0, 0, 0, 0); // Normalize time
    
    // Add one month to endDateForIter to include the end month itself
    const endDateInclusive = new Date(endDateForIter);
    endDateInclusive.setMonth(endDateInclusive.getMonth() + 1);
    
    while (currentIterDate < endDateInclusive) {
      const month = currentIterDate.getMonth() + 1;
      const year = currentIterDate.getFullYear();
      
      // Only include if not in the future
      if (year < currentYear || (year === currentYear && month <= currentMonth)) {
        monthsToInclude.push({ month, year });
      }
      
      // Move to next month
      currentIterDate.setMonth(currentIterDate.getMonth() + 1);
    }


    // Process each month in the range
    monthsToInclude.forEach(({ month }) => {
      const monthKey = `${month}`.padStart(2, '0');
      
      // Get data for current year (same month)
      const currentData = monthlyDataCurrent[monthKey] || initMonthData();
      // Get data for previous year (same month)
      const previousData = monthlyDataPrevious[monthKey] || initMonthData();

      const currentDebtRatio = currentData.revenues > 0 ? (currentData.loans / currentData.revenues) * 100 : 0;
      const previousDebtRatio = previousData.revenues > 0 ? (previousData.loans / previousData.revenues) * 100 : 0;

      result.push({
        month: monthNames[month - 1],
        currentYear: {
          revenue: currentData.revenues,
          revenueForecasted: currentData.revenuesForecasted || 0,
          revenueActual: currentData.revenuesActual || currentData.revenues,
          cogs: currentData.cmv,
          loans: currentData.loans,
          debtRatio: currentDebtRatio,
          revenuesByUnit: currentData.revenuesByUnit,
          cmvByUnit: currentData.cmvByUnit
        },
        previousYear: {
          revenue: previousData.revenues,
          revenueForecasted: previousData.revenuesForecasted || 0,
          revenueActual: previousData.revenuesActual || previousData.revenues,
          cogs: previousData.cmv,
          loans: previousData.loans,
          debtRatio: previousDebtRatio,
          revenuesByUnit: previousData.revenuesByUnit,
          cmvByUnit: previousData.cmvByUnit
        }
      });
    });

    return result;
  }, [filteredData, rawData.companies, rawData.cmvChartOfAccounts, dateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getMonthIndexFromName = (monthName: string): number => {
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
      'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11
    };
    return monthMap[monthName] ?? new Date().getMonth();
  };

  const getWeekDates = (monthName: string, weekInMonth: number): { start: Date; end: Date } => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = getMonthIndexFromName(monthName);
    
    const firstDay = new Date(currentYear, month, 1);
    const lastDay = new Date(currentYear, month + 1, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const daysToFirstMonday = firstDayOfWeek === 0 ? 1 : (8 - firstDayOfWeek) % 7;
    const firstMonday = new Date(currentYear, month, 1 + daysToFirstMonday);
    
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekInMonth - 1) * 7);
    
    if (weekStart < firstDay) {
      weekStart.setTime(firstDay.getTime());
    }
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    if (weekEnd > lastDay) {
      weekEnd.setTime(lastDay.getTime());
    }
    
    return { start: weekStart, end: weekEnd };
  };

  const formatWeekLabel = (start: Date, end: Date): string => {
    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}/${month}`;
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Process data for line view mode (by company or group)
  const processLineData = useMemo(() => {
    return (entities: Array<{ name: string; code: string; type: 'company' | 'group' }>) => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      // Initialize data structure: { month: { entity1: value, entity2: value, ... } }
      const monthlyData: { [month: string]: { [entity: string]: number } } = {};

      // Initialize only months up to current month (don't show future months)
      for (let month = 1; month <= currentMonth; month++) {
        const monthKey = monthNames[month - 1];
        monthlyData[monthKey] = {};
        entities.forEach(entity => {
          monthlyData[monthKey][entity.name] = 0;
        });
      }

      // Process revenues - Same logic as card (previsto/pendente + forecasted entries for forecasted, realizado for actual)
      if (selectedMetric === 'revenue') {
        // Process actual revenues (realizado) - same as card's "Realizado"
        filteredData.revenues.forEach(rev => {
          if (rev.payment_date && rev.status?.toLowerCase() === 'realizado') {
            const date = new Date(rev.payment_date);
            const year = date.getFullYear();
            if (year === currentYear) {
              const monthKey = monthNames[date.getMonth()];
              const normalizedBU = normalizeCode(rev.business_unit);
              
              // Find matching entity
              let entityName: string | undefined;
              
              if (entities.some(e => e.type === 'company')) {
                // If grouping by companies, match by company_code
                const matchingEntity = entities.find(e => {
                  if (e.type !== 'company') return false;
                  const normalizedCode = normalizeCode(e.code);
                  return normalizedCode === normalizedBU;
                });
                entityName = matchingEntity?.name;
                
                // Fallback: if no match by code, try to find company by business_unit and match by name
                if (!entityName) {
                  const company = rawData.companies.find(c => {
                    const normalizedCode = normalizeCode(c.company_code);
                    return normalizedCode === normalizedBU;
                  });
                  if (company) {
                    const matchingEntityByName = entities.find(e => 
                      e.type === 'company' && e.name === company.company_name
                    );
                    entityName = matchingEntityByName?.name;
                  }
                }
              } else if (entities.some(e => e.type === 'group')) {
                // If grouping by groups, match by group_name
                const company = rawData.companies.find(c => {
                  const normalizedCode = normalizeCode(c.company_code);
                  return normalizedCode === normalizedBU;
                });
                if (company) {
                  const matchingEntity = entities.find(e => 
                    e.type === 'group' && e.name === company.group_name
                  );
                  entityName = matchingEntity?.name;
                }
              }
              
              if (entityName && monthlyData[monthKey]) {
                monthlyData[monthKey][entityName] = (monthlyData[monthKey][entityName] || 0) + (rev.amount || 0);
              }
            }
          }
        });

        // Process revenues from forecasted entries (movimento em dinheiro) - same as card logic
        filteredData.forecastedEntries.forEach(entry => {
          if (entry.due_date && entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro')) {
            const date = new Date(entry.due_date);
            const year = date.getFullYear();
            if (year === currentYear) {
              const monthKey = monthNames[date.getMonth()];
              const normalizedBU = normalizeCode(entry.business_unit);
              
              // Find matching entity
              let entityName: string | undefined;
              
              if (entities.some(e => e.type === 'company')) {
                const matchingEntity = entities.find(e => {
                  if (e.type !== 'company') return false;
                  const normalizedCode = normalizeCode(e.code);
                  return normalizedCode === normalizedBU;
                });
                entityName = matchingEntity?.name;
                
                // Fallback: if no match by code, try to find company by business_unit and match by name
                if (!entityName) {
                  const company = rawData.companies.find(c => {
                    const normalizedCode = normalizeCode(c.company_code);
                    return normalizedCode === normalizedBU;
                  });
                  if (company) {
                    const matchingEntityByName = entities.find(e => 
                      e.type === 'company' && e.name === company.company_name
                    );
                    entityName = matchingEntityByName?.name;
                  }
                }
              } else if (entities.some(e => e.type === 'group')) {
                const company = rawData.companies.find(c => {
                  const normalizedCode = normalizeCode(c.company_code);
                  return normalizedCode === normalizedBU;
                });
                if (company) {
                  const matchingEntity = entities.find(e => 
                    e.type === 'group' && e.name === company.group_name
                  );
                  entityName = matchingEntity?.name;
                }
              }
              
              // Only count if paid (paga = actual), otherwise it's forecasted
              if (entityName && monthlyData[monthKey] && entry.status?.toLowerCase() === 'paga') {
                monthlyData[monthKey][entityName] = (monthlyData[monthKey][entityName] || 0) + (entry.amount || 0);
              }
            }
          }
        });
      }

      // Process CMV - Same logic as card: ONLY from CMV DRE spreadsheet
      if (selectedMetric === 'cogs') {
        if (filteredData.cmvDRE && filteredData.cmvDRE.length > 0) {
          filteredData.cmvDRE.forEach(cmv => {
            if (cmv.issue_date) {
              const date = new Date(cmv.issue_date);
              const year = date.getFullYear();
              if (year === currentYear) {
                const monthKey = monthNames[date.getMonth()];
                const normalizedBU = normalizeCode(cmv.business_unit);
                
                // Find matching entity
                let entityName: string | undefined;
                
                if (entities.some(e => e.type === 'company')) {
                  const matchingEntity = entities.find(e => 
                    e.type === 'company' && normalizeCode(e.code) === normalizedBU
                  );
                  entityName = matchingEntity?.name;
                } else if (entities.some(e => e.type === 'group')) {
                  const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
                  const matchingEntity = entities.find(e => 
                    e.type === 'group' && e.name === company?.group_name
                  );
                  entityName = matchingEntity?.name;
                }
                
                if (entityName && monthlyData[monthKey]) {
                  monthlyData[monthKey][entityName] = (monthlyData[monthKey][entityName] || 0) + Math.abs(cmv.amount || 0);
                }
              }
            }
          });
        }
      }

      // Process Loans - Same logic as Total de Pagamentos card
      // Only from accounts_payable table, where creditor contains "empréstimo" OR chart_of_accounts contains loan-related accounts
      if (selectedMetric === 'loans') {
        filteredData.accountsPayable.forEach(ap => {
          if (ap.payment_date && ap.status?.toLowerCase() === 'realizado') {
            // Check if creditor name contains "empréstimo" or "emprestimo" anywhere in the string (case insensitive)
            // This will match: "Empréstimo XYZ", "XYZ Empréstimo", "XYZ Empréstimo ABC", etc.
            const creditorIsLoan = ap.credor && (
              ap.credor.toLowerCase().includes('empréstimo') || 
              ap.credor.toLowerCase().includes('emprestimo') ||
              ap.credor.toLowerCase().includes('emprest') // Also match "emprest" as partial match
            );
            
            // Also check chart_of_accounts for loan-related accounts
            const chartIsLoan = ap.chart_of_accounts && (
              ap.chart_of_accounts.toLowerCase().includes('empréstimo') ||
              ap.chart_of_accounts.toLowerCase().includes('emprestimo') ||
              ap.chart_of_accounts.toLowerCase().includes('pagamento de empréstimo') ||
              ap.chart_of_accounts.toLowerCase().includes('pagamento de emprestimo') ||
              ap.chart_of_accounts.toLowerCase().includes('financiamento')
            );
            
            const isLoan = creditorIsLoan || chartIsLoan;
            
            if (isLoan) {
              const date = new Date(ap.payment_date);
              const year = date.getFullYear();
              if (year === currentYear) {
                const monthKey = monthNames[date.getMonth()];
                const normalizedBU = normalizeCode(ap.business_unit);
                
                // Find matching entity
                let entityName: string | undefined;
                
                if (entities.some(e => e.type === 'company')) {
                  const matchingEntity = entities.find(e => 
                    e.type === 'company' && normalizeCode(e.code) === normalizedBU
                  );
                  entityName = matchingEntity?.name;
                } else if (entities.some(e => e.type === 'group')) {
                  const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
                  const matchingEntity = entities.find(e => 
                    e.type === 'group' && e.name === company?.group_name
                  );
                  entityName = matchingEntity?.name;
                }
                
                if (entityName && monthlyData[monthKey]) {
                  monthlyData[monthKey][entityName] = (monthlyData[monthKey][entityName] || 0) + Math.abs(ap.amount || 0);
                }
              }
            }
          }
        });
      }

      // Convert to array format for chart - only include months with data
      const result = Object.keys(monthlyData)
        .map(month => ({
          month,
          ...monthlyData[month]
        }))
        .filter(item => {
          // Only include months that have at least one entity with data > 0
          const itemAny = item as any;
          const keys = Object.keys(itemAny).filter(key => key !== 'month');
          return keys.some(key => {
            const value = itemAny[key] as number;
            return value > 0;
          });
        });

      // Return all months (grouping will be handled in getMetricData)
      return result;
    };
  }, [filteredData, rawData.companies, rawData.cmvChartOfAccounts, selectedMetric]);

  const getLineViewData = useMemo(() => {
    if (!lineViewMode) return null;

    // Determine if we should group by companies or groups
    const groupByCompanies = selectedCompanies.length > 0;
    const groupByGroups = selectedGroups.length > 0 && selectedCompanies.length === 0;

    if (groupByCompanies) {
      // Group by selected companies
      const entities = selectedCompanies.map(companyName => {
        const company = rawData.companies.find(c => c.company_name === companyName);
        return {
          name: companyName,
          code: company?.company_code || '',
          type: 'company' as const
        };
      });
      return processLineData(entities);
    }

    if (groupByGroups) {
      // Group by selected groups
      const entities = selectedGroups.map(groupName => ({
        name: groupName,
        code: '',
        type: 'group' as const
      }));
      return processLineData(entities);
    }

    // If no filters, show all companies (limit to first 10 to avoid clutter)
    if (rawData.companies.length > 0) {
      const allCompanies = rawData.companies.slice(0, 10);
      const entities = allCompanies.map(c => ({
        name: c.company_name,
        code: c.company_code,
        type: 'company' as const
      }));
      return processLineData(entities);
    }

    return null;
  }, [lineViewMode, selectedCompanies, selectedGroups, rawData.companies, processLineData]);

  const getMetricData = () => {
    // If line view mode is active, return line data
    if (lineViewMode && getLineViewData && getLineViewData.length > 0) {
      return getLineViewData;
    }

    // Helper to get the correct value based on metric
    const getMetricValue = (item: MonthlyData, year: 'currentYear' | 'previousYear') => {
      if (selectedMetric === 'revenue') {
        // For revenue, use revenueActual (same as card's "Realizado")
        return item[year].revenueActual ?? item[year].revenue;
      } else if (selectedMetric === 'cogs') {
        return item[year].cogs || 0;
      } else if (selectedMetric === 'loans') {
        return item[year].loans || 0;
      }
      return 0;
    };

    if (grouping === 'week') {
      const weeklyData: Array<{ month: string; current: number; previous: number; debtRatioCurrent: number; debtRatioPrevious: number; originalData: any }> = [];
      
      data.forEach((item) => {
        const monthName = item.month;
        const now = new Date();
        const currentYear = now.getFullYear();
        const month = getMonthIndexFromName(monthName);
        
        const firstDay = new Date(currentYear, month, 1);
        const lastDay = new Date(currentYear, month + 1, 0);
        const firstDayOfWeek = firstDay.getDay();
        const daysToFirstMonday = firstDayOfWeek === 0 ? 1 : (8 - firstDayOfWeek) % 7;
        const firstMonday = new Date(currentYear, month, 1 + daysToFirstMonday);
        
        const daysInMonth = lastDay.getDate();
        const daysFromFirstMonday = daysInMonth - (firstMonday.getDate() - 1);
        const weeksInMonth = Math.ceil(daysFromFirstMonday / 7);
        
        const weekValue = getMetricValue(item, 'currentYear') / weeksInMonth;
        const previousWeekValue = getMetricValue(item, 'previousYear') / weeksInMonth;
        
        for (let w = 1; w <= weeksInMonth; w++) {
          const { start, end } = getWeekDates(monthName, w);
          const weekLabel = formatWeekLabel(start, end);
          
          weeklyData.push({
            month: weekLabel,
            current: weekValue,
            previous: previousWeekValue,
            debtRatioCurrent: item.currentYear.debtRatio,
            debtRatioPrevious: item.previousYear.debtRatio,
            originalData: item
          });
        }
      });
      
      return weeklyData;
    }

    if (grouping === 'day') {
      // Group by day - need to process raw filtered data by day
      const dailyData: Array<{ month: string; current: number; previous: number; debtRatioCurrent: number; debtRatioPrevious: number; originalData: any }> = [];
      
      // Get all unique dates in the filtered data
      const dateMap = new Map<string, { current: number; previous: number }>();
      
      // Process revenues
      if (selectedMetric === 'revenue') {
        filteredData.revenues.forEach(rev => {
          if (rev.payment_date && rev.status?.toLowerCase() === 'realizado') {
            const date = new Date(rev.payment_date);
            const dateKey = rev.payment_date;
            const year = date.getFullYear();
            const isCurrentYear = year === new Date().getFullYear();
            
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, { current: 0, previous: 0 });
            }
            const dayData = dateMap.get(dateKey)!;
            if (isCurrentYear) {
              dayData.current += rev.amount || 0;
            } else {
              dayData.previous += rev.amount || 0;
            }
          }
        });
        
        filteredData.forecastedEntries.forEach(entry => {
          if (entry.due_date && entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro') && entry.status?.toLowerCase() === 'paga') {
            const date = new Date(entry.due_date);
            const dateKey = entry.due_date;
            const year = date.getFullYear();
            const isCurrentYear = year === new Date().getFullYear();
            
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, { current: 0, previous: 0 });
            }
            const dayData = dateMap.get(dateKey)!;
            if (isCurrentYear) {
              dayData.current += entry.amount || 0;
            } else {
              dayData.previous += entry.amount || 0;
            }
          }
        });
      }
      
      // Process CMV
      if (selectedMetric === 'cogs') {
        filteredData.cmvDRE?.forEach(cmv => {
          if (cmv.issue_date) {
            const date = new Date(cmv.issue_date);
            const dateKey = cmv.issue_date;
            const year = date.getFullYear();
            const isCurrentYear = year === new Date().getFullYear();
            
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, { current: 0, previous: 0 });
            }
            const dayData = dateMap.get(dateKey)!;
            if (isCurrentYear) {
              dayData.current += Math.abs(cmv.amount || 0);
            } else {
              dayData.previous += Math.abs(cmv.amount || 0);
            }
          }
        });
      }
      
      // Process Loans
      if (selectedMetric === 'loans') {
        filteredData.accountsPayable.forEach(ap => {
          if (ap.payment_date && ap.status?.toLowerCase() === 'realizado') {
            // Check if creditor name contains "empréstimo" or "emprestimo" anywhere in the string (case insensitive)
            // This will match: "Empréstimo XYZ", "XYZ Empréstimo", "XYZ Empréstimo ABC", etc.
            const creditorIsLoan = ap.credor && (
              ap.credor.toLowerCase().includes('empréstimo') || 
              ap.credor.toLowerCase().includes('emprestimo') ||
              ap.credor.toLowerCase().includes('emprest') // Also match "emprest" as partial match
            );
            
            // Also check chart_of_accounts for loan-related accounts
            const chartIsLoan = ap.chart_of_accounts && (
              ap.chart_of_accounts.toLowerCase().includes('empréstimo') ||
              ap.chart_of_accounts.toLowerCase().includes('emprestimo') ||
              ap.chart_of_accounts.toLowerCase().includes('pagamento de empréstimo') ||
              ap.chart_of_accounts.toLowerCase().includes('pagamento de emprestimo') ||
              ap.chart_of_accounts.toLowerCase().includes('financiamento')
            );
            
            const isLoan = creditorIsLoan || chartIsLoan;
            
            if (isLoan) {
              const date = new Date(ap.payment_date);
              const dateKey = ap.payment_date;
              const year = date.getFullYear();
              const isCurrentYear = year === new Date().getFullYear();
              
              if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, { current: 0, previous: 0 });
              }
              const dayData = dateMap.get(dateKey)!;
              if (isCurrentYear) {
                dayData.current += Math.abs(ap.amount || 0);
              } else {
                dayData.previous += Math.abs(ap.amount || 0);
              }
            }
          }
        });
      }
      
      // Convert to array and sort by date
      const sortedDates = Array.from(dateMap.entries())
        .filter(([dateKey]) => {
          const date = new Date(dateKey);
          return date >= new Date(dateRange.start) && date <= new Date(dateRange.end);
        })
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
      
      sortedDates.forEach(([dateKey, values]) => {
        const date = new Date(dateKey);
        const dayLabel = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        dailyData.push({
          month: dayLabel,
          current: values.current,
          previous: values.previous,
          debtRatioCurrent: 0,
          debtRatioPrevious: 0,
          originalData: null
        });
      });
      
      return dailyData;
    }

    // Default: monthly grouping
    return data.map(item => ({
      month: item.month,
      current: getMetricValue(item, 'currentYear'),
      previous: getMetricValue(item, 'previousYear'),
      debtRatioCurrent: item.currentYear.debtRatio,
      debtRatioPrevious: item.previousYear.debtRatio,
      originalData: item
    }));
  };

  const getMetricTitle = () => {
    switch (selectedMetric) {
      case 'revenue':
        return 'Receita Direta Total';
      case 'cogs':
        return 'Custo das Mercadorias Vendidas (CMV)';
      case 'loans':
        return 'Empréstimos e Financiamentos';
      default:
        return '';
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'revenue':
        return { current: '#3b82f6', previous: '#93c5fd' };
      case 'cogs':
        return { current: '#ef4444', previous: '#fca5a5' };
      case 'loans':
        return { current: '#eab308', previous: '#fde047' };
      default:
        return { current: '#6b7280', previous: '#d1d5db' };
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const originalData = payload[0]?.payload?.originalData;

      return (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} p-4 border rounded-lg shadow-lg max-w-sm`}>
          <p className={`text-sm font-medium mb-3 border-b pb-2 ${darkMode ? 'text-slate-100 border-slate-700' : 'text-gray-700 border-gray-200'}`}>{label}</p>

          {payload.map((entry: any, index: number) => {
            if (entry.dataKey === 'debtRatioCurrent' || entry.dataKey === 'debtRatioPrevious') {
              return (
                <p key={index} className="text-sm mb-1" style={{ color: entry.color }}>
                  {entry.name}: {entry.value.toFixed(1)}%
                </p>
              );
            }

            const isCurrentYear = entry.dataKey === 'current';
            const year = isCurrentYear ? 'currentYear' : 'previousYear';
            const yearLabel = isCurrentYear ? 'Ano Atual' : 'Ano Anterior';

            return (
              <div key={index} className="mb-3">
                <p className="text-sm font-medium mb-1" style={{ color: entry.color }}>
                  {yearLabel}: {formatCurrency(entry.value)}
                </p>

                {selectedMetric === 'revenue' && originalData?.[year]?.revenuesByUnit && (
                  <div className="ml-3 mt-1 space-y-0.5">
                    {Object.entries(originalData[year].revenuesByUnit).map(([unit, value]: [string, any]) => (
                      <p key={unit} className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                        {unit}: {formatCurrency(value)}
                      </p>
                    ))}
                  </div>
                )}

                {selectedMetric === 'cogs' && originalData?.[year]?.cmvByUnit && (
                  <div className="ml-3 mt-1 space-y-0.5">
                    {Object.entries(originalData[year].cmvByUnit).map(([unit, value]: [string, any]) => (
                      <p key={unit} className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                        {unit}: {formatCurrency(value)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const handleGroupToggle = (group: string) => {
    setSelectedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
    // Clear companies when groups change
    setSelectedCompanies([]);
  };

  const handleCompanyToggle = (company: string) => {
    setSelectedCompanies(prev => 
      prev.includes(company) 
        ? prev.filter(c => c !== company)
        : [...prev, company]
    );
  };

  const handleClearFilters = () => {
    setPeriod('3months');
    setCustomStartDate('');
    setCustomEndDate('');
    setGrouping('month');
    setSelectedGroups([]);
    setSelectedCompanies([]); // Empty = todas as empresas (padrão)
  };

  const handleApplyFilters = () => {
    setFiltersDropdownOpen(false);
    setExpandedFilter(null);
  };

  const colors = getMetricColor();

  return (
    <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Análise Mês a Mês & Ano a Ano</h2>
        
        <div className="flex items-center space-x-4">
          {/* Botão de Filtros */}
          <div className="relative" ref={filtersDropdownRef}>
            <button
              onClick={() => setFiltersDropdownOpen(!filtersDropdownOpen)}
              className={`p-2 rounded-md transition-colors relative ${
                (selectedGroups.length > 0 || selectedCompanies.length > 0 || period !== '3months' || grouping !== 'month')
                  ? darkMode
                    ? 'bg-sky-500 text-white'
                    : 'bg-marsala-600 text-white'
                  : darkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Filtros"
            >
              <Filter className="w-4 h-4" />
              {(selectedGroups.length > 0 || selectedCompanies.length > 0 || period !== '3months' || grouping !== 'month') && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            {filtersDropdownOpen && (
              <div className={`absolute top-full right-0 mt-1 z-20 rounded-lg shadow-lg border w-80 max-h-[600px] overflow-y-auto ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
              }`}>
                <div className="p-4 space-y-2">
                  {/* Período */}
                  <div>
                    <button
                      onClick={() => setExpandedFilter(expandedFilter === 'period' ? null : 'period')}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded transition-colors ${
                        darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>Período: {period === '3months' ? 'Últimos 3 meses' : period === '6months' ? 'Últimos 6 meses' : period === '12months' ? 'Últimos 12 meses' : period === 'currentYear' ? 'Ano atual' : 'Personalizado'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedFilter === 'period' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedFilter === 'period' && (
                      <>
                        <div className="mt-2 space-y-1">
                          <button
                            onClick={() => { setPeriod('3months'); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                              period === '3months'
                                ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                                : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {period === '3months' && <Check className="w-4 h-4" />}
                            <span>Últimos 3 meses</span>
                          </button>
                          <button
                            onClick={() => { setPeriod('6months'); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                              period === '6months'
                                ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                                : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {period === '6months' && <Check className="w-4 h-4" />}
                            <span>Últimos 6 meses</span>
                          </button>
                          <button
                            onClick={() => { setPeriod('12months'); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                              period === '12months'
                                ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                                : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {period === '12months' && <Check className="w-4 h-4" />}
                            <span>Últimos 12 meses</span>
                          </button>
                          <button
                            onClick={() => { setPeriod('currentYear'); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                              period === 'currentYear'
                                ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                                : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {period === 'currentYear' && <Check className="w-4 h-4" />}
                            <span>Ano atual</span>
                          </button>
                          <button
                            onClick={() => { setPeriod('custom'); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                              period === 'custom'
                                ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                                : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {period === 'custom' && <Check className="w-4 h-4" />}
                            <span>Personalizado</span>
                          </button>
                        </div>
                        {period === 'custom' && (
                          <div className={`mt-2 p-3 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                            <div className="space-y-2">
                              <div>
                                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                                  Data Inicial
                                </label>
                                <input
                                  type="date"
                                  value={customStartDate}
                                  onChange={(e) => setCustomStartDate(e.target.value)}
                                  className={`w-full px-2 py-1 rounded border text-sm ${
                                    darkMode
                                      ? 'bg-slate-600 border-slate-500 text-slate-200'
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                              <div>
                                <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                                  Data Final
                                </label>
                                <input
                                  type="date"
                                  value={customEndDate}
                                  onChange={(e) => setCustomEndDate(e.target.value)}
                                  className={`w-full px-2 py-1 rounded border text-sm ${
                                    darkMode
                                      ? 'bg-slate-600 border-slate-500 text-slate-200'
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Agrupamento */}
                  <div>
                    <button
                      onClick={() => setExpandedFilter(expandedFilter === 'grouping' ? null : 'grouping')}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded transition-colors ${
                        darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>Agrupar por: {grouping === 'month' ? 'Mês' : grouping === 'week' ? 'Semana' : 'Dia'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedFilter === 'grouping' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedFilter === 'grouping' && (
                      <div className="mt-2 space-y-1">
                      <button
                        onClick={() => { setGrouping('month'); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                          grouping === 'month'
                            ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                            : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {grouping === 'month' && <Check className="w-4 h-4" />}
                        <span>Mês</span>
                      </button>
                      <button
                        onClick={() => { setGrouping('week'); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                          grouping === 'week'
                            ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                            : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {grouping === 'week' && <Check className="w-4 h-4" />}
                        <span>Semana</span>
                      </button>
                      <button
                        onClick={() => { setGrouping('day'); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                          grouping === 'day'
                            ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                            : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {grouping === 'day' && <Check className="w-4 h-4" />}
                        <span>Dia</span>
                      </button>
                    </div>
                    )}
                  </div>

                  {/* Grupos */}
                  {uniqueGroups.length > 0 && (
                    <div>
                      <button
                        onClick={() => setExpandedFilter(expandedFilter === 'groups' ? null : 'groups')}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded transition-colors ${
                          darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>Grupos {selectedGroups.length > 0 && `(${selectedGroups.length})`}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedFilter === 'groups' ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedFilter === 'groups' && (
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                        {uniqueGroups.map(group => (
                          <button
                            key={group}
                            onClick={() => handleGroupToggle(group)}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                              selectedGroups.includes(group)
                                ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                                : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {selectedGroups.includes(group) && <Check className="w-4 h-4" />}
                            <span>{group}</span>
                          </button>
                        ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empresas */}
                  {availableCompanies.length > 0 && (
                    <div>
                      <button
                        onClick={() => setExpandedFilter(expandedFilter === 'companies' ? null : 'companies')}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded transition-colors ${
                          darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>Empresas {selectedCompanies.length > 0 && `(${selectedCompanies.length})`}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedFilter === 'companies' ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedFilter === 'companies' && (
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                        {availableCompanies.map(company => (
                          <button
                            key={company.company_name}
                            onClick={() => handleCompanyToggle(company.company_name)}
                            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                              selectedCompanies.includes(company.company_name)
                                ? darkMode ? 'bg-sky-600 bg-opacity-50 text-sky-200' : 'bg-marsala-100 text-marsala-700'
                                : darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {selectedCompanies.includes(company.company_name) && <Check className="w-4 h-4" />}
                            <span>{company.company_name}</span>
                          </button>
                        ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="pt-4 mt-4 border-t border-gray-300 dark:border-slate-700 flex gap-2">
                    <button
                      onClick={handleClearFilters}
                      className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                        darkMode
                          ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Limpar
                    </button>
                    <button
                      onClick={handleApplyFilters}
                      className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                        darkMode
                          ? 'bg-sky-500 text-white hover:bg-sky-600'
                          : 'bg-marsala-600 text-white hover:bg-marsala-700'
                      }`}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Botão minimalista de alternar */}
          <button
            onClick={() => setLineViewMode(!lineViewMode)}
            className={`p-2 rounded-md transition-colors ${
              lineViewMode
                ? darkMode
                  ? 'bg-sky-500 text-white'
                  : 'bg-marsala-600 text-white'
                : darkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={lineViewMode ? 'Alternar para gráfico de barras' : 'Alternar para gráfico de linhas por loja/grupo'}
          >
            {lineViewMode ? (
              <BarChart3 className="w-4 h-4" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>


      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'revenue', label: 'Receita Direta' },
          { key: 'cogs', label: 'CMV' },
          { key: 'loans', label: 'Empréstimos' }
        ].map((metric) => (
          <button
            key={metric.key}
            onClick={() => setSelectedMetric(metric.key as any)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              selectedMetric === metric.key
                ? (darkMode ? 'bg-sky-500 text-white' : 'bg-marsala-600 text-white')
                : darkMode
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {(() => {
            // Check if line view mode is active and we have data
            if (lineViewMode && getLineViewData && getLineViewData.length > 0) {
              // Check if we have any data values (not just month keys)
              const firstDataPoint = getLineViewData[0] as any;
              const entityKeys = firstDataPoint ? Object.keys(firstDataPoint).filter(key => key !== 'month') : [];
              const hasDataValues = entityKeys.length > 0 && getLineViewData.some((r: any) => 
                entityKeys.some(k => (r[k] as number) > 0)
              );
              
              if (!hasDataValues) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      Nenhum dado encontrado para os filtros selecionados
                    </p>
                  </div>
                );
              }
              
              return (
                <LineChart data={getLineViewData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f0f0f0'} />
                  <XAxis 
                    dataKey="month" 
                    stroke={darkMode ? '#9ca3af' : '#6b7280'}
                    fontSize={12}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value)}
                    stroke={darkMode ? '#9ca3af' : '#6b7280'}
                    fontSize={12}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} p-4 border rounded-lg shadow-lg`}>
                            <p className={`text-sm font-medium mb-3 border-b pb-2 ${darkMode ? 'text-slate-100 border-slate-700' : 'text-gray-700 border-gray-200'}`}>{label}</p>
                            {payload.map((entry: any, index: number) => (
                              <p key={index} className="text-sm mb-1" style={{ color: entry.color }}>
                                {entry.name}: {formatCurrency(entry.value)}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  {entityKeys.map((entityName, index) => {
                    // Generate colors for each line
                    const colors = [
                      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
                      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                    ];
                    const color = colors[index % colors.length];
                    return (
                      <Line
                        key={entityName}
                        type="monotone"
                        dataKey={entityName}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ fill: color, strokeWidth: 2, r: 4 }}
                        name={entityName}
                      />
                    );
                  })}
                </LineChart>
              );
            }
            
            // Default: show bar chart
            const chartData = getMetricData();
            
            if (!chartData || chartData.length === 0) {
              return (
                <div className="flex items-center justify-center h-full">
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    Nenhum dado encontrado para os filtros selecionados
                  </p>
                </div>
              );
            }
            
            return (
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f0f0f0'} />
              <XAxis 
                dataKey="month" 
                stroke={darkMode ? '#9ca3af' : '#6b7280'}
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                tickFormatter={(value) => formatCurrency(value)}
                stroke={darkMode ? '#9ca3af' : '#6b7280'}
                fontSize={12}
              />
              {selectedMetric === 'loans' && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => `${value}%`}
                  stroke={darkMode ? '#9ca3af' : '#6b7280'}
                  fontSize={12}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              
              <Bar
                yAxisId="left"
                dataKey="current"
                fill={colors.current}
                name={`${getMetricTitle()} (Atual)`}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="previous"
                fill={colors.previous}
                name={`${getMetricTitle()} (Ano Anterior)`}
                radius={[2, 2, 0, 0]}
              />
              
              {selectedMetric === 'loans' && (
                <>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="debtRatioCurrent"
                    stroke="#722832"
                    strokeWidth={2}
                    dot={{ fill: '#722832', strokeWidth: 2, r: 4 }}
                    name="% Empréstimos/Receita (Atual)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="debtRatioPrevious"
                    stroke="#a1a1aa"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#a1a1aa', strokeWidth: 2, r: 4 }}
                    name="% Empréstimos/Receita (Anterior)"
                  />
                </>
              )}
            </ComposedChart>
            );
          })()}
        </ResponsiveContainer>
      </div>

      {!lineViewMode && (
        <div className={`mt-4 flex items-center justify-center space-x-6 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.current }}></div>
            <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Ano Atual</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.previous }}></div>
            <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Ano Anterior</span>
          </div>
          {selectedMetric === 'loans' && (
            <div className="flex items-center">
              <div className="w-3 h-3 bg-marsala-600 rounded-full mr-2"></div>
              <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>% Empréstimos/Receita</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
