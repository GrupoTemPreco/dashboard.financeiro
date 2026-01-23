import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calculator, Target, BarChart3, ChevronLeft, ChevronRight, Save, Edit2, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CardSkeleton } from './CardSkeleton';
import { ChartSkeleton } from './ChartSkeleton';

interface DREData {
  category: string;
  currentMonth: number;
  previousMonth: number;
  percentageOfRevenue?: number;
  variation: number;
  variationPercentage: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  cmv: number;
  operatingExpenses: number;
  ebitda: number;
  netProfit: number;
  previousRevenue: number;
  previousCmv: number;
  previousOperatingExpenses: number;
  previousEbitda: number;
  previousNetProfit: number;
}

interface DebtData {
  month: string;
  loanAmount: number;
  ebitdaPercentage: number;
  revenuePercentage: number;
}

interface DREPageProps {
  accountsPayable: any[];
  financialTransactions: any[];
  forecastedEntries: any[];
  revenuesDRE: any[];
  cmvDRE: any[];
  nonOperationalAccounts: string[];
  filters: {
    startDate: string;
    endDate: string;
    groups: string[];
    companies: string[];
  };
  companies: any[];
  darkMode?: boolean;
}

export const DREPage: React.FC<DREPageProps> = ({
  accountsPayable,
  financialTransactions,
  forecastedEntries,
  revenuesDRE,
  cmvDRE,
  nonOperationalAccounts,
  filters,
  companies,
  darkMode = false
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'cmv' | 'operatingExpenses' | 'ebitda' | 'netProfit'>('revenue');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [tempBudgetValue, setTempBudgetValue] = useState<string>('');
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Normalize company code (same logic as App.tsx)
  const normalizeCode = (code: any): string => {
    if (!code) return '';
    const strCode = String(code).trim();
    const numCode = parseInt(strCode);
    return isNaN(numCode) ? strCode : String(numCode);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getCurrentMonthDates = () => {
    const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
    return { start, end };
  };

  const getPreviousMonthDates = () => {
    const previousMonth = subMonths(selectedMonth, 1);
    const start = format(startOfMonth(previousMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(previousMonth), 'yyyy-MM-dd');
    return { start, end };
  };

  // Função auxiliar para verificar se a empresa está nos filtros
  const isCompanyFiltered = (businessUnit: string) => {
    // Se não há empresas cadastradas ou não há filtros ativos, mostra tudo
    if (companies.length === 0) return true;

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;
    if (!hasActiveFilters) return true;

    // Filtra empresas baseado em grupos e empresas selecionados
    const filteredCompanyCodes = companies
      .filter(c => {
        const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
        const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
        return groupMatch && companyMatch;
      })
      .map(c => c.company_code);

    // Normaliza e compara
    const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
    const normalizedBU = normalizeCode(businessUnit);

    return normalizedCompanyCodes.includes(normalizedBU);
  };

  // Calcula a receita DRE
  const calculateRevenue = (startDate: string, endDate: string) => {
    console.log('🔵 Calculando Receita DRE:', { startDate, endDate, totalRecords: revenuesDRE.length });
    console.log('📊 Dados revenuesDRE:', revenuesDRE);
    
    const filtered = revenuesDRE.filter(r => {
      const dateMatch = r.issue_date >= startDate && r.issue_date <= endDate;
      const companyMatch = isCompanyFiltered(r.business_unit);
      const result = dateMatch && companyMatch;
      
      if (!dateMatch) {
        console.log('❌ Data não corresponde:', { 
          issue_date: r.issue_date, 
          startDate, 
          endDate,
          business_unit: r.business_unit,
          amount: r.amount 
        });
      }
      if (!companyMatch) {
        console.log('❌ Empresa não corresponde:', { 
          business_unit: r.business_unit,
          selectedBusinessUnit,
          companies: companies.map(c => ({ code: c.company_code, name: c.company_name }))
        });
      }
      
      return result;
    });
    
    console.log('✅ Receita DRE filtrada:', { count: filtered.length, records: filtered });
    
    const total = filtered.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    console.log('💰 Total Receita DRE:', total);
    
    return total;
  };

  // Calcula o CMV DRE - alimentado pela tabela cmv_dre
  // Os dados vêm da prop cmvDRE que é carregada do banco de dados (tabela cmv_dre)
  const calculateCMV = (startDate: string, endDate: string) => {
    console.log('🔴 Calculando CMV DRE (tabela cmv_dre):', { 
      startDate, 
      endDate, 
      totalRecords: cmvDRE.length,
      cmvDREIsArray: Array.isArray(cmvDRE)
    });
    
    if (!cmvDRE || !Array.isArray(cmvDRE) || cmvDRE.length === 0) {
      console.warn('⚠️ Nenhum dado de CMV DRE disponível na tabela cmv_dre!', {
        cmvDRE,
        isArray: Array.isArray(cmvDRE),
        length: cmvDRE?.length
      });
      return 0;
    }
    
    // Mostrar amostra dos dados
    console.log('📊 Amostra cmvDRE (primeiros 5):', cmvDRE.slice(0, 5).map(c => ({
      issue_date: c.issue_date,
      business_unit: c.business_unit,
      amount: c.amount,
      chart_of_accounts: c.chart_of_accounts,
      amountType: typeof c.amount,
      amountParsed: parseFloat(c.amount || 0)
    })));
    
    const filtered = cmvDRE.filter(c => {
      if (!c || !c.issue_date) {
        console.warn('⚠️ Registro CMV inválido (sem issue_date):', c);
        return false;
      }
      
      // Comparação de datas: garantir que ambas sejam strings no formato YYYY-MM-DD
      const recordDate = String(c.issue_date).split('T')[0]; // Remove hora se houver
      const startDateStr = String(startDate).split('T')[0];
      const endDateStr = String(endDate).split('T')[0];
      
      const dateMatch = recordDate >= startDateStr && recordDate <= endDateStr;
      const companyMatch = isCompanyFiltered(c.business_unit);
      const result = dateMatch && companyMatch;
      
      // Log detalhado para debug
      if (!dateMatch && cmvDRE.length > 0 && cmvDRE.length < 100) {
        // Só logar se houver poucos registros para não poluir o console
        console.log('📅 Data não corresponde (CMV):', {
          recordDate,
          startDateStr,
          endDateStr,
          dateMatch,
          record: c
        });
      }
      
      if (!result && dateMatch) {
        console.log('❌ Empresa não corresponde (CMV):', { 
          issue_date: c.issue_date,
          business_unit: c.business_unit,
          selectedBusinessUnit,
          filters: {
            groups: filters.groups,
            companies: filters.companies
          },
          companies: companies.map(c => ({ code: c.company_code, name: c.company_name }))
        });
      }
      
      return result;
    });
    
    // Mostrar todas as datas disponíveis nos dados para debug
    const allDates = [...new Set(cmvDRE.map(c => String(c.issue_date).split('T')[0]))].sort();
    const datesInRange = allDates.filter(d => d >= String(startDate).split('T')[0] && d <= String(endDate).split('T')[0]);
    
    console.log('✅ CMV DRE filtrado:', { 
      count: filtered.length, 
      totalRecords: cmvDRE.length,
      dateRange: { 
        startDate: String(startDate).split('T')[0], 
        endDate: String(endDate).split('T')[0] 
      },
      allDatesAvailable: allDates.slice(0, 10), // Primeiras 10 datas
      datesInRange: datesInRange,
      sampleFiltered: filtered.slice(0, 3).map(c => ({
        issue_date: c.issue_date,
        business_unit: c.business_unit,
        amount: c.amount
      }))
    });
    
    const total = filtered.reduce((sum, c) => {
      const amount = parseFloat(c.amount || 0);
      if (isNaN(amount)) {
        console.warn('⚠️ Valor CMV inválido (NaN):', c);
        return sum;
      }
      return sum + amount;
    }, 0);
    
    console.log('💰 Total CMV DRE calculado:', total, {
      filteredCount: filtered.length,
      sumBreakdown: filtered.slice(0, 5).map(c => ({
        issue_date: c.issue_date,
        amount: c.amount,
        parsed: parseFloat(c.amount || 0)
      }))
    });
    
    // Se não encontrou dados mas há registros, mostrar aviso
    if (total === 0 && cmvDRE.length > 0) {
      console.warn('⚠️ CMV DRE: Nenhum registro encontrado no período, mas há dados disponíveis!', {
        totalRecords: cmvDRE.length,
        dateRange: { startDate, endDate },
        firstRecord: cmvDRE[0],
        lastRecord: cmvDRE[cmvDRE.length - 1]
      });
    }
    
    return total;
  };

  // Load budgets from database
  useEffect(() => {
    const loadBudgets = async () => {
      if (selectedBusinessUnit === 'all') {
        setBudgets({});
        return;
      }
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('orcamento_dre')
          .select('account_name, budget_amount')
          .eq('business_unit', selectedBusinessUnit)
          .eq('period_date', `${selectedPeriod}-01`);

        if (error) throw error;

        if (data) {
          const budgetMap: Record<string, number> = {};
          data.forEach(budget => {
            budgetMap[budget.account_name] = parseFloat(budget.budget_amount || 0);
          });
          setBudgets(budgetMap);
        }
      } catch (error) {
        console.error('Error loading budgets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBudgets();
  }, [selectedBusinessUnit, selectedPeriod]);

  // Mostrar loading quando os dados principais estiverem sendo calculados
  useEffect(() => {
    // Se não há dados ainda, mostrar loading
    if (revenuesDRE.length === 0 && cmvDRE.length === 0 && accountsPayable.length === 0) {
      setIsLoading(true);
    } else {
      // Pequeno delay para permitir cálculos
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [revenuesDRE.length, cmvDRE.length, accountsPayable.length, selectedMonth, selectedBusinessUnit]);

  // Save budget
  const saveBudget = async (accountName: string, value: number) => {
    if (selectedBusinessUnit === 'all') {
      alert('Selecione uma unidade de negócio específica para editar o orçamento');
      return;
    }

    try {
      const { error } = await supabase
        .from('orcamento_dre')
        .upsert({
          business_unit: selectedBusinessUnit,
          account_name: accountName,
          period_date: `${selectedPeriod}-01`,
          budget_amount: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_unit,account_name,period_date'
        });

      if (error) throw error;

      setBudgets(prev => ({ ...prev, [accountName]: value }));
      setEditingBudget(null);
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Erro ao salvar orçamento');
    }
  };

  const startEditingBudget = (accountName: string) => {
    setEditingBudget(accountName);
    setTempBudgetValue(String(budgets[accountName] || 0));
  };

  const cancelEditingBudget = () => {
    setEditingBudget(null);
    setTempBudgetValue('');
  };

  const saveEditingBudget = (accountName: string) => {
    const value = parseFloat(tempBudgetValue) || 0;
    saveBudget(accountName, value);
  };

  // Estrutura completa de contas da DRE
  const dreAccountStructure = [
    { id: 'receita', name: 'Receita', level: 1, editable: true, bg: 'bg-blue-50', bold: true, expandable: false },
    { id: 'deducoes', name: 'Deduções', level: 1, editable: false, bg: '', bold: true, formula: 'sum', expandable: true },
    { id: 'deducoes-simples', name: 'Simples Nacional pago no período (R$)', level: 2, editable: true, bg: '', parent: 'deducoes' },
    { id: 'deducoes-icms', name: 'ICMS Pago No Período', level: 2, editable: true, bg: '', parent: 'deducoes' },
    { id: 'deducoes-parcelamento', name: 'Parcelamento de Divida Ativa pago no período', level: 2, editable: true, bg: '', parent: 'deducoes' },
    { id: 'receita-liquida', name: 'Receita Líquida', level: 1, editable: false, bg: 'bg-blue-100', bold: true, formula: 'receita-deducoes', expandable: false },
    { id: 'cmv', name: 'CMV', level: 1, editable: true, bg: 'bg-red-50', bold: true, expandable: false },
    { id: 'lucro-bruto', name: 'Lucro Bruto', level: 1, editable: false, bg: 'bg-green-100', bold: true, formula: 'receitaliq-cmv', expandable: false },
    { id: 'despesas-op', name: 'Despesas Operacionais', level: 1, editable: false, bg: 'bg-orange-50', bold: true, formula: 'sum', expandable: true },
    { id: 'despesas-op-pessoal', name: 'Despesas operacionais com pessoal', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
    { name: 'Salários Fixos + Horas Extras', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Custo com Motoboy', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Convênio Makebella', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Comissões e Premiações Sobre Vendas', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: '13º. Salário e Férias', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Endomarketing', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Vale Transporte', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Encargos - FGTS', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Encargos - INSS / IRPF', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'FGTS Multa Recisória', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Verba Rescisória', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Uniforme', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Exames Médicos', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Encargo em Atraso - INSS / IRRF', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Encargo em Atraso - FGTS', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Indenização Trabalhista', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { name: 'Pró-Labore', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal' },
    { id: 'despesas-op-assessorias', name: 'Despesas operacionais com assessorias', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
    { name: 'Aluguel do POS de Cartão e Crédito', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Escritório de Contabilidade', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Assessoria Juridica', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Cursos, Treinamentos e Despesas de Viagem', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Entidades', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Sistemas e Servidores', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Manutenção de Software + Hardware', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Outras Despesas com Assessorias', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Mensalidades', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { name: 'Alarmes e Segurança', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias' },
    { id: 'despesas-op-admin', name: 'Despesas operacionais administrativas', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
    { name: 'Seguro da Empresa (Imóvel e Veículos)', level: 3, editable: true, bg: '', parent: 'despesas-op-admin' },
    { name: 'Manutenção de Veículos', level: 3, editable: true, bg: '', parent: 'despesas-op-admin' },
    { name: 'Prosegur', level: 3, editable: true, bg: '', parent: 'despesas-op-admin' },
    { name: 'Combustível Operacional', level: 3, editable: true, bg: '', parent: 'despesas-op-admin' },
    { name: 'Prestador de Serviço Terceirizado', level: 3, editable: true, bg: '', parent: 'despesas-op-admin' },
    { id: 'despesas-op-func', name: 'Despesas operacionais com funcionamento', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
    { name: 'Aluguel', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'IPTU', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Energia Elétrica', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Água / Esgoto', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Telefone / Acesso a Internet', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Consumo Interno', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Consumo Interno - Lojas', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Mat.Limpeza / Faxina', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Manutenção de Instalações', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Taxas e Licenças da Farmácia', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'TFE -Tx Fiscalização Estabelecimento', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'TFA - Tx de Fiscalização Anuncios', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Promoção e Propaganda', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { name: 'Outras Despesas de Funcionamento', level: 3, editable: true, bg: '', parent: 'despesas-op-func' },
    { id: 'despesas-financeiras', name: 'Despesas financeiras', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
    { name: 'Juros de Cheque, Duplicatas e Demais Juros', level: 3, editable: true, bg: '', parent: 'despesas-financeiras' },
    { name: 'Tarifas Bancárias', level: 3, editable: true, bg: '', parent: 'despesas-financeiras' },
    { name: 'Produtos Vencidos', level: 3, editable: true, bg: '', parent: 'despesas-financeiras' },
    { name: 'Fundo de Troco - Lojas', level: 3, editable: true, bg: '', parent: 'despesas-financeiras' },
    { name: 'Quebra de Inventário', level: 3, editable: true, bg: '', parent: 'despesas-financeiras' },
    { id: 'despesas-extras', name: 'Despesas Extras', level: 2, editable: true, bg: '', bold: true, parent: 'despesas-op' },
    { id: 'despesas-rateio', name: 'Despesas com rateio', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
    { name: 'Aporte Escritório', level: 3, editable: true, bg: '', parent: 'despesas-rateio' },
    { id: 'ebitda', name: 'EBITDA', level: 1, editable: false, bg: 'bg-green-200', bold: true, formula: 'lucrobruto-despop', expandable: false },
    { id: 'despesas-nao-op', name: 'Despesas não operacionais', level: 1, editable: false, bg: 'bg-purple-50', bold: true, formula: 'sum', expandable: true },
    { id: 'outras-rec-desp', name: 'Outras receitas e despesas', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-nao-op', expandable: true },
    { name: 'Receita Reembolsável - Makebella', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { name: 'Despesa Reembolsável - Makebella', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { name: 'Receita Reembolsável - Outros', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { name: 'Despesa Reembolsável - Outros', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { name: 'Receita Reembolsável - XBrothers', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { name: 'Despesa Reembolsável - XBrothers', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { name: 'Receita Reembolsável - ESCPP', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { name: 'Despesa Reembolsável - ESCPP', level: 3, editable: true, bg: '', parent: 'outras-rec-desp' },
    { id: 'desp-financiamento', name: 'Despesas com financiamento', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-nao-op', expandable: true },
    { name: 'Empréstimos Recebidos', level: 3, editable: true, bg: '', parent: 'desp-financiamento' },
    { name: 'Pagamento de Empréstimo / Financiamento', level: 3, editable: true, bg: '', parent: 'desp-financiamento' },
    { name: 'Pagamento Via Cartão', level: 3, editable: true, bg: '', parent: 'desp-financiamento' },
    { name: 'Empréstimos Recebidos via Cartão', level: 3, editable: true, bg: '', parent: 'desp-financiamento' },
    { id: 'desp-investimento', name: 'Despesas com investimento', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-nao-op', expandable: true },
    { name: 'Investimentos Financeiros', level: 3, editable: true, bg: '', parent: 'desp-investimento' },
    { name: 'Investimento - Societário / Comercial', level: 3, editable: true, bg: '', parent: 'desp-investimento' },
    { name: 'Invest. Maq. / Equip. / Moveis', level: 3, editable: true, bg: '', parent: 'desp-investimento' },
    { name: 'Cartão de Crédito', level: 3, editable: true, bg: '', parent: 'desp-investimento' },
    { name: 'Reforma do Imóvel', level: 3, editable: true, bg: '', parent: 'desp-investimento' },
    { name: 'Recebimento de Dividendos', level: 3, editable: true, bg: '', parent: 'desp-investimento' },
    { name: 'Rendimento Financeiro', level: 3, editable: true, bg: '', parent: 'desp-investimento' },
    { id: 'lucros-distrib', name: 'Lucros distribuidos', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-nao-op', expandable: true },
    { name: 'Distribuição de Lucros', level: 3, editable: true, bg: '', parent: 'lucros-distrib' },
    { name: 'Capital de Investimentos', level: 3, editable: true, bg: '', parent: 'lucros-distrib' },
    { id: 'lucro-liquido', name: 'Lucro Líquido', level: 1, editable: false, bg: 'bg-purple-100', bold: true, formula: 'ebitda-despnaoop', expandable: false }
  ];

  // Toggle expansão de conta
  const toggleExpand = (accountId: string) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  // Verificar se uma conta deve ser exibida
  const shouldShowAccount = (account: any): boolean => {
    // Contas de nível 1 sempre são exibidas
    if (account.level === 1) return true;

    // Se não tem parent, exibir
    if (!account.parent) return true;

    // Verificar se o parent está expandido
    return expandedAccounts[account.parent] === true;
  };

  // Calcula o valor direto de uma conta a partir dos dados financeiros
  const getDirectAccountValue = (accountName: string, startDate: string, endDate: string): number => {
    // Mapear contas especiais
    if (accountName === 'Receita') {
      return calculateRevenue(startDate, endDate);
    }
    if (accountName === 'CMV') {
      return calculateCMV(startDate, endDate);
    }

    // Para outras contas, buscar em accountsPayable e financialTransactions
    let total = 0;

    // Buscar em accountsPayable
    const apValue = accountsPayable
      .filter(ap => {
        const dateMatch = ap.payment_date >= startDate && ap.payment_date <= endDate;
        const accountMatch = ap.chart_of_accounts === accountName;
        const companyMatch = isCompanyFiltered(ap.business_unit);
        return dateMatch && accountMatch && companyMatch;
      })
      .reduce((sum, ap) => sum + parseFloat(ap.amount || 0), 0);

    // Buscar em financialTransactions (apenas valores negativos para despesas)
    const ftValue = financialTransactions
      .filter(ft => {
        const dateMatch = ft.transaction_date >= startDate && ft.transaction_date <= endDate;
        const accountMatch = ft.chart_of_accounts === accountName;
        const isNegative = parseFloat(ft.amount || 0) < 0;
        const companyMatch = isCompanyFiltered(ft.business_unit);
        return dateMatch && accountMatch && companyMatch && isNegative;
      })
      .reduce((sum, ft) => sum + Math.abs(parseFloat(ft.amount || 0)), 0);

    total = apValue + ftValue;
    return total;
  };

  // Calcula o valor de uma conta recursivamente (soma das subcontas)
  const getAccountValueRecursive = (account: any, month: 'current' | 'previous'): number => {
    const { start: currentStart, end: currentEnd } = getCurrentMonthDates();
    const { start: previousStart, end: previousEnd } = getPreviousMonthDates();

    const startDate = month === 'current' ? currentStart : previousStart;
    const endDate = month === 'current' ? currentEnd : previousEnd;

    // Se a conta tem fórmula 'sum', calcular a soma das subcontas
    if (account.formula === 'sum') {
      // Encontrar todas as subcontas desta conta
      const subAccounts = dreAccountStructure.filter(
        acc => acc.parent === account.id || acc.parent === account.name
      );

      // Somar recursivamente todas as subcontas
      let sum = 0;
      subAccounts.forEach(subAccount => {
        sum += getAccountValueRecursive(subAccount, month);
      });

      return sum;
    }

    // Se a conta tem uma fórmula específica (como receita-deducoes)
    if (account.formula && account.formula !== 'sum') {
      // Implementar fórmulas específicas se necessário
      if (account.formula === 'receita-deducoes') {
        const receita = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'receita') || { name: 'Receita' },
          month
        );
        const deducoes = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'deducoes') || { name: 'Deduções' },
          month
        );
        return receita - deducoes;
      }
      if (account.formula === 'receitaliq-cmv') {
        const receitaLiq = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'receita-liquida') || { name: 'Receita Líquida' },
          month
        );
        const cmv = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'cmv') || { name: 'CMV' },
          month
        );
        return receitaLiq - cmv;
      }
      if (account.formula === 'lucrobruto-despop') {
        const lucroBruto = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'lucro-bruto') || { name: 'Lucro Bruto' },
          month
        );
        const despesasOp = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'despesas-op') || { name: 'Despesas Operacionais' },
          month
        );
        return lucroBruto - despesasOp;
      }
      if (account.formula === 'ebitda-despnaoop') {
        const ebitda = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'ebitda') || { name: 'EBITDA' },
          month
        );
        const despesasNaoOp = getAccountValueRecursive(
          dreAccountStructure.find(a => a.id === 'despesas-nao-op') || { name: 'Despesas não operacionais' },
          month
        );
        return ebitda - despesasNaoOp;
      }
    }

    // Se não tem fórmula ou é uma conta editável, buscar valor direto
    return getDirectAccountValue(account.name || account.id, startDate, endDate);
  };

  // Helper para calcular valores das contas
  const getAccountValue = (accountName: string, month: 'current' | 'previous'): number => {
    // Encontrar a conta na estrutura
    const account = dreAccountStructure.find(
      acc => acc.name === accountName || acc.id === accountName
    );

    if (!account) {
      // Se não encontrou, tentar buscar valor direto
      const { start: currentStart, end: currentEnd } = getCurrentMonthDates();
      const { start: previousStart, end: previousEnd } = getPreviousMonthDates();
      const startDate = month === 'current' ? currentStart : previousStart;
      const endDate = month === 'current' ? currentEnd : previousEnd;
      return getDirectAccountValue(accountName, startDate, endDate);
    }

    // Calcular recursivamente
    return getAccountValueRecursive(account, month);
  };

  // Helper para renderizar célula de orçamento editável
  const renderBudgetCell = (accountName: string, editable: boolean) => {
    if (!editable) {
      return (
        <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>
          -
        </td>
      );
    }

    const budgetValue = budgets[accountName] || 0;
    const isEditing = editingBudget === accountName;

    if (selectedBusinessUnit === 'all') {
      return (
        <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>
          -
        </td>
      );
    }

    return (
      <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        {isEditing ? (
          <div className="flex items-center gap-2 justify-end">
            <input
              type="number"
              value={tempBudgetValue}
              onChange={(e) => setTempBudgetValue(e.target.value)}
              className="w-32 px-2 py-1 border border-blue-300 rounded text-right"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEditingBudget(accountName);
                if (e.key === 'Escape') cancelEditingBudget();
              }}
            />
            <button
              onClick={() => saveEditingBudget(accountName)}
              className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
              title="Salvar"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-end group">
            <span>{formatCurrency(budgetValue)}</span>
            <button
              onClick={() => startEditingBudget(accountName)}
              className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Editar orçamento"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    );
  };

  // Helper para renderizar uma linha da DRE
  const renderDRERow = (account: any, index: number) => {
    // Verificar se deve mostrar a conta
    if (!shouldShowAccount(account)) return null;

    const currentValue = getAccountValue(account.name, 'current');
    const previousValue = getAccountValue(account.name, 'previous');
    const variation = currentValue - previousValue;
    const receita = getAccountValue('Receita', 'current');
    const percentOfRevenue = receita > 0 ? (currentValue / receita) * 100 : 0;

    const paddingClass = account.level === 1 ? 'px-4' : account.level === 2 ? 'pl-8 pr-4' : 'pl-12 pr-4';
    const fontClass = account.bold ? 'font-semibold' : '';
    const bgClass =
      darkMode && account.bg
        ? account.bg
            .replace('bg-blue-50', 'bg-slate-900/60')
            .replace('bg-blue-100', 'bg-slate-900/70')
            .replace('bg-red-50', 'bg-red-950/30')
            .replace('bg-green-100', 'bg-emerald-950/30')
            .replace('bg-green-200', 'bg-emerald-950/40')
            .replace('bg-purple-50', 'bg-violet-950/30')
            .replace('bg-purple-100', 'bg-violet-950/40')
            .replace('bg-orange-50', 'bg-amber-950/30')
        : account.bg || '';

    const isExpanded = account.id && expandedAccounts[account.id];
    const hasExpandIcon = account.expandable;

    return (
      <tr key={index} className={bgClass}>
        <td
          className={`border ${paddingClass} py-3 ${fontClass} ${
            darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {hasExpandIcon && (
                <button
                  onClick={() => toggleExpand(account.id)}
                  className={`p-1 rounded transition-colors ${
                    darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-200 text-gray-600'
                  }`}
                  title={isExpanded ? 'Colapsar' : 'Expandir'}
                >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasExpandIcon && <span className="w-6" />}
            <span>{account.name}</span>
          </div>
        </td>
        <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
          {formatCurrency(currentValue)}
        </td>
        <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
          {formatCurrency(previousValue)}
        </td>
        {renderBudgetCell(account.name, account.editable)}
        <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
          {formatCurrency(variation)}
        </td>
        <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
          {percentOfRevenue.toFixed(1)}%
        </td>
      </tr>
    );
  };

  // Calcula despesas operacionais (Total de Despesas - igual ao fluxo de caixa)
  // Usa a mesma lógica do card "Total de Despesas" da tela de fluxo de caixa
  const calculateOperatingExpenses = (startDate: string, endDate: string) => {
    console.log('🟠 Calculando Despesas Operacionais:', { startDate, endDate });
    console.log('📊 Total accountsPayable:', accountsPayable.length);
    console.log('📊 Total financialTransactions:', financialTransactions.length);
    console.log('📊 Total forecastedEntries:', forecastedEntries?.length || 0);
    
    if (accountsPayable.length === 0 && financialTransactions.length === 0 && (!forecastedEntries || forecastedEntries.length === 0)) {
      console.warn('⚠️ Nenhum dado de despesas disponível!');
      return 0;
    }
    
    // Lista de exclusões (mesma do Total de Despesas)
    const expensesExclusionList = [
      'Receita Reembolsável - Makebella',
      'Despesa Reembolsável - Makebella',
      'Receita Reembolsável - Outros',
      'Despesa Reembolsável - Outros',
      'Receita Reembolsável - XBrothers',
      'Despesa Reembolsável - XBrothers',
      'Receita Reembolsável - ESCPP',
      'Despesa Reembolsável - ESCPP',
      'Empréstimos Recebidos',
      'Pagamento de Empréstimo',
      'Financiamento',
      'Pagamento Via Cartão',
      'Empréstimos Recebidos via Cartão',
      'Investimentos Financeiros',
      'Investimento - Societário / Comercial',
      'Invest. Maq. / Equip. / Moveis',
      'Cartão de Crédito',
      'Reforma do Imóvel',
      'Recebimento de Dividendos',
      'Rendimento Financeiro',
      'Distribuição de Lucros',
      'Capital de Investimentos'
    ];
    
    // Despesas de Accounts Payable
    const apExpenses = accountsPayable
      .filter(ap => {
        const dateMatch = ap.payment_date >= startDate && ap.payment_date <= endDate;
        const isOperational = !expensesExclusionList.some(excluded =>
          ap.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())
        );
        const companyMatch = isCompanyFiltered(ap.business_unit);
        return dateMatch && isOperational && companyMatch;
      })
      .reduce((sum, ap) => sum + Math.abs(parseFloat(ap.amount || 0)), 0);

    // Despesas de Forecasted Entries
    const feExpenses = forecastedEntries
      .filter(entry => {
        const dateMatch = entry.due_date >= startDate && entry.due_date <= endDate;
        const isOperational = !expensesExclusionList.some(excluded =>
          entry.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())
        );
        const companyMatch = isCompanyFiltered(entry.business_unit);
        return dateMatch && isOperational && companyMatch;
      })
      .reduce((sum, entry) => sum + Math.abs(parseFloat(entry.amount || 0)), 0);

    // Despesas de Financial Transactions (apenas negativas)
    const ftExpenses = financialTransactions
      .filter(ft => {
        const dateMatch = ft.transaction_date >= startDate && ft.transaction_date <= endDate;
        const isNegative = parseFloat(ft.amount || 0) < 0;
        const isOperational = !expensesExclusionList.some(excluded =>
          (ft.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase()) ||
           ft.description?.toLowerCase().includes(excluded.toLowerCase()))
        );
        const companyMatch = isCompanyFiltered(ft.business_unit);
        return dateMatch && isNegative && isOperational && companyMatch;
      })
      .reduce((sum, ft) => sum + Math.abs(parseFloat(ft.amount || 0)), 0);

    const total = apExpenses + feExpenses + ftExpenses;
    console.log('💰 Despesas Operacionais:', { 
      apExpenses, 
      feExpenses, 
      ftExpenses, 
      total,
      dateRange: { startDate, endDate },
      accountsPayableFiltered: accountsPayable.filter(ap => {
        const dateMatch = ap.payment_date >= startDate && ap.payment_date <= endDate;
        return dateMatch;
      }).length,
      forecastedEntriesFiltered: forecastedEntries?.filter(entry => {
        const dateMatch = entry.due_date >= startDate && entry.due_date <= endDate;
        return dateMatch;
      }).length || 0,
      transactionsFiltered: financialTransactions.filter(ft => {
        const dateMatch = ft.transaction_date >= startDate && ft.transaction_date <= endDate;
        return dateMatch;
      }).length
    });

    return total;
  };

  // Calcula EBITDA = Receita - CMV - Despesas Operacionais
  const calculateEBITDA = (revenue: number, cmv: number, operatingExpenses: number) => {
    return revenue - cmv - operatingExpenses;
  };

  // Calcula Lucro Líquido = EBITDA - Despesas não operacionais
  const calculateNetProfit = (ebitda: number) => {
    const apNonOperational = accountsPayable
      .filter(ap => {
        const dateMatch = ap.payment_date >= filters.startDate && ap.payment_date <= filters.endDate;
        const isNonOperational = nonOperationalAccounts.includes(ap.chart_of_accounts);
        return dateMatch && isNonOperational;
      })
      .reduce((sum, ap) => sum + parseFloat(ap.amount || 0), 0);

    const ftNonOperational = financialTransactions
      .filter(ft => {
        const dateMatch = ft.transaction_date >= filters.startDate && ft.transaction_date <= filters.endDate;
        const isNonOperational = nonOperationalAccounts.includes(ft.chart_of_accounts);
        const isNegative = parseFloat(ft.amount || 0) < 0;
        return dateMatch && isNonOperational && isNegative;
      })
      .reduce((sum, ft) => sum + Math.abs(parseFloat(ft.amount || 0)), 0);

    return ebitda - (apNonOperational + ftNonOperational);
  };

  // Calcula os KPIs para o mês atual selecionado
  const currentMonthDates = getCurrentMonthDates();
  const previousMonthDates = getPreviousMonthDates();
  
  // Debug: Log das datas e dados disponíveis
  useEffect(() => {
    console.log('📅 DRE Debug Info:', {
      selectedMonth: format(selectedMonth, 'yyyy-MM-dd'),
      currentMonthDates,
      previousMonthDates,
      selectedBusinessUnit,
      totalRevenuesDRE: revenuesDRE.length,
      totalCmvDRE: cmvDRE.length,
      totalAccountsPayable: accountsPayable.length,
      totalFinancialTransactions: financialTransactions.length,
      companies: companies.map(c => ({ code: c.company_code, name: c.company_name })),
      filters: {
        groups: filters.groups,
        companies: filters.companies,
        startDate: filters.startDate,
        endDate: filters.endDate
      }
    });
    
    // Mostrar amostra dos dados brutos
    if (revenuesDRE.length > 0) {
      console.log('📊 Sample revenuesDRE (first 5):', revenuesDRE.slice(0, 5));
    }
    if (cmvDRE.length > 0) {
      console.log('📊 Sample cmvDRE (first 5):', cmvDRE.slice(0, 5));
    }
    
    // Mostrar informações sobre filtros de empresa
    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;
    console.log('🔍 Filter Status:', {
      hasActiveFilters,
      selectedGroups: filters.groups,
      selectedCompanies: filters.companies,
      totalCompanies: companies.length
    });
  }, [selectedMonth, selectedBusinessUnit, revenuesDRE, cmvDRE, accountsPayable, financialTransactions, companies, filters]);

  // Usar filtros globais se disponíveis, senão usar o mês selecionado
  const effectiveStartDate = filters.startDate || currentMonthDates.start;
  const effectiveEndDate = filters.endDate || currentMonthDates.end;
  
  console.log('📅 Datas efetivas para cálculo:', {
    filtersStartDate: filters.startDate,
    filtersEndDate: filters.endDate,
    currentMonthStart: currentMonthDates.start,
    currentMonthEnd: currentMonthDates.end,
    effectiveStartDate,
    effectiveEndDate,
    selectedMonth: format(selectedMonth, 'yyyy-MM-dd')
  });

  const currentRevenue = calculateRevenue(effectiveStartDate, effectiveEndDate);
  const currentCmv = calculateCMV(effectiveStartDate, effectiveEndDate);
  const currentOperatingExpenses = calculateOperatingExpenses(effectiveStartDate, effectiveEndDate);
  const currentEbitda = calculateEBITDA(currentRevenue, currentCmv, currentOperatingExpenses);
  const currentNetProfit = calculateNetProfit(currentEbitda);

  // Calcula os KPIs para o mês anterior
  const previousRevenue = calculateRevenue(previousMonthDates.start, previousMonthDates.end);
  const previousCmv = calculateCMV(previousMonthDates.start, previousMonthDates.end);
  const previousOperatingExpenses = calculateOperatingExpenses(previousMonthDates.start, previousMonthDates.end);
  const previousEbitda = calculateEBITDA(previousRevenue, previousCmv, previousOperatingExpenses);
  const previousNetProfit = calculateNetProfit(previousEbitda);
  
  console.log('💰 Valores calculados:', {
    currentRevenue,
    currentCmv,
    currentOperatingExpenses,
    currentEbitda,
    currentNetProfit,
    previousRevenue,
    previousCmv,
    previousOperatingExpenses
  });

  // DRE data com valores calculados
  const dreData: DREData[] = [
    {
      category: 'Receita',
      currentMonth: currentRevenue,
      previousMonth: previousRevenue,
      variation: currentRevenue - previousRevenue,
      variationPercentage: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0
    },
    {
      category: 'CMV', // Alimentado pela tabela cmv_dre
      currentMonth: currentCmv, // Calculado a partir de cmvDRE (tabela cmv_dre)
      previousMonth: previousCmv, // Calculado a partir de cmvDRE (tabela cmv_dre)
      percentageOfRevenue: currentRevenue > 0 ? (currentCmv / currentRevenue) * 100 : 0,
      variation: currentCmv - previousCmv,
      variationPercentage: previousCmv > 0 ? ((currentCmv - previousCmv) / previousCmv) * 100 : 0
    },
    {
      category: 'Despesas Operacionais',
      currentMonth: currentOperatingExpenses,
      previousMonth: previousOperatingExpenses,
      percentageOfRevenue: currentRevenue > 0 ? (currentOperatingExpenses / currentRevenue) * 100 : 0,
      variation: currentOperatingExpenses - previousOperatingExpenses,
      variationPercentage: previousOperatingExpenses > 0 ? ((currentOperatingExpenses - previousOperatingExpenses) / previousOperatingExpenses) * 100 : 0
    },
    {
      category: 'EBITDA',
      currentMonth: currentEbitda,
      previousMonth: previousEbitda,
      percentageOfRevenue: currentRevenue > 0 ? (currentEbitda / currentRevenue) * 100 : 0,
      variation: currentEbitda - previousEbitda,
      variationPercentage: previousEbitda > 0 ? ((currentEbitda - previousEbitda) / previousEbitda) * 100 : 0
    },
    {
      category: 'Lucro Líquido',
      currentMonth: currentNetProfit,
      previousMonth: previousNetProfit,
      percentageOfRevenue: currentRevenue > 0 ? (currentNetProfit / currentRevenue) * 100 : 0,
      variation: currentNetProfit - previousNetProfit,
      variationPercentage: previousNetProfit > 0 ? ((currentNetProfit - previousNetProfit) / previousNetProfit) * 100 : 0
    }
  ];

  // Contas de endividamento
  const debtAccounts = [
    'Empréstimos Recebidos',
    'Pagamento de Empréstimo / Financiamento',
    'Pagamento Via Cartão',
    'Empréstimos Recebidos via Cartão',
    'Cartão de Crédito'
  ];

  // Calcula dados mensais reais (simplificado - mostra apenas o valor atual do período)
  const monthlyData: MonthlyData[] = [
    {
      month: 'Atual',
      revenue: currentRevenue,
      cmv: currentCmv,
      operatingExpenses: currentOperatingExpenses,
      ebitda: currentEbitda,
      netProfit: currentNetProfit,
      previousRevenue,
      previousCmv,
      previousOperatingExpenses,
      previousEbitda,
      previousNetProfit
    }
  ];

  // Calcula o saldo de endividamento
  const calculateDebt = () => {
    // Somatório de empréstimos recebidos (positivo)
    const loansReceived = accountsPayable
      .filter(ap => {
        const dateMatch = ap.payment_date >= filters.startDate && ap.payment_date <= filters.endDate;
        const companyMatch = isCompanyFiltered(ap.business_unit);
        return dateMatch && companyMatch && ap.chart_of_accounts === 'Empréstimos Recebidos';
      })
      .reduce((sum, ap) => sum + parseFloat(ap.amount || 0), 0);

    const loansReceivedFT = financialTransactions
      .filter(ft => {
        const dateMatch = ft.transaction_date >= filters.startDate && ft.transaction_date <= filters.endDate;
        const companyMatch = isCompanyFiltered(ft.business_unit);
        return dateMatch && companyMatch && ft.chart_of_accounts === 'Empréstimos Recebidos';
      })
      .reduce((sum, ft) => sum + parseFloat(ft.amount || 0), 0);

    // Somatório de pagamentos de empréstimos (negativo)
    const loanPayments = accountsPayable
      .filter(ap => {
        const dateMatch = ap.payment_date >= filters.startDate && ap.payment_date <= filters.endDate;
        const companyMatch = isCompanyFiltered(ap.business_unit);
        return dateMatch && companyMatch && debtAccounts.includes(ap.chart_of_accounts) && ap.chart_of_accounts !== 'Empréstimos Recebidos';
      })
      .reduce((sum, ap) => sum + parseFloat(ap.amount || 0), 0);

    const loanPaymentsFT = financialTransactions
      .filter(ft => {
        const dateMatch = ft.transaction_date >= filters.startDate && ft.transaction_date <= filters.endDate;
        const companyMatch = isCompanyFiltered(ft.business_unit);
        const isNegative = parseFloat(ft.amount || 0) < 0;
        return dateMatch && companyMatch && debtAccounts.includes(ft.chart_of_accounts) && ft.chart_of_accounts !== 'Empréstimos Recebidos' && isNegative;
      })
      .reduce((sum, ft) => sum + Math.abs(parseFloat(ft.amount || 0)), 0);

    return (loansReceived + loansReceivedFT) - (loanPayments + loanPaymentsFT);
  };

  const debtAmount = calculateDebt();

  // Debt data com valores calculados
  const debtData: DebtData[] = [
    {
      month: 'Atual',
      loanAmount: debtAmount,
      ebitdaPercentage: currentEbitda > 0 ? (debtAmount / currentEbitda) * 100 : 0,
      revenuePercentage: currentRevenue > 0 ? (debtAmount / currentRevenue) * 100 : 0
    }
  ];

  const getMetricData = () => {
    return monthlyData.map(item => ({
      month: item.month,
      current: item[selectedMetric],
      previous: item[`previous${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}` as keyof MonthlyData] as number,
      revenue: item.revenue
    }));
  };

  const getMetricTitle = () => {
    switch (selectedMetric) {
      case 'revenue': return 'Receita';
      case 'cmv': return 'CMV';
      case 'operatingExpenses': return 'Despesas Operacionais';
      case 'ebitda': return 'EBITDA';
      case 'netProfit': return 'Lucro Líquido';
      default: return '';
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'revenue': return { current: '#3b82f6', previous: '#93c5fd' };
      case 'cmv': return { current: '#ef4444', previous: '#fca5a5' };
      case 'operatingExpenses': return { current: '#f59e0b', previous: '#fcd34d' };
      case 'ebitda': return { current: '#10b981', previous: '#6ee7b7' };
      case 'netProfit': return { current: '#8b5cf6', previous: '#c4b5fd' };
      default: return { current: '#6b7280', previous: '#d1d5db' };
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} p-3 border rounded-lg shadow-lg`}>
          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index}>
              <p className="text-sm" style={{ color: entry.color }}>
                {entry.name}: {formatCurrency(entry.value)}
              </p>
              {/* Show percentage over revenue for specific metrics */}
              {(selectedMetric === 'cmv' || selectedMetric === 'operatingExpenses' || selectedMetric === 'ebitda') && entry.dataKey === 'current' && (
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  % sobre Receita: {((entry.value / data.revenue) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const DebtTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} p-3 border rounded-lg shadow-lg`}>
          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>{label}</p>
          <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Empréstimos: {formatCurrency(data.loanAmount)}</p>
          <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>% do EBITDA: {data.ebitdaPercentage.toFixed(1)}%</p>
          <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>% da Receita: {data.revenuePercentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const colors = getMetricColor();

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div>
        <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Indicadores de Desempenho</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {isLoading ? (
            <>
              <CardSkeleton darkMode={darkMode} />
              <CardSkeleton darkMode={darkMode} />
              <CardSkeleton darkMode={darkMode} />
              <CardSkeleton darkMode={darkMode} />
              <CardSkeleton darkMode={darkMode} />
            </>
          ) : (
            dreData.map((item, index) => {
            const isPositive = item.variation >= 0;
            const icons = [DollarSign, Calculator, Target, TrendingUp, BarChart3];
            const colors = ['blue', 'red', 'orange', 'green', 'purple'];
            const Icon = icons[index];
            
            if (darkMode) {
              const darkBorders = ['border-l-sky-400', 'border-l-rose-400', 'border-l-amber-400', 'border-l-emerald-400', 'border-l-violet-400'];
              const darkBorder = darkBorders[index] || 'border-l-slate-500';
              return (
                <div
                  key={item.category}
                  className={`bg-[#0F172A] border border-slate-800 rounded-lg p-4 border-l-4 ${darkBorder} shadow-[0_18px_40px_rgba(15,23,42,0.18)] hover:shadow-[0_0_32px_rgba(59,130,246,0.35)] transition-all duration-300`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-1.5 rounded-lg bg-slate-950 shadow-sm text-slate-100">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-semibold text-slate-100 ml-2">{item.category}</h3>
                    </div>
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-rose-300" />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-medium">Atual</span>
                      <span className="text-lg font-bold text-slate-100">
                        {formatCurrency(item.currentMonth)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-medium">Variação</span>
                      <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {isPositive ? '+' : ''}{item.variationPercentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    {item.percentageOfRevenue && (
                      <div className="pt-2 border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400 font-medium">% Receita</span>
                          <span className="text-sm font-semibold text-slate-100">
                            {item.percentageOfRevenue.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={item.category} className={`bg-gradient-to-br from-${colors[index]}-50 to-${colors[index]}-100 border border-${colors[index]}-200 rounded-lg shadow-md p-4 border-l-4 border-l-${colors[index]}-500`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`p-1.5 rounded-lg bg-white shadow-sm text-${colors[index]}-600`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xs font-semibold text-gray-700 ml-2">{item.category}</h3>
                  </div>
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Atual</span>
                    <span className={`text-lg font-bold text-${colors[index]}-700`}>
                      {formatCurrency(item.currentMonth)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Variação</span>
                    <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{item.variationPercentage.toFixed(1)}%
                    </span>
                  </div>
                  
                  {item.percentageOfRevenue && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-medium">% Receita</span>
                        <span className="text-sm font-semibold text-gray-700">
                          {item.percentageOfRevenue.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* DRE Table */}
      <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
        <div className="mb-6">
          <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Demonstração do Resultado do Exercício</h2>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                Unidade de Negócio
              </label>
              <div
                className={`rounded-lg border px-3 py-1.5 ${
                  darkMode ? 'bg-slate-950/40 border-slate-700' : 'bg-white border-gray-200 shadow-sm'
                }`}
              >
                <select
                  value={selectedBusinessUnit}
                  onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                  className={`w-full bg-transparent px-0 py-0 border-none focus:outline-none focus:ring-0 text-sm ${
                    darkMode ? 'text-slate-100' : 'text-gray-900'
                  }`}
                >
                  <option value="all">Todas as Unidades</option>
                  {companies.map(c => (
                    <option key={c.company_code} value={c.company_code}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                Período (Orçamento)
              </label>
              <div
                className={`rounded-lg border px-3 py-1.5 ${
                  darkMode ? 'bg-slate-950/40 border-slate-700' : 'bg-white border-gray-200 shadow-sm'
                }`}
              >
                <input
                  type="month"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className={`w-full bg-transparent px-0 py-0 border-none focus:outline-none focus:ring-0 text-sm ${
                    darkMode ? 'text-slate-100 dre-month-dark' : 'text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <button
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center min-w-[150px]">
                <div className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                  {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                </div>
                <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  vs {format(subMonths(selectedMonth, 1), 'MMM yyyy', { locale: ptBR })}
                </div>
              </div>

              <button
                onClick={() => setSelectedMonth(subMonths(selectedMonth, -1))}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className={darkMode ? 'bg-slate-800' : 'bg-gray-50'}>
                <th className={`border px-4 py-3 text-left text-sm font-semibold ${
                  darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'
                }`}>
                  Conta
                </th>
                <th className={`border px-4 py-3 text-right text-sm font-semibold ${
                  darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'
                }`}>
                  {format(selectedMonth, 'MMM/yy', { locale: ptBR })}
                </th>
                <th className={`border px-4 py-3 text-right text-sm font-semibold ${
                  darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'
                }`}>
                  {format(subMonths(selectedMonth, 1), 'MMM/yy', { locale: ptBR })}
                </th>
                <th className={`border px-4 py-3 text-right text-sm font-semibold ${
                  darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'
                }`}>
                  Orçamento
                </th>
                <th className={`border px-4 py-3 text-right text-sm font-semibold ${
                  darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'
                }`}>
                  Variação
                </th>
                <th className={`border px-4 py-3 text-right text-sm font-semibold ${
                  darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'
                }`}>
                  % Receita
                </th>
              </tr>
            </thead>
            <tbody>
              {dreAccountStructure.map((account, index) => renderDRERow(account, index))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Análise do Período</h2>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'revenue', label: 'Receita' },
            { key: 'cmv', label: 'CMV' },
            { key: 'operatingExpenses', label: 'Desp. Operacionais' },
            { key: 'ebitda', label: 'EBITDA' },
            { key: 'netProfit', label: 'Lucro Líquido' }
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

        {isLoading || !getMetricData() || getMetricData().length === 0 ? (
          <ChartSkeleton darkMode={darkMode} height="h-80" />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getMetricData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f0f0f0'} />
                <XAxis dataKey="month" stroke={darkMode ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} stroke={darkMode ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                
                <Bar
                  dataKey="current"
                  fill={colors.current}
                  name={`${getMetricTitle()} (Atual)`}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="previous"
                  fill={colors.previous}
                  name={`${getMetricTitle()} (Ano Anterior)`}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Annual Debt Chart */}
      <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
        <h2 className={`text-xl font-bold mb-6 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Endividamento Mensal</h2>
        
        {isLoading || !debtData || debtData.length === 0 ? (
          <ChartSkeleton darkMode={darkMode} height="h-80" />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={debtData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f0f0f0'} />
                <XAxis dataKey="month" stroke={darkMode ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} stroke={darkMode ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip content={<DebtTooltip />} />
                
                <Bar
                  dataKey="loanAmount"
                  fill="#ef4444"
                  name="Empréstimos"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={`mt-4 text-sm text-center ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
          Passe o mouse sobre as barras para ver % do EBITDA e % da Receita
        </div>
      </div>
    </div>
  );
};