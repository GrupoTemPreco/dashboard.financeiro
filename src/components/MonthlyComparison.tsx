import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, LineChart, Legend } from 'recharts';
import { Check, TrendingUp, Filter, ChevronDown } from 'lucide-react';
import { DataSourceNote } from './DataSourceNote';

interface MonthlyData {
  month: string;
  monthLabel: string; // ex: "Abr/25", "Mai/24"
  yearContext?: { currentYear: number; previousYear: number }; // ano do slot vs ano anterior (contextual)
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
  vendasPorUsuario: any[];
  accountsPayable: any[];
  companies: any[];
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
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState(false);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null); // 'period' | 'grouping' | null
  const [lineViewMode] = useState(false); // false = barras, true = linhas por loja/grupo (desabilitado temporariamente)
  const [showLineChartTooltip, setShowLineChartTooltip] = useState(false);
  const filtersDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

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

    // Usar componentes locais para evitar problemas de timezone (toISOString usa UTC)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(startDate), end: fmt(endDate) };
  }, [period, customStartDate, customEndDate]);

  // Filter data based on period (filtro de grupos removido)
  const filterByDate = (item: any, dateField: string) => {
    if (!item[dateField]) return false;
    const itemDate = String(item[dateField]).split('T')[0];
    return itemDate >= dateRange.start && itemDate <= dateRange.end;
  };

  const filteredData = useMemo(() => ({
    vendasPorUsuario: (rawData.vendasPorUsuario || []).filter(v => filterByDate(v, 'data')),
    accountsPayable: (rawData.accountsPayable || []).filter(ap => filterByDate(ap, 'payment_date'))
  }), [rawData.vendasPorUsuario, rawData.accountsPayable, dateRange]);

  // Process data into monthly format - por ano-mês (YYYY-MM) para comparação contextual
  const data = useMemo(() => {
    const monthlyDataByYearMonth: { [key: string]: {
      revenues: number,
      revenuesForecasted: number,
      revenuesActual: number,
      cmv: number,
      loans: number,
      revenuesByUnit: { [unit: string]: number },
      cmvByUnit: { [unit: string]: number }
    } } = {};

    const getKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

    const initMonthData = () => ({
      revenues: 0,
      revenuesForecasted: 0,
      revenuesActual: 0,
      cmv: 0,
      loans: 0,
      revenuesByUnit: {},
      cmvByUnit: {}
    });

    // Mesma lógica dos cards: toDateStr = String(d).split('T')[0] para consistência
    const toDateStr = (d: any) => (d == null ? '' : String(d).split('T')[0]);
    const num = (v: any) => Number(v) || 0;

    // Process revenues (Receita Direta) - vendas_por_usuario (amount) - acumula por ano-mês
    const allVendas = rawData.vendasPorUsuario || [];
    allVendas.forEach(v => {
      const dateStr = toDateStr(v.data);
      if (!dateStr || dateStr.length < 10) return;
      const dateParts = dateStr.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return;
      const key = getKey(year, month);
      const amount = num(v.amount);
      const normalizedBU = normalizeCode(v.business_unit);
      const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
      const unit = company ? `${company.company_code} - ${company.company_name}` : 'Não classificado';

      if (!monthlyDataByYearMonth[key]) monthlyDataByYearMonth[key] = initMonthData();
      monthlyDataByYearMonth[key].revenues += amount;
      monthlyDataByYearMonth[key].revenuesActual += amount;
      monthlyDataByYearMonth[key].revenuesByUnit[unit] = (monthlyDataByYearMonth[key].revenuesByUnit[unit] || 0) + amount;
    });

    // Process CMV - vendas_por_usuario (custo) - acumula por ano-mês
    allVendas.forEach(v => {
      const dateStr = toDateStr(v.data);
      if (!dateStr || dateStr.length < 10) return;
      const dateParts = dateStr.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return;
      const key = getKey(year, month);
      const amount = num(v.custo);
      const normalizedBU = normalizeCode(v.business_unit);
      const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
      const unit = company ? `${company.company_code} - ${company.company_name}` : 'Não classificado';

      if (!monthlyDataByYearMonth[key]) monthlyDataByYearMonth[key] = initMonthData();
      monthlyDataByYearMonth[key].cmv += amount;
      monthlyDataByYearMonth[key].cmvByUnit[unit] = (monthlyDataByYearMonth[key].cmvByUnit[unit] || 0) + amount;
    });

    // Process Loans (Empréstimos) - contas_a_pagar
    const allAccountsPayable = rawData.accountsPayable || [];
    allAccountsPayable.forEach(ap => {
      if (ap.payment_date && ap.status?.toLowerCase() === 'realizado') {
        // Check if creditor name contains "empréstimo" (case insensitive)
        const credorVal = ap.creditor ?? ap.credor;
        const creditorIsLoan = credorVal && (
          String(credorVal).toLowerCase().includes('empréstimo') ||
          String(credorVal).toLowerCase().includes('emprestimo')
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
          const dateStr = String(ap.payment_date);
          const dateParts = dateStr.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10);
          const key = getKey(year, month);
          const amount = Math.abs(ap.amount || 0);

          if (!monthlyDataByYearMonth[key]) monthlyDataByYearMonth[key] = initMonthData();
          monthlyDataByYearMonth[key].loans += amount;
        }
      }
    });

    // Convert to array format - include all months in the selected period
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const result: MonthlyData[] = [];

    // Parse dates as local to evitar timezone (new Date('YYYY-MM-DD') interpreta como UTC)
    const parseLocal = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const startDate = parseLocal(dateRange.start);
    const endDate = parseLocal(dateRange.end);

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
      const currentMonth = currentMonthIndex + 1; // 1-12
      
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
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
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


    // Process each month in the range - comparação contextual: ano do slot vs ano anterior
    monthsToInclude.forEach(({ month, year }) => {
      const currentKey = getKey(year, month);
      const previousKey = getKey(year - 1, month);

      // Dados do ano do mês (ex: Jan/25 → 2025)
      const currentData = monthlyDataByYearMonth[currentKey] || initMonthData();
      // Dados do ano anterior ao mês (ex: Jan/25 → 2024)
      const previousData = monthlyDataByYearMonth[previousKey] || initMonthData();

      const currentDebtRatio = currentData.revenues > 0 ? (currentData.loans / currentData.revenues) * 100 : 0;
      const previousDebtRatio = previousData.revenues > 0 ? (previousData.loans / previousData.revenues) * 100 : 0;

      const yearShort = String(year).slice(-2);
      const monthLabel = `${monthNames[month - 1]}/${yearShort}`;

      result.push({
        month: monthNames[month - 1],
        monthLabel,
        yearContext: { currentYear: year, previousYear: year - 1 },
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
  }, [filteredData, rawData.companies, dateRange]);

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
      const year = String(date.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
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

      // Process revenues - vendas_por_usuario (mesma fonte dos cards)
      if (selectedMetric === 'revenue') {
        const allVendas = rawData.vendasPorUsuario || [];
        allVendas.forEach((v: { data?: string; amount?: number; business_unit?: string }) => {
          const dateStr = v.data ? String(v.data).split('T')[0] : '';
          if (!dateStr || dateStr.length < 10) return;
          const revDate = dateStr;
          if (revDate < dateRange.start || revDate > dateRange.end) return;
          const dateParts = dateStr.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          if (year === currentYear) {
            const monthKey = monthNames[month];
            const normalizedBU = normalizeCode(v.business_unit);
            let entityName: string | undefined;
            if (entities.some(e => e.type === 'company')) {
              const matchingEntity = entities.find(e => {
                if (e.type !== 'company') return false;
                return normalizeCode(e.code) === normalizedBU;
              });
              entityName = matchingEntity?.name;
              if (!entityName) {
                const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
                const matchingByName = entities.find(e => e.type === 'company' && e.name === company?.company_name);
                entityName = matchingByName?.name;
              }
            } else if (entities.some(e => e.type === 'group')) {
              const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
              const matchingEntity = entities.find(e => e.type === 'group' && e.name === company?.group_name);
              entityName = matchingEntity?.name;
            }
            if (entityName && monthlyData[monthKey]) {
              monthlyData[monthKey][entityName] = (monthlyData[monthKey][entityName] || 0) + (Number(v.amount) || 0);
            }
          }
        });
      }

      // Process CMV - vendas_por_usuario (custo) - mesma fonte dos cards
      if (selectedMetric === 'cogs') {
        const allVendas = rawData.vendasPorUsuario || [];
        allVendas.forEach((v: { data?: string; custo?: number; business_unit?: string }) => {
          const dateStr = v.data ? String(v.data).split('T')[0] : '';
          if (!dateStr || dateStr.length < 10) return;
          if (dateStr < dateRange.start || dateStr > dateRange.end) return;
          const dateParts = dateStr.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          if (year === currentYear) {
            const monthKey = monthNames[month];
            const normalizedBU = normalizeCode(v.business_unit);
            let entityName: string | undefined;
            if (entities.some(e => e.type === 'company')) {
              const matchingEntity = entities.find(e => e.type === 'company' && normalizeCode(e.code) === normalizedBU);
              entityName = matchingEntity?.name;
              if (!entityName) {
                const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
                const matchingByName = entities.find(e => e.type === 'company' && e.name === company?.company_name);
                entityName = matchingByName?.name;
              }
            } else if (entities.some(e => e.type === 'group')) {
              const company = rawData.companies.find(c => normalizeCode(c.company_code) === normalizedBU);
              const matchingEntity = entities.find(e => e.type === 'group' && e.name === company?.group_name);
              entityName = matchingEntity?.name;
            }
            if (entityName && monthlyData[monthKey]) {
              monthlyData[monthKey][entityName] = (monthlyData[monthKey][entityName] || 0) + Math.abs(Number(v.custo) || 0);
            }
          }
        });
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
            const credorVal = ap.creditor ?? ap.credor;
            const creditorIsLoan = credorVal && (
              String(credorVal).toLowerCase().includes('empréstimo') ||
              String(credorVal).toLowerCase().includes('emprestimo') ||
              String(credorVal).toLowerCase().includes('emprest')
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
  }, [rawData, rawData.companies, selectedMetric, period, dateRange, normalizeCode]);

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
      const weeklyData: Array<{ month: string; current: number; previous: number; debtRatioCurrent: number; debtRatioPrevious: number; variationYoY?: number; variationMoM?: number; originalData: any }> = [];
      
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
        const variationYoY = (selectedMetric === 'revenue' || selectedMetric === 'cogs')
          ? (previousWeekValue > 0
            ? ((weekValue - previousWeekValue) / previousWeekValue) * 100
            : weekValue > 0 ? 100 : 0)
          : undefined;
        
        for (let w = 1; w <= weeksInMonth; w++) {
          const { start, end } = getWeekDates(monthName, w);
          const weekLabel = formatWeekLabel(start, end);
          
          weeklyData.push({
            month: weekLabel,
            current: weekValue,
            previous: previousWeekValue,
            debtRatioCurrent: item.currentYear.debtRatio,
            debtRatioPrevious: item.previousYear.debtRatio,
            variationYoY,
            variationMoM: undefined,
            originalData: item
          });
        }
      });
      // variationMoM: compara com período anterior no range
      weeklyData.forEach((row, i) => {
        if ((selectedMetric === 'revenue' || selectedMetric === 'cogs') && i > 0) {
          const prev = weeklyData[i - 1].current;
          row.variationMoM = prev > 0 ? ((row.current - prev) / prev) * 100 : undefined;
        } else if ((selectedMetric === 'revenue' || selectedMetric === 'cogs') && i === 0 && row.current > 0) {
          row.variationMoM = 100;
        }
      });
      
      return weeklyData;
    }

    if (grouping === 'day') {
      // Group by day - need to process raw filtered data by day
      const dailyData: Array<{ month: string; current: number; previous: number; debtRatioCurrent: number; debtRatioPrevious: number; variationYoY?: number; variationMoM?: number; originalData: any }> = [];
      
      // Get all unique dates in the filtered data
      const dateMap = new Map<string, { current: number; previous: number }>();
      
      // Process revenues - vendas_por_usuario (amount, data)
      if (selectedMetric === 'revenue') {
        filteredData.vendasPorUsuario.forEach(v => {
          if (v.data) {
            const dateStr = String(v.data).split('T')[0];
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0], 10);
            const dateKey = dateStr;
            const isCurrentYear = year === new Date().getFullYear();
            
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, { current: 0, previous: 0 });
            }
            const dayData = dateMap.get(dateKey)!;
            const amount = Number(v.amount) || 0;
            if (isCurrentYear) {
              dayData.current += amount;
            } else {
              dayData.previous += amount;
            }
          }
        });
      }
      
      // Process CMV - vendas_por_usuario (custo, data)
      if (selectedMetric === 'cogs') {
        filteredData.vendasPorUsuario.forEach(v => {
          if (v.data) {
            const dateStr = String(v.data).split('T')[0];
            const dateParts = dateStr.split('-');
            const year = parseInt(dateParts[0], 10);
            const dateKey = dateStr;
            const isCurrentYear = year === new Date().getFullYear();
            
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, { current: 0, previous: 0 });
            }
            const dayData = dateMap.get(dateKey)!;
            const custo = Math.abs(Number(v.custo) || 0);
            if (isCurrentYear) {
              dayData.current += custo;
            } else {
              dayData.previous += custo;
            }
          }
        });
      }
      
      // Process Loans
      if (selectedMetric === 'loans') {
        filteredData.accountsPayable.forEach(ap => {
          if (ap.payment_date && ap.status?.toLowerCase() === 'realizado') {
            // Check if creditor name contains "empréstimo" or "emprestimo" anywhere in the string (case insensitive)
            const credorVal = ap.creditor ?? ap.credor;
            const creditorIsLoan = credorVal && (
              String(credorVal).toLowerCase().includes('empréstimo') ||
              String(credorVal).toLowerCase().includes('emprestimo') ||
              String(credorVal).toLowerCase().includes('emprest')
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
        const yearShort = String(date.getFullYear()).slice(-2);
        const dayLabel = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${yearShort}`;
        const variationYoY = (selectedMetric === 'revenue' || selectedMetric === 'cogs')
          ? (values.previous > 0
            ? ((values.current - values.previous) / values.previous) * 100
            : values.current > 0 ? 100 : 0)
          : undefined;
        
        dailyData.push({
          month: dayLabel,
          current: values.current,
          previous: values.previous,
          debtRatioCurrent: 0,
          debtRatioPrevious: 0,
          variationYoY,
          variationMoM: undefined,
          originalData: null
        });
      });
      dailyData.forEach((row, i) => {
        if ((selectedMetric === 'revenue' || selectedMetric === 'cogs') && i > 0) {
          const prev = dailyData[i - 1].current;
          row.variationMoM = prev > 0 ? ((row.current - prev) / prev) * 100 : undefined;
        } else if ((selectedMetric === 'revenue' || selectedMetric === 'cogs') && i === 0 && row.current > 0) {
          row.variationMoM = 100;
        }
      });
      
      return dailyData;
    }

    // Default: monthly grouping
    return data.map((item, i) => {
      const current = getMetricValue(item, 'currentYear');
      const previous = getMetricValue(item, 'previousYear');
      // Variação ano a ano (período vs ano anterior)
      const variationYoY = (selectedMetric === 'revenue' || selectedMetric === 'cogs')
        ? (previous > 0
          ? ((current - previous) / previous) * 100
          : current > 0 ? 100 : 0)
        : undefined;
      // Variação mês a mês (períodos filtrados - compara com mês anterior no range)
      const prevInRange = i > 0 ? getMetricValue(data[i - 1], 'currentYear') : 0;
      const variationMoM = (selectedMetric === 'revenue' || selectedMetric === 'cogs')
        ? (prevInRange > 0
          ? ((current - prevInRange) / prevInRange) * 100
          : i === 0 && current > 0 ? 100 : undefined)
        : undefined;
      return {
        month: item.monthLabel,
        current,
        previous,
        debtRatioCurrent: item.currentYear.debtRatio,
        debtRatioPrevious: item.previousYear.debtRatio,
        variationYoY,
        variationMoM,
        originalData: item
      };
    });
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
      const ctx = originalData?.yearContext;
      const currentYearNum = ctx?.currentYear ?? new Date().getFullYear();
      const previousYearNum = ctx?.previousYear ?? currentYearNum - 1;

      // Excluir entradas das linhas (mesmo dado das barras) para evitar duplicação
      const payloadFiltered = payload.filter((entry: any) => !entry.name?.includes('(linha)'));

      return (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} p-4 border rounded-lg shadow-lg max-w-sm`}>
          <p className={`text-sm font-medium mb-3 border-b pb-2 ${darkMode ? 'text-slate-100 border-slate-700' : 'text-gray-700 border-gray-200'}`}>
            {label}
            <span className={`ml-1 text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              ({previousYearNum} vs {currentYearNum})
            </span>
          </p>

          {payloadFiltered.map((entry: any, index: number) => {
            if (entry.dataKey === 'debtRatioCurrent' || entry.dataKey === 'debtRatioPrevious') {
              return (
                <p key={index} className="text-sm mb-1" style={{ color: entry.color }}>
                  {entry.name}: {entry.value.toFixed(1)}%
                </p>
              );
            }
            if ((entry.dataKey === 'variationMoM' || entry.dataKey === 'variationYoY') && entry.value != null) {
              const sign = entry.value >= 0 ? '+' : '';
              return (
                <p key={index} className="text-sm mb-1" style={{ color: entry.color }}>
                  {entry.name}: {sign}{entry.value.toFixed(1)}%
                </p>
              );
            }

            const isCurrentYear = entry.dataKey === 'current';
            const year = isCurrentYear ? 'currentYear' : 'previousYear';
            const yearLabel = isCurrentYear ? `Ano do período (${currentYearNum})` : `Ano anterior (${previousYearNum})`;

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

  const sourceTablesForMetric = useMemo(() => {
    switch (selectedMetric) {
      case 'revenue':
        return ['vendas_por_usuario'];
      case 'cogs':
        return ['vendas_por_usuario'];
      case 'loans':
        return ['contas_a_pagar', 'empresas'];
      default:
        return ['vendas_por_usuario', 'contas_a_pagar', 'empresas'];
    }
  }, [selectedMetric]);

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
                (period !== '3months' || grouping !== 'month')
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
              {(period !== '3months' || grouping !== 'month') && (
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
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={-30} barCategoryGap="20%">
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
              
              {(selectedMetric === 'revenue' || selectedMetric === 'cogs' || selectedMetric === 'loans') && (
                <>
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="current"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                    name="Ano do período (linha)"
                    connectNulls
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="previous"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                    name="Ano anterior (linha)"
                    connectNulls
                  />
                </>
              )}
            </ComposedChart>
            );
          })()}
        </ResponsiveContainer>
      </div>

      {!lineViewMode && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <DataSourceNote
            darkMode={darkMode}
            tables={sourceTablesForMetric}
            suffix="(dados consolidados por mês/ano)"
          />
          <div className={`flex items-center justify-center space-x-6 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.current }}></div>
              <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Ano do período</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.previous }}></div>
              <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Ano anterior</span>
            </div>
            {(selectedMetric === 'revenue' || selectedMetric === 'cogs' || selectedMetric === 'loans') && (
              <>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#22c55e' }}></div>
                  <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Ano do período (linha)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#f97316' }}></div>
                  <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Ano anterior (linha)</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
