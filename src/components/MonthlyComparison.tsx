import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, LineChart, Legend } from 'recharts';
import { Check, TrendingUp, Filter, ChevronDown } from 'lucide-react';

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
  // IMPORTANTE: Este componente NÃO respeita o filtro de período global da aplicação.
  // Ele usa apenas seus próprios filtros internos. Quando não houver seleção, usa os últimos 3 meses por padrão.
  // Period filter: defines which dates are included (independente do filtro global)
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
  const [lineViewMode] = useState(false); // false = barras, true = linhas por loja/grupo (desabilitado temporariamente)
  const [showLineChartTooltip, setShowLineChartTooltip] = useState(false);
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
        // Exemplo: Se estamos em janeiro (mês 0), deve incluir: Nov (mês 10), Dez (mês 11), Jan (mês 0)
        // Não deve incluir Out (mês 9)
        const monthsBack = 2; // 2 meses anteriores + mês atual = 3 meses
        const currentMonthIndex = now.getMonth(); // 0-11
        const targetMonthIndex = currentMonthIndex - monthsBack;
        
        if (targetMonthIndex < 0) {
          // Se o mês calculado é negativo, está no ano anterior
          // Exemplo: Janeiro (0) - 2 = -2, então novembro = -2 + 12 = 10
          startDate = new Date(now.getFullYear() - 1, targetMonthIndex + 12, 1);
        } else {
          startDate = new Date(now.getFullYear(), targetMonthIndex, 1);
        }
        break;
      case '6months':
        // Últimos 6 meses: inclui o mês atual e os 5 meses anteriores
        const monthsBack6 = 5; // 5 meses anteriores + mês atual = 6 meses
        const targetMonth6 = now.getMonth() - monthsBack6;
        if (targetMonth6 < 0) {
          startDate = new Date(now.getFullYear() - 1, targetMonth6 + 12, 1);
        } else {
          startDate = new Date(now.getFullYear(), targetMonth6, 1);
        }
        break;
      case '12months':
        // Últimos 12 meses: inclui o mês atual e os 11 meses anteriores
        const monthsBack12 = 11; // 11 meses anteriores + mês atual = 12 meses
        const targetMonth12 = now.getMonth() - monthsBack12;
        if (targetMonth12 < 0) {
          startDate = new Date(now.getFullYear() - 1, targetMonth12 + 12, 1);
        } else {
          startDate = new Date(now.getFullYear(), targetMonth12, 1);
        }
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
  // IMPORTANTE: Este filtro usa APENAS os filtros internos do componente (period, selectedGroups, selectedCompanies)
  // NÃO usa o filtro de período global da aplicação
  const filteredData = useMemo(() => {
    // First filter by date (period) - usa apenas o dateRange calculado internamente, não o filtro global
    const filterByDate = (item: any, dateField: string) => {
      if (!item[dateField]) return false;
      const itemDate = item[dateField];
      const isInRange = itemDate >= dateRange.start && itemDate <= dateRange.end;
      return isInRange;
    };
    

    // Filter CMV from accountsPayable by category "04.0DESPESAS COM MERCADORIA"
    const cmvFromAP = rawData.accountsPayable.filter(ap => {
      const chartOfAccounts = (ap.chart_of_accounts || '').toUpperCase();
      // Verificar se contém "04.0" seguido de "DESPESAS COM MERCADORIA" (aceita espaço e singular/plural)
      return chartOfAccounts.includes('04.0') && 
             chartOfAccounts.includes('DESPESAS COM MERCADORIA');
    });

    // Filter by date
    const dateFiltered = {
      revenues: rawData.revenues.filter(rev => filterByDate(rev, 'payment_date')),
      accountsPayable: rawData.accountsPayable.filter(ap => filterByDate(ap, 'payment_date')),
      forecastedEntries: rawData.forecastedEntries.filter(entry => filterByDate(entry, 'due_date')),
      transactions: rawData.transactions.filter(t => filterByDate(t, 'transaction_date')),
      cmvDRE: cmvFromAP.filter(cmv => filterByDate(cmv, 'payment_date')) // Usar payment_date ao invés de issue_date
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
    // IMPORTANT: We need to process ALL revenues, not just those in the date range, because we're comparing current year vs previous year
    // The date range filter is only for determining which months to show, but we need data from previous year months too
    const allRevenues = rawData.revenues.filter(rev => {
      // Filter by company/group if filters are active
      if (selectedGroups.length > 0 || selectedCompanies.length > 0) {
        const normalizedBU = normalizeCode(rev.business_unit);
        const filteredCompanyCodes = rawData.companies
          .filter(c => {
            const groupMatch = selectedGroups.length === 0 || selectedGroups.includes(c.group_name);
            const companyMatch = selectedCompanies.length === 0 || selectedCompanies.includes(c.company_name);
            return groupMatch && companyMatch;
          })
          .map(c => normalizeCode(c.company_code));
        return filteredCompanyCodes.includes(normalizedBU);
      }
      return true; // No filters = show all
    });


    // Log para identificar receitas de setembro
    const septemberRevenues: any[] = [];
    
    allRevenues.forEach(rev => {
      if (rev.payment_date) {
        // Extrair ano e mês diretamente da string para evitar problemas de timezone
        const dateStr = String(rev.payment_date);
        const dateParts = dateStr.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10); // Já vem como 1-12
        const monthKey = `${month}`.padStart(2, '0');
        const amount = rev.amount || 0;
        const status = rev.status?.toLowerCase();
        const isForecasted = status === 'previsto' || status === 'pendente';
        const isActual = status === 'realizado';

        // Criar date apenas para debug/logs
        const date = new Date(rev.payment_date);

        // Coletar dados de setembro
        if (month === 9) {
          septemberRevenues.push({
            payment_date: rev.payment_date,
            date_parsed: date.toISOString(),
            year: year,
            month: month,
            amount: amount,
            status: rev.status,
            business_unit: rev.business_unit,
            id: rev.id
          });
        }

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
    
    // Log das receitas de setembro
    if (septemberRevenues.length > 0) {
      console.log('🔍 DADOS DE SETEMBRO ENCONTRADOS (Receitas):', {
        total: septemberRevenues.length,
        dados: septemberRevenues,
        resumo: {
          anoAtual: septemberRevenues.filter(d => d.year === currentYear).length,
          anoAnterior: septemberRevenues.filter(d => d.year === previousYear).length,
          totalAnoAtual: septemberRevenues.filter(d => d.year === currentYear).reduce((sum, d) => sum + d.amount, 0),
          totalAnoAnterior: septemberRevenues.filter(d => d.year === previousYear).reduce((sum, d) => sum + d.amount, 0)
        }
      });
    }

    // Process revenues from forecasted entries (movimento em dinheiro) - Same as card logic
    // IMPORTANT: We need to process ALL forecasted entries, not just those in the date range
    const allForecastedEntries = rawData.forecastedEntries.filter(entry => {
      // Filter by company/group if filters are active
      if (selectedGroups.length > 0 || selectedCompanies.length > 0) {
        const normalizedBU = normalizeCode(entry.business_unit);
        const filteredCompanyCodes = rawData.companies
          .filter(c => {
            const groupMatch = selectedGroups.length === 0 || selectedGroups.includes(c.group_name);
            const companyMatch = selectedCompanies.length === 0 || selectedCompanies.includes(c.company_name);
            return groupMatch && companyMatch;
          })
          .map(c => normalizeCode(c.company_code));
        return filteredCompanyCodes.includes(normalizedBU);
      }
      return true; // No filters = show all
    });

    allForecastedEntries.forEach(entry => {
      if (entry.due_date && entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro')) {
        // Extrair ano e mês diretamente da string para evitar problemas de timezone
        const dateStr = String(entry.due_date);
        const dateParts = dateStr.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10); // Já vem como 1-12
        const monthKey = `${month}`.padStart(2, '0');
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

    // Process CMV - Same logic as card: from contas_a_pagar with category "04.0DESPESAS COM MERCADORIA"
    // IMPORTANT: We need to process ALL CMV data, not just those in the date range, because we're comparing current year vs previous year
    const allCMVFromAP = rawData.accountsPayable.filter(ap => {
      const chartOfAccounts = (ap.chart_of_accounts || '').toUpperCase();
      // Verificar se contém "04.0" seguido de "DESPESAS COM MERCADORIA" (aceita espaço e singular/plural)
      const isCMV = chartOfAccounts.includes('04.0') && 
                    chartOfAccounts.includes('DESPESAS COM MERCADORIA');
      
      if (!isCMV) return false;
      
      // Filter by company/group if filters are active
      if (selectedGroups.length > 0 || selectedCompanies.length > 0) {
        const normalizedBU = normalizeCode(ap.business_unit);
        const filteredCompanyCodes = rawData.companies
          .filter(c => {
            const groupMatch = selectedGroups.length === 0 || selectedGroups.includes(c.group_name);
            const companyMatch = selectedCompanies.length === 0 || selectedCompanies.includes(c.company_name);
            return groupMatch && companyMatch;
          })
          .map(c => normalizeCode(c.company_code));
        return filteredCompanyCodes.includes(normalizedBU);
      }
      return true; // No filters = show all
    });

    if (allCMVFromAP && allCMVFromAP.length > 0) {
      // Log para identificar dados de setembro
      const septemberData: any[] = [];
      const allCMVData: any[] = [];
      
      allCMVFromAP.forEach(cmv => {
        if (cmv.payment_date) {
          // Extrair ano e mês diretamente da string para evitar problemas de timezone
          // payment_date vem no formato "YYYY-MM-DD"
          const dateStr = String(cmv.payment_date);
          const dateParts = dateStr.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10); // Já vem como 1-12
          const monthKey = `${month}`.padStart(2, '0');
          const amount = Math.abs(cmv.amount || 0);
          
          // Criar date apenas para debug/logs
          const date = new Date(cmv.payment_date);

          // Coletar TODOS os dados para debug
          allCMVData.push({
            payment_date: cmv.payment_date,
            date_parsed: date.toISOString(),
            year: year,
            month: month,
            monthKey: monthKey,
            amount: amount,
            business_unit: cmv.business_unit,
            chart_of_accounts: cmv.chart_of_accounts,
            creditor: cmv.creditor,
            status: cmv.status,
            id: cmv.id
          });

          // Coletar dados de setembro especificamente
          if (month === 9) {
            septemberData.push({
              payment_date: cmv.payment_date,
              date_parsed: date.toISOString(),
              year: year,
              month: month,
              amount: amount,
              business_unit: cmv.business_unit,
              chart_of_accounts: cmv.chart_of_accounts,
              creditor: cmv.creditor,
              status: cmv.status,
              id: cmv.id,
              currentYear: currentYear,
              previousYear: previousYear,
              isCurrentYear: year === currentYear,
              isPreviousYear: year === previousYear
            });
          }

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
      
      // Log dos dados de setembro encontrados
      if (septemberData.length > 0) {
        console.log('🔍 DADOS DE SETEMBRO ENCONTRADOS (CMV de contas_a_pagar):', {
          total: septemberData.length,
          dados: septemberData,
          resumo: {
            anoAtual: septemberData.filter(d => d.year === currentYear).length,
            anoAnterior: septemberData.filter(d => d.year === previousYear).length,
            totalAnoAtual: septemberData.filter(d => d.year === currentYear).reduce((sum, d) => sum + d.amount, 0),
            totalAnoAnterior: septemberData.filter(d => d.year === previousYear).reduce((sum, d) => sum + d.amount, 0)
          },
          currentYear: currentYear,
          previousYear: previousYear
        });
      }
      
      // Log geral de todos os dados CMV processados (útil para debug)
      console.log('📊 TODOS OS DADOS CMV PROCESSADOS:', {
        total: allCMVData.length,
        porMes: allCMVData.reduce((acc, d) => {
          const key = `${d.year}-${d.monthKey}`;
          if (!acc[key]) acc[key] = { count: 0, total: 0 };
          acc[key].count++;
          acc[key].total += d.amount;
          return acc;
        }, {} as any),
        setembro: septemberData.length > 0 ? septemberData : 'Nenhum dado de setembro encontrado'
      });
    }

    // Process Loans (Empréstimos) - Same logic as Total de Pagamentos card
    // Only from accounts_payable table, where creditor contains "empréstimo" OR chart_of_accounts contains loan-related accounts
    // IMPORTANT: We need to process ALL accounts payable, not just those in the date range, because we're comparing current year vs previous year
    const allAccountsPayable = rawData.accountsPayable.filter(ap => {
      // Filter by company/group if filters are active
      if (selectedGroups.length > 0 || selectedCompanies.length > 0) {
        const normalizedBU = normalizeCode(ap.business_unit);
        const filteredCompanyCodes = rawData.companies
          .filter(c => {
            const groupMatch = selectedGroups.length === 0 || selectedGroups.includes(c.group_name);
            const companyMatch = selectedCompanies.length === 0 || selectedCompanies.includes(c.company_name);
            return groupMatch && companyMatch;
          })
          .map(c => normalizeCode(c.company_code));
        return filteredCompanyCodes.includes(normalizedBU);
      }
      return true; // No filters = show all
    });

    allAccountsPayable.forEach(ap => {
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
          // Extrair ano e mês diretamente da string para evitar problemas de timezone
          const dateStr = String(ap.payment_date);
          const dateParts = dateStr.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10); // Já vem como 1-12
          const monthKey = `${month}`.padStart(2, '0');
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
    
    // For fixed periods (3, 6, 12 months), calculate exactly the number of months
    // instead of using date range iteration to avoid including extra months
    if (period === '3months' || period === '6months' || period === '12months') {
      const now = new Date();
      const currentMonthIndex = now.getMonth(); // 0-11
      const currentYear = now.getFullYear();
      
      // Determine how many months back to go
      let monthsBack: number;
      if (period === '3months') {
        monthsBack = 2; // 2 months back + current = 3 months
      } else if (period === '6months') {
        monthsBack = 5; // 5 months back + current = 6 months
      } else { // 12months
        monthsBack = 11; // 11 months back + current = 12 months
      }
      
      // Include exactly the specified number of months
      for (let i = monthsBack; i >= 0; i--) {
        const monthIndex = currentMonthIndex - i;
        let month: number;
        let year: number;
        
        if (monthIndex < 0) {
          // Month is in previous year
          month = monthIndex + 12 + 1; // +1 because we need 1-12, not 0-11
          year = currentYear - 1;
        } else {
          month = monthIndex + 1; // +1 because we need 1-12, not 0-11
          year = currentYear;
        }
        
        // Only include if not in the future
        if (year < currentYear || (year === currentYear && month <= currentMonth)) {
          monthsToInclude.push({ month, year });
        }
      }
    } else {
      // For other periods, use date range iteration
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
    }


    // Log dos meses que serão incluídos
    console.log('📅 MESES QUE SERÃO INCLUÍDOS NO GRÁFICO:', {
      monthsToInclude: monthsToInclude,
      period: period,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end
      },
      currentYear: currentYear,
      currentMonth: currentMonth,
      setembroIncluido: monthsToInclude.some(m => m.month === 9)
    });

    // Process each month in the range
    monthsToInclude.forEach(({ month }) => {
      const monthKey = `${month}`.padStart(2, '0');
      
      // Get data for current year (same month)
      const currentData = monthlyDataCurrent[monthKey] || initMonthData();
      // Get data for previous year (same month)
      const previousData = monthlyDataPrevious[monthKey] || initMonthData();
      
      // Log específico para setembro
      if (month === 9) {
        console.log('🔍 PROCESSANDO SETEMBRO:', {
          monthKey: monthKey,
          currentData: {
            revenues: currentData.revenues,
            cmv: currentData.cmv,
            loans: currentData.loans,
            revenuesByUnit: currentData.revenuesByUnit,
            cmvByUnit: currentData.cmvByUnit
          },
          previousData: {
            revenues: previousData.revenues,
            cmv: previousData.cmv,
            loans: previousData.loans,
            revenuesByUnit: previousData.revenuesByUnit,
            cmvByUnit: previousData.cmvByUnit
          }
        });
      }

      const currentDebtRatio = currentData.revenues > 0 ? (currentData.loans / currentData.revenues) * 100 : 0;
      const previousDebtRatio = previousData.revenues > 0 ? (previousData.loans / previousData.revenues) * 100 : 0;

      // Debug: Log data for October to understand the issue
      if (month === 10 && monthNames[month - 1] === 'Out') {
        const octRevenues = allRevenues.filter(rev => {
          if (!rev.payment_date) return false;
          const date = new Date(rev.payment_date);
          return date.getFullYear() === previousYear && date.getMonth() === 9;
        });
        console.log(`🔍 Debug Outubro ${monthNames[month - 1]}:`, {
          month,
          currentYear,
          previousYear,
          allRevenuesTotal: allRevenues.length,
          octRevenuesCount: octRevenues.length,
          octRevenuesActual: octRevenues.filter(r => r.status?.toLowerCase() === 'realizado').length,
          octRevenuesSample: octRevenues.slice(0, 3).map(r => ({
            date: r.payment_date,
            status: r.status,
            amount: r.amount,
            business_unit: r.business_unit
          })),
          currentData: {
            revenues: currentData.revenues,
            revenuesActual: currentData.revenuesActual,
            cmv: currentData.cmv,
            revenuesByUnit: currentData.revenuesByUnit,
            cmvByUnit: currentData.cmvByUnit
          },
          previousData: {
            revenues: previousData.revenues,
            revenuesActual: previousData.revenuesActual,
            cmv: previousData.cmv,
            revenuesByUnit: previousData.revenuesByUnit,
            cmvByUnit: previousData.cmvByUnit
          }
        });
      }

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

    // Log final resumindo todos os dados de setembro
    const septemberInResult = result.find(r => r.month === 'Set');
    if (septemberInResult) {
      console.log('📊 RESUMO FINAL - SETEMBRO NO RESULTADO:', {
        month: 'Set',
        currentYear: {
          revenue: septemberInResult.currentYear.revenue,
          cmv: septemberInResult.currentYear.cogs,
          loans: septemberInResult.currentYear.loans
        },
        previousYear: {
          revenue: septemberInResult.previousYear.revenue,
          cmv: septemberInResult.previousYear.cogs,
          loans: septemberInResult.previousYear.loans
        },
        temDadosAnoAtual: septemberInResult.currentYear.revenue > 0 || 
                          septemberInResult.currentYear.cogs > 0 || 
                          septemberInResult.currentYear.loans > 0,
        temDadosAnoAnterior: septemberInResult.previousYear.revenue > 0 || 
                             septemberInResult.previousYear.cogs > 0 || 
                             septemberInResult.previousYear.loans > 0
      });
    } else {
      console.log('✅ Setembro NÃO está no resultado final do gráfico');
    }

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

      // Determine which months to include based on period selection (same logic as data processing)
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      // Calculate months to include
      const monthsToInclude: Array<{ month: number; year: number }> = [];
      let currentIterDate = new Date(startDate);
      currentIterDate.setDate(1);
      currentIterDate.setHours(0, 0, 0, 0);
      const endDateForIter = new Date(endDate);
      endDateForIter.setDate(1);
      endDateForIter.setHours(0, 0, 0, 0);
      
      if (period === '3months' || period === '6months' || period === '12months') {
        const monthsBack = period === '3months' ? 2 : period === '6months' ? 5 : 11;
        const currentMonthIndex = now.getMonth();
        
        for (let i = monthsBack; i >= 0; i--) {
          const monthIndex = currentMonthIndex - i;
          let month: number;
          let year: number;
          
          if (monthIndex < 0) {
            month = monthIndex + 12 + 1;
            year = currentYear - 1;
          } else {
            month = monthIndex + 1;
            year = currentYear;
          }
          
          if (year < currentYear || (year === currentYear && month <= currentMonth)) {
            monthsToInclude.push({ month, year });
          }
        }
      } else {
        const endDateInclusive = new Date(endDateForIter);
        endDateInclusive.setMonth(endDateInclusive.getMonth() + 1);
        
        while (currentIterDate < endDateInclusive) {
          const month = currentIterDate.getMonth() + 1;
          const year = currentIterDate.getFullYear();
          
          if (year < currentYear || (year === currentYear && month <= currentMonth)) {
            monthsToInclude.push({ month, year });
          }
          
          currentIterDate.setMonth(currentIterDate.getMonth() + 1);
        }
      }

      // Initialize months based on period
      monthsToInclude.forEach(({ month }) => {
        const monthKey = monthNames[month - 1];
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {};
          entities.forEach(entity => {
            monthlyData[monthKey][entity.name] = 0;
          });
        }
      });

      // Process revenues - Same logic as card (previsto/pendente + forecasted entries for forecasted, realizado for actual)
      // Use rawData to get all data, then filter by date range and entities manually
      if (selectedMetric === 'revenue') {
        // Process actual revenues (realizado) - same as card's "Realizado"
        rawData.revenues.forEach(rev => {
          if (rev.payment_date && rev.status?.toLowerCase() === 'realizado') {
            // Filter by date range
            const revDate = rev.payment_date;
            if (revDate < dateRange.start || revDate > dateRange.end) return;
            
            // Extrair ano e mês diretamente da string para evitar problemas de timezone
            const dateStr = String(rev.payment_date);
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Converter para 0-11 para usar com monthNames
            if (year === currentYear) {
              const monthKey = monthNames[month];
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
        rawData.forecastedEntries.forEach(entry => {
          if (entry.due_date && entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro')) {
            // Filter by date range
            const entryDate = entry.due_date;
            if (entryDate < dateRange.start || entryDate > dateRange.end) return;
            
            // Extrair ano e mês diretamente da string para evitar problemas de timezone
            const dateStr = String(entry.due_date);
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Converter para 0-11 para usar com monthNames
            if (year === currentYear) {
              const monthKey = monthNames[month];
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

      // Process CMV - Same logic as card: from contas_a_pagar with category "04.0DESPESAS COM MERCADORIA"
      if (selectedMetric === 'cogs') {
        const cmvFromAP = rawData.accountsPayable.filter(ap => {
          const chartOfAccounts = (ap.chart_of_accounts || '').toUpperCase();
          // Verificar se contém "04.0" seguido de "DESPESAS COM MERCADORIA" (aceita espaço e singular/plural)
          return chartOfAccounts.includes('04.0') && 
                 chartOfAccounts.includes('DESPESAS COM MERCADORIA');
        });
        
        if (cmvFromAP && cmvFromAP.length > 0) {
          cmvFromAP.forEach(cmv => {
            if (cmv.payment_date) {
              // Filter by date range
              const cmvDate = cmv.payment_date;
              if (cmvDate < dateRange.start || cmvDate > dateRange.end) return;
              
              // Extrair ano e mês diretamente da string para evitar problemas de timezone
              const dateStr = String(cmv.payment_date);
              const dateParts = dateStr.split('-');
              const year = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10) - 1; // Converter para 0-11 para usar com monthNames
              if (year === currentYear) {
                const monthKey = monthNames[month];
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
        rawData.accountsPayable.forEach(ap => {
          if (ap.payment_date && ap.status?.toLowerCase() === 'realizado') {
            // Filter by date range
            const apDate = ap.payment_date;
            if (apDate < dateRange.start || apDate > dateRange.end) return;
            
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

      // Convert to array format for chart - include all months in the period (even if empty)
      // This ensures consistent chart rendering with all months visible
      const result = Object.keys(monthlyData)
        .sort((a, b) => {
          // Sort by month order (Jan, Fev, Mar, etc.)
          const monthOrder = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          return monthOrder.indexOf(a) - monthOrder.indexOf(b);
        })
        .map(month => ({
          month,
          ...monthlyData[month]
        }));

      // Return all months in the period (even if some have zero values)
      return result;
    };
  }, [rawData, rawData.companies, rawData.cmvChartOfAccounts, selectedMetric, period, dateRange, normalizeCode]);

  const getLineViewData = useMemo(() => {
    if (!lineViewMode) return null;

    // Determine if we should group by companies or groups
    const groupByCompanies = selectedCompanies.length > 0;
    const groupByGroups = selectedGroups.length > 0 && selectedCompanies.length === 0;

    let entities: Array<{ name: string; code: string; type: 'company' | 'group' }> = [];

    if (groupByCompanies) {
      // Group by selected companies
      entities = selectedCompanies.map(companyName => {
        const company = rawData.companies.find(c => c.company_name === companyName);
        return {
          name: companyName,
          code: company?.company_code || '',
          type: 'company' as const
        };
      });
    } else if (groupByGroups) {
      // Group by selected groups
      entities = selectedGroups.map(groupName => ({
        name: groupName,
        code: '',
        type: 'group' as const
      }));
    } else {
      // If no filters, show all companies (limit to first 10 to avoid clutter)
      if (rawData.companies.length > 0) {
        const allCompanies = rawData.companies.slice(0, 10);
        entities = allCompanies.map(c => ({
          name: c.company_name,
          code: c.company_code,
          type: 'company' as const
        }));
      }
    }

    // Always return an array (even if empty) when in line view mode
    if (entities.length === 0) {
      return [];
    }

    const result = processLineData(entities);
    return result || [];
  }, [lineViewMode, selectedCompanies, selectedGroups, rawData.companies, processLineData]);

  const getMetricData = () => {
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
            // Extrair ano diretamente da string para evitar problemas de timezone
            const dateStr = String(rev.payment_date);
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0], 10);
            const dateKey = rev.payment_date;
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
            // Extrair ano diretamente da string para evitar problemas de timezone
            const dateStr = String(entry.due_date);
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0], 10);
            const dateKey = entry.due_date;
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
      
      // Process CMV - from contas_a_pagar with category "04.0DESPESAS COM MERCADORIA"
      if (selectedMetric === 'cogs') {
        const cmvFromAP = filteredData.accountsPayable.filter(ap => {
          const chartOfAccounts = (ap.chart_of_accounts || '').toUpperCase();
          // Verificar se contém "04.0" seguido de "DESPESAS COM MERCADORIA" (aceita espaço e singular/plural)
          return chartOfAccounts.includes('04.0') && 
                 chartOfAccounts.includes('DESPESAS COM MERCADORIA');
        });
        
        cmvFromAP.forEach(cmv => {
          if (cmv.payment_date) {
            // Extrair ano diretamente da string para evitar problemas de timezone
            const dateStr = String(cmv.payment_date);
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0], 10);
            const dateKey = cmv.payment_date;
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
              // Extrair ano diretamente da string para evitar problemas de timezone
              const dateStr = String(ap.payment_date);
              const dateParts = dateStr.split('-');
              const year = parseInt(dateParts[0], 10);
              const dateKey = ap.payment_date;
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

            // Calculate CMV percentage for total - same logic as card
            // Card uses: (cmvTotals.actual / totalRevenueActual) * 100
            // Where totalRevenueActual = revenueTotals.actual 
            // revenueTotals.actual = sum of revenues with status 'realizado' (same as revenueActual in our data)
            // So we use revenueActual (not revenue which includes forecasted)
            const revenueForYear = originalData?.[year]?.revenueActual ?? 0;
            const cmvForYear = originalData?.[year]?.cogs ?? 0;
            const cmvPercentage = revenueForYear > 0 ? (cmvForYear / revenueForYear) * 100 : 0;

            return (
              <div key={index} className="mb-3">
                <p className="text-sm font-medium mb-1" style={{ color: entry.color }}>
                  {yearLabel}: {formatCurrency(entry.value)}
                </p>

                {/* Show CMV percentage for total when CMV is selected */}
                {selectedMetric === 'cogs' && (
                  <p className={`text-xs ml-3 mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    % CMV/Receita: {cmvPercentage.toFixed(1)}%
                  </p>
                )}

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
                    {Object.entries(originalData[year].cmvByUnit).map(([unit, cmvValue]: [string, any]) => {
                      // Calculate CMV percentage for each store - same logic as total
                      // revenuesByUnit contains actual revenue (status 'realizado') for each unit
                      // But if it's empty, we need to check if there's revenue data for this unit
                      // For CMV calculation, we need the actual revenue for this specific unit
                      const storeRevenue = originalData[year]?.revenuesByUnit?.[unit] || 0;
                      const storeCmvPercentage = storeRevenue > 0 ? (cmvValue / storeRevenue) * 100 : 0;
                      
                      return (
                        <p key={unit} className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                          {unit}: {formatCurrency(cmvValue)} 
                          <span className={`ml-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                            ({storeCmvPercentage.toFixed(1)}%)
                          </span>
                        </p>
                      );
                    })}
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
          <div className="relative">
            <button
              onMouseEnter={() => setShowLineChartTooltip(true)}
              onMouseLeave={() => setShowLineChartTooltip(false)}
              className={`p-2 rounded-md transition-colors ${
                darkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            
            {/* Tooltip flutuante */}
            {showLineChartTooltip && (
              <div 
                className={`absolute right-0 top-full mt-1 w-56 p-4 rounded-lg shadow-lg border z-50 ${
                  darkMode 
                    ? 'bg-slate-900 border-slate-700' 
                    : 'bg-white border-gray-200'
                }`}
                style={{ 
                  pointerEvents: 'none',
                  transform: 'translateX(calc(-100% + 36px))'
                }}
              >
                <h3 className={`text-sm font-semibold mb-2 ${
                  darkMode ? 'text-slate-100' : 'text-gray-800'
                }`}>
                  Em Desenvolvimento
                </h3>
                <div className={`h-px mb-3 ${
                  darkMode ? 'bg-slate-700' : 'bg-gray-200'
                }`}></div>
                <p className={`text-xs leading-relaxed ${
                  darkMode ? 'text-slate-300' : 'text-gray-600'
                }`}>
                  O gráfico de linhas por loja estará disponível em breve
                </p>
              </div>
            )}
          </div>
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
            // Check if line view mode is active
            if (lineViewMode) {
              // Check if we have line view data
              if (!getLineViewData || getLineViewData.length === 0) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      Nenhum dado encontrado para os filtros selecionados
                    </p>
                  </div>
                );
              }
              
              // Check if we have any data values (not just month keys)
              const firstDataPoint = getLineViewData[0] as any;
              const entityKeys = firstDataPoint ? Object.keys(firstDataPoint).filter(key => key !== 'month') : [];
              
              if (entityKeys.length === 0) {
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
                    const lineColors = [
                      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
                      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                    ];
                    const color = lineColors[index % lineColors.length];
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
