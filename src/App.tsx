import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { KPICard } from './components/KPICard';
import { KPIDetailModal } from './components/KPIDetailModal';
import { CalendarView } from './components/CalendarView';
import { CashFlowChart } from './components/CashFlowChart';
import { CashFlowAlerts } from './components/CashFlowAlerts';
import { MonthlyComparison } from './components/MonthlyComparison';
import { CashFlowTable } from './components/CashFlowTable';
import { AnalyticalInsights } from './components/AnalyticalInsights';
import { ExpenseBreakdown } from './components/ExpenseBreakdown';
import { DREPage } from './components/DREPage';
import { CompanyFormModal } from './components/CompanyFormModal';
import { CompanyEditModal } from './components/CompanyEditModal';
import { DespesasOperacionaisTable, formatLastUpdate } from './components/DespesasOperacionaisTable';
import { ErrorModal } from './components/ErrorModal';
import { DuplicateFileModal } from './components/DuplicateFileModal';
import { ChartSkeleton } from './components/ChartSkeleton';
import { PageLoader } from './components/PageLoader';
import { NotificationCenter } from './components/NotificationCenter';
import { ToastNotification } from './components/ToastNotification';
import { NotificationProvider, useNotificationContext } from './contexts/NotificationContext';
import { FinancialRecord, Filters, ImportedFile } from './types/financial';
import { processExcelFile, processAccountsPayableFile, processRevenuesFile, processFinancialTransactionsFile, processForecastedEntriesFile, processRevenuesDREFile, processCMVDREFile, processInitialBalancesFile, processOrcamentoDREFile, processReceitaCrediarioFile, processVendasPorUsuarioFile, validateFileFormat } from './utils/excelProcessor';
import { filterData, calculateKPIs } from './utils/dataProcessor';
import { DollarSign, TrendingUp, Pill, ArrowDown, ArrowUp, Calculator, Target, List, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { supabase } from './lib/supabase';
import { startOfMonth, endOfMonth, format, parseISO, subMonths, subDays, differenceInCalendarDays, addDays, getDate, setDate, lastDayOfMonth } from 'date-fns';
import { CapCoaMatchCollector, formatCapCoaLaunchMessage } from './lib/coaCapMatchCollector';
import { computeDespesasOperacionaisValuesMap } from './components/DespesasOperacionaisTable';
import { computeDeducoesValuesMap } from './lib/dreDeducoesValues';
import { computeLucrosDistribuidosValuesMap } from './lib/dreLucrosDistribuidosValues';
import { computeInvestimentoValuesMap } from './lib/dreInvestimentoValues';
import { computeFinanciamentoValuesMap } from './lib/dreFinanciamentoValues';
import { computeOutrasReceitasDespesasValuesMap } from './lib/dreOutrasReceitasDespesasValues';
import { CAP_COA_MATCH_DISMISSED_STORAGE_KEY } from './lib/importAdminCode';

/** Mínimo entre duas leituras do selo "última atualização" (contas a pagar); recarga da página reseta. */
const CONTAS_PAGAR_METADATA_MIN_INTERVAL_MS = 60 * 60 * 1000;

/** Contas a pagar: importações ativas ou sem import_id (ex.: carga direta no Supabase). */
function applyContasAPagarImportFilter(query: any, activeImportIds: string[]): any {
  if (activeImportIds.length > 0) {
    return query.or(`import_id.in.(${activeImportIds.join(',')}),import_id.is.null`);
  }
  return query.is('import_id', null);
}

function AppContent() {
  // Sistema de notificações
  const { notifications, addNotification, removeNotificationsWhere } = useNotificationContext();
  const [activeToast, setActiveToast] = useState<string | null>(null);

  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<any[]>([]);
  const [, setRevenues] = useState<any[]>([]);
  const [, setReceitaCrediario] = useState<any[]>([]);
  const [receitasManuais, setReceitasManuais] = useState<any[]>([]);
  const [vendasPorUsuarioRows, setVendasPorUsuarioRows] = useState<any[]>([]);
  const [directRevenueSalesTotals, setDirectRevenueSalesTotals] = useState<{
    actual: number;
    previous: number;
    prevStart: string;
    prevEnd: string;
    currentStart: string;
    currentEnd: string;
  } | null>(null);
  const [directCmvSalesTotals, setDirectCmvSalesTotals] = useState<{
    actual: number;
    previous: number;
    prevStart: string;
    prevEnd: string;
    currentStart: string;
    currentEnd: string;
  } | null>(null);
  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);
  const [forecastedEntries, setForecastedEntries] = useState<any[]>([]);
  const [revenuesDRE, setRevenuesDRE] = useState<any[]>([]);
  const [cmvDRE, setCmvDRE] = useState<any[]>([]);
  const [initialBalances, setInitialBalances] = useState<any[]>([]);
  const [showLatestInitialBalance, setShowLatestInitialBalance] = useState(false);
  const [currentPage, setCurrentPage] = useState('cashflow');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [filters, setFiltersState] = useState<Filters>({
    companies: [],
    groups: [],
    banks: [],
    startDate: '',
    endDate: ''
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const setFilters = useCallback((next: Filters | ((prev: Filters) => Filters)) => {
    const nextValue = typeof next === 'function' ? (next as (p: Filters) => Filters)(filtersRef.current) : next;
    setFiltersState(nextValue);
  }, []);

  const capCoaMatchIssues = useMemo(() => {
    const col = new CapCoaMatchCollector();
    if (!accountsPayable.length) return [];
    computeDespesasOperacionaisValuesMap(accountsPayable, filters, companies, col);
    computeDeducoesValuesMap(accountsPayable, filters, companies, col);
    computeLucrosDistribuidosValuesMap(accountsPayable, filters, companies, col);
    computeInvestimentoValuesMap(accountsPayable, filters, companies, col);
    computeFinanciamentoValuesMap(accountsPayable, filters, companies, col);
    computeOutrasReceitasDespesasValuesMap(accountsPayable, filters, companies, col);
    return col.getIssues();
  }, [
    accountsPayable,
    filters.startDate,
    filters.endDate,
    filters.groups,
    filters.companies,
    companies
  ]);

  useEffect(() => {
    let dismissed: string[] = [];
    try {
      const raw = sessionStorage.getItem(CAP_COA_MATCH_DISMISSED_STORAGE_KEY);
      if (raw) dismissed = JSON.parse(raw);
    } catch {
      dismissed = [];
    }
    const dismissedSet = new Set(Array.isArray(dismissed) ? dismissed : []);
    const visible = capCoaMatchIssues.filter(i => !dismissedSet.has(i.dedupeKey));

    removeNotificationsWhere(n => n.data?.capCoaMatch === true);

    for (const issue of visible) {
      const title =
        issue.kind === 'fallback_unique_prefix'
          ? 'Plano de contas (CAP): texto esperado ausente'
          : 'Plano de contas (CAP): prefixo ambíguo';
      const hint =
        issue.kind === 'fallback_unique_prefix'
          ? 'Prefixo único no painel: o valor foi alocado, mas o segmento deveria conter o texto da regra. Corrija o plano/lançamento no banco.'
          : 'Várias linhas usam este prefixo e o segmento não contém o texto esperado — não foi possível classificar só pelo prefixo. Corrija o plano de contas.';

      const message = `${hint}\n\nPrefixo: ${issue.prefix}\nTexto esperado no segmento: "${issue.expectedContains}"\nSegmento: "${issue.segmentMatched}"\nRegra: ${issue.ruleLabel}\n\nLançamento:\n${formatCapCoaLaunchMessage(issue.launch)}`;

      addNotification({
        type: 'warning',
        title,
        message,
        data: { capCoaMatch: true, capCoaDedupeKey: issue.dedupeKey }
      });
    }
  }, [capCoaMatchIssues, removeNotificationsWhere, addNotification]);

  const [calendarDate, setCalendarDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });
  const [calendarAccumulatedMode, setCalendarAccumulatedMode] = useState(false); // false = diário, true = acumulado
  const [calendarViewData, setCalendarViewData] = useState<{
    accountsPayable: any[];
    financialTransactions: any[];
    receitasManuais: any[];
  }>({ accountsPayable: [], financialTransactions: [], receitasManuais: [] });
  const [calendarDataLoading, setCalendarDataLoading] = useState(false);
  const [loading, setLoading] = useState<{
    isLoading: boolean;
    currentFile?: string;
    currentIndex?: number;
    totalFiles?: number;
    allCompleted?: boolean;
    progress?: string;
  }>({
    isLoading: false
  });
  const [dataLoading, setDataLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  /** Incrementado ao clicar em "Aplicar filtro" no Sidebar — garante que o load rode sempre (incl. ao aplicar de novo com a mesma seleção) */
  const [filterApplyTick, setFilterApplyTick] = useState(0);
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  /** Maior `updated_at` em contas_a_pagar (inclui edições diretas no Supabase). */
  const [lastContasPagarUpdatedAt, setLastContasPagarUpdatedAt] = useState<string | null>(null);
  const lastContasPagarMetadataFetchAtRef = useRef(0);
  const [companyFormModalOpen, setCompanyFormModalOpen] = useState(false);
  const [companyEditModalOpen, setCompanyEditModalOpen] = useState(false);
  const [duplicateFileModal, setDuplicateFileModal] = useState<{
    isOpen: boolean;
    fileName: string;
    fileType: string;
    pendingFile: File | null;
    pendingType: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances' | 'orcamento_dre' | 'receita_crediario' | 'vendas_por_usuario' | null;
    pendingIndex?: number;
    pendingTotal?: number;
    existingImportId: string;
  }>({ isOpen: false, fileName: '', fileType: '', pendingFile: null, pendingType: null, existingImportId: '' });
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    data: any[];
    type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed' | 'total_inflows' | 'total_outflows' | 'initial_balance';
    loadPaginatedData?: (page: number, pageSize: number, filters: any) => Promise<{ data: any[]; totalCount: number; hasMore: boolean }>;
    initialStartDate?: string;
    initialEndDate?: string;
    sourceTables?: string[];
  }>({
    isOpen: false,
    title: '',
    data: [],
    type: 'generic'
  });
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });
  const [importRole, setImportRole] = useState<'none' | 'user' | 'admin'>('none');
  const [isPermanentlyUnlocked, setIsPermanentlyUnlocked] = useState(false);
  const [dreWarningClosed, setDreWarningClosed] = useState(false);
  const [entregaResultadoHidden, setEntregaResultadoHidden] = useState(true); // padrão: oculto (calendário, gráfico, alertas)
  // unlockClickCount é usado indiretamente através do callback do setState em handleUnlockClick
  // @ts-ignore - valor usado indiretamente via callback do setState
  const [unlockClickCount, setUnlockClickCount] = useState(0);
  const [lastUnlockClickTime, setLastUnlockClickTime] = useState(0);

  // Verificar se está desbloqueado permanentemente ao carregar
  useEffect(() => {
    const savedUnlockState = localStorage.getItem('importPermanentlyUnlocked');
    if (savedUnlockState === 'true') {
      setIsPermanentlyUnlocked(true);
      setImportRole('admin');
    }
  }, []);

  // Aba "Importar dados" removida: evitar ficar preso nessa rota
  useEffect(() => {
    setCurrentPage(p => (p === 'import' ? 'cashflow' : p));
  }, []);

  // Resetar aviso do DRE quando acessar a página
  useEffect(() => {
    if (currentPage === 'dre') {
      setDreWarningClosed(false);
    }
  }, [currentPage]);

  // Normaliza código para comparação (ex.: "02" e "2" são iguais)
  const normalizeCode = (code: any): string => {
    if (!code) return '';
    const strCode = String(code).trim();
    const numCode = parseInt(strCode, 10);
    return isNaN(numCode) ? strCode : String(numCode);
  };

  // Forma canônica para queries: sempre 2 dígitos (02, 03, 04) para bater com business_unit no banco.
  // Evita passar "02" e "2" no .in() e qualquer risco de duplicidade na soma ao filtrar várias empresas.
  const toCanonicalBusinessUnit = (code: any): string => {
    if (!code) return '';
    const strCode = String(code).trim();
    const numCode = parseInt(strCode, 10);
    if (!isNaN(numCode)) return strCode.padStart(2, '0');
    return strCode;
  };

  // Helper: códigos normalizados das empresas filtradas (por grupo e/ou empresa) — usado em filtros client-side
  const getFilteredCompanyCodesNormalized = useMemo((): { codes: string[]; hasActive: boolean } => {
    const hasActive = filters.groups.length > 0 || filters.companies.length > 0;
    if (!hasActive || companies.length === 0) {
      return { codes: [], hasActive: false };
    }
    let filtered = companies;
    if (filters.groups.length > 0) {
      const groupSet = new Set(filters.groups.map((g) => String(g ?? '').trim().toLowerCase()));
      filtered = filtered.filter((c) => groupSet.has(String(c.group_name ?? '').trim().toLowerCase()));
    }
    if (filters.companies.length > 0) {
      const codeMatches = (a: string, b: string) => {
        const na = normalizeCode(a || '');
        const nb = normalizeCode(b || '');
        if (na === nb) return true;
        const ca = toCanonicalBusinessUnit(a || '');
        const cb = toCanonicalBusinessUnit(b || '');
        return !!(ca && cb && ca === cb);
      };
      filtered = filtered.filter((c) =>
        filters.companies.some((code: string) => codeMatches(String(c.company_code ?? ''), code))
      );
    }
    const codes = filtered.map((c) => normalizeCode(c.company_code ?? ''));
    return { codes, hasActive: true };
  }, [companies, filters.groups, filters.companies]);

  // Helper: business_unit deriva de group_name e/ou companies. Inclui forma canônica (02,03,04) e numérica (2,3,4)
  const getFilteredBusinessUnits = (_companiesList?: { company_code?: string; group_name?: string }[]): string[] | null => {
    const list = _companiesList ?? companies;
    if (list.length === 0 || (filters.groups.length === 0 && filters.companies.length === 0)) return null;
    let filtered = list;
    if (filters.groups.length > 0) {
      const groupSet = new Set(filters.groups.map((g) => String(g ?? '').trim().toLowerCase()));
      filtered = filtered.filter((c) => groupSet.has(String(c.group_name ?? '').trim().toLowerCase()));
    }
    if (filters.companies.length > 0) {
      const codeMatches = (a: string, b: string) => {
        const na = normalizeCode(a || '');
        const nb = normalizeCode(b || '');
        if (na === nb) return true;
        const ca = toCanonicalBusinessUnit(a || '');
        const cb = toCanonicalBusinessUnit(b || '');
        return !!(ca && cb && ca === cb);
      };
      filtered = filtered.filter((c) =>
        filters.companies.some((code: string) => codeMatches(String(c.company_code ?? ''), code))
      );
    }
    if (filtered.length === 0) return ['__NO_MATCH__'];
    const codesSet = new Set<string>();
    filtered.forEach((c) => {
      const code = String(c.company_code ?? '').trim();
      if (code) codesSet.add(code); // valor exato como no banco
      const canonical = toCanonicalBusinessUnit(code);
      if (canonical) codesSet.add(canonical);
      const norm = normalizeCode(code);
      if (norm) codesSet.add(norm);
    });
    return codesSet.size > 0 ? Array.from(codesSet) : null;
  };

  // Test Supabase connection on mount
  useEffect(() => {
    testSupabaseConnection();
  }, []);

  // Calcular período padrão (mês atual) quando não houver filtros
  const getDefaultPeriod = () => {
    const now = new Date();
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    const end = format(endOfMonth(now), 'yyyy-MM-dd');
    return { start, end };
  };

  // Mount: carregar dados do dashboard (incl. empresas para o dropdown) e imports. Sem isso o dropdown de empresas fica vazio.
  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      await loadDataFromSupabase(undefined, undefined, { companies: [], groups: [], startDate: '', endDate: '' });
      await loadImportsFromSupabase();
      setInitialLoading(false);
    };
    init();
  }, []);

  // Único ponto que carrega dados: quando filtros mudam ou ao clicar em "Aplicar filtro" (filterApplyTick).
  const loadDataVersionRef = useRef(0);
  const loadInProgressRef = useRef(false);
  const pendingLoadAfterCompleteRef = useRef(false);
  useEffect(() => {
    if (initialLoading || loading.isLoading) return;
    // Sempre usar o filtro atual (ref) para evitar snapshot desatualizado em re-renders
    const f = filtersRef.current;
    const snapshot = {
      companies: [...f.companies],
      groups: [...f.groups],
      startDate: f.startDate ?? '',
      endDate: f.endDate ?? ''
    };
    // Evitar dois loads ao mesmo tempo (ex.: dois setStates no Aplicar geram dois effect runs)
    if (loadInProgressRef.current) {
      pendingLoadAfterCompleteRef.current = true;
      return;
    }
    loadDataFromSupabase(undefined, undefined, snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.companies, filters.groups, filters.startDate, filters.endDate, filterApplyTick]);

  // Resetar estado quando o período mudar
  useEffect(() => {
    setShowLatestInitialBalance(false);
  }, [filters.startDate, filters.endDate]);

  const testSupabaseConnection = async () => {
    console.log('🔌 Testando conexão com Supabase...');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    console.log('📍 URL:', supabaseUrl || 'NÃO CONFIGURADA');
    console.log('🔑 Chave anônima configurada:', supabaseKey ? 'Sim' : 'NÃO CONFIGURADA');
    
    // Verificar se as variáveis estão configuradas
    if (!supabaseUrl || !supabaseKey) {
      const errorMsg = 'Variáveis de ambiente do Supabase não configuradas!\n\nPor favor, configure na Vercel:\n- Settings > Environment Variables\n- VITE_SUPABASE_URL\n- VITE_SUPABASE_ANON_KEY\n\nVeja VERCEL_SETUP.md para mais detalhes.';
      console.error('❌', errorMsg);
      setErrorModal({
        isOpen: true,
        title: 'Configuração do Supabase',
        message: errorMsg
      });
      return;
    }
    
    try {
      // Teste básico: verificar se o cliente foi criado
      if (!supabase) {
        throw new Error('Cliente Supabase não foi criado');
      }
      console.log('✅ Cliente Supabase criado com sucesso');

      // Teste de conexão: fazer uma query simples (mesmo que retorne vazio, confirma que a conexão funciona)
      const { error, count } = await supabase
        .from('empresas')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('❌ Erro na conexão:', error.message);
        console.error('Código do erro:', error.code);
        console.error('Detalhes completos:', error);
        
        // Verificar se é erro de rede
        if (error.message.includes('Failed to fetch') || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
          setErrorModal({
            isOpen: true,
            title: 'Erro de Conexão com Supabase',
            message: `Não foi possível conectar ao Supabase.\n\nPossíveis causas:\n1. Variáveis de ambiente não configuradas na Vercel\n2. URL do Supabase incorreta\n3. Problema de rede\n\nVerifique:\n- Settings > Environment Variables na Vercel\n- Se a URL do Supabase está correta\n- Se o projeto Supabase está ativo\n\nVeja VERCEL_SETUP.md para instruções detalhadas.`
          });
        }
        return;
      }

      console.log('✅ Conexão com Supabase funcionando perfeitamente!');
      console.log(`📊 Total de registros na tabela companies: ${count || 0}`);
    } catch (error: any) {
      console.error('❌ Erro ao testar conexão:', error.message);
      console.error('Erro completo:', error);
      
      if (error.message.includes('Missing Supabase environment variables')) {
        setErrorModal({
          isOpen: true,
          title: 'Configuração do Supabase',
          message: error.message + '\n\nPor favor, configure as variáveis de ambiente na Vercel.\nVeja VERCEL_SETUP.md para instruções detalhadas.'
        });
      }
    }
  };

  const loadDataFromSupabase = async (
    customStartDate?: string,
    customEndDate?: string,
    filtersSnapshot?: { companies: string[]; groups: string[]; startDate: string; endDate: string }
  ) => {
    loadInProgressRef.current = true;
    loadDataVersionRef.current += 1;
    const thisLoadId = loadDataVersionRef.current;
    const snap = filtersSnapshot ?? {
      companies: filters.companies,
      groups: filters.groups,
      startDate: filters.startDate,
      endDate: filters.endDate
    };
    const snapHadActiveFilters = (snap.companies?.length ?? 0) > 0 || (snap.groups?.length ?? 0) > 0;
    const shouldApplyState = () => {
      if (thisLoadId !== loadDataVersionRef.current) return false;
      const curr = filtersRef.current;
      const currHasFilters = (curr.companies?.length ?? 0) > 0 || (curr.groups?.length ?? 0) > 0;
      if (!snapHadActiveFilters && currHasFilters) return false;
      return true;
    };
    const markPendingReloadIfStale = () => {
      const curr = filtersRef.current;
      const currHasFilters = (curr.companies?.length ?? 0) > 0 || (curr.groups?.length ?? 0) > 0;
      if (!snapHadActiveFilters && currHasFilters) pendingLoadAfterCompleteRef.current = true;
    };
    console.log('🔄 Starting to load data from Supabase...', { loadId: thisLoadId, snapshotCompanies: snap.companies?.length ?? 0, snapshotCompaniesList: snap.companies });
    setDataLoading(true);

    try {
      // Período: snapshot dos filtros (evita que load antigo sobrescreva com estado desatualizado)
      let startDate: string;
      let endDate: string;
    
      if (customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      } else if (snap.startDate && snap.endDate && snap.startDate.trim() !== '' && snap.endDate.trim() !== '') {
        startDate = snap.startDate;
        endDate = snap.endDate;
      } else {
        const defaultPeriod = getDefaultPeriod();
        startDate = defaultPeriod.start;
        endDate = defaultPeriod.end;
      }
    
      const startDateObj = parseISO(startDate);
      const prevMonthObj = subMonths(startDateObj, 1);
      const prevStart = format(startOfMonth(prevMonthObj), 'yyyy-MM-dd');
      const prevEnd = format(endOfMonth(prevMonthObj), 'yyyy-MM-dd');

      console.log('📊 Loading companies...');
      const { data: companiesData, error: companiesError } = await supabase
        .from('empresas')
        .select('id, company_code, company_name, group_name, name')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('❌ Error loading companies:', companiesError);
        throw companiesError;
      }
      if (companiesData) {
        setCompanies(companiesData);
      }

      const { data: importsData, error: importsError } = await supabase
        .from('importacoes')
        .select('id, is_deleted');

      if (importsError) throw importsError;

      const activeImportIds = (importsData || [])
        .filter((imp: any) => !imp.is_deleted)
        .map((imp: any) => imp.id);

      const hasActiveImports = activeImportIds.length > 0;

      // Selo "última atualização" — no máx. a cada 60 min (ref zera a cada recarga da página)
      const shouldFetchContasPagarMetadata =
        lastContasPagarMetadataFetchAtRef.current === 0 ||
        Date.now() - lastContasPagarMetadataFetchAtRef.current >= CONTAS_PAGAR_METADATA_MIN_INTERVAL_MS;
      if (shouldFetchContasPagarMetadata) {
        try {
          const [byUpdated, byCreated] = await Promise.all([
            supabase
              .from('contas_a_pagar')
              .select('updated_at')
              .not('updated_at', 'is', null)
              .order('updated_at', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('contas_a_pagar')
              .select('created_at')
              .not('created_at', 'is', null)
              .order('created_at', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle()
          ]);
          if (byUpdated.error) {
            console.warn('⚠️ Não foi possível obter max(updated_at) de contas_a_pagar:', byUpdated.error);
          }
          if (byCreated.error) {
            console.warn('⚠️ Não foi possível obter max(created_at) de contas_a_pagar:', byCreated.error);
          }
          const tU = byUpdated.data?.updated_at;
          const tC = byCreated.data?.created_at;
          const msU = tU ? new Date(tU).getTime() : 0;
          const msC = tC ? new Date(tC).getTime() : 0;
          const chosen =
            msU > 0 && msC > 0
              ? msU >= msC
                ? tU!
                : tC!
              : msU > 0
                ? tU!
                : msC > 0
                  ? tC!
                  : null;
          if (shouldApplyState()) {
            setLastContasPagarUpdatedAt(chosen);
            lastContasPagarMetadataFetchAtRef.current = Date.now();
          }
        } catch (capTsEx) {
          console.warn('⚠️ Exceção ao buscar última data em contas_a_pagar:', capTsEx);
          if (shouldApplyState()) setLastContasPagarUpdatedAt(null);
        }
      }

      // business_unit: deriva de group_name e/ou companies. Inclui canônico (02,03,04) e numérico (2,3,4)
      let filteredBusinessUnits: string[] | null = null;
      if (companiesData && ((snap.groups?.length ?? 0) > 0 || (snap.companies?.length ?? 0) > 0)) {
        let filtered = companiesData as { company_code?: string; group_name?: string }[];
        if ((snap.groups?.length ?? 0) > 0) {
          const groupSet = new Set(snap.groups!.map((g: string) => String(g ?? '').trim().toLowerCase()));
          filtered = filtered.filter((c: any) => groupSet.has(String(c.group_name ?? '').trim().toLowerCase()));
        }
        if ((snap.companies?.length ?? 0) > 0) {
          const codeMatches = (a: string, b: string) => {
            const na = normalizeCode(a || '');
            const nb = normalizeCode(b || '');
            if (na === nb) return true;
            const ca = toCanonicalBusinessUnit(a || '');
            const cb = toCanonicalBusinessUnit(b || '');
            return !!(ca && cb && ca === cb);
          };
          filtered = filtered.filter((c: any) =>
            snap.companies!.some((code: string) => codeMatches(String(c.company_code ?? ''), code))
          );
        }
        if (filtered.length > 0) {
          const codesSet = new Set<string>();
          filtered.forEach((c: any) => {
            const code = String(c.company_code ?? '').trim();
            if (code) codesSet.add(code); // valor exato como no banco
            const canonical = toCanonicalBusinessUnit(code);
            if (canonical) codesSet.add(canonical);
            const norm = normalizeCode(code);
            if (norm) codesSet.add(norm);
          });
          filteredBusinessUnits = codesSet.size > 0 ? Array.from(codesSet) : null;
          if (snap.groups?.length) {
            console.log(`📌 Filtro grupo(s): ${snap.groups.join(', ')} → ${filtered.length} empresas, ${codesSet.size} business_units:`, Array.from(codesSet).slice(0, 20).join(', ') + (codesSet.size > 20 ? '...' : ''));
          }
        } else {
          // Filtros ativos mas nenhuma empresa corresponde → sentinela para retornar vazio
          filteredBusinessUnits = ['__NO_MATCH__'];
        }
      }

      // Load accounts payable - FILTRADO POR DATA E BUSINESS_UNIT NO BANCO (otimizado com índices)
      // IMPORTANTE: Incluir registros com payment_date no período OU registros sem payment_date mas com due_date no período
      let apData: any[] | null = [];
      {
        // Carregar registros do período em lotes
        let allData: any[] = [];
        // Supabase limita ~1000 linhas por query; usar 1000 para maximizar e evitar perda de dados
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;
        
        // Query 1: Registros com payment_date no período atual OU no mês anterior (para coluna comparativa da tabela Despesas Operacionais)
        while (hasMore) {
          let query = applyContasAPagarImportFilter(
            supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id'),
            activeImportIds
          )
            .not('payment_date', 'is', null)
            .gte('payment_date', prevStart)
            .lte('payment_date', endDate);
          
          // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          
          const { data, error } = await query
            .order('payment_date', { ascending: false })
            .range(offset, offset + batchSize - 1);
          
          if (error) {
            console.error('❌ Error loading accounts payable batch (with payment_date):', error);
            throw error;
          }
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        
        // Query 2: Registros com due_date no período atual OU no mês anterior (para previsto e para coluna comparativa)
        // Inclui todos com vencimento no período; PAGINADO para não bater no limite padrão do Supabase (1000 linhas)
        let offset2 = 0;
        let hasMore2 = true;
        while (hasMore2) {
          let query2 = applyContasAPagarImportFilter(
            supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id'),
            activeImportIds
          )
            .gte('due_date', prevStart)
            .lte('due_date', endDate);
          
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query2 = query2.in('business_unit', filteredBusinessUnits);
          }
          
          const { data: data2, error: error2 } = await query2
            .order('due_date', { ascending: false })
            .range(offset2, offset2 + batchSize - 1);
          
          if (error2) {
            console.error('❌ Error loading accounts payable (due_date in period):', error2);
            throw error2;
          }
          
          if (data2 && data2.length > 0) {
            const existingIds = new Set(allData.map(item => item.id));
            const newData = data2.filter(item => !existingIds.has(item.id));
            allData = [...allData, ...newData];
            offset2 += batchSize;
            hasMore2 = data2.length === batchSize;
          } else {
            hasMore2 = false;
          }
        }
        
        apData = allData;
        console.log(`✅ Carregados ${apData.length} registros de contas_a_pagar (período ${startDate} a ${endDate} + mês anterior ${prevStart} a ${prevEnd})${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
        console.log(`   - Com payment_date no período: ${allData.filter(ap => ap.payment_date).length}`);
        console.log(`   - Com due_date no período: ${allData.filter(ap => ap.due_date).length}`);
      }
      if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
      if (apData) {
        setAccountsPayable(apData);
      }

      // Receita: usar apenas receitas_manuais (paginação 500)
      setRevenues([]);
      setReceitaCrediario([]);
      let receitasManuaisData: any[] = [];
      try {
        let allRec: any[] = [];
        let offsetRec = 0;
        let hasMoreRec = true;
        while (hasMoreRec) {
          let query = supabase
            .from('receitas_manuais')
            .select('id, status, business_unit, conta, descricao, data, valor')
            .gte('data', startDate)
            .lte('data', endDate)
            .order('data', { ascending: false });
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          const { data, error } = await query.range(offsetRec, offsetRec + 999);
          if (error) {
            console.warn('⚠️ Erro ao carregar receitas_manuais (tabela pode não existir):', error);
            hasMoreRec = false;
            break;
          }
          const batch = data || [];
          allRec = [...allRec, ...batch];
          offsetRec += 1000;
          hasMoreRec = batch.length === 1000;
        }
        receitasManuaisData = allRec;
        console.log(`✅ Carregados ${receitasManuaisData.length} registros de receitas_manuais do período ${startDate} a ${endDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      } catch (err) {
        console.warn('⚠️ Exceção ao carregar receitas_manuais:', err);
      }
      if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
      setReceitasManuais(receitasManuaisData);

      // Receita Direta (Entrega de Resultado): usar vendas_por_usuario para o card (período atual + período anterior)
      // Regra do "Período anterior":
      // - Se o período começar no dia 1 do mês: deslocar em meses (mesmo span de meses do filtro)
      //   Ex: mês atual => mês anterior; últimos 3 meses => 3 meses anteriores.
      // - Caso contrário: pegar um período imediatamente anterior com a mesma quantidade de dias
      //   Ex: hoje–ontem => 2 dias anteriores; semana atual => semana anterior; últimos 15 dias => 15 dias anteriores.
      // IMPORTANTE: Supabase limita SELECT a ~1000 linhas por padrão, então aqui usamos paginação em lotes.
      try {
        const startObj = parseISO(startDate);
        const endObj = parseISO(endDate);
        const isMonthBased =
          format(startObj, 'yyyy-MM-dd') === format(startOfMonth(startObj), 'yyyy-MM-dd');

        let prevStartSales: string;
        let prevEndSales: string;

        if (isMonthBased) {
          // Quando o período começa no dia 1 do mês: período anterior = mesma quantidade de dias.
          // Ex.: 01/03 a 09/03 (9 dias) => 01/02 a 09/02 (9 dias), NÃO o mês inteiro de fevereiro.
          const prevStartObj = startOfMonth(subMonths(startObj, 1));
          const lastDayPrev = getDate(lastDayOfMonth(prevStartObj));
          const prevEndDay = Math.min(getDate(endObj), lastDayPrev);
          const prevEndObj = setDate(prevStartObj, prevEndDay);
          prevStartSales = format(prevStartObj, 'yyyy-MM-dd');
          prevEndSales = format(prevEndObj, 'yyyy-MM-dd');
        } else {
          // Para períodos arbitrários (não iniciando no dia 1), usamos exatamente a mesma quantidade de dias,
          // imediatamente antes da data inicial atual.
          const daysSpan = Math.max(1, differenceInCalendarDays(endObj, startObj) + 1);
          const prevEndObj = subDays(startObj, 1);
          const prevStartObj = subDays(prevEndObj, daysSpan - 1);
          prevStartSales = format(prevStartObj, 'yyyy-MM-dd');
          prevEndSales = format(prevEndObj, 'yyyy-MM-dd');
        }

        const batchSizeSales = 1000; // Supabase limita ~1000/query; usar 1000 para não perder dados
        let offsetSales = 0;
        let hasMoreSales = true;
        let allSales: any[] = [];

        const endDateObj = parseISO(endDate);
        const nextEndDateStr = format(addDays(endDateObj, 1), 'yyyy-MM-dd');

        while (hasMoreSales) {
          let q = supabase
            .from('vendas_por_usuario')
            .select('id, business_unit, data, usuario, amount, custo, lucro, qtd_vendas, qtd_itens')
            .gte('data', prevStartSales)
            // Usar limite superior exclusivo para garantir que incluímos todo o último dia,
            // mesmo que a coluna seja TIMESTAMP (>= prevStartSales e < diaSeguinteAoFim).
            .lt('data', nextEndDateStr)
            .order('data', { ascending: false })
            .range(offsetSales, offsetSales + batchSizeSales - 1);

          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            q = q.in('business_unit', filteredBusinessUnits);
          }

          const { data: salesData, error: salesError } = await q;
          if (salesError) {
            console.warn('⚠️ Erro ao carregar vendas_por_usuario (Entrega de Resultado):', salesError);
            if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
            setVendasPorUsuarioRows([]);
            setDirectRevenueSalesTotals(null);
            setDirectCmvSalesTotals(null);
            hasMoreSales = false;
            break;
          }

          const batch = salesData || [];
          allSales = [...allSales, ...batch];

          if (batch.length < batchSizeSales) {
            hasMoreSales = false;
          } else {
            offsetSales += batchSizeSales;
          }
        }

        const rows = allSales;
        console.log(`✅ Carregados ${rows.length} registros de vendas_por_usuario (período ${prevStartSales} a ${endDate}${filteredBusinessUnits ? `, ${filteredBusinessUnits.length} business units` : ''})`);

        // Normalizar data para YYYY-MM-DD (Supabase pode retornar ISO com hora, ex: 2024-07-15T00:00:00.000Z)
        const toDateStr = (d: any) => (d == null ? '' : String(d).split('T')[0]);
        const num = (v: any) => Number(v) || 0;
        const actual = rows
          .filter(r => toDateStr(r.data) >= startDate && toDateStr(r.data) <= endDate)
          .reduce((s, r) => s + num(r.amount), 0);
        const previous = rows
          .filter(r => toDateStr(r.data) >= prevStartSales && toDateStr(r.data) <= prevEndSales)
          .reduce((s, r) => s + num(r.amount), 0);

        const cmvActual = rows
          .filter(r => toDateStr(r.data) >= startDate && toDateStr(r.data) <= endDate)
          .reduce((s, r) => s + num(r.custo), 0);
        const cmvPrevious = rows
          .filter(r => toDateStr(r.data) >= prevStartSales && toDateStr(r.data) <= prevEndSales)
          .reduce((s, r) => s + num(r.custo), 0);

        if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
        setVendasPorUsuarioRows(rows);
        setDirectRevenueSalesTotals({
          actual,
          previous,
          prevStart: prevStartSales,
          prevEnd: prevEndSales,
          currentStart: startDate,
          currentEnd: endDate
        });
        setDirectCmvSalesTotals({
          actual: cmvActual,
          previous: cmvPrevious,
          prevStart: prevStartSales,
          prevEnd: prevEndSales,
          currentStart: startDate,
          currentEnd: endDate
        });
      } catch (err) {
        console.warn('⚠️ Exceção ao carregar Entrega de Resultado (vendas_por_usuario):', err);
        if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
        setVendasPorUsuarioRows([]);
        setDirectRevenueSalesTotals(null);
        setDirectCmvSalesTotals(null);
      }

      // Load financial transactions - FILTRADO POR DATA E BUSINESS_UNIT NO BANCO (paginação 500)
      let transactionsData: any[] | null = [];
      if (hasActiveImports) {
        try {
          let allTx: any[] = [];
          let offsetTx = 0;
          let hasMoreTx = true;
          while (hasMoreTx) {
            let query = supabase
              .from('transacoes_financeiras')
              .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, descricao, id')
              .in('import_id', activeImportIds)
              .gte('transaction_date', startDate)
              .lte('transaction_date', endDate);
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            }
            const { data, error } = await query
              .order('transaction_date', { ascending: false })
              .range(offsetTx, offsetTx + 999);
            if (error) {
              console.warn('⚠️ Error loading financial transactions (table may not exist):', error);
              hasMoreTx = false;
              break;
            }
            const batch = data || [];
            allTx = [...allTx, ...batch];
            offsetTx += 1000;
            hasMoreTx = batch.length === 1000;
          }
          transactionsData = allTx;
          console.log(`✅ Carregados ${transactionsData?.length || 0} registros de transacoes_financeiras do período ${startDate} a ${endDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
        } catch (err) {
          console.warn('⚠️ Exception loading financial transactions:', err);
          transactionsData = [];
        }
      }
      if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
      if (transactionsData) {
        setFinancialTransactions(transactionsData);
      }

      // Load forecasted entries - FILTRADO POR DATA E BUSINESS_UNIT NO BANCO (paginação 500)
      let forecastedData: any[] | null = [];
      if (hasActiveImports) {
        let allPrev: any[] = [];
        let offsetPrev = 0;
        let hasMorePrev = true;
        while (hasMorePrev) {
          let query = supabase
            .from('previstos')
            .select('import_id, business_unit, due_date, amount, status, chart_of_accounts, supplier, id')
            .in('import_id', activeImportIds)
            .gte('due_date', startDate)
            .lte('due_date', endDate);
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          const { data, error } = await query
            .order('due_date', { ascending: false })
            .range(offsetPrev, offsetPrev + 999);
          if (error) throw error;
          const batch = data || [];
          allPrev = [...allPrev, ...batch];
          offsetPrev += 1000;
          hasMorePrev = batch.length === 1000;
        }
        forecastedData = allPrev;
        console.log(`✅ Carregados ${forecastedData?.length || 0} registros de previstos do período ${startDate} a ${endDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
      if (forecastedData) {
        setForecastedEntries(forecastedData);
      }

      // Load revenues DRE - Carregar período amplo (últimos 24 meses), paginação 500
      let revenuesDREData: any[] | null = [];
      if (hasActiveImports) {
        const wideEndDate = endDate;
        const wideStartDate = new Date(new Date(wideEndDate).setMonth(new Date(wideEndDate).getMonth() - 24))
          .toISOString()
          .split('T')[0];
        let allRev: any[] = [];
        let offsetRev = 0;
        let hasMoreRev = true;
        while (hasMoreRev) {
          let query = supabase
            .from('receitas_dre')
            .select('import_id, business_unit, issue_date, amount, id')
            .in('import_id', activeImportIds)
            .gte('issue_date', wideStartDate)
            .lte('issue_date', wideEndDate);
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          const { data, error } = await query
            .order('issue_date', { ascending: false })
            .range(offsetRev, offsetRev + 999);
          if (error) {
            console.error('❌ Error loading revenues DRE:', error);
            throw error;
          }
          const batch = data || [];
          allRev = [...allRev, ...batch];
          offsetRev += 1000;
          hasMoreRev = batch.length === 1000;
        }
        revenuesDREData = allRev;
        console.log(`✅ Carregados ${revenuesDREData?.length || 0} registros de receitas_dre do período amplo ${wideStartDate} a ${wideEndDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
      if (revenuesDREData) {
        setRevenuesDRE(revenuesDREData);
      }

      // Load CMV DRE - Carregar período amplo (últimos 24 meses), paginação 500
      let cmvDREData: any[] | null = [];
      if (hasActiveImports) {
        const wideEndDate = endDate;
        const wideStartDate = new Date(new Date(wideEndDate).setMonth(new Date(wideEndDate).getMonth() - 24))
          .toISOString()
          .split('T')[0];
        let allCmv: any[] = [];
        let offsetCmv = 0;
        let hasMoreCmv = true;
        while (hasMoreCmv) {
          let query = supabase
            .from('cmv_dre')
            .select('import_id, business_unit, issue_date, amount, chart_of_accounts, status, id')
            .in('import_id', activeImportIds)
            .gte('issue_date', wideStartDate)
            .lte('issue_date', wideEndDate);
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          const { data, error } = await query
            .order('issue_date', { ascending: false })
            .range(offsetCmv, offsetCmv + 999);
          if (error) {
            console.error('❌ Error loading CMV DRE:', error);
            throw error;
          }
          const batch = data || [];
          allCmv = [...allCmv, ...batch];
          offsetCmv += 1000;
          hasMoreCmv = batch.length === 1000;
        }
        cmvDREData = allCmv;
        console.log(`✅ Carregados ${cmvDREData?.length || 0} registros de cmv_dre do período amplo ${wideStartDate} a ${wideEndDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
      if (cmvDREData) {
        setCmvDRE(cmvDREData);
      }

      // Load initial_balances - CARREGAR TODOS OS SALDOS (sem filtro de data), paginação 500
      try {
        let initialBalancesData: any[] | null = [];
        let allBal: any[] = [];
        let offsetBal = 0;
        let hasMoreBal = true;
        while (hasMoreBal) {
          let query = supabase
            .from('saldos_iniciais')
            .select('import_id, business_unit, balance_date, balance, bank_name, id')
            .order('balance_date', { ascending: false });
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          const { data, error } = await query.range(offsetBal, offsetBal + 999);
          if (error) {
            console.error('❌ Error loading initial balances:', error);
            hasMoreBal = false;
            break;
          }
          const batch = data || [];
          allBal = [...allBal, ...batch];
          offsetBal += 1000;
          hasMoreBal = batch.length === 1000;
        }
        initialBalancesData = allBal;
        console.log(`✅ Carregados ${initialBalancesData.length} registros de saldos_iniciais${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
        
        if (!shouldApplyState()) { markPendingReloadIfStale(); return; }
        // Sempre definir o estado, mesmo se vazio
        setInitialBalances(initialBalancesData);
      } catch (initialBalanceError) {
        console.error('❌ Exception loading initial balances:', initialBalanceError);
        if (thisLoadId === loadDataVersionRef.current) setInitialBalances([]);
      }

    } catch (error) {
      console.error('Error loading data from Supabase:', error);
    } finally {
      loadInProgressRef.current = false;
      if (thisLoadId === loadDataVersionRef.current) {
        setDataLoading(false);
      }
      if (pendingLoadAfterCompleteRef.current) {
        pendingLoadAfterCompleteRef.current = false;
        const f = filtersRef.current;
        loadDataFromSupabase(undefined, undefined, {
          companies: [...f.companies],
          groups: [...f.groups],
          startDate: f.startDate ?? '',
          endDate: f.endDate ?? ''
        });
      }
    }
  };

  /** Refresh dos dados usando SEMPRE o filtro atual (ref). Referência estável para não disparar efeitos em cascata. */
  const refreshWithCurrentFilters = useCallback(() => {
    const f = filtersRef.current;
    const snapshot = {
      companies: [...f.companies],
      groups: [...f.groups],
      startDate: f.startDate ?? '',
      endDate: f.endDate ?? ''
    };
    loadDataFromSupabase(undefined, undefined, snapshot);
  }, []);

  /** Carrega dados do calendário para o mês selecionado (independente do filtro de período global) */
  const loadCalendarData = useCallback(async (year: number, month: number, accumulatedMode: boolean) => {
    setCalendarDataLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = format(firstDay, 'yyyy-MM-dd');
      const endDate = format(lastDay, 'yyyy-MM-dd');
      const rangeStart = accumulatedMode
        ? format(new Date(year, 0, 1), 'yyyy-MM-dd')
        : startDate;

      const { data: importsData } = await supabase.from('importacoes').select('id, is_deleted');
      const activeImportIds = (importsData || []).filter((imp: any) => !imp.is_deleted).map((imp: any) => imp.id);
      const hasActiveImports = activeImportIds.length > 0;

      const f = filtersRef.current;
      let filteredBusinessUnits: string[] | null = null;
      if (companies.length > 0 && ((f.groups?.length ?? 0) > 0 || (f.companies?.length ?? 0) > 0)) {
        let filtered = [...companies];
        if ((f.groups?.length ?? 0) > 0) {
          const groupSet = new Set(f.groups!.map((g: string) => String(g ?? '').trim().toLowerCase()));
          filtered = filtered.filter((c) => groupSet.has(String(c.group_name ?? '').trim().toLowerCase()));
        }
        if ((f.companies?.length ?? 0) > 0) {
          const codeMatches = (a: string, b: string) => {
            const na = normalizeCode(a || '');
            const nb = normalizeCode(b || '');
            if (na === nb) return true;
            const ca = toCanonicalBusinessUnit(a || '');
            const cb = toCanonicalBusinessUnit(b || '');
            return !!(ca && cb && ca === cb);
          };
          filtered = filtered.filter((c) =>
            f.companies!.some((code: string) => codeMatches(String(c.company_code ?? ''), code))
          );
        }
        if (filtered.length > 0) {
          const codesSet = new Set<string>();
          filtered.forEach((c) => {
            const code = String(c.company_code ?? '').trim();
            if (code) codesSet.add(code);
            const canonical = toCanonicalBusinessUnit(code);
            if (canonical) codesSet.add(canonical);
            const norm = normalizeCode(code);
            if (norm) codesSet.add(norm);
          });
          filteredBusinessUnits = codesSet.size > 0 ? Array.from(codesSet) : ['__NO_MATCH__'];
        } else {
          filteredBusinessUnits = ['__NO_MATCH__'];
        }
      }

      let apData: any[] = [];
      let transactionsData: any[] = [];
      let receitasManuaisData: any[] = [];

      {
        const allAp: any[] = [];
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          let q = applyContasAPagarImportFilter(
            supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id'),
            activeImportIds
          )
            .not('payment_date', 'is', null)
            .gte('payment_date', rangeStart)
            .lte('payment_date', endDate);
          if (filteredBusinessUnits?.length) q = q.in('business_unit', filteredBusinessUnits);
          const { data, error } = await q.order('payment_date', { ascending: false }).range(offset, offset + 999);
          if (error) throw error;
          if (data?.length) {
            allAp.push(...data);
            offset += 1000;
            hasMore = data.length === 1000;
          } else hasMore = false;
        }
        offset = 0;
        hasMore = true;
        while (hasMore) {
          let q2 = applyContasAPagarImportFilter(
            supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id'),
            activeImportIds
          )
            .gte('due_date', rangeStart)
            .lte('due_date', endDate);
          if (filteredBusinessUnits?.length) q2 = q2.in('business_unit', filteredBusinessUnits);
          const { data: data2, error: err2 } = await q2.order('due_date', { ascending: false }).range(offset, offset + 999);
          if (err2) throw err2;
          if (data2?.length) {
            const ids = new Set(allAp.map((x: any) => x.id));
            allAp.push(...data2.filter((x: any) => !ids.has(x.id)));
            offset += 1000;
            hasMore = data2.length === 1000;
          } else hasMore = false;
        }
        apData = allAp;
      }

      try {
        let offsetRm = 0;
        let hasMoreRm = true;
        while (hasMoreRm) {
          let q = supabase
            .from('receitas_manuais')
            .select('id, status, business_unit, conta, descricao, data, valor')
            .gte('data', rangeStart)
            .lte('data', endDate)
            .order('data', { ascending: false });
          if (filteredBusinessUnits?.length) q = q.in('business_unit', filteredBusinessUnits);
          const { data, error } = await q.range(offsetRm, offsetRm + 999);
          if (!error && data?.length) {
            receitasManuaisData = [...receitasManuaisData, ...data];
            offsetRm += 1000;
            hasMoreRm = data.length === 1000;
          } else hasMoreRm = false;
        }
      } catch (_) {}

      if (hasActiveImports) {
        try {
          let offsetTf = 0;
          let hasMoreTf = true;
          while (hasMoreTf) {
            let q = supabase
              .from('transacoes_financeiras')
              .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, descricao, id')
              .in('import_id', activeImportIds)
              .gte('transaction_date', rangeStart)
              .lte('transaction_date', endDate)
              .order('transaction_date', { ascending: false });
            if (filteredBusinessUnits?.length) q = q.in('business_unit', filteredBusinessUnits);
            const { data, error } = await q.range(offsetTf, offsetTf + 999);
            if (!error && data?.length) {
              transactionsData = [...transactionsData, ...data];
              offsetTf += 1000;
              hasMoreTf = data.length === 1000;
            } else hasMoreTf = false;
          }
        } catch (_) {}
      }

      setCalendarViewData({
        accountsPayable: apData,
        financialTransactions: transactionsData,
        receitasManuais: receitasManuaisData
      });
    } catch (err) {
      console.error('Erro ao carregar dados do calendário:', err);
      setCalendarViewData({ accountsPayable: [], financialTransactions: [], receitasManuais: [] });
    } finally {
      setCalendarDataLoading(false);
    }
  }, [companies]);

  // Carregar dados do calendário ao mudar mês, modo acumulado ou filtro de empresas/grupos
  useEffect(() => {
    loadCalendarData(calendarDate.year, calendarDate.month, calendarAccumulatedMode);
  }, [calendarDate.year, calendarDate.month, calendarAccumulatedMode, filters.companies, filters.groups, loadCalendarData]);

  const loadImportsFromSupabase = async () => {
    try {
      const { data: importsData, error } = await supabase
        .from('importacoes')
        .select('id, file_name, file_type, imported_at, record_count, is_deleted')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      if (importsData) {
        const formattedImports: ImportedFile[] = importsData.map((imp: any) => ({
          id: imp.id,
          name: imp.file_name,
          type: getTypeFromTableName(imp.file_type), // Converter de português para inglês
          uploadDate: imp.imported_at,
          recordCount: imp.record_count,
          status: 'success',
          isDeleted: imp.is_deleted === true
        }));
        setImportedFiles(formattedImports);
      }
    } catch (error) {
      console.error('Error loading imports from Supabase:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    setLoading({
      isLoading: true,
      allCompleted: false
    });
    try {
      const processedRecords = await processExcelFile(file);
      setRecords(processedRecords);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing Excel file. Please check the format and try again.');
    } finally {
      setLoading({
        isLoading: false,
        allCompleted: false
      });
    }
  };


  // Função para converter tipo em inglês para nome da tabela em português
  const getTableNameFromType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'companies': 'empresas',
      'accounts_payable': 'contas_a_pagar',
      'revenues': 'receitas',
      'financial_transactions': 'transacoes_financeiras',
      'forecasted_entries': 'previstos',
      'revenues_dre': 'receitas_dre',
      'cmv_dre': 'cmv_dre',
      'initial_balances': 'saldos_iniciais',
      'orcamento_dre': 'orcamento_dre',
      'transactions': 'transactions',
      'receita_crediario': 'receita_crediario',
      'vendas_por_usuario': 'vendas_por_usuario'
    };
    return typeMap[type] || type;
  };

  // Função reversa: converter nome da tabela em português para tipo em inglês
  const getTypeFromTableName = (tableName: string): ImportedFile['type'] => {
    const reverseMap: Record<string, ImportedFile['type']> = {
      'empresas': 'companies',
      'contas_a_pagar': 'accounts_payable',
      'receitas': 'revenues',
      'transacoes_financeiras': 'financial_transactions',
      'previstos': 'forecasted_entries',
      'receitas_dre': 'revenues_dre',
      'cmv_dre': 'cmv_dre',
      'saldos_iniciais': 'initial_balances',
      'orcamento_dre': 'orcamento_dre',
      'transactions': 'transactions',
      'receita_crediario': 'receita_crediario',
      'vendas_por_usuario': 'vendas_por_usuario'
    };
    return reverseMap[tableName] || 'companies'; // Fallback para um tipo válido
  };


  const moveOldImportsToTrash = async (fileType: string) => {
    try {
      const tableName = getTableNameFromType(fileType);
      console.log(`🗑️ Movendo imports antigos do tipo ${tableName} para a lixeira`);
      
      // Buscar todos os imports ativos do mesmo tipo
      const { data: oldImports, error: fetchError } = await supabase
        .from('importacoes')
        .select('id')
        .eq('file_type', tableName)
        .eq('is_deleted', false);

      if (fetchError) throw fetchError;

      if (oldImports && oldImports.length > 0) {
        // Marcar todos como deletados (soft delete)
        const importIds = oldImports.map(imp => imp.id);
        const { error: updateError } = await supabase
          .from('importacoes')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString()
          })
          .in('id', importIds);

        if (updateError) throw updateError;

        // Atualizar UI
        setImportedFiles(prev =>
          prev.map(f => 
            importIds.includes(f.id) ? { ...f, isDeleted: true } : f
          )
        );

        console.log(`✅ ${oldImports.length} import(s) movido(s) para a lixeira`);
      }
    } catch (error) {
      console.error('❌ Erro ao mover imports para a lixeira:', error);
      throw error;
    }
  };

  const deleteOldImportData = async (importId: string, fileType: string) => {
    try {
      console.log(`🗑️ Deletando dados antigos do import ${importId} (tipo: ${fileType})`);
      
      // fileType já vem como nome da tabela em português do banco
      // Delete data from the appropriate table based on file type
      if (fileType === 'contas_a_pagar') {
        const { error } = await supabase
          .from('contas_a_pagar')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de contas a pagar deletados');
      } else if (fileType === 'receitas') {
        const { error } = await supabase
          .from('receitas')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de receitas deletados');
      } else if (fileType === 'transacoes_financeiras') {
        const { error } = await supabase
          .from('transacoes_financeiras')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de transações financeiras deletados');
      } else if (fileType === 'previstos') {
        const { error } = await supabase
          .from('previstos')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de lançamentos previstos deletados');
      } else if (fileType === 'receitas_dre') {
        const { error } = await supabase
          .from('receitas_dre')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de receitas DRE deletados');
      } else if (fileType === 'cmv_dre') {
        const { error } = await supabase
          .from('cmv_dre')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de CMV DRE deletados');
      } else if (fileType === 'saldos_iniciais') {
        const { error } = await supabase
          .from('saldos_iniciais')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de saldos iniciais deletados');
      } else if (fileType === 'orcamento_dre') {
        const { error } = await supabase
          .from('orcamento_dre')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de orçamento DRE deletados');
      } else if (fileType === 'vendas_por_usuario') {
        const { error } = await supabase
          .from('vendas_por_usuario')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de vendas por usuário deletados');
      } else if (fileType === 'receita_crediario') {
        const { error } = await supabase
          .from('receita_crediario')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de receita crediário deletados');
      } else if (fileType === 'empresas') {
        // Para empresas, não deletamos por import_id pois não há essa coluna
        // O upsert na função handleDataImport já atualiza os dados existentes
        console.log('ℹ️ Empresas usa upsert, não é necessário deletar dados antigos');
      }

      // Delete the import record
      const { error: deleteError } = await supabase
        .from('importacoes')
        .delete()
        .eq('id', importId);

      if (deleteError) throw deleteError;
      console.log('✅ Registro de import deletado');

      // Remove from UI
      setImportedFiles(prev => prev.filter(f => f.id !== importId));
      console.log('✅ Arquivo removido da UI');
    } catch (error) {
      console.error('❌ Erro ao deletar dados antigos:', error);
      throw error;
    }
  };

  const handleSaveCompany = async (company: { company_code: string; company_name: string; name: string; group_name: string }) => {
    try {
      // Verificar se já existe uma empresa com o mesmo código
      const { data: existingCompany, error: checkError } = await supabase
        .from('empresas')
        .select('company_code')
        .eq('company_code', company.company_code)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Erro ao verificar empresa existente: ${checkError.message}`);
      }

      if (existingCompany) {
        throw new Error('Já existe uma empresa cadastrada com este código da loja.');
      }

      // Inserir a nova empresa
      const { error: insertError } = await supabase
        .from('empresas')
        .insert([{
          company_code: company.company_code,
          company_name: company.company_name,
          name: company.name,
          group_name: company.group_name
        }]);

      if (insertError) {
        throw new Error(`Erro ao cadastrar empresa: ${insertError.message}`);
      }

      // Recarregar empresas do banco
      const { data: companiesData, error: companiesError } = await supabase
        .from('empresas')
        .select('id, company_code, company_name, group_name, name')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Erro ao recarregar empresas:', companiesError);
      } else {
        setCompanies(companiesData || []);
      }

      // Adicionar notificação de sucesso
      const successNotificationId = addNotification({
        type: 'success',
        title: 'Empresa Cadastrada',
        message: `A empresa "${company.company_name}" (${company.company_code}) foi cadastrada com sucesso.`
      });
      setActiveToast(successNotificationId);
    } catch (error: any) {
      console.error('Erro ao salvar empresa:', error);
      
      // Adicionar notificação de erro
      const errorNotificationId = addNotification({
        type: 'error',
        title: 'Erro ao Cadastrar Empresa',
        message: error.message || 'Erro ao cadastrar empresa. Tente novamente.'
      });
      setActiveToast(errorNotificationId);
      
      throw error;
    }
  };

  const handleUpdateCompany = async (id: string, company: { company_code: string; company_name: string; name: string; group_name: string }) => {
    try {
      // Verificar se já existe outra empresa com o mesmo código
      const { data: existingCompany, error: checkError } = await supabase
        .from('empresas')
        .select('id, company_code')
        .eq('company_code', company.company_code)
        .neq('id', id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Erro ao verificar empresa existente: ${checkError.message}`);
      }

      if (existingCompany) {
        throw new Error('Já existe outra empresa cadastrada com este código da loja.');
      }

      // Atualizar a empresa
      const { error: updateError } = await supabase
        .from('empresas')
        .update({
          company_code: company.company_code,
          company_name: company.company_name,
          name: company.name,
          group_name: company.group_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        throw new Error(`Erro ao atualizar empresa: ${updateError.message}`);
      }

      // Recarregar empresas do banco para atualizar a lista
      const { data: companiesData, error: companiesError } = await supabase
        .from('empresas')
        .select('id, company_code, company_name, group_name, name')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Erro ao recarregar empresas:', companiesError);
      } else {
        setCompanies(companiesData || []);
      }

      // Adicionar notificação de sucesso
      const successNotificationId = addNotification({
        type: 'success',
        title: 'Empresa Atualizada',
        message: `A empresa "${company.company_name}" (${company.company_code}) foi atualizada com sucesso.`
      });
      setActiveToast(successNotificationId);
    } catch (error: any) {
      console.error('Erro ao atualizar empresa:', error);
      
      // Adicionar notificação de erro
      const errorNotificationId = addNotification({
        type: 'error',
        title: 'Erro ao Atualizar Empresa',
        message: error.message || 'Erro ao atualizar empresa. Tente novamente.'
      });
      setActiveToast(errorNotificationId);
      
      throw error;
    }
  };

  const handleRefreshCompanies = async () => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('empresas')
        .select('id, company_code, company_name, group_name, name')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('Erro ao recarregar empresas:', companiesError);
        throw companiesError;
      } else {
        setCompanies(companiesData || []);
      }
    } catch (error: any) {
      console.error('Erro ao recarregar empresas:', error);
      throw error;
    }
  };

  const handleDataImport = async (file: File, type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances' | 'orcamento_dre' | 'receita_crediario' | 'vendas_por_usuario', currentIndex?: number, totalFiles?: number, shouldOverwrite?: boolean, shouldAccumulate?: boolean) => {
    // Opção "Sobrepor vs Acumular" oculta por enquanto:
    // - padronizar para acumular
    // - evita que imports múltiplos (vários arquivos) apaguem imports anteriores do mesmo tipo
    shouldAccumulate = shouldAccumulate ?? true;
    shouldOverwrite = shouldOverwrite ?? false;

    // Validar formato do arquivo antes de processar
    if (type !== 'transactions') {
      const validation = await validateFileFormat(file, type);
      if (!validation.isValid) {
        setErrorModal({
          isOpen: true,
          title: 'Arquivo não corresponde ao tipo esperado',
          message: `${validation.errorMessage}\n\nPor favor, verifique se você está importando o arquivo correto na seção adequada.`
        });
        return; // Não processar arquivo inválido
      }
    }

    // Verificar se já existe um arquivo com o mesmo nome e tipo (não excluído)
    const tableName = getTableNameFromType(type);
    const { data: existingImport } = await supabase
      .from('importacoes')
      .select('id')
      .eq('file_name', file.name)
      .eq('file_type', tableName)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existingImport) {
      setDuplicateFileModal({
        isOpen: true,
        fileName: file.name,
        fileType: type,
        pendingFile: file,
        pendingType: type,
        pendingIndex: currentIndex,
        pendingTotal: totalFiles,
        existingImportId: existingImport.id
      });
      return;
    }

    // Se deve sobrepor (e não acumular), mover todos os imports anteriores do mesmo tipo para a lixeira
    if (shouldOverwrite && !shouldAccumulate) {
      await moveOldImportsToTrash(type);
    }

    setLoading({
      isLoading: true,
      currentFile: file.name,
      currentIndex: currentIndex,
      totalFiles: totalFiles,
      allCompleted: false
    });

    let importId: string | undefined;
    try {
      // Create import record in database first
      const tableName = getTableNameFromType(type);
      const { data: importRecord, error: importError } = await supabase
        .from('importacoes')
        .insert({
          file_name: file.name,
          file_type: tableName,
          record_count: 0
        })
        .select()
        .single();

      if (importError) throw importError;

      importId = importRecord.id;

      if (!importId) {
        throw new Error('Não foi possível criar o registro de importação no banco de dados.');
      }

      // Create new file entry for UI
      const newFile: ImportedFile = {
        id: importId as string,
        name: file.name,
        type,
        uploadDate: new Date().toISOString(),
        recordCount: 0,
        status: 'processing' as const
      };

      setImportedFiles(prev => [...prev, newFile]);

      let recordCount = 0;

      if (type === 'accounts_payable') {
        // Obter business units válidas do banco
        const validBusinessUnits = companies.map(c => normalizeCode(c.company_code));
        
        // Atualizar progresso: processando arquivo
        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: 'Lendo e validando planilha...'
        });

        // Processar arquivo com validações
        const result = await processAccountsPayableFile(file, validBusinessUnits);
        
        console.log('📊 RESULTADO DO PROCESSAMENTO:');
        console.log(`   Total de linhas na planilha: ${result.stats.totalRows}`);
        console.log(`   Linhas ignoradas (cabeçalho/rodapé): ${result.stats.skippedHeaderFooter}`);
        console.log(`   Linhas ignoradas (vazias): ${result.stats.skippedEmpty}`);
        console.log(`   Linhas inválidas: ${result.stats.invalid}`);
        console.log(`   Linhas processadas com sucesso: ${result.stats.processed}`);
        console.log(`   Registros válidos para inserir: ${result.data.length}`);
        console.log(`   Unidades inválidas encontradas: ${result.validationErrors.invalidBusinessUnits.length}`);
        console.log(`   Linhas com erros: ${result.validationErrors.invalidRows.length}`);

        // Verificar se há erros de validação que impedem a importação
        if (result.validationErrors.invalidRows.length > 0 || result.validationErrors.invalidBusinessUnits.length > 0) {
          // Criar notificação de erro
          const totalErrors = result.validationErrors.invalidRows.length + result.validationErrors.invalidBusinessUnits.length;
          const notificationId = addNotification({
            type: 'error',
            title: 'Erros na Importação',
            message: `Foram encontrados ${totalErrors} erro(s) na planilha "${file.name}".`,
            data: {
              invalidRows: result.validationErrors.invalidRows,
              invalidBusinessUnits: result.validationErrors.invalidBusinessUnits,
              fileName: file.name
            }
          });
          setActiveToast(notificationId);
          
          // Parar o processamento e não inserir dados
          setLoading({
            isLoading: false,
            allCompleted: false
          });
          return;
        }

        if (result.data.length === 0) {
          throw new Error('Nenhum registro válido foi encontrado na planilha após a validação.');
        }

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          // Verificar quantos registros existem antes de deletar
          const { count: countBefore } = await supabase
            .from('contas_a_pagar')
            .select('*', { count: 'exact', head: true });
          
          console.log(`🗑️ Deletando ${countBefore || 0} registros antigos antes de inserir novos...`);
          
          // Deletar todos os registros de contas_a_pagar antes de inserir os novos
          const { error: deleteError, count: deletedCount } = await supabase
            .from('contas_a_pagar')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todas
          
          if (deleteError) throw deleteError;
          
          console.log(`✅ ${deletedCount || countBefore || 0} registros deletados`);
        }

        // Add import_id to each record
        const recordsWithImportId = result.data.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log(`📊 Total de registros a inserir no banco: ${recordsWithImportId.length}`);
        console.log(`📊 Resumo: ${result.stats.processed} processados de ${result.stats.totalRows} linhas da planilha`);
        
        // Log de amostra das primeiras datas para debug
        if (recordsWithImportId.length > 0) {
          const sampleDates = recordsWithImportId.slice(0, 5).map(r => ({
            due_date: r.due_date,
            payment_date: r.payment_date || 'NULL',
            status: r.status
          }));
          console.log(`📅 Amostra de datas dos primeiros 5 registros:`, sampleDates);
          
          // Estatísticas de datas
          const datesWithPayment = recordsWithImportId.filter(r => r.payment_date).length;
          const datesWithoutPayment = recordsWithImportId.filter(r => !r.payment_date).length;
          const minDueDate = recordsWithImportId.reduce((min, r) => 
            (!min || (r.due_date && r.due_date < min)) ? (r.due_date || min) : min, null as string | null
          );
          const maxDueDate = recordsWithImportId.reduce((max, r) => 
            (!max || (r.due_date && r.due_date > max)) ? (r.due_date || max) : max, null as string | null
          );
          const minPaymentDate = recordsWithImportId
            .filter(r => r.payment_date)
            .reduce((min, r) => 
              (!min || (r.payment_date && r.payment_date < min)) ? r.payment_date : min, null as string | null
            );
          const maxPaymentDate = recordsWithImportId
            .filter(r => r.payment_date)
            .reduce((max, r) => 
              (!max || (r.payment_date && r.payment_date > max)) ? r.payment_date : max, null as string | null
            );
          
          console.log(`📅 Estatísticas de datas:`);
          console.log(`   - Com payment_date: ${datesWithPayment}`);
          console.log(`   - Sem payment_date: ${datesWithoutPayment}`);
          console.log(`   - due_date: ${minDueDate} a ${maxDueDate}`);
          if (minPaymentDate && maxPaymentDate) {
            console.log(`   - payment_date: ${minPaymentDate} a ${maxPaymentDate}`);
          }
        }

        // Save to Supabase com progresso real
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;
        
        // Atualizar progresso: iniciando inserção
        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} registros no banco...`
        });
        
        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);
          
          // Atualizar progresso
          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} registros no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from('contas_a_pagar')
            .insert(batch)
            .select('id');

          if (error) {
            throw new Error(`Erro ao inserir dados no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} registros inseridos (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes para evitar sobrecarga no banco (200-500ms)
          // Não pausar após o último lote
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log('📊 RESUMO FINAL DA IMPORTAÇÃO:');
        console.log(`   Linhas na planilha: ${result.stats.totalRows}`);
        console.log(`   Linhas processadas: ${result.stats.processed}`);
        console.log(`   Registros válidos: ${result.data.length}`);
        console.log(`   Registros inseridos no banco: ${totalInserted}`);
        console.log(`   Diferença (processados - inseridos): ${result.stats.processed - totalInserted}`);
        
        if (totalInserted !== result.data.length) {
          console.warn(`⚠️ ATENÇÃO: ${result.data.length - totalInserted} registros não foram inseridos!`);
        }

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = result.data.length;
        console.log(`Saved ${recordCount} accounts payable records to Supabase`);
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);

        // Mostrar notificação de linhas ignoradas (se houver)
        if (result.skippedRows && result.skippedRows.length > 0) {
          const categorySummary = {
            'cabeçalho': result.skippedRows.filter(r => r.category === 'cabeçalho').length,
            'rodapé': result.skippedRows.filter(r => r.category === 'rodapé').length,
            'vazia': result.skippedRows.filter(r => r.category === 'vazia').length,
            'inválida': result.skippedRows.filter(r => r.category === 'inválida').length,
            'metadado': result.skippedRows.filter(r => r.category === 'metadado').length
          };
          
          const summaryMessages: string[] = [];
          if (categorySummary.cabeçalho > 0) {
            summaryMessages.push(`${categorySummary.cabeçalho} ${categorySummary.cabeçalho === 1 ? 'linha de cabeçalho' : 'linhas de cabeçalho'}`);
          }
          if (categorySummary.rodapé > 0) {
            summaryMessages.push(`${categorySummary.rodapé} ${categorySummary.rodapé === 1 ? 'linha de rodapé' : 'linhas de rodapé'}`);
          }
          if (categorySummary.vazia > 0) {
            summaryMessages.push(`${categorySummary.vazia} ${categorySummary.vazia === 1 ? 'linha vazia' : 'linhas vazias'}`);
          }
          if (categorySummary.inválida > 0) {
            summaryMessages.push(`${categorySummary.inválida} ${categorySummary.inválida === 1 ? 'linha inválida' : 'linhas inválidas'}`);
          }
          if (categorySummary.metadado > 0) {
            summaryMessages.push(`${categorySummary.metadado} ${categorySummary.metadado === 1 ? 'linha de metadado' : 'linhas de metadado'}`);
          }
          
          const summaryText = summaryMessages.length > 0 
            ? summaryMessages.join(', ')
            : `${result.skippedRows.length} ${result.skippedRows.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}`;
          
          const notificationId = addNotification({
            type: 'info',
            title: 'Linhas Ignoradas na Importação',
            message: `${summaryText} foram ignoradas durante a importação de "${file.name}".`,
            data: {
              skippedRows: result.skippedRows,
              fileName: file.name,
              stats: result.stats
            }
          });
          setActiveToast(notificationId);
        }
      } else if (type === 'revenues') {
        // Obter business units válidas do banco
        const validBusinessUnits = companies.map(c => normalizeCode(c.company_code));
        
        // Atualizar progresso: processando arquivo
        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: 'Lendo e validando planilha...'
        });

        // Processar arquivo com validações (detecta automaticamente se é receita ou receita_crediario)
        const result = await processRevenuesFile(file, validBusinessUnits);
        
        // Detectar se é receita_crediario verificando propriedades do primeiro registro
        const isReceitaCrediario = result.data.length > 0 && 'data_receb' in result.data[0] && !('payment_date' in result.data[0]);
        
        // Atualizar o tipo de arquivo no registro de importação se necessário
        if (isReceitaCrediario && importId) {
          const { error: updateError } = await supabase
            .from('importacoes')
            .update({ file_type: 'receita_crediario' })
            .eq('id', importId);
          if (updateError) {
            console.warn('⚠️ Erro ao atualizar tipo de arquivo:', updateError);
          } else {
            console.log('✅ Tipo de arquivo atualizado para receita_crediario');
          }
        }
        
        console.log(`📊 RESULTADO DO PROCESSAMENTO ${isReceitaCrediario ? 'RECEITA CREDIÁRIO' : 'RECEITAS'}:`);
        console.log(`   Total de linhas na planilha: ${result.stats.totalRows}`);
        console.log(`   Linhas ignoradas (cabeçalho/rodapé): ${result.stats.skippedHeaderFooter}`);
        console.log(`   Linhas ignoradas (vazias): ${result.stats.skippedEmpty}`);
        console.log(`   Linhas inválidas: ${result.stats.invalid}`);
        console.log(`   Linhas processadas com sucesso: ${result.stats.processed}`);
        console.log(`   Registros válidos para inserir: ${result.data.length}`);
        console.log(`   Unidades inválidas encontradas: ${result.validationErrors.invalidBusinessUnits.length}`);
        console.log(`   Linhas com erros: ${result.validationErrors.invalidRows.length}`);
        console.log(`   Colunas faltantes: ${result.validationErrors.missingColumns.length}`);
        
        // Verificar linhas com status não identificado (apenas para receitas normais)
        const rowsWithUnidentifiedStatus = !isReceitaCrediario ? ((result as any).rowsWithUnidentifiedStatus || []) : [];
        if (rowsWithUnidentifiedStatus.length > 0) {
          console.log(`   Linhas com status não identificado: ${rowsWithUnidentifiedStatus.length}`);
        }

        // Verificar se há erros de validação que impedem a importação
        if (result.validationErrors.missingColumns.length > 0 || 
            result.validationErrors.invalidRows.length > 0 || 
            result.validationErrors.invalidBusinessUnits.length > 0) {
          // Criar notificação de erro
          const totalErrors = result.validationErrors.missingColumns.length + 
                             result.validationErrors.invalidRows.length + 
                             result.validationErrors.invalidBusinessUnits.length;
          const notificationId = addNotification({
            type: 'error',
            title: 'Erros na Importação',
            message: `Foram encontrados ${totalErrors} erro(s) na planilha "${file.name}".`,
            data: {
              missingColumns: result.validationErrors.missingColumns,
              invalidRows: result.validationErrors.invalidRows,
              invalidBusinessUnits: result.validationErrors.invalidBusinessUnits,
              fileName: file.name
            } as any
          });
          setActiveToast(notificationId);
          
          // Parar o processamento e não inserir dados
          setLoading({
            isLoading: false,
            allCompleted: false
          });
          return;
        }

        if (result.data.length === 0) {
          throw new Error('Nenhum registro válido foi encontrado na planilha após a validação.');
        }

        const tableName = isReceitaCrediario ? 'receita_crediario' : 'receitas';
        const recordTypeName = isReceitaCrediario ? 'receita crediário' : 'receitas';

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          const { count: countBefore } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          console.log(`🗑️ Deletando ${countBefore || 0} registros antigos antes de inserir novos...`);
          
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (deleteError) throw deleteError;
          
          console.log(`✅ ${countBefore || 0} registros deletados`);
        }

        // Add import_id to each record
        const recordsWithImportId = result.data.map((record: any) => ({
          ...record,
          import_id: importId
        }));

        console.log(`📊 Total de registros a inserir no banco: ${recordsWithImportId.length}`);
        console.log(`📊 Resumo: ${result.stats.processed} processados de ${result.stats.totalRows} linhas da planilha`);

        // Save to Supabase com progresso real
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;
        
        // Atualizar progresso: iniciando inserção
        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} ${recordTypeName} no banco...`
        });
        
        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);
          
          // Atualizar progresso
          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} ${recordTypeName} no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from(tableName)
            .insert(batch)
            .select('id');

          if (error) {
            throw new Error(`Erro ao inserir ${recordTypeName} no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} ${recordTypeName} inseridos (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes para evitar sobrecarga no banco
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log(`📊 RESUMO FINAL DA IMPORTAÇÃO ${isReceitaCrediario ? 'RECEITA CREDIÁRIO' : 'RECEITAS'}:`);
        console.log(`   Linhas na planilha: ${result.stats.totalRows}`);
        console.log(`   Linhas processadas: ${result.stats.processed}`);
        console.log(`   Registros válidos: ${result.data.length}`);
        console.log(`   Registros inseridos no banco: ${totalInserted}`);

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        if (!isReceitaCrediario) {
          await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison apenas para receitas normais
        }
        recordCount = result.data.length;
        console.log(`Saved ${recordCount} ${recordTypeName} records to Supabase`);
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de ${recordTypeName} de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);

        // Mostrar notificação de linhas ignoradas (se houver)
        if (result.skippedRows && result.skippedRows.length > 0) {
          const categorySummary = {
            'cabeçalho': result.skippedRows.filter(r => r.category === 'cabeçalho').length,
            'rodapé': result.skippedRows.filter(r => r.category === 'rodapé').length,
            'vazia': result.skippedRows.filter(r => r.category === 'vazia').length,
            'inválida': result.skippedRows.filter(r => r.category === 'inválida').length
          };
          
          const summaryMessages: string[] = [];
          if (categorySummary.cabeçalho > 0) {
            summaryMessages.push(`${categorySummary.cabeçalho} ${categorySummary.cabeçalho === 1 ? 'linha de cabeçalho' : 'linhas de cabeçalho'}`);
          }
          if (categorySummary.rodapé > 0) {
            summaryMessages.push(`${categorySummary.rodapé} ${categorySummary.rodapé === 1 ? 'linha de rodapé' : 'linhas de rodapé'}`);
          }
          if (categorySummary.vazia > 0) {
            summaryMessages.push(`${categorySummary.vazia} ${categorySummary.vazia === 1 ? 'linha vazia' : 'linhas vazias'}`);
          }
          
          const summaryText = summaryMessages.length > 0 
            ? summaryMessages.join(', ')
            : `${result.skippedRows.length} ${result.skippedRows.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}`;
          
          const notificationId = addNotification({
            type: 'info',
            title: 'Linhas Ignoradas na Importação',
            message: `${summaryText} foram ignoradas durante a importação de "${file.name}".`,
            data: {
              skippedRows: result.skippedRows,
              fileName: file.name,
              stats: result.stats
            }
          });
          setActiveToast(notificationId);
        }

        // Mostrar notificação informativa de status não identificado (se houver)
        if (rowsWithUnidentifiedStatus.length > 0) {
          const notificationId = addNotification({
            type: 'info',
            title: 'Status não identificado',
            message: `${rowsWithUnidentifiedStatus.length} linha(s) com status não identificado foram normalizadas para "não identificado".`,
            data: {
              invalidRows: rowsWithUnidentifiedStatus.map((r: { lineNumber: number; rowContent: any[] }) => ({
                lineNumber: r.lineNumber,
                rowContent: r.rowContent,
                errors: ['Status não identificado - normalizado para "não identificado"']
              })),
              fileName: file.name
            }
          });
          setActiveToast(notificationId);
        }
      } else if (type === 'receita_crediario') {
        // Obter business units válidas do banco
        const validBusinessUnits = companies.map(c => normalizeCode(c.company_code));
        
        // Atualizar progresso: processando arquivo
        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: 'Lendo e validando planilha...'
        });

        // Processar arquivo com validações
        const result = await processReceitaCrediarioFile(file, validBusinessUnits);
        
        console.log('📊 RESULTADO DO PROCESSAMENTO RECEITA CREDIÁRIO:');
        console.log(`   Total de linhas na planilha: ${result.stats.totalRows}`);
        console.log(`   Linhas ignoradas (cabeçalho/rodapé): ${result.stats.skippedHeaderFooter}`);
        console.log(`   Linhas ignoradas (vazias): ${result.stats.skippedEmpty}`);
        console.log(`   Linhas inválidas: ${result.stats.invalid}`);
        console.log(`   Linhas processadas com sucesso: ${result.stats.processed}`);
        console.log(`   Registros válidos para inserir: ${result.data.length}`);
        console.log(`   Unidades inválidas encontradas: ${result.validationErrors.invalidBusinessUnits.length}`);
        console.log(`   Linhas com erros: ${result.validationErrors.invalidRows.length}`);

        // Verificar se há erros de validação que impedem a importação
        if (result.validationErrors.invalidRows.length > 0 || result.validationErrors.invalidBusinessUnits.length > 0) {
          // Criar notificação de erro
          const totalErrors = result.validationErrors.invalidRows.length + result.validationErrors.invalidBusinessUnits.length;
          const notificationId = addNotification({
            type: 'error',
            title: 'Erros na Importação',
            message: `Foram encontrados ${totalErrors} erro(s) na planilha "${file.name}".`,
            data: {
              invalidRows: result.validationErrors.invalidRows,
              invalidBusinessUnits: result.validationErrors.invalidBusinessUnits,
              fileName: file.name
            }
          });
          setActiveToast(notificationId);
          
          // Parar o processamento e não inserir dados
          setLoading({
            isLoading: false,
            allCompleted: false
          });
          return;
        }

        if (result.data.length === 0) {
          throw new Error('Nenhum registro válido foi encontrado na planilha após a validação.');
        }

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          const { count: countBefore } = await supabase
            .from('receita_crediario')
            .select('*', { count: 'exact', head: true });
          
          console.log(`🗑️ Deletando ${countBefore || 0} registros antigos antes de inserir novos...`);
          
          const { error: deleteError } = await supabase
            .from('receita_crediario')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          
          if (deleteError) throw deleteError;
          
          console.log(`✅ ${countBefore || 0} registros deletados`);
        }

        // Add import_id to each record
        const recordsWithImportId = result.data.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log(`📊 Total de registros a inserir no banco: ${recordsWithImportId.length}`);
        console.log(`📊 Resumo: ${result.stats.processed} processados de ${result.stats.totalRows} linhas da planilha`);

        // Save to Supabase com progresso real
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;
        
        // Atualizar progresso: iniciando inserção
        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} registros no banco...`
        });
        
        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);
          
          // Atualizar progresso
          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} registros no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from('receita_crediario')
            .insert(batch)
            .select('id');

          if (error) {
            throw new Error(`Erro ao inserir registros no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} registros inseridos (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes para evitar sobrecarga no banco
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log('📊 RESUMO FINAL DA IMPORTAÇÃO RECEITA CREDIÁRIO:');
        console.log(`   Linhas na planilha: ${result.stats.totalRows}`);
        console.log(`   Linhas processadas: ${result.stats.processed}`);
        console.log(`   Registros válidos: ${result.data.length}`);
        console.log(`   Registros inseridos no banco: ${totalInserted}`);

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        recordCount = result.data.length;
        console.log(`Saved ${recordCount} receita crediário records to Supabase`);
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de receita crediário de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);

        // Mostrar notificação de linhas ignoradas (se houver)
        if (result.skippedRows && result.skippedRows.length > 0) {
          const categorySummary = {
            'cabeçalho': result.skippedRows.filter(r => r.category === 'cabeçalho').length,
            'rodapé': result.skippedRows.filter(r => r.category === 'rodapé').length,
            'vazia': result.skippedRows.filter(r => r.category === 'vazia').length,
            'inválida': result.skippedRows.filter(r => r.category === 'inválida').length
          };
          
          const summaryMessages: string[] = [];
          if (categorySummary.cabeçalho > 0) {
            summaryMessages.push(`${categorySummary.cabeçalho} ${categorySummary.cabeçalho === 1 ? 'linha de cabeçalho' : 'linhas de cabeçalho'}`);
          }
          if (categorySummary.rodapé > 0) {
            summaryMessages.push(`${categorySummary.rodapé} ${categorySummary.rodapé === 1 ? 'linha de rodapé' : 'linhas de rodapé'}`);
          }
          if (categorySummary.vazia > 0) {
            summaryMessages.push(`${categorySummary.vazia} ${categorySummary.vazia === 1 ? 'linha vazia' : 'linhas vazias'}`);
          }
          
          const summaryText = summaryMessages.length > 0 
            ? summaryMessages.join(', ')
            : `${result.skippedRows.length} ${result.skippedRows.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}`;
          
          const notificationId = addNotification({
            type: 'info',
            title: 'Linhas Ignoradas na Importação',
            message: `${summaryText} foram ignoradas durante a importação de "${file.name}".`,
            data: {
              skippedRows: result.skippedRows,
              fileName: file.name,
              stats: result.stats
            }
          });
          setActiveToast(notificationId);
        }
      } else if (type === 'financial_transactions') {
        // Buscar business units válidas do banco
        const { data: companiesData } = await supabase
          .from('companies')
          .select('company_code');
        const validBusinessUnits = companiesData?.map(c => c.company_code) || [];

        const result = await processFinancialTransactionsFile(file, validBusinessUnits);
        console.log('📊 RESULTADO DO PROCESSAMENTO LANÇAMENTOS FINANCEIROS:');
        console.log(`   Total de linhas na planilha: ${result.stats.totalRows}`);
        console.log(`   Linhas ignoradas (cabeçalho/rodapé): ${result.stats.skippedHeaderFooter}`);
        console.log(`   Linhas ignoradas (vazias): ${result.stats.skippedEmpty}`);
        console.log(`   Linhas inválidas: ${result.stats.invalid}`);
        console.log(`   Linhas processadas com sucesso: ${result.stats.processed}`);
        console.log(`   Registros válidos para inserir: ${result.data.length}`);
        console.log(`   Unidades inválidas encontradas: ${result.validationErrors.invalidBusinessUnits.length}`);
        console.log(`   Linhas com erros: ${result.validationErrors.invalidRows.length}`);
        console.log(`   Colunas faltantes: ${result.validationErrors.missingColumns.length}`);

        // Verificar erros críticos que impedem a importação
        if (result.validationErrors.missingColumns.length > 0 ||
            result.validationErrors.invalidRows.length > 0 ||
            result.validationErrors.invalidBusinessUnits.length > 0) {
          const totalErrors = result.validationErrors.missingColumns.length +
                              result.validationErrors.invalidRows.length +
                              result.validationErrors.invalidBusinessUnits.length;
          const notificationId = addNotification({
            type: 'error',
            title: 'Erros na Importação',
            message: `Foram encontrados ${totalErrors} erro(s) na planilha "${file.name}".`,
            data: {
              missingColumns: result.validationErrors.missingColumns,
              invalidRows: result.validationErrors.invalidRows,
              invalidBusinessUnits: result.validationErrors.invalidBusinessUnits,
              fileName: file.name,
              skippedRows: result.skippedRows || [],
              stats: result.stats
            }
          });
          setActiveToast(notificationId);
          setLoading({
            isLoading: false,
            allCompleted: false
          });
          return;
        }

        if (result.data.length === 0) {
          addNotification({
            type: 'error',
            title: 'Importação Cancelada',
            message: `Nenhum registro válido de lançamentos financeiros foi encontrado no arquivo "${file.name}".`,
            data: {
              fileName: file.name,
              skippedRows: result.skippedRows || [],
              stats: result.stats
            }
          });
          setLoading({
            isLoading: false,
            allCompleted: false
          });
          return;
        }

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          const { error: deleteError } = await supabase
            .from('transacoes_financeiras')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          if (deleteError) throw deleteError;
        }

        // Add import_id to each record
        const recordsWithImportId = result.data.map(record => ({
          ...record,
          import_id: importId
        }));

        // Save to Supabase em lotes para evitar sobrecarga
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;

        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} transações no banco...`
        });

        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);

          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} transações no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from('transacoes_financeiras')
            .insert(batch)
            .select('id');

          if (error) {
            throw new Error(`Erro ao inserir transações no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} transações inseridas (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes (200-500ms)
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = result.data.length;
        console.log('Saved financial transactions to Supabase');

        // Mostrar notificação de linhas ignoradas (se houver)
        if (result.skippedRows && result.skippedRows.length > 0) {
          const categorySummary = {
            'cabeçalho': result.skippedRows.filter(r => r.category === 'cabeçalho').length,
            'rodapé': result.skippedRows.filter(r => r.category === 'rodapé').length,
            'vazia': result.skippedRows.filter(r => r.category === 'vazia').length,
            'inválida': result.skippedRows.filter(r => r.category === 'inválida').length,
            'metadado': result.skippedRows.filter(r => r.category === 'metadado').length
          };
          
          const summaryMessages: string[] = [];
          if (categorySummary.cabeçalho > 0) {
            summaryMessages.push(`${categorySummary.cabeçalho} ${categorySummary.cabeçalho === 1 ? 'linha de cabeçalho' : 'linhas de cabeçalho'}`);
          }
          if (categorySummary.rodapé > 0) {
            summaryMessages.push(`${categorySummary.rodapé} ${categorySummary.rodapé === 1 ? 'linha de rodapé' : 'linhas de rodapé'}`);
          }
          if (categorySummary.vazia > 0) {
            summaryMessages.push(`${categorySummary.vazia} ${categorySummary.vazia === 1 ? 'linha vazia' : 'linhas vazias'}`);
          }
          if (categorySummary.inválida > 0) {
            summaryMessages.push(`${categorySummary.inválida} ${categorySummary.inválida === 1 ? 'linha inválida' : 'linhas inválidas'}`);
          }
          if (categorySummary.metadado > 0) {
            summaryMessages.push(`${categorySummary.metadado} ${categorySummary.metadado === 1 ? 'linha de metadado' : 'linhas de metadado'}`);
          }
          
          const summaryText = summaryMessages.length > 0 
            ? summaryMessages.join(', ')
            : `${result.skippedRows.length} ${result.skippedRows.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}`;
          
          const notificationId = addNotification({
            type: 'info',
            title: 'Linhas Ignoradas na Importação',
            message: `${summaryText} foram ignoradas durante a importação de "${file.name}".`,
            data: {
              skippedRows: result.skippedRows,
              fileName: file.name,
              stats: result.stats
            }
          });
          setActiveToast(notificationId);
        }
        
        // Adicionar notificação de sucesso
        let successMessage = `${recordCount} registro(s) de transações financeiras de "${file.name}" foram importados com sucesso.`;
        if (result.skippedRows && result.skippedRows.length > 0) {
          successMessage += ` ${result.skippedRows.length} linha(s) foram ignoradas.`;
        }
        
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: successMessage,
          data: result.skippedRows && result.skippedRows.length > 0 ? {
            skippedRows: result.skippedRows,
            fileName: file.name,
            stats: result.stats
          } : undefined
        });
        setActiveToast(successNotificationId);
      } else if (type === 'forecasted_entries') {
        console.log('Starting forecasted entries import...');
        const importedEntries = await processForecastedEntriesFile(file);
        console.log('Lançamentos previstos importados:', importedEntries);
        console.log('Number of entries:', importedEntries.length);

        if (importedEntries.length === 0) {
          throw new Error('Nenhum lançamento previsto foi processado. Verifique o formato do arquivo.');
        }

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          const { error: deleteError } = await supabase
            .from('previstos')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          if (deleteError) throw deleteError;
        }

        // Add import_id to each record
        const recordsWithImportId = importedEntries.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log('Records to insert:', recordsWithImportId);

        // Save to Supabase em lotes para evitar sobrecarga
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;

        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} previstos no banco...`
        });

        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);

          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} previstos no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from('previstos')
            .insert(batch)
            .select();

          if (error) {
            console.error('Supabase insert error:', error);
            throw new Error(`Erro ao inserir previstos no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} previstos inseridos (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes (200-500ms)
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log('Inserted data:', { total: totalInserted });

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedEntries.length;
        console.log('Saved forecasted entries to Supabase');
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de previstos de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);
      } else if (type === 'revenues_dre') {
        console.log('🔵 Starting revenues DRE import...');
        console.log('📁 File info:', { name: file.name, size: file.size, type: file.type });
        const importedRevenuesDRE = await processRevenuesDREFile(file);
        console.log('✅ Receitas DRE importadas:', importedRevenuesDRE);
        console.log('📊 Number of entries:', importedRevenuesDRE.length);

        if (importedRevenuesDRE.length === 0) {
          throw new Error('Nenhuma receita DRE foi processada. Verifique o formato do arquivo.');
        }

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          const { error: deleteError } = await supabase
            .from('receitas_dre')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          if (deleteError) throw deleteError;
        }

        // Add import_id to each record
        const recordsWithImportId = importedRevenuesDRE.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log('Records to insert:', recordsWithImportId);

        // Save to Supabase em lotes para evitar sobrecarga
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;

        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} receitas DRE no banco...`
        });

        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);

          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} receitas DRE no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from('receitas_dre')
            .insert(batch)
            .select();

          if (error) {
            console.error('Supabase insert error:', error);
            throw new Error(`Erro ao inserir receitas DRE no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} receitas DRE inseridas (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes (200-500ms)
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log('Inserted data:', { total: totalInserted });

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedRevenuesDRE.length;
        console.log('Saved revenues DRE to Supabase');
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de receitas DRE de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);
      } else if (type === 'cmv_dre') {
        console.log('Starting CMV DRE import...');
        const importedCMVDRE = await processCMVDREFile(file);
        console.log('CMV DRE importado:', importedCMVDRE);
        console.log('Number of entries:', importedCMVDRE.length);

        if (importedCMVDRE.length === 0) {
          throw new Error('Nenhum CMV DRE foi processado. Verifique o formato do arquivo.');
        }

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          const { error: deleteError } = await supabase
            .from('cmv_dre')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          if (deleteError) throw deleteError;
        }

        // Add import_id to each record
        const recordsWithImportId = importedCMVDRE.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log('Records to insert:', recordsWithImportId);

        // Save to Supabase em lotes para evitar sobrecarga
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;

        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} CMV DRE no banco...`
        });

        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);

          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} CMV DRE no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from('cmv_dre')
            .insert(batch)
            .select();

          if (error) {
            console.error('Supabase insert error:', error);
            throw new Error(`Erro ao inserir CMV DRE no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} CMV DRE inseridos (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes (200-500ms)
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log('Inserted data:', { total: totalInserted });

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedCMVDRE.length;
        console.log('Saved CMV DRE to Supabase');
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de CMV DRE de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);
      } else if (type === 'vendas_por_usuario') {
        const validBusinessUnits = companies.map(c => normalizeCode(c.company_code));
        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: 'Lendo e validando planilha Entrega de Resultado...'
        });

        const result = await processVendasPorUsuarioFile(file, validBusinessUnits);

        if (result.validationErrors.invalidRows.length > 0 || result.validationErrors.invalidBusinessUnits.length > 0) {
          const totalErrors = result.validationErrors.invalidRows.length + result.validationErrors.invalidBusinessUnits.length;
          const firstErrors = result.validationErrors.invalidRows.slice(0, 3).map(r => `Linha ${r.lineNumber}: ${r.errors.join('; ')}`).join('\n');
          const unitMsg = result.validationErrors.invalidBusinessUnits.length > 0 ? ` Unidades inválidas: ${result.validationErrors.invalidBusinessUnits.join(', ')}.` : '';
          const notificationId = addNotification({
            type: 'error',
            title: 'Erros na importação - Entrega de Resultado',
            message: `O arquivo não foi aceito. ${totalErrors} erro(s).${unitMsg}\n\n${firstErrors}${result.validationErrors.invalidRows.length > 3 ? '\n...' : ''}`,
            data: {
              invalidRows: result.validationErrors.invalidRows,
              invalidBusinessUnits: result.validationErrors.invalidBusinessUnits,
              fileName: file.name
            }
          });
          setActiveToast(notificationId);
          setLoading({ isLoading: false, allCompleted: false });
          return;
        }

        if (result.data.length === 0) {
          throw new Error('Nenhum registro válido encontrado na planilha. Verifique se há linhas com Usuário, Venda, Custo, Lucro, Qtd. Vendas e Qtd. Itens preenchidos (e se as linhas de Total/Soma e o cabeçalho "Análise de venda" foram ignorados).');
        }

        const recordsWithImportId = result.data.map(record => ({ ...record, import_id: importId }));
        const totalRecords = recordsWithImportId.length;
        const batchSize = 500;
        let totalInserted = 0;

        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} registros de Entrega de Resultado...`
        });

        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);
          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} registros...`
          });

          const { error } = await supabase.from('vendas_por_usuario').insert(batch).select('id');

          if (error) throw new Error(`Erro ao inserir no banco (por volta da linha ${i + 1}): ${error.message}`);
          totalInserted += batch.length;
        }

        // Usar o padrão geral: atualizar recordCount e deixar o bloco comum persistir no banco
        recordCount = totalInserted;

        await loadDataFromSupabase();
        await loadMonthlyComparisonData();

        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação concluída',
          message: `${totalInserted} registro(s) de Entrega de Resultado de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);
      } else if (type === 'initial_balances') {
        console.log('Starting Initial Balances import...');
        const importedBalances = await processInitialBalancesFile(file);
        console.log('Initial Balances importados:', importedBalances);

        if (importedBalances.length === 0) {
          throw new Error('Nenhum saldo foi processado. Verifique o formato do arquivo.');
        }

        // Se deve sobrepor, deletar dados antigos primeiro
        if (shouldOverwrite && !shouldAccumulate) {
          const { error: deleteError } = await supabase
            .from('saldos_iniciais')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
          if (deleteError) throw deleteError;
        }

        // Add import_id to each record
        const recordsWithImportId = importedBalances.map(record => ({
          ...record,
          import_id: importId
        }));

        // Save to Supabase em lotes para evitar sobrecarga
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;

        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} saldos iniciais no banco...`
        });

        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);

          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} saldos iniciais no banco...`
          });

          const { data: insertedData, error } = await supabase
            .from('saldos_iniciais')
            .insert(batch)
            .select();

          if (error) {
            console.error('Supabase insert error:', error);
            throw new Error(`Erro ao inserir saldos iniciais no banco de dados (linha ${i + 1}): ${error.message}`);
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} saldos inseridos (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes (200-500ms)
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log('Inserted data:', { total: totalInserted });

        // Reload from database
        await loadDataFromSupabase();
        recordCount = importedBalances.length;
        console.log('Saved Initial Balances to Supabase');
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de saldos iniciais de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);
      } else if (type === 'orcamento_dre') {
        console.log('🔄 Starting Orçamento DRE import...');
        console.log('📁 File info:', { name: file.name, size: file.size, type: file.type });
        const importedOrcamentoDRE = await processOrcamentoDREFile(file);
        console.log('✅ Orçamento DRE importado:', importedOrcamentoDRE);
        console.log('📊 Number of entries:', importedOrcamentoDRE.length);

        if (importedOrcamentoDRE.length === 0) {
          throw new Error('Nenhum orçamento DRE foi processado. Verifique o formato do arquivo.');
        }

        // Add import_id to each record
        const recordsWithImportId = importedOrcamentoDRE.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log('Records to insert:', recordsWithImportId);

        // Save to Supabase em lotes para evitar sobrecarga
        const batchSize = 500;
        const totalRecords = recordsWithImportId.length;
        let totalInserted = 0;

        setLoading({
          isLoading: true,
          currentFile: file.name,
          currentIndex: currentIndex,
          totalFiles: totalFiles,
          allCompleted: false,
          progress: `Inserindo 0/${totalRecords} orçamento DRE no banco...`
        });

        for (let i = 0; i < totalRecords; i += batchSize) {
          const batch = recordsWithImportId.slice(i, i + batchSize);
          const current = Math.min(i + batchSize, totalRecords);

          setLoading({
            isLoading: true,
            currentFile: file.name,
            currentIndex: currentIndex,
            totalFiles: totalFiles,
            allCompleted: false,
            progress: `Inserindo ${current}/${totalRecords} orçamento DRE no banco...`
          });

          // Se acumular: usar insert (pode criar duplicatas se já existir)
          // Se sobrepor: usar upsert para atualizar registros existentes
          let insertedData;
          if (shouldAccumulate) {
            const { data, error } = await supabase
              .from('orcamento_dre')
              .insert(batch)
              .select();
            if (error) {
              console.error('Supabase insert error:', error);
              throw new Error(`Erro ao inserir orçamento DRE no banco de dados (linha ${i + 1}): ${error.message}`);
            }
            insertedData = data;
          } else {
            const { data, error } = await supabase
              .from('orcamento_dre')
              .upsert(batch, {
                onConflict: 'business_unit,account_name,period_date'
              })
              .select();
            if (error) {
              console.error('Supabase upsert error:', error);
              throw new Error(`Erro ao inserir orçamento DRE no banco de dados (linha ${i + 1}): ${error.message}`);
            }
            insertedData = data;
          }

          if (insertedData) {
            totalInserted += insertedData.length;
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}: ${insertedData.length} orçamento DRE inseridos (total inserido: ${totalInserted}/${totalRecords})`);
          }

          // Pausa entre lotes (200-500ms)
          if (i + batchSize < totalRecords) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log('Inserted data:', { total: totalInserted });

        // Reload from database
        await loadDataFromSupabase();
        recordCount = importedOrcamentoDRE.length;
        console.log('Saved Orçamento DRE to Supabase');
        
        // Adicionar notificação de sucesso
        const successNotificationId = addNotification({
          type: 'success',
          title: 'Importação Concluída',
          message: `${recordCount} registro(s) de orçamento DRE de "${file.name}" foram importados com sucesso.`
        });
        setActiveToast(successNotificationId);
      } else if (type === 'transactions') {
        const processedRecords = await processExcelFile(file);
        setRecords(prev => [...prev, ...processedRecords]);
        recordCount = processedRecords.length;
      }

      // Update import record with final count
      await supabase
        .from('importacoes')
        .update({ record_count: recordCount })
        .eq('id', importId);

      // Update file status
      setImportedFiles(prev =>
        prev.map(f =>
          f.id === newFile.id
            ? { ...f, status: 'success' as const, recordCount }
            : f
        )
      );

    } catch (error) {
      console.error('❌ Error processing file:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar arquivo';
      
      // Identificar tipo de erro
      let errorType = 'sistema';
      if (errorMessage.includes('Colunas obrigatórias') || 
          errorMessage.includes('unidades de negócio') || 
          errorMessage.includes('linha(s) inválida') ||
          errorMessage.includes('formato')) {
        errorType = 'planilha';
      } else if (errorMessage.includes('banco de dados') || 
                 errorMessage.includes('Supabase') ||
                 errorMessage.includes('insert') ||
                 errorMessage.includes('update') ||
                 errorMessage.includes('delete')) {
        errorType = 'banco de dados';
      }

      // Atualizar registro de importação com erro (sem colunas de erro por enquanto)
      if (importId) {
        try {
          await supabase
            .from('importacoes')
            .update({ 
              record_count: 0
            })
            .eq('id', importId);
        } catch (updateError) {
          console.error('Erro ao atualizar registro de importação:', updateError);
        }
      }

      // Mostrar mensagem de erro detalhada
      const errorTitle = errorType === 'planilha' 
        ? 'Erro na Planilha' 
        : errorType === 'banco de dados'
        ? 'Erro no Banco de Dados'
        : 'Erro no Sistema';
      
      setErrorModal({
        isOpen: true,
        title: errorTitle,
        message: `${errorMessage}\n\nTipo de erro: ${errorType}\n\nVeja o console (F12) para mais detalhes.`
      });

      // Atualizar status do arquivo na UI
      if (importId) {
        setImportedFiles(prev =>
          prev.map(f =>
            f.id === importId
              ? { ...f, status: 'error' as const }
              : f
          )
        );
      }
    } finally {
      // Se este é o último arquivo, marcar como completo
      if (currentIndex && totalFiles && currentIndex === totalFiles) {
        setLoading({
          isLoading: false,
          allCompleted: true
        });
        // Limpar a mensagem de sucesso após 3 segundos
        setTimeout(() => {
          setLoading({
            isLoading: false,
            allCompleted: false
          });
        }, 3000);
      } else if (!currentIndex || !totalFiles) {
        // Se não há múltiplos arquivos, apenas desligar o loading
        setLoading({
          isLoading: false,
          allCompleted: false
        });
      }
      // Se não é o último arquivo, o loading será atualizado quando o próximo arquivo começar
    }
  };

  // Envia arquivo para a lixeira (soft delete)
  const handleDeleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('importacoes')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', fileId);

      if (error) throw error;

      // Atualiza UI localmente
      setImportedFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, isDeleted: true } : f))
      );

      // Recarrega dados ignorando imports deletados
      await loadDataFromSupabase();
    } catch (error) {
      console.error('Error moving import to trash:', error);
      alert('Erro ao mover importação para a lixeira');
    }
  };

  const handleRestoreFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('importacoes')
        .update({
          is_deleted: false,
          deleted_at: null
        })
        .eq('id', fileId);

      if (error) throw error;

      setImportedFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, isDeleted: false } : f))
      );

      await loadDataFromSupabase();
    } catch (error) {
      console.error('Error restoring import from trash:', error);
      alert('Erro ao restaurar importação');
    }
  };

  const handlePermanentDeleteFile = async (fileId: string) => {
    try {
      const file = importedFiles.find(f => f.id === fileId);
      const fileType = file?.type;

      if (fileType) {
        // Converter tipo em inglês para nome da tabela em português
        const tableName = getTableNameFromType(fileType);
        // Usa a função existente que deleta dados relacionados + registro de import
        await deleteOldImportData(fileId, tableName);
      } else {
        const { error } = await supabase
          .from('importacoes')
          .delete()
          .eq('id', fileId);
        if (error) throw error;
        setImportedFiles(prev => prev.filter(f => f.id !== fileId));
      }

      await loadDataFromSupabase();
      await loadImportsFromSupabase();
    } catch (error) {
      console.error('Error permanently deleting import:', error);
      alert('Erro ao excluir importação permanentemente');
    }
  };

  const handleEmptyTrash = async () => {
    const trashedFiles = importedFiles.filter(f => f.isDeleted);
    if (trashedFiles.length === 0) return;

    const confirmed = window.confirm(
      `Tem certeza de que deseja esvaziar a lixeira? ${trashedFiles.length} arquivo(s) serão excluídos permanentemente.`
    );

    if (!confirmed) return;

    for (const file of trashedFiles) {
      // eslint-disable-next-line no-await-in-loop
      await handlePermanentDeleteFile(file.id);
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 Refreshing data...');
    setCompanies([]);
    setAccountsPayable([]);
    setRevenues([]);
    setReceitaCrediario([]);
    setReceitasManuais([]);
    setFinancialTransactions([]);
    setRevenuesDRE([]);
    setCmvDRE([]);
    await loadDataFromSupabase();
    await loadImportsFromSupabase();
  };

  const togglePresentationMode = () => {
    const targetPresentationMode = !presentationMode;
    setPresentationMode(targetPresentationMode);
    
    if (targetPresentationMode) {
      // Enter fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const filteredData = useMemo(() => filterData(records, filters), [records, filters]);

  // Non-operational accounts to exclude from total expenses
  const nonOperationalAccounts = [
    'Receita Reembolsável - Makebella',
    'Despesa Reembolsável - Makebella',
    'Receita Reembolsável - Outros',
    'Despesa Reembolsável - Outros',
    'Receita Reembolsável - XBrothers',
    'Despesa Reembolsável - XBrothers',
    'Receita Reembolsável - ESCPP',
    'Despesa Reembolsável - ESCPP',
    'Empréstimos Recebidos',
    'Pagamento de Empréstimo / Financiamento',
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

  // Dados já vêm filtrados do banco por data e business_unit quando há filtros ativos
  // Não precisa refiltrar aqui - apenas retorna os dados como estão
  const getFilteredAccountsPayable = useMemo(() => {
    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Então apenas retornamos os dados como estão
    return accountsPayable;
  }, [accountsPayable]);

  const lastContasPagarUpdateLabel = useMemo(
    () => (lastContasPagarUpdatedAt ? formatLastUpdate(lastContasPagarUpdatedAt) : ''),
    [lastContasPagarUpdatedAt]
  );

  // Dados já vêm filtrados do banco por data e business_unit quando há filtros ativos
  // Não precisa refiltrar aqui - apenas retorna os dados como estão
  const getFilteredForecastedEntries = useMemo(() => {
    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Então apenas retornamos os dados como estão
    return forecastedEntries;
  }, [forecastedEntries]);

  // Receita: apenas receitas_manuais (tabelas receitas e receita_crediario inativas)
  // Mapear para o formato esperado pelos cards/detalhes (business_unit, payment_date, amount, status, chart_of_accounts)
  const getFilteredRevenues = useMemo(() => {
    return receitasManuais.map(r => ({
      id: r.id,
      business_unit: r.business_unit,
      payment_date: r.data,
      amount: Number(r.valor) || 0,
      status: r.status || 'previsto',
      chart_of_accounts: r.conta,
      descricao: r.descricao
    }));
  }, [receitasManuais]);

  // Receita Direta (Entrega de Resultado): dados detalhados no período atual (para modal de detalhes)
  const getFilteredDirectRevenueSales = useMemo(() => {
    const periodStart = filters.startDate?.trim() || getDefaultPeriod().start;
    const periodEnd = filters.endDate?.trim() || getDefaultPeriod().end;
    const toDateStr = (d: any) => (d == null ? '' : String(d).split('T')[0]);
    return (vendasPorUsuarioRows || [])
      .filter(r => toDateStr(r.data) >= periodStart && toDateStr(r.data) <= periodEnd)
      .map(r => ({
        ...r,
        // Normalizar campos úteis para visualização no modal
        payment_date: r.data,
        business_unit: r.business_unit,
        amount: Number(r.amount) || 0
      }));
  }, [vendasPorUsuarioRows, filters.startDate, filters.endDate]);

  // Receita crediário inativa: usar apenas receitas_manuais
  const getFilteredReceitaCrediario = useMemo((): any[] => [], []);

  // Dados já vêm filtrados do banco por data e business_unit quando há filtros ativos
  // Não precisa refiltrar aqui - apenas retorna os dados como estão
  const getFilteredTransactions = useMemo(() => {
    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Então apenas retornamos os dados como estão
    return financialTransactions;
  }, [financialTransactions]);

  // Total de Despesas: mesma lógica do Total de Pagamentos (payment_date para realizado, due_date para previsto)
  const getFilteredExpenses = useMemo(() => {
    const periodStart = filters.startDate?.trim() || getDefaultPeriod().start;
    const periodEnd = filters.endDate?.trim() || getDefaultPeriod().end;
    const toYYYYMMDD = (val: string | Date | null | undefined): string | null => {
      if (val == null) return null;
      if (typeof val === 'string' && !val.trim()) return null;
      if (val instanceof Date) return format(val, 'yyyy-MM-dd');
      const s = String(val).trim();
      return s.indexOf('T') !== -1 ? s.slice(0, 10) : s.length >= 10 ? s.slice(0, 10) : s;
    };
    const inPeriod = (dateStr: string | Date | null | undefined) => {
      const d = toYYYYMMDD(dateStr);
      return d ? d >= periodStart && d <= periodEnd : false;
    };
    const statusLower = (s: string) => String(s || '').toLowerCase().trim();
    const isPrevisto = (ap: any) => ['previsto', 'pendente'].includes(statusLower(ap.status));
    const isRealizado = (ap: any) => ['realizado', 'pago'].includes(statusLower(ap.status));

    const fromAccountsPayable = getFilteredAccountsPayable
      .filter(ap => (isRealizado(ap) && inPeriod(ap.payment_date)) || (isPrevisto(ap) && inPeriod(ap.due_date)))
      .map(item => ({ ...item, source: 'accounts_payable' }));

    const fromTransactions = getFilteredTransactions
      .filter(t => (Number(t.amount) || 0) < 0 && !nonOperationalAccounts.some(acc =>
        t.chart_of_accounts?.toLowerCase() === acc.toLowerCase()
      ))
      .map(item => ({ ...item, source: 'transactions' }));

    return [...fromAccountsPayable, ...fromTransactions];
  }, [getFilteredAccountsPayable, getFilteredTransactions, filters.startDate, filters.endDate, nonOperationalAccounts]);

  // Saldos iniciais filtrados por empresas/grupos e período (sem agrupar, para cálculos)
  const getFilteredInitialBalancesRaw = useMemo(() => {
    let filtered = initialBalances;

    // Filtrar por data do saldo (balance_date) - pega saldos até o início do período
    // Se há filtro de data inicial, considera apenas saldos com balance_date <= startDate
    // (ou seja, o saldo que estava no início do período filtrado)
    if (filters.startDate) {
      filtered = filtered.filter(bal => {
        const balanceDate = bal.balance_date;
        if (!balanceDate) return true; // Se não tem data, mantém
        return balanceDate <= filters.startDate;
      });
    }

    // Se não há empresas cadastradas, retorna apenas com filtro de data
    if (companies.length === 0) {
      return filtered;
    }

    const { codes: normalizedCompanyCodes, hasActive: hasActiveFilters } = getFilteredCompanyCodesNormalized;

    // Se não há filtros de empresa/grupo ativos, retorna apenas com filtro de data
    if (!hasActiveFilters) {
      return filtered;
    }

    return filtered.filter(bal => {
      const normalizedBU = normalizeCode(bal.business_unit);
      return normalizedCompanyCodes.includes(normalizedBU);
    });
  }, [initialBalances, companies, getFilteredCompanyCodesNormalized, filters.startDate]);

  // Dados detalhados para Saldo Inicial (saldos bancários) - agrupados por banco e filtrados por empresas/grupos
  const getFilteredInitialBalances = useMemo(() => {
    // Agrupar por bank_name e somar os valores dos saldos filtrados
    const groupedByBank = getFilteredInitialBalancesRaw.reduce((acc, bal) => {
      const bankName = bal.bank_name || '-';
      const balanceValue = bal.balance;
      let balance = 0;
      if (balanceValue !== null && balanceValue !== undefined && balanceValue !== '') {
        const parsed = parseFloat(String(balanceValue));
        balance = isNaN(parsed) ? 0 : parsed;
      }
      
      if (!acc[bankName]) {
        acc[bankName] = {
          bank_name: bankName,
          balance: 0,
          business_unit: bal.business_unit,
          balance_date: bal.balance_date,
          import_id: bal.import_id,
          created_at: bal.created_at,
          id: bal.id,
          source: 'initial_balance'
        };
      }
      
      acc[bankName].balance += balance;
      return acc;
    }, {} as Record<string, any>);

    // Converter o objeto agrupado de volta para array e mapear balance para amount
    return Object.values(groupedByBank).map((item: any) => ({
      ...item,
      amount: item.balance, // Mapear balance para amount para o modal
      source: 'initial_balance'
    }));
  }, [getFilteredInitialBalancesRaw]);

  // Mesmos registros que sustentam o valor do card Saldo Inicial (no período ou mais recente antes do período)
  const getInitialBalanceDetailRecords = useMemo(() => {
    let startDateStr = filters.startDate || '';
    if (!startDateStr || startDateStr.trim() === '') {
      const defaultPeriod = getDefaultPeriod();
      startDateStr = defaultPeriod.start;
    }
    const startDateObj = startDateStr ? new Date(startDateStr) : null;
    const allBalances = (getFilteredInitialBalancesRaw || []).filter(bal => !!bal.balance_date);
    const balancesInPeriod = startDateObj ? allBalances.filter(bal => new Date(bal.balance_date) >= startDateObj) : [];
    let allBalancesForBeforePeriod = (initialBalances || []).filter(bal => !!bal.balance_date);
    if (companies.length > 0 && getFilteredCompanyCodesNormalized.hasActive) {
      const normalizedCompanyCodes = getFilteredCompanyCodesNormalized.codes;
      allBalancesForBeforePeriod = allBalancesForBeforePeriod.filter(bal => normalizedCompanyCodes.includes(normalizeCode(bal.business_unit)));
    }
    const balancesBeforePeriodFiltered = startDateObj ? allBalancesForBeforePeriod.filter(bal => new Date(bal.balance_date) < startDateObj) : [];
    let balancesToUse: Record<string, any> = {};
    const hasBalanceInPeriod = balancesInPeriod.length > 0;
    if (hasBalanceInPeriod) {
      balancesToUse = balancesInPeriod.reduce((acc, bal) => {
        const key = `${bal.bank_name || '-'}_${bal.business_unit || '-'}`;
        const existing = acc[key];
        if (!existing) acc[key] = bal;
        else if ((bal.balance_date || '') < (existing.balance_date || '')) acc[key] = bal;
        return acc;
      }, {} as Record<string, any>);
    } else if (showLatestInitialBalance && balancesBeforePeriodFiltered.length > 0) {
      balancesToUse = balancesBeforePeriodFiltered.reduce((acc, bal) => {
        const key = `${bal.bank_name || '-'}_${bal.business_unit || '-'}`;
        const existing = acc[key];
        if (!existing || (bal.balance_date || '') > (existing.balance_date || '')) acc[key] = bal;
        else if (!acc[key]) acc[key] = bal;
        return acc;
      }, {} as Record<string, any>);
    }
    return Object.values(balancesToUse).map((bal: any) => ({
      id: bal.id,
      source: 'initial_balance',
      type: 'Saldo Inicial',
      business_unit: bal.business_unit,
      balance_date: bal.balance_date,
      amount: Number(bal.balance) || 0,
      balance: Number(bal.balance) || 0,
      bank_name: bal.bank_name || '-',
      status: 'realizado'
    }));
  }, [getFilteredInitialBalancesRaw, initialBalances, companies, getFilteredCompanyCodesNormalized, filters.startDate, showLatestInitialBalance]);

  // Dados detalhados para Total de Recebimentos (receitas + receita_crediario + transações positivas)
  const getFilteredTotalInflows = useMemo(() => {
    const revenuesData = getFilteredRevenues.map(r => ({
      ...r,
      source: 'revenues',
      type: 'Receita'
    }));

    const crediarioData = getFilteredReceitaCrediario.map(rc => ({
      id: rc.id,
      source: 'receita_crediario',
      type: 'Receita Crediário',
      business_unit: rc.business_unit,
      payment_date: rc.data_receb,
      amount: Number(rc.recebimento) || 0,
      chart_of_accounts: rc.parcela ? `Parcela ${rc.parcela}` : 'Receita Crediário',
      status: 'realizado',
      import_id: rc.import_id
    }));

    const transactionsData = getFilteredTransactions
      .filter(t => (Number(t.amount) || 0) > 0)
      .map(t => ({
        ...t,
        source: 'transactions',
        type: 'Transação Financeira',
        amount: Math.abs(Number(t.amount) || 0)
      }));

    return [...revenuesData, ...crediarioData, ...transactionsData];
  }, [getFilteredRevenues, getFilteredReceitaCrediario, getFilteredTransactions]);

  // Dados detalhados para Total de Pagamentos (contas_a_pagar + transações negativas) — usado no cálculo do card
  const getFilteredTotalOutflows = useMemo(() => {
    const apData = getFilteredAccountsPayable.map(ap => ({
      ...ap,
      source: 'accounts_payable',
      type: 'Conta a Pagar'
    }));

    const transactionsData = getFilteredTransactions
      .filter(t => (Number(t.amount) || 0) < 0)
      .map(t => ({
        ...t,
        source: 'transactions',
        type: 'Transação Financeira',
        amount: Math.abs(Number(t.amount) || 0)
      }));

    return [...apData, ...transactionsData];
  }, [getFilteredAccountsPayable, getFilteredTransactions]);

  // Tabela de detalhes do Total de Pagamentos: SOMENTE contas_a_pagar (card continua somando ap + transações)
  const getFilteredTotalOutflowsTable = useMemo(() => {
    return getFilteredAccountsPayable.map(ap => ({
      ...ap,
      source: 'accounts_payable',
      type: 'Conta a Pagar'
    }));
  }, [getFilteredAccountsPayable]);

  // Dados detalhados para Saldo Final (composição: inicial + recebimentos - pagamentos)
  const getFilteredFinalBalance = useMemo(() => {
    const initialBalancesData = getFilteredInitialBalances.map(bal => ({
      ...bal,
      source: 'initial_balance',
      type: 'Saldo Inicial',
      description: `Saldo inicial - ${bal.bank_name}`,
      amount: parseFloat(bal.balance || 0),
      date: bal.balance_date
    }));

    const inflowsData = getFilteredTotalInflows.map(item => ({
      ...item,
      type: item.type || 'Recebimento',
      description: item.description || item.chart_of_accounts || 'Recebimento'
    }));

    const outflowsData = getFilteredTotalOutflows.map(item => ({
      ...item,
      type: item.type || 'Pagamento',
      description: item.description || item.chart_of_accounts || 'Pagamento',
      amount: -Math.abs(item.amount || 0) // Negativo para saídas
    }));

    return [...initialBalancesData, ...inflowsData, ...outflowsData];
  }, [getFilteredInitialBalances, getFilteredTotalInflows, getFilteredTotalOutflows]);


  // Função para carregar dados paginados do banco para o modal
  const loadPaginatedDataForModal = async (
    type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed' | 'total_inflows' | 'total_outflows' | 'initial_balance',
    page: number,
    pageSize: number,
    filters: {
      status?: string | string[];
      businessUnit?: string | string[];
      startDate?: string;
      endDate?: string;
      searchTerm?: string;
    }
  ): Promise<{ data: any[]; totalCount: number; hasMore: boolean; totalSum?: number }> => {
    try {
      if (type === 'generic') {
        // Dados são fornecidos diretamente via `data` no modal (sem paginação no banco)
        return { data: [], totalCount: 0, hasMore: false };
      }

      // Buscar imports ativos
      const { data: importsData } = await supabase
        .from('importacoes')
        .select('id, is_deleted');

      const activeImportIds = (importsData || [])
        .filter((imp: any) => !imp.is_deleted)
        .map((imp: any) => imp.id);

      // Obter business units filtrados
      const filteredBusinessUnits = getFilteredBusinessUnits();

      // Determinar período base (usar filtros globais ou período padrão)
      let baseStartDate: string;
      let baseEndDate: string;
      
      if (filters.startDate && filters.endDate) {
        baseStartDate = filters.startDate;
        baseEndDate = filters.endDate;
      } else if (filters.startDate || filters.endDate) {
        // Se só um filtro de data foi passado, usar ele
        baseStartDate = filters.startDate || '';
        baseEndDate = filters.endDate || '';
      } else if (filters.startDate && filters.endDate && filters.startDate.trim() !== '' && filters.endDate.trim() !== '') {
        baseStartDate = filters.startDate;
        baseEndDate = filters.endDate;
      } else {
        const defaultPeriod = getDefaultPeriod();
        baseStartDate = defaultPeriod.start;
        baseEndDate = defaultPeriod.end;
      }

      const offset = page * pageSize;

      if (type === 'accounts_payable') {
        let query = applyContasAPagarImportFilter(
          supabase
            .from('contas_a_pagar')
            .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id', { count: 'exact' }),
          activeImportIds
        );

        // Aplicar filtros de business_unit (do filtro global ou do modal)
        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
          query = query.in('business_unit', filters.businessUnit);
        } else if (filters.businessUnit && filters.businessUnit !== 'all') {
          query = query.eq('business_unit', filters.businessUnit);
        }

        // Aplicar filtros de data
        if (baseStartDate) {
          query = query.gte('payment_date', baseStartDate);
        }
        if (baseEndDate) {
          query = query.lte('payment_date', baseEndDate);
        }

        // Aplicar filtro de status
        if (filters.status && filters.status !== 'all') {
          const statusValue = filters.status === 'realizado' ? 'realizado' : 'previsto';
          query = query.eq('status', statusValue);
        }

        // Busca de texto (se houver)
        if (filters.searchTerm && filters.searchTerm.trim() !== '') {
          const searchLower = `%${filters.searchTerm.toLowerCase()}%`;
          // Buscar em múltiplas colunas usando OR
          query = query.or(`chart_of_accounts.ilike.${searchLower},creditor.ilike.${searchLower},business_unit.ilike.${searchLower}`);
        }

        const { data, error, count } = await query
          .order('payment_date', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        return {
          data: data || [],
          totalCount: count || 0,
          hasMore: (count || 0) > offset + pageSize
        };
      } else if (type === 'revenues') {
        let query = supabase
          .from('receitas_manuais')
          .select('id, status, business_unit, conta, descricao, data, valor', { count: 'exact' });

        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
          query = query.in('business_unit', filters.businessUnit);
        } else if (filters.businessUnit && filters.businessUnit !== 'all') {
          query = query.eq('business_unit', filters.businessUnit);
        }

        if (baseStartDate) query = query.gte('data', baseStartDate);
        if (baseEndDate) query = query.lte('data', baseEndDate);
        if (filters.status && filters.status !== 'all') {
          const statusValue = filters.status === 'realizado' ? 'realizado' : 'previsto';
          query = query.eq('status', statusValue);
        }
        if (filters.searchTerm && filters.searchTerm.trim() !== '') {
          const searchLower = `%${filters.searchTerm.toLowerCase()}%`;
          query = query.or(`conta.ilike.${searchLower},business_unit.ilike.${searchLower},descricao.ilike.${searchLower}`);
        }

        const { data, error, count } = await query
          .order('data', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        const mapped = (data || []).map(r => ({
          id: r.id,
          business_unit: r.business_unit,
          payment_date: r.data,
          amount: Number(r.valor) || 0,
          status: r.status || 'previsto',
          chart_of_accounts: r.conta,
          descricao: r.descricao
        }));

        return {
          data: mapped,
          totalCount: count || 0,
          hasMore: (count || 0) > offset + pageSize
        };
      } else if (type === 'transactions') {
        if (activeImportIds.length === 0) {
          return { data: [], totalCount: 0, hasMore: false };
        }
        let query = supabase
          .from('transacoes_financeiras')
          .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, descricao, id', { count: 'exact' })
          .in('import_id', activeImportIds);

        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
          query = query.in('business_unit', filters.businessUnit);
        } else if (filters.businessUnit && filters.businessUnit !== 'all') {
          query = query.eq('business_unit', filters.businessUnit);
        }

        if (baseStartDate) {
          query = query.gte('transaction_date', baseStartDate);
        }
        if (baseEndDate) {
          query = query.lte('transaction_date', baseEndDate);
        }

        if (filters.status && filters.status !== 'all') {
          const statusValue = filters.status === 'realizado' ? 'realizado' : 'previsto';
          query = query.eq('status', statusValue);
        }

        if (filters.searchTerm && filters.searchTerm.trim() !== '') {
          const searchLower = `%${filters.searchTerm.toLowerCase()}%`;
          query = query.or(`chart_of_accounts.ilike.${searchLower},business_unit.ilike.${searchLower}`);
        }

        const { data, error, count } = await query
          .order('transaction_date', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        return {
          data: data || [],
          totalCount: count || 0,
          hasMore: (count || 0) > offset + pageSize
        };
      } else if (type === 'total_inflows') {
        // Total de Recebimentos: receitas_manuais + transacoes_financeiras (apenas positivas). receitas e receita_crediario inativos.
        const [revenuesResult, transactionsResult] = await Promise.all([
          (async () => {
            let query = supabase
              .from('receitas_manuais')
              .select('id, status, business_unit, conta, descricao, data, valor')
              .gte('data', baseStartDate || '')
              .lte('data', baseEndDate || '');
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
              query = query.in('business_unit', filters.businessUnit);
            } else if (filters.businessUnit && filters.businessUnit !== 'all') {
              query = query.eq('business_unit', filters.businessUnit);
            }
            if (filters.status && filters.status !== 'all') {
              query = query.eq('status', filters.status === 'realizado' ? 'realizado' : 'previsto');
            }
            const { data: d, error } = await query.order('data', { ascending: false });
            if (error) return [];
            return (d || []).map(r => ({
              id: r.id,
              source: 'revenues',
              type: 'Receita',
              business_unit: r.business_unit,
              payment_date: r.data,
              amount: Number(r.valor) || 0,
              chart_of_accounts: r.conta,
              status: r.status || 'previsto',
              descricao: r.descricao
            }));
          })(),
          (async () => {
            if (activeImportIds.length === 0) return [];
            let query = supabase
              .from('transacoes_financeiras')
              .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, descricao, id')
              .in('import_id', activeImportIds)
              .gt('amount', 0);
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
              query = query.in('business_unit', filters.businessUnit);
            } else if (filters.businessUnit && filters.businessUnit !== 'all') {
              query = query.eq('business_unit', filters.businessUnit);
            }
            if (baseStartDate) query = query.gte('transaction_date', baseStartDate);
            if (baseEndDate) query = query.lte('transaction_date', baseEndDate);
            if (filters.status && filters.status !== 'all') {
              query = query.eq('status', filters.status === 'realizado' ? 'realizado' : 'previsto');
            }
            const { data: d, error } = await query.order('transaction_date', { ascending: false });
            if (error) throw error;
            return (d || []).map(t => ({
              ...t,
              source: 'transactions',
              type: 'Transação Financeira',
              payment_date: t.transaction_date,
              amount: Math.abs(t.amount || 0)
            }));
          })()
        ]);

        const allData = [...revenuesResult, ...transactionsResult];
        allData.sort((a: any, b: any) => {
          const dateA = a.payment_date || a.transaction_date || '';
          const dateB = b.payment_date || b.transaction_date || '';
          return dateB.localeCompare(dateA);
        });

        let filteredData = allData;
        if (filters.searchTerm && filters.searchTerm.trim() !== '') {
          const searchLower = filters.searchTerm.toLowerCase();
          filteredData = allData.filter(item =>
            JSON.stringify(item).toLowerCase().includes(searchLower)
          );
        }

        const paginatedData = filteredData.slice(offset, offset + pageSize);
        return {
          data: paginatedData,
          totalCount: filteredData.length,
          hasMore: filteredData.length > offset + pageSize
        };
      } else if (type === 'total_outflows') {
        // Tabela de Total de Pagamentos: SOMENTE contas_a_pagar (card continua somando ap + transações)
        const BATCH = 1000;
        const searchTerm = filters.searchTerm?.trim() || '';
        const searchPattern = searchTerm ? `%${searchTerm.toLowerCase()}%` : '';

        let allData: any[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          let q = applyContasAPagarImportFilter(
            supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id'),
            activeImportIds
          );
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            q = q.in('business_unit', filteredBusinessUnits);
          } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
            q = q.in('business_unit', filters.businessUnit);
          } else if (filters.businessUnit && filters.businessUnit !== 'all') {
            q = q.eq('business_unit', filters.businessUnit);
          }
          if (baseStartDate) q = q.gte('payment_date', baseStartDate);
          if (baseEndDate) q = q.lte('payment_date', baseEndDate);
          if (Array.isArray(filters.status) && filters.status.length > 0) {
            q = q.in('status', filters.status);
          } else if (filters.status && filters.status !== 'all') {
            q = q.eq('status', filters.status === 'realizado' ? 'realizado' : 'previsto');
          }
          if (searchPattern) {
            q = q.or(`chart_of_accounts.ilike.${searchPattern},creditor.ilike.${searchPattern},business_unit.ilike.${searchPattern}`);
          }
          const { data, error } = await q.order('payment_date', { ascending: false }).range(from, from + BATCH - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allData = [...allData, ...data.map((ap: any) => ({ ...ap, source: 'accounts_payable', type: 'Conta a Pagar' }))];
            from += BATCH;
            hasMore = data.length === BATCH;
          } else {
            hasMore = false;
          }
        }

        const totalCount = allData.length;
        const totalSum = allData.reduce((s: number, i: any) => s + Math.abs(Number(i.amount) || 0), 0);
        const paginatedData = allData.slice(offset, offset + pageSize);
        return {
          data: paginatedData,
          totalCount,
          hasMore: totalCount > offset + pageSize,
          totalSum
        };
      } else if (type === 'initial_balance') {
        // Detalhes: Saldo Inicial — apenas tabela saldos_iniciais; mostrar tudo que existe (outubro, etc.)
        // Período não filtra aqui para não zerar a lista quando o dashboard está em outro mês
        let query = supabase
          .from('saldos_iniciais')
          .select('import_id, business_unit, balance_date, balance, bank_name, id', { count: 'exact' });

        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
          query = query.in('business_unit', filters.businessUnit);
        } else if (filters.businessUnit && filters.businessUnit !== 'all') {
          query = query.eq('business_unit', filters.businessUnit);
        }
        // Período: quando o usuário escolhe datas e clica Aplicar, filtra por balance_date
        if (baseStartDate && baseStartDate.trim()) query = query.gte('balance_date', baseStartDate);
        if (baseEndDate && baseEndDate.trim()) query = query.lte('balance_date', baseEndDate);
        if (filters.searchTerm && filters.searchTerm.trim() !== '') {
          const searchLower = `%${filters.searchTerm.toLowerCase()}%`;
          query = query.or(`bank_name.ilike.${searchLower},business_unit.ilike.${searchLower}`);
        }

        const { data, error, count } = await query
          .order('balance_date', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        const mapped = (data || []).map(bal => ({
          id: bal.id,
          source: 'initial_balance',
          type: 'Saldo Inicial',
          business_unit: bal.business_unit,
          balance_date: bal.balance_date,
          amount: Number(bal.balance) || 0,
          balance: Number(bal.balance) || 0,
          bank_name: bal.bank_name || '-',
          status: 'realizado'
        }));

        return {
          data: mapped,
          totalCount: count || 0,
          hasMore: (count || 0) > offset + pageSize
        };
      } else if (type === 'mixed') {
        // Para mixed, carregar de múltiplas fontes e combinar
        // Por enquanto, vamos carregar todas as fontes e combinar
        // (pode ser otimizado depois para carregar cada fonte paginada)
        const [revenuesResult, apResult, transactionsResult, forecastedResult, balancesResult] = await Promise.all([
          // Receitas (receitas_manuais; tabelas receitas/receita_crediario inativas)
          (async () => {
            let query = supabase
              .from('receitas_manuais')
              .select('id, status, business_unit, conta, descricao, data, valor', { count: 'exact' })
              .gte('data', baseStartDate || '')
              .lte('data', baseEndDate || '');
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
              query = query.in('business_unit', filters.businessUnit);
            } else if (filters.businessUnit && filters.businessUnit !== 'all') {
              query = query.eq('business_unit', filters.businessUnit);
            }
            if (filters.status && filters.status !== 'all') {
              query = query.eq('status', filters.status === 'realizado' ? 'realizado' : 'previsto');
            }
            const { data, error } = await query.order('data', { ascending: false });
            if (error) return [];
            return (data || []).map(r => ({
              id: r.id,
              business_unit: r.business_unit,
              payment_date: r.data,
              amount: Number(r.valor) || 0,
              status: r.status || 'previsto',
              chart_of_accounts: r.conta,
              descricao: r.descricao,
              source: 'revenues',
              type: 'Receita'
            }));
          })(),
          // Contas a pagar
          (async () => {
            let query = applyContasAPagarImportFilter(
              supabase
                .from('contas_a_pagar')
                .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id', { count: 'exact' }),
              activeImportIds
            );

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
              query = query.in('business_unit', filters.businessUnit);
            } else if (filters.businessUnit && filters.businessUnit !== 'all') {
              query = query.eq('business_unit', filters.businessUnit);
            }

            if (baseStartDate) query = query.gte('payment_date', baseStartDate);
            if (baseEndDate) query = query.lte('payment_date', baseEndDate);
            if (filters.status && filters.status !== 'all') {
              query = query.eq('status', filters.status === 'realizado' ? 'realizado' : 'previsto');
            }

            const { data, error } = await query.order('payment_date', { ascending: false });
            if (error) throw error;
            return (data || []).map(ap => ({ ...ap, source: 'accounts_payable', type: 'Conta a Pagar' }));
          })(),
          // Transações
          (async () => {
            if (activeImportIds.length === 0) return [];
            let query = supabase
              .from('transacoes_financeiras')
              .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, descricao, id', { count: 'exact' })
              .in('import_id', activeImportIds);

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
              query = query.in('business_unit', filters.businessUnit);
            } else if (filters.businessUnit && filters.businessUnit !== 'all') {
              query = query.eq('business_unit', filters.businessUnit);
            }

            if (baseStartDate) query = query.gte('transaction_date', baseStartDate);
            if (baseEndDate) query = query.lte('transaction_date', baseEndDate);
            if (filters.status && filters.status !== 'all') {
              query = query.eq('status', filters.status === 'realizado' ? 'realizado' : 'previsto');
            }

            const { data, error } = await query.order('transaction_date', { ascending: false });
            if (error) throw error;
            return (data || []).map(t => ({ ...t, source: 'transactions', type: 'Transação Financeira', transaction_date: t.transaction_date }));
          })(),
          // Previstos
          (async () => {
            if (activeImportIds.length === 0) return [];
            let query = supabase
              .from('previstos')
              .select('import_id, business_unit, due_date, amount, status, chart_of_accounts, supplier, id', { count: 'exact' })
              .in('import_id', activeImportIds);

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
              query = query.in('business_unit', filters.businessUnit);
            } else if (filters.businessUnit && filters.businessUnit !== 'all') {
              query = query.eq('business_unit', filters.businessUnit);
            }

            if (baseStartDate) query = query.gte('due_date', baseStartDate);
            if (baseEndDate) query = query.lte('due_date', baseEndDate);
            if (filters.status && filters.status !== 'all') {
              query = query.eq('status', filters.status === 'realizado' ? 'paga' : 'pendente');
            }

            const { data, error } = await query.order('due_date', { ascending: false });
            if (error) throw error;
            return (data || []).map(e => ({ ...e, source: 'forecasted_entries', type: 'Lançamento Orçado', payment_date: e.due_date }));
          })(),
          // Saldos iniciais
          (async () => {
            let query = supabase
              .from('saldos_iniciais')
              .select('import_id, business_unit, balance_date, balance, bank_name, id', { count: 'exact' })
              .lte('balance_date', baseEndDate || new Date().toISOString().split('T')[0]);

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            } else if (Array.isArray(filters.businessUnit) && filters.businessUnit.length > 0) {
              query = query.in('business_unit', filters.businessUnit);
            } else if (filters.businessUnit && filters.businessUnit !== 'all') {
              query = query.eq('business_unit', filters.businessUnit);
            }

            const { data, error } = await query.order('balance_date', { ascending: false });
            if (error) throw error;
            
            // Agrupar por banco e business_unit (manter lógica existente)
            const grouped = (data || []).reduce((acc: any, bal: any) => {
              const bankName = bal.bank_name || '-';
              const key = `${bankName}_${bal.business_unit || '-'}`;
              if (!acc[key]) {
                acc[key] = {
                  bank_name: bankName,
                  business_unit: bal.business_unit,
                  balance: 0,
                  balance_date: bal.balance_date,
                  amount: 0,
                  source: 'initial_balance',
                  type: 'Saldo Inicial'
                };
              }
              if (!acc[key].balance_date || bal.balance_date > acc[key].balance_date) {
                acc[key].balance_date = bal.balance_date;
                acc[key].balance = bal.balance;
                acc[key].amount = bal.balance;
              }
              return acc;
            }, {});
            
            return Object.values(grouped);
          })()
        ]);

        // Combinar todos os resultados
        const allData = [...revenuesResult, ...apResult, ...transactionsResult, ...forecastedResult, ...balancesResult];

        // Ordenar por data (mais recente primeiro)
        allData.sort((a: any, b: any) => {
          const dateA = a.payment_date || a.transaction_date || a.due_date || a.balance_date || '';
          const dateB = b.payment_date || b.transaction_date || b.due_date || b.balance_date || '';
          return dateB.localeCompare(dateA);
        });

        // Aplicar busca de texto se houver (no front, já que é mixed)
        let filteredData = allData;
        if (filters.searchTerm && filters.searchTerm.trim() !== '') {
          const searchLower = filters.searchTerm.toLowerCase();
          filteredData = allData.filter(item => 
            JSON.stringify(item).toLowerCase().includes(searchLower)
          );
        }

        // Aplicar paginação
        const paginatedData = filteredData.slice(offset, offset + pageSize);
        const totalCount = filteredData.length;

        return {
          data: paginatedData,
          totalCount,
          hasMore: totalCount > offset + pageSize
        };
      }

      return { data: [], totalCount: 0, hasMore: false };
    } catch (error) {
      console.error('❌ Erro ao carregar dados paginados:', error);
      return { data: [], totalCount: 0, hasMore: false };
    }
  };

  const openKPIDetail = (title: string, data: any[], type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed' | 'total_inflows' | 'total_outflows' | 'initial_balance', sourceTables?: string[]) => {
    // Período atual do dashboard (mesmo que está filtrado no card)
    const periodStart = filters.startDate?.trim() || getDefaultPeriod().start;
    const periodEnd = filters.endDate?.trim() || getDefaultPeriod().end;

    const loadPaginatedData = async (
      page: number,
      pageSize: number,
      filtersParam: {
        status?: string;
        businessUnit?: string;
        startDate?: string;
        endDate?: string;
        searchTerm?: string;
      }
    ) => {
      return await loadPaginatedDataForModal(type, page, pageSize, filtersParam);
    };

    // Saldo Inicial: mostrar exatamente os registros que sustentam o valor do card (ex.: mais recente antes do período)
    const isInitialBalance = type === 'initial_balance';
    setModalState({
      isOpen: true,
      title,
      data: isInitialBalance ? getInitialBalanceDetailRecords : data,
      type,
      loadPaginatedData: isInitialBalance ? undefined : loadPaginatedData,
      initialStartDate: isInitialBalance ? '' : periodStart,
      initialEndDate: isInitialBalance ? '' : periodEnd,
      sourceTables
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      data: [],
      type: 'generic',
      loadPaginatedData: undefined,
      initialStartDate: undefined,
      initialEndDate: undefined,
      sourceTables: undefined
    });
  };

  // Total de Pagamentos: contas_a_pagar
  // Realizado = payment_date no período + status realizado/pago
  // Previsto  = due_date no período + status pendente/previsto
  const accountsPayableTotals = useMemo(() => {
    const periodStart = filters.startDate?.trim() || getDefaultPeriod().start;
    const periodEnd = filters.endDate?.trim() || getDefaultPeriod().end;
    // Normaliza qualquer valor de data (string ISO, Date, ou YYYY-MM-DD) para YYYY-MM-DD para comparação
    const toYYYYMMDD = (val: string | Date | null | undefined): string | null => {
      if (val == null) return null;
      if (typeof val === 'string' && !val.trim()) return null;
      if (val instanceof Date) return format(val, 'yyyy-MM-dd');
      const s = String(val).trim();
      if (s.indexOf('T') !== -1) return s.slice(0, 10);
      return s.length >= 10 ? s.slice(0, 10) : s;
    };
    const inPeriod = (dateStr: string | Date | null | undefined, start: string, end: string) => {
      const d = toYYYYMMDD(dateStr);
      if (!d) return false;
      return d >= start && d <= end;
    };
    const statusLower = (s: string) => String(s || '').toLowerCase().trim();
    const isPrevisto = (ap: any) => ['previsto', 'pendente'].includes(statusLower(ap.status));
    const isRealizado = (ap: any) => ['realizado', 'pago'].includes(statusLower(ap.status));
    const num = (v: any) => Math.abs(Number(v) || 0);

    const actual = getFilteredAccountsPayable
      .filter(ap => isRealizado(ap) && inPeriod(ap.payment_date, periodStart, periodEnd))
      .reduce((sum, ap) => sum + num(ap.amount), 0);

    const forecasted = getFilteredAccountsPayable
      .filter(ap => isPrevisto(ap) && inPeriod(ap.due_date, periodStart, periodEnd))
      .reduce((sum, ap) => sum + num(ap.amount), 0);

    return { forecasted, actual };
  }, [getFilteredAccountsPayable, filters.startDate, filters.endDate]);

  // Calculate totals from forecasted entries
  // Dados já vêm filtrados do banco por data e business_unit
  // Apenas aplica filtros de lógica de negócio (operacional, não-receita)
  const forecastedEntriesTotals = useMemo(() => {
    console.log('Forecasted Entries:', forecastedEntries);

    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Apenas aplicamos filtros de lógica de negócio aqui
    const filtered = forecastedEntries.filter(entry => {
      const isOperational = !nonOperationalAccounts.some(account =>
        entry.chart_of_accounts?.toLowerCase() === account.toLowerCase()
      );

      // Exclude "Movimento em Dinheiro" as it goes to revenues
      const isNotRevenue = !entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro');

      return isOperational && isNotRevenue;
    });

    const total = filtered.reduce((sum, entry) => sum + (entry.amount || 0), 0);

    return { forecasted: total, actual: 0 };
  }, [forecastedEntries, nonOperationalAccounts]);

  // Totais de receita a partir de receitas_manuais (tabelas receitas/receita_crediario inativas)
  const revenueTotals = useMemo(() => {
    const forecasted = receitasManuais
      .filter(r => (r.status || '').toLowerCase() === 'previsto' || (r.status || '').toLowerCase() === 'pendente')
      .reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
    const actual = receitasManuais
      .filter(r => (r.status || '').toLowerCase() === 'realizado')
      .reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
    return { forecasted, actual };
  }, [receitasManuais]);

  // Receita crediário inativa
  const receitaCrediarioTotals = useMemo(() => ({ forecasted: 0, actual: 0 }), []);

  // Dados já vêm filtrados do banco por data e business_unit
  // Apenas calcula totais por status e tipo (inflow/outflow), excluindo contas não operacionais
  const transactionTotals = useMemo(() => {
    console.log('Financial Transactions:', financialTransactions);

    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Apenas aplicamos filtros de lógica de negócio (excluir contas não operacionais) e calculamos totais
    const filtered = financialTransactions.filter(t => {
      // Exclude non-operational accounts for outflows
      const isOperational = t.amount >= 0 || !nonOperationalAccounts.some(account =>
        t.chart_of_accounts?.toLowerCase() === account.toLowerCase()
      );
      return isOperational;
    });

    // Previsto = previsto ou pendente; Realizado = realizado ou pago (null tratado como realizado para inflows)
    const statusLower = (s: string) => String(s || '').toLowerCase().trim();
    const isPrevisto = (t: any) => ['previsto', 'pendente'].includes(statusLower(t.status));
    const isRealizadoStrict = (t: any) => ['realizado', 'pago'].includes(statusLower(t.status));
    const isRealizadoOrNull = (t: any) => isRealizadoStrict(t) || !t.status?.trim();
    const num = (v: any) => Number(v) || 0;

    // Inflows (positivos): previsto/realizado
    const forecastedInflows = filtered
      .filter(t => isPrevisto(t) && num(t.amount) > 0)
      .reduce((sum, t) => sum + num(t.amount), 0);

    const actualInflows = filtered
      .filter(t => isRealizadoOrNull(t) && num(t.amount) > 0)
      .reduce((sum, t) => sum + num(t.amount), 0);

    // Outflows (negativos) para Total de Pagamentos: previsto/pendente → previsto; realizado/pago → realizado
    const forecastedOutflows = Math.abs(filtered
      .filter(t => isPrevisto(t) && num(t.amount) < 0)
      .reduce((sum, t) => sum + num(t.amount), 0));

    const actualOutflows = Math.abs(filtered
      .filter(t => isRealizadoStrict(t) && num(t.amount) < 0)
      .reduce((sum, t) => sum + num(t.amount), 0));

    return {
      inflows: { forecasted: forecastedInflows, actual: actualInflows },
      outflows: { forecasted: forecastedOutflows, actual: actualOutflows }
    };
  }, [financialTransactions, nonOperationalAccounts]);

  // CMV - dados de vendas_por_usuario (coluna custo)
  const getFilteredCMVDRE = useMemo(() => {
    const periodStart = filters.startDate?.trim() || getDefaultPeriod().start;
    const periodEnd = filters.endDate?.trim() || getDefaultPeriod().end;
    const toDateStr = (d: any) => (d == null ? '' : String(d).split('T')[0]);
    return (vendasPorUsuarioRows || [])
      .filter(r => toDateStr(r.data) >= periodStart && toDateStr(r.data) <= periodEnd)
      .map(r => ({
        id: r.id ?? `vpu-${r.business_unit}-${r.data}-${r.usuario}`,
        status: 'realizado',
        business_unit: r.business_unit,
        chart_of_accounts: 'CMV',
        issue_date: r.data,
        amount: Number(r.custo) || 0,
        creditor: r.usuario ?? '',
        payment_date: r.data,
        usuario: r.usuario
      }));
  }, [vendasPorUsuarioRows, filters.startDate, filters.endDate]);


  // Dados detalhados para Resultado Operacional (receita - CMV - despesas)
  const getFilteredOperationalResult = useMemo(() => {
    // Receita Direta da Entrega de Resultado (vendas_por_usuario) no período atual
    const revenueData = getFilteredDirectRevenueSales.map(r => ({
      ...r,
      source: 'vendas_por_usuario',
      type: 'Receita',
      category: 'Receita Direta'
    }));

    // CMV de vendas_por_usuario (coluna custo)
    const cmvData = getFilteredCMVDRE.map(item => ({
      ...item,
      source: 'vendas_por_usuario',
      type: 'CMV',
      category: 'Custo de Mercadoria Vendida',
      amount: -Math.abs(item.amount || 0) // Negativo para custo
    }));

    const expensesData = getFilteredExpenses.map(item => ({
      ...item,
      type: 'Despesa',
      category: 'Despesa Operacional',
      amount: -Math.abs(item.amount || 0) // Negativo para despesa
    }));

    return [...revenueData, ...cmvData, ...expensesData];
  }, [getFilteredDirectRevenueSales, getFilteredCMVDRE, getFilteredExpenses]);

  // Referência para evitar warning de variável não usada (será usado quando modais de detalhes forem implementados)
  void getFilteredFinalBalance;
  void getFilteredOperationalResult;

  // CMV de vendas_por_usuario (coluna custo) - forecasted = período anterior
  const cmvTotals = useMemo(() => ({
    actual: directCmvSalesTotals?.actual ?? 0,
    forecasted: directCmvSalesTotals?.previous ?? 0
  }), [directCmvSalesTotals]);

  const kpiData = useMemo(() => {
    const baseKpis = calculateKPIs(filteredData);

    // Receita Direta (Entrega de Resultado): usar vendas_por_usuario
    // "forecasted" aqui passa a ser "Período anterior" (mesmo intervalo, deslocado para trás)
    const totalRevenueForecasted = directRevenueSalesTotals?.previous ?? revenueTotals.forecasted;
    const totalRevenueActual = directRevenueSalesTotals?.actual ?? revenueTotals.actual;

    // Add accounts payable to forecasted and actual outflows
    // Add revenues + receita_crediario to forecasted and actual inflows
    // Add financial transactions (apenas valores positivos para recebimentos)
    // Total de Recebimentos = Receitas + Receita Crediário + Transações positivas
    const totalInflowsForecasted = revenueTotals.forecasted + receitaCrediarioTotals.forecasted + transactionTotals.inflows.forecasted;
    const totalInflowsActual = revenueTotals.actual + receitaCrediarioTotals.actual + transactionTotals.inflows.actual;
    
    // Total de Pagamentos = Contas a Pagar + Transações negativas (previsto/realizado)
    // Deve corresponder a getFilteredTotalOutflows (getFilteredAccountsPayable + transações negativas)
    const totalOutflowsForecasted = accountsPayableTotals.forecasted + transactionTotals.outflows.forecasted;
    const totalOutflowsActual = accountsPayableTotals.actual + transactionTotals.outflows.actual;

    // Total de Despesas: mesma lógica do Total de Pagamentos
    // AP: realizado = payment_date no período; previsto = due_date no período
    // Transações: previsto/realizado por status (transaction_date já filtrado no carregamento)
    const totalExpensesForecasted = accountsPayableTotals.forecasted + transactionTotals.outflows.forecasted;
    const totalExpensesActual = accountsPayableTotals.actual + transactionTotals.outflows.actual;

    const result = {
      ...baseKpis,
      totalInflows: {
        forecasted: totalInflowsForecasted,
        actual: totalInflowsActual
      },
      totalOutflows: {
        forecasted: totalOutflowsForecasted,
        actual: totalOutflowsActual,
        percentageOfRevenue: baseKpis.totalOutflows.percentageOfRevenue
      },
      totalExpenses: {
        forecasted: totalExpensesForecasted,
        actual: totalExpensesActual,
        percentageOfRevenue: totalRevenueActual ? (totalExpensesActual / totalRevenueActual) * 100 : 0
      },
      directRevenue: {
        forecasted: totalRevenueForecasted,
        actual: totalRevenueActual
      },
      cogs: {
        forecasted: cmvTotals.forecasted,
        actual: cmvTotals.actual,
        percentageOfRevenue: totalRevenueActual ? (cmvTotals.actual / totalRevenueActual) * 100 : 0
      }
    };

    // Calculate initial balance from database - pega o saldo inicial do início do período filtrado
    // Primeiro, vamos separar saldos DENTRO do período (>= startDate) dos saldos ANTES do período (< startDate)
    // Se filters.startDate estiver vazio, usar o período padrão (mês atual) - mesma lógica do loadDataFromSupabase
    let startDateStr = filters.startDate || '';
    if (!startDateStr || startDateStr.trim() === '') {
      const defaultPeriod = getDefaultPeriod();
      startDateStr = defaultPeriod.start;
    }
    const startDateObj = startDateStr ? new Date(startDateStr) : null;

    // Para buscar saldos dentro do período, usa os dados filtrados
    const allBalances = (getFilteredInitialBalancesRaw || [])
      .filter(bal => {
        const balanceDate = bal.balance_date;
        return !!balanceDate; // Apenas filtra saldos com data válida
      });

    // Separar saldos dentro do período (>= startDate) dos saldos antes do período (< startDate)
    const balancesInPeriod = allBalances.filter(bal => {
      if (!startDateObj) return false;
      const balanceDateObj = new Date(bal.balance_date);
      return balanceDateObj >= startDateObj;
    });

    // Para buscar saldos ANTES do período, usa TODOS os saldos (não apenas os filtrados)
    // porque precisamos encontrar o mais recente, mesmo que seja muito antigo
    const allBalancesForBeforePeriod = (initialBalances || [])
      .filter(bal => {
        const balanceDate = bal.balance_date;
        return !!balanceDate; // Apenas filtra saldos com data válida
      });

    // Aplicar filtros de empresas/grupos se houver (mas sem filtro de data)
    let balancesBeforePeriod = allBalancesForBeforePeriod;
    if (companies.length > 0 && getFilteredCompanyCodesNormalized.hasActive) {
      const normalizedCompanyCodes = getFilteredCompanyCodesNormalized.codes;
      balancesBeforePeriod = allBalancesForBeforePeriod.filter(bal => {
        const normalizedBU = normalizeCode(bal.business_unit);
        return normalizedCompanyCodes.includes(normalizedBU);
      });
    }

    // Filtrar apenas saldos antes do período (balance_date < startDate)
    // IMPORTANTE: Se não há startDate, não podemos filtrar por data
    let balancesBeforePeriodFiltered: any[] = [];
    if (startDateObj) {
      balancesBeforePeriodFiltered = balancesBeforePeriod.filter(bal => {
        const balanceDateObj = new Date(bal.balance_date);
        const isBefore = balanceDateObj < startDateObj;
        return isBefore;
      });
      console.log(`  - Saldos antes do período (${startDateStr}): ${balancesBeforePeriodFiltered.length}`);
      if (balancesBeforePeriodFiltered.length > 0) {
        const dates = balancesBeforePeriodFiltered.map(b => b.balance_date).sort().reverse();
        console.log(`  - Datas encontradas (mais recente primeiro):`, dates.slice(0, 5));
      }
    } else {
      console.log(`  - ⚠️ ATENÇÃO: startDateObj é null! Não é possível filtrar saldos antes do período.`);
      console.log(`  - Isso significa que filters.startDate está vazio ou inválido.`);
    }

    balancesBeforePeriod = balancesBeforePeriodFiltered;

    // Agrupar saldos DENTRO do período por bank_name + business_unit e pegar o mais próximo do início
    const initialBalancesByBankAndUnit = balancesInPeriod.reduce((acc, bal) => {
      const key = `${bal.bank_name || '-'}_${bal.business_unit || '-'}`;
      const existing = acc[key];
      
      if (!existing) {
        acc[key] = bal;
      } else {
        // Compara as datas e pega o mais próximo do início do período (menor data >= startDate)
        const existingDate = existing.balance_date || '';
        const currentDate = bal.balance_date || '';
        if (currentDate < existingDate) {
          acc[key] = bal; // Pega o mais próximo do início (menor data)
        }
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Verificar se há saldo DENTRO do período (não apenas antes dele)
    const hasBalanceInPeriod = Object.keys(initialBalancesByBankAndUnit).length > 0;

    // Se não houver saldo no período e o usuário não pediu para mostrar o mais recente,
    // retornar indicador de que não há saldo
    if (!hasBalanceInPeriod && !showLatestInitialBalance) {
      result.initialBalance = {
        forecasted: 0,
        actual: 0,
        date: filters.startDate || new Date().toISOString().split('T')[0],
        hasBalance: false
      };
    } else {
      // Se não houver saldo no período mas o usuário pediu para mostrar o mais recente,
      // buscar o saldo mais recente antes do período
      let balancesToUse = initialBalancesByBankAndUnit;
      let isLatestBeforePeriod = false;

      if (!hasBalanceInPeriod && showLatestInitialBalance) {
        console.log('🔍 DEBUG - Buscando saldo mais recente antes do período:');
        console.log(`  - Saldos disponíveis antes do período: ${balancesBeforePeriod.length}`);
        
        // Usar os saldos antes do período que já foram separados
        // Agrupar por bank_name + business_unit e pegar o mais recente de cada grupo
        balancesToUse = balancesBeforePeriod.reduce((acc, bal) => {
          const key = `${bal.bank_name || '-'}_${bal.business_unit || '-'}`;
          const existing = acc[key];
          
          if (!existing) {
            acc[key] = bal;
          } else {
            const existingDate = existing.balance_date || '';
            const currentDate = bal.balance_date || '';
            // Comparar datas como strings (formato YYYY-MM-DD)
            if (currentDate > existingDate) {
              acc[key] = bal; // Pega o mais recente antes do período
            }
          }
          
          return acc;
        }, {} as Record<string, any>);
        
        console.log(`  - Saldos agrupados por banco/empresa: ${Object.keys(balancesToUse).length}`);
        console.log(`  - Chaves encontradas:`, Object.keys(balancesToUse));
        
        // Verificar se realmente há saldos antes do período
        isLatestBeforePeriod = Object.keys(balancesToUse).length > 0;
        
        console.log(`  - isLatestBeforePeriod: ${isLatestBeforePeriod}`);
        
        // Se não houver saldos antes do período, retornar indicador de que não há saldo
        if (!isLatestBeforePeriod) {
          console.log('⚠️ Nenhum saldo encontrado antes do período após agrupamento');
          result.initialBalance = {
            forecasted: 0,
            actual: 0,
            date: filters.startDate || new Date().toISOString().split('T')[0],
            hasBalance: false,
            isLatestBeforePeriod: false
          };
          return result;
        }
      }

      // Usar apenas a data mais recente: não somar valores de datas diferentes
      const valuesFromBalancesToUse = Object.values(balancesToUse);
      const balanceDates = valuesFromBalancesToUse
        .map((bal: any) => bal.balance_date)
        .filter((date: string) => date);
      const mostRecentDate = balanceDates.length > 0 ? balanceDates.sort().reverse()[0] : null;
      const balancesOnMostRecentDate = mostRecentDate
        ? valuesFromBalancesToUse.filter((bal: any) => bal.balance_date === mostRecentDate)
        : valuesFromBalancesToUse;

      const calculatedInitialBalance = balancesOnMostRecentDate
        .reduce((sum: number, bal: any) => {
          const balanceValue = bal?.balance;
          if (balanceValue === null || balanceValue === undefined || balanceValue === '') {
            return sum;
          }
          const parsed = parseFloat(String(balanceValue));
          return sum + (isNaN(parsed) ? 0 : parsed);
        }, 0);

      const calculatedInitialBalanceDate = mostRecentDate || (filters.startDate || new Date().toISOString().split('T')[0]);

      result.initialBalance = {
        forecasted: calculatedInitialBalance || 0,
        actual: calculatedInitialBalance || 0,
        date: calculatedInitialBalanceDate,
        hasBalance: hasBalanceInPeriod,
        isLatestBeforePeriod: isLatestBeforePeriod
      };
    }
    
    // Saldo Final = Saldo Inicial + Total de Recebimentos - Total de Pagamentos
    // Usa os valores exatos dos cards para garantir consistência
    result.finalBalance = {
      forecasted: result.initialBalance.forecasted + result.totalInflows.forecasted - result.totalOutflows.forecasted,
      actual: result.initialBalance.actual + result.totalInflows.actual - result.totalOutflows.actual
    };

    return result;
  }, [filteredData, accountsPayableTotals, forecastedEntriesTotals, revenueTotals, receitaCrediarioTotals, transactionTotals, cmvTotals, getFilteredInitialBalancesRaw, companies, filters, showLatestInitialBalance, initialBalances]);


  // Saldo inicial para o calendário (SEM filtro de período, apenas empresas/grupos)
  const getCalendarInitialBalances = useMemo(() => {
    if (companies.length === 0) return initialBalances;
    const { codes: normalizedCompanyCodes, hasActive: hasActiveFilters } = getFilteredCompanyCodesNormalized;
    if (!hasActiveFilters) return initialBalances;
    return initialBalances.filter(bal => {
      const normalizedBU = normalizeCode(bal.business_unit);
      return normalizedCompanyCodes.includes(normalizedBU);
    });
  }, [initialBalances, companies, getFilteredCompanyCodesNormalized]);

  // Calculate daily cash flow based on actual data from database (SEM filtro de período)
  const dailyCashFlow = useMemo(() => {
    // Calcula para um range amplo que cubra qualquer mês que o calendário possa mostrar
    // Vai de 6 meses atrás até 18 meses à frente para garantir que cubra qualquer navegação
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1); // 6 meses atrás
    const endDate = new Date(today.getFullYear(), today.getMonth() + 18, 0); // 18 meses à frente (último dia do mês)

    const days: any[] = [];
    const { codes: normalizedCompanyCodes, hasActive: hasActiveFilters } = getFilteredCompanyCodesNormalized;
    const filterByCompany = (item: any) => {
      if (companies.length === 0 || !hasActiveFilters) return true;
      const normalizedBU = normalizeCode(item.business_unit);
      return normalizedCompanyCodes.includes(normalizedBU);
    };

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      let dayInitialBalance: number;
      let dayForecastedInflows: number;
      let dayActualInflows: number;
      let dayForecastedOutflows: number;
      let dayActualOutflows: number;
      let forecastedBalance: number;
      let actualBalance: number;

      if (calendarAccumulatedMode) {
        // MODO ACUMULADO: calcula saldo final acumulado até aquele dia (como o card faz)
        // Saldo Inicial: pega o saldo inicial mais recente até dateStr (atualizado manualmente diariamente)
        const balancesUpToDate = initialBalances
          .filter(bal => {
            if (!filterByCompany(bal)) return false;
            const balanceDate = bal?.balance_date;
            if (!balanceDate) return false;
            return balanceDate <= dateStr;
          });

        // Agrupar por bank_name + business_unit e pegar o mais recente de cada grupo
        const latestBalancesByBankAndUnit = balancesUpToDate.reduce((acc, bal) => {
          const key = `${bal.bank_name || '-'}_${bal.business_unit || '-'}`;
          const existing = acc[key];
          
          if (!existing) {
            acc[key] = bal;
          } else {
            // Se já existe, compara as datas e pega o mais recente
            const existingDate = existing.balance_date || '';
            const currentDate = bal.balance_date || '';
            if (currentDate > existingDate) {
              acc[key] = bal;
            }
          }
          
          return acc;
        }, {} as Record<string, any>);

        // Somar os valores dos saldos mais recentes de cada banco/empresa
        dayInitialBalance = Object.values(latestBalancesByBankAndUnit)
          .reduce((sum: number, bal: any) => {
            const balanceValue = bal?.balance;
            if (balanceValue === null || balanceValue === undefined || balanceValue === '') {
              return sum;
            }
            const parsed = parseFloat(String(balanceValue));
            return sum + (isNaN(parsed) ? 0 : parsed);
          }, 0);

        // Recebimentos Previstos acumulados até dateStr
        const forecastedRevenues = getFilteredRevenues
          .filter(r => filterByCompany(r) && r.payment_date <= dateStr && (r.status?.toLowerCase() === 'previsto' || r.status?.toLowerCase() === 'pendente'))
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        const forecastedTransactionsInflows = financialTransactions
          .filter(t => filterByCompany(t) && t.transaction_date <= dateStr && t.amount > 0 && t.status?.toLowerCase() === 'previsto')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        dayForecastedInflows = forecastedRevenues + forecastedTransactionsInflows;

        // Recebimentos Realizados acumulados até dateStr
        const actualRevenues = getFilteredRevenues
          .filter(r => filterByCompany(r) && r.payment_date <= dateStr && r.status?.toLowerCase() === 'realizado')
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        const actualTransactionsInflows = financialTransactions
          .filter(t => filterByCompany(t) && t.transaction_date <= dateStr && t.amount > 0 && t.status?.toLowerCase() === 'realizado')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        dayActualInflows = actualRevenues + actualTransactionsInflows;

        // Pagamentos Previstos acumulados até dateStr
        // Para status "previsto", usar due_date se payment_date for NULL
        const forecastedOutflowsAccountsPayable = accountsPayable
          .filter(ap => {
            if (!filterByCompany(ap) || ap.status?.toLowerCase() !== 'previsto') return false;
            // Se tem payment_date, usar ele. Se não tem, usar due_date
            const dateToCompare = ap.payment_date || ap.due_date;
            return dateToCompare && dateToCompare <= dateStr;
          })
          .reduce((sum, ap) => {
            const amount = parseFloat(ap.amount || 0);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);

        const forecastedTransactionsOutflows = financialTransactions
          .filter(t => filterByCompany(t) && t.transaction_date <= dateStr && t.amount < 0 && t.status?.toLowerCase() === 'previsto')
          .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

        dayForecastedOutflows = forecastedOutflowsAccountsPayable + forecastedTransactionsOutflows;

        // Pagamentos Realizados acumulados até dateStr
        const actualOutflowsAccountsPayable = accountsPayable
          .filter(ap => filterByCompany(ap) && ap.payment_date <= dateStr && ap.status?.toLowerCase() === 'realizado')
          .reduce((sum, ap) => {
            const amount = parseFloat(ap.amount || 0);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);

        const actualTransactionsOutflows = financialTransactions
          .filter(t => filterByCompany(t) && t.transaction_date <= dateStr && t.amount < 0 && t.status?.toLowerCase() === 'realizado')
          .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

        dayActualOutflows = actualOutflowsAccountsPayable + actualTransactionsOutflows;

        // Saldo Final = Saldo Inicial (acumulado) + Recebimentos (acumulados) - Pagamentos (acumulados)
        forecastedBalance = dayInitialBalance + dayForecastedInflows - dayForecastedOutflows;
        actualBalance = dayInitialBalance + dayActualInflows - dayActualOutflows;
      } else {
        // MODO DIÁRIO: calcula APENAS os MOVIMENTOS DAQUELE DIA específico (não acumulado)
        // Saldo Inicial: apenas saldos com balance_date === dateStr (saldo inicial do dia, atualizado manualmente via planilha)
        dayInitialBalance = initialBalances
          .filter(bal => {
            if (!filterByCompany(bal)) return false;
            const balanceDate = bal?.balance_date;
            if (!balanceDate) return false; // Se não tem data, não inclui (precisa ter data específica)
            return balanceDate === dateStr;
          })
          .reduce((sum, bal) => {
            const balanceValue = bal?.balance;
            if (balanceValue === null || balanceValue === undefined || balanceValue === '') {
              return sum;
            }
            const parsed = parseFloat(String(balanceValue));
            return sum + (isNaN(parsed) ? 0 : parsed);
          }, 0);

        // Recebimentos Previstos DO dia específico (apenas === dateStr)
        dayForecastedInflows = getFilteredRevenues
          .filter(r => filterByCompany(r) && r.payment_date === dateStr && (r.status?.toLowerCase() === 'previsto' || r.status?.toLowerCase() === 'pendente'))
          .reduce((sum, r) => sum + (r.amount || 0), 0) +
          financialTransactions
            .filter(t => filterByCompany(t) && t.transaction_date === dateStr && t.amount > 0 && t.status?.toLowerCase() === 'previsto')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        // Recebimentos Realizados DO dia específico (apenas === dateStr)
        dayActualInflows = getFilteredRevenues
          .filter(r => filterByCompany(r) && r.payment_date === dateStr && r.status?.toLowerCase() === 'realizado')
          .reduce((sum, r) => sum + (r.amount || 0), 0) +
          financialTransactions
            .filter(t => filterByCompany(t) && t.transaction_date === dateStr && t.amount > 0 && t.status?.toLowerCase() === 'realizado')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        // Pagamentos Previstos DO dia específico (apenas === dateStr)
        dayForecastedOutflows = accountsPayable
          .filter(ap => filterByCompany(ap) && ap.payment_date === dateStr && ap.status?.toLowerCase() === 'previsto')
          .reduce((sum, ap) => {
            const amount = parseFloat(ap.amount || 0);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0) +
          financialTransactions
            .filter(t => filterByCompany(t) && t.transaction_date === dateStr && t.amount < 0 && t.status?.toLowerCase() === 'previsto')
            .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

        // Pagamentos Realizados DO dia específico (apenas === dateStr)
        dayActualOutflows = accountsPayable
          .filter(ap => filterByCompany(ap) && ap.payment_date === dateStr && ap.status?.toLowerCase() === 'realizado')
          .reduce((sum, ap) => {
            const amount = parseFloat(ap.amount || 0);
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0) +
          financialTransactions
            .filter(t => filterByCompany(t) && t.transaction_date === dateStr && t.amount < 0 && t.status?.toLowerCase() === 'realizado')
            .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

        // Saldo Final = Saldo Inicial do dia + Recebimentos do dia - Pagamentos do dia
        // Cada dia mostra apenas a movimentação daquele dia específico
        forecastedBalance = dayInitialBalance + dayForecastedInflows - dayForecastedOutflows;
        actualBalance = dayInitialBalance + dayActualInflows - dayActualOutflows;
      }

      days.push({
        date: dateStr,
        forecastedInflows: dayForecastedInflows,
        actualInflows: dayActualInflows,
        forecastedOutflows: dayForecastedOutflows,
        actualOutflows: dayActualOutflows,
        forecastedBalance: forecastedBalance,
        actualBalance: actualBalance
      });
    }

    // Debug: mostra algumas datas geradas e valores
    if (days.length > 0) {
      console.log('📅 Debug dailyCashFlow:', {
        totalDias: days.length,
        primeiraData: days[0]?.date,
        ultimaData: days[days.length - 1]?.date,
        primeiros3: days.slice(0, 3).map(d => ({ date: d.date, forecasted: d.forecastedBalance, actual: d.actualBalance })),
        ultimos3: days.slice(-3).map(d => ({ date: d.date, forecasted: d.forecastedBalance, actual: d.actualBalance }))
      });
    }

    return days;
  }, [getFilteredRevenues, accountsPayable, forecastedEntries, financialTransactions, initialBalances, companies, getFilteredCompanyCodesNormalized, calendarAccumulatedMode]);

  // Fluxo diário do calendário: usa dados carregados por loadCalendarData, due_date para previsto, payment_date para realizado, sem forecastedEntries
  const calendarDailyCashFlow = useMemo(() => {
    const { accountsPayable: calAp, financialTransactions: calTx, receitasManuais: calRec } = calendarViewData;
    const calRevenues = calRec.map((r: any) => ({
      business_unit: r.business_unit,
      payment_date: r.data,
      amount: Number(r.valor) || 0,
      status: r.status || 'previsto'
    }));

    const year = calendarDate.year;
    const month = calendarDate.month;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const rangeStart = calendarAccumulatedMode ? new Date(year, 0, 1) : firstDay;
    const rangeEnd = lastDay;

    const days: any[] = [];
    const { codes: normalizedCompanyCodes, hasActive: hasActiveFilters } = getFilteredCompanyCodesNormalized;
    const filterByCompany = (item: any) => {
      if (companies.length === 0 || !hasActiveFilters) return true;
      return normalizedCompanyCodes.includes(normalizeCode(item.business_unit));
    };

    const initialBalancesCal = getCalendarInitialBalances;

    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let dayInitialBalance: number;
      let dayForecastedInflows: number;
      let dayActualInflows: number;
      let dayForecastedOutflows: number;
      let dayActualOutflows: number;
      let forecastedBalance: number;
      let actualBalance: number;

      if (calendarAccumulatedMode) {
        const balancesUpToDate = initialBalancesCal.filter((bal: any) => {
          if (!filterByCompany(bal)) return false;
          const balanceDate = bal?.balance_date;
          return balanceDate && balanceDate <= dateStr;
        });
        const latestByBank = balancesUpToDate.reduce((acc: Record<string, any>, bal: any) => {
          const key = `${bal.bank_name || '-'}_${bal.business_unit || '-'}`;
          const existing = acc[key];
          if (!existing || (bal.balance_date || '') > (existing.balance_date || '')) acc[key] = bal;
          return acc;
        }, {});
        dayInitialBalance = Object.values(latestByBank).reduce((sum: number, bal: any) => {
          const v = bal?.balance;
          if (v == null || v === '') return sum;
          const p = parseFloat(String(v));
          return sum + (isNaN(p) ? 0 : p);
        }, 0);

        dayForecastedInflows = calRevenues.filter((r: any) => filterByCompany(r) && r.payment_date <= dateStr && ['previsto', 'pendente'].includes(String(r.status || '').toLowerCase())).reduce((s: number, r: any) => s + (r.amount || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date <= dateStr && (t.amount || 0) > 0 && String(t.status || '').toLowerCase() === 'previsto').reduce((s: number, t: any) => s + (t.amount || 0), 0);
        dayActualInflows = calRevenues.filter((r: any) => filterByCompany(r) && r.payment_date <= dateStr && String(r.status || '').toLowerCase() === 'realizado').reduce((s: number, r: any) => s + (r.amount || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date <= dateStr && (t.amount || 0) > 0 && String(t.status || '').toLowerCase() === 'realizado').reduce((s: number, t: any) => s + (t.amount || 0), 0);

        dayForecastedOutflows = calAp.filter((ap: any) => {
          if (!filterByCompany(ap) || String(ap.status || '').toLowerCase() !== 'previsto') return false;
          const dt = ap.due_date || ap.payment_date;
          return dt && dt <= dateStr;
        }).reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date <= dateStr && (t.amount || 0) < 0 && String(t.status || '').toLowerCase() === 'previsto').reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
        dayActualOutflows = calAp.filter((ap: any) => filterByCompany(ap) && ap.payment_date && ap.payment_date <= dateStr && String(ap.status || '').toLowerCase() === 'realizado').reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date <= dateStr && (t.amount || 0) < 0 && String(t.status || '').toLowerCase() === 'realizado').reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);

        forecastedBalance = dayInitialBalance + dayForecastedInflows - dayForecastedOutflows;
        actualBalance = dayInitialBalance + dayActualInflows - dayActualOutflows;
      } else {
        dayInitialBalance = initialBalancesCal.filter((bal: any) => filterByCompany(bal) && bal?.balance_date === dateStr).reduce((s: number, bal: any) => {
          const v = bal?.balance;
          if (v == null || v === '') return s;
          return s + (parseFloat(String(v)) || 0);
        }, 0);

        dayForecastedInflows = calRevenues.filter((r: any) => filterByCompany(r) && r.payment_date === dateStr && ['previsto', 'pendente'].includes(String(r.status || '').toLowerCase())).reduce((s: number, r: any) => s + (r.amount || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date === dateStr && (t.amount || 0) > 0 && String(t.status || '').toLowerCase() === 'previsto').reduce((s: number, t: any) => s + (t.amount || 0), 0);
        dayActualInflows = calRevenues.filter((r: any) => filterByCompany(r) && r.payment_date === dateStr && String(r.status || '').toLowerCase() === 'realizado').reduce((s: number, r: any) => s + (r.amount || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date === dateStr && (t.amount || 0) > 0 && String(t.status || '').toLowerCase() === 'realizado').reduce((s: number, t: any) => s + (t.amount || 0), 0);

        dayForecastedOutflows = calAp.filter((ap: any) => filterByCompany(ap) && String(ap.status || '').toLowerCase() === 'previsto' && (ap.due_date === dateStr || ap.payment_date === dateStr)).reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date === dateStr && (t.amount || 0) < 0 && String(t.status || '').toLowerCase() === 'previsto').reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
        dayActualOutflows = calAp.filter((ap: any) => filterByCompany(ap) && ap.payment_date === dateStr && String(ap.status || '').toLowerCase() === 'realizado').reduce((s: number, ap: any) => s + (parseFloat(ap.amount) || 0), 0) +
          calTx.filter((t: any) => filterByCompany(t) && t.transaction_date === dateStr && (t.amount || 0) < 0 && String(t.status || '').toLowerCase() === 'realizado').reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);

        forecastedBalance = dayInitialBalance + dayForecastedInflows - dayForecastedOutflows;
        actualBalance = dayInitialBalance + dayActualInflows - dayActualOutflows;
      }

      days.push({ date: dateStr, forecastedInflows: dayForecastedInflows, actualInflows: dayActualInflows, forecastedOutflows: dayForecastedOutflows, actualOutflows: dayActualOutflows, forecastedBalance, actualBalance });
    }
    return days;
  }, [calendarViewData, calendarDate.year, calendarDate.month, calendarAccumulatedMode, getCalendarInitialBalances, companies, getFilteredCompanyCodesNormalized]);

  const calendarData = useMemo(() => {
    const year = calendarDate.year;
    const month = calendarDate.month;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = calendarDailyCashFlow.find(d => d.date === dateStr);

      if (dayData) {
        // Usa o saldo final de cada dia (previsto e realizado)
        calendarDays.push({
          date: day,
          openingBalance: 0,
          forecastedRevenue: dayData.forecastedInflows,
          forecastedOutflows: dayData.forecastedOutflows,
          forecastedBalance: dayData.forecastedBalance, // Saldo final previsto do dia
          actualBalance: dayData.actualBalance // Saldo final realizado do dia
        });
      } else {
        // Se não há dados para o dia, mostra apenas o saldo inicial (sem recebimentos/pagamentos)
        const calendarInitialBalance = (getCalendarInitialBalances || [])
          .reduce((sum, bal) => {
            const balanceValue = bal?.balance;
            if (balanceValue === null || balanceValue === undefined || balanceValue === '') {
              return sum;
            }
            const parsed = parseFloat(String(balanceValue));
            return sum + (isNaN(parsed) ? 0 : parsed);
          }, 0);

        calendarDays.push({
          date: day,
          openingBalance: 0,
          forecastedRevenue: 0,
          forecastedOutflows: 0,
          forecastedBalance: calendarInitialBalance, // Saldo inicial (sem recebimentos/pagamentos do dia)
          actualBalance: calendarInitialBalance // Saldo inicial (sem recebimentos/pagamentos do dia)
        });
      }
    }

    return calendarDays;
  }, [calendarDailyCashFlow, calendarDate.year, calendarDate.month, getCalendarInitialBalances]);

  const uniqueGroups = useMemo(() => [...new Set(companies.map(c => c.group_name))], [companies]);
  const companiesForSidebar = useMemo(() =>
    companies.map(c => ({
      name: c.company_name,
      group: c.group_name,
      code: c.company_code
    })),
    [companies]
  );

  // Calculate available banks based on selected companies/groups
  const availableBanks = useMemo(() => {
    // Filter initial_balances based on company selection
    let filteredBalances = initialBalances;

    if (companies.length > 0 && getFilteredCompanyCodesNormalized.hasActive) {
      const normalizedCompanyCodes = getFilteredCompanyCodesNormalized.codes;
      filteredBalances = initialBalances.filter(bal => {
        const normalizedBU = normalizeCode(bal.business_unit);
        return normalizedCompanyCodes.includes(normalizedBU);
      });
    }

    return [...new Set(filteredBalances.map(b => b.bank_name))];
  }, [initialBalances, companies, getFilteredCompanyCodesNormalized]);

  // Generate chart data from daily cash flow
  const cashFlowData = useMemo(() => {
    return dailyCashFlow.map(day => ({
      date: day.date,
      actualBalance: day.actualBalance,
      projectedBalance: day.forecastedBalance,
      isHistorical: day.actualInflows > 0 || day.actualOutflows > 0
    }));
  }, [dailyCashFlow]);

  // Raw data for MonthlyComparison - precisa carregar TODOS os dados, não apenas do período filtrado
  // O componente tem seu próprio filtro de período interno
  const [monthlyComparisonData, setMonthlyComparisonData] = useState<{
    vendasPorUsuario: any[];
    accountsPayable: any[];
    companies: any[];
  }>({
    vendasPorUsuario: [],
    accountsPayable: [],
    companies: []
  });

  // Carregar dados completos para MonthlyComparison (sem filtro de data ou com range muito amplo)
  const loadMonthlyComparisonData = async () => {
    console.log('🔄 Carregando dados completos para MonthlyComparison...');
    
    try {
      // Buscar imports ativos
      const { data: importsData, error: importsError } = await supabase
        .from('importacoes')
        .select('id, is_deleted');

      if (importsError) throw importsError;

      const activeImportIds = (importsData || [])
        .filter((imp: any) => !imp.is_deleted)
        .map((imp: any) => imp.id);

      const hasActiveImports = activeImportIds.length > 0;

      // MonthlyComparison tem lógica à parte: carrega TODOS os dados (sem filtro de empresas)
      const filteredBusinessUnits = null as string[] | null;

      // Carregar TODOS os dados disponíveis (sem limite de data) para garantir comparação ano a ano completa
      // Não limitamos por data porque o componente MonthlyComparison tem seu próprio filtro de período

      // Carregar vendas_por_usuario (Receita Direta e CMV) em lotes - Supabase limita ~1000 linhas
      // Sem paginação, dados do ano anterior e do primeiro mês podem ser cortados
      let vendasPorUsuarioResult: any = { data: [], error: null };
      let apResult: any = { data: [], error: null };

      try {
        let allVendas: any[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: batch, error: vendasError } = await supabase
            .from('vendas_por_usuario')
            .select('id, business_unit, data, amount, custo, usuario')
            .order('data', { ascending: false })
            .range(offset, offset + batchSize - 1);
          if (vendasError) {
            console.error('❌ Erro ao carregar vendas_por_usuario para MonthlyComparison:', vendasError);
            break;
          }
          if (batch && batch.length > 0) {
            allVendas = [...allVendas, ...batch];
            offset += batchSize;
            hasMore = batch.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        vendasPorUsuarioResult = { data: allVendas, error: null };
      } catch (err) {
        console.error('❌ Exceção ao carregar vendas_por_usuario para MonthlyComparison:', err);
        vendasPorUsuarioResult = { data: [], error: err };
      }

      try {
        // Carregar contas_a_pagar em lotes (import ativo ou import_id nulo — automação direta)
        let allAP: any[] = [];
        const batchSize = 500;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          let query = applyContasAPagarImportFilter(
            supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, due_date, amount, status, chart_of_accounts, creditor, id'),
            activeImportIds
          );

          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }

          const batch = await query
            .order('payment_date', { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (batch.error) {
            console.error('❌ Erro ao carregar contas_a_pagar para MonthlyComparison:', batch.error);
            break;
          }

          if (batch.data && batch.data.length > 0) {
            allAP = [...allAP, ...batch.data];
            offset += batchSize;
            hasMore = batch.data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        apResult = { data: allAP, error: null };
      } catch (err) {
        console.error('❌ Exceção ao carregar contas_a_pagar para MonthlyComparison:', err);
        apResult = { data: [], error: err };
      }

      const newData = {
        vendasPorUsuario: vendasPorUsuarioResult.data || [],
        accountsPayable: apResult.data || [],
        companies: companies
      };

      console.log('✅ Dados completos carregados para MonthlyComparison:', {
        vendasPorUsuario: newData.vendasPorUsuario.length,
        accountsPayable: newData.accountsPayable.length,
        companies: newData.companies.length,
        hasActiveImports
      });

      setMonthlyComparisonData(newData);
    } catch (error) {
      console.error('❌ Erro ao carregar dados para MonthlyComparison:', error);
    }
  };

  // Carregar dados do MonthlyComparison quando companies for carregado
  // MonthlyComparison tem seus próprios filtros e NÃO responde a filtros globais (período, empresa)
  useEffect(() => {
    if (companies.length > 0) {
      loadMonthlyComparisonData();
    }
  }, [companies.length]);
  
  // Também carregar quando a aplicação iniciar (mesmo sem companies, para ter dados básicos)
  useEffect(() => {
    loadMonthlyComparisonData();
  }, []); // Carregar uma vez no mount

  const monthlyComparisonRawData = useMemo(() => monthlyComparisonData, [monthlyComparisonData]);

  const cashFlowTableData = useMemo(() => [], []);

  const analyticalInsightsData = useMemo(() => {
    const insights: any[] = [];

    // Check for negative forecasted balances
    const negativeDays = dailyCashFlow.filter(day => day.forecastedBalance < 0);

    if (negativeDays.length > 0) {
      // Find the most critical day (lowest balance)
      const criticalDay = negativeDays.reduce((min, day) =>
        day.forecastedBalance < min.forecastedBalance ? day : min
      );

      // Analyze expenses by category for negative days
      const categoryExpenses: { [key: string]: number } = {};

      negativeDays.forEach(day => {
        // Get expenses for this day
        const dayExpenses = accountsPayable.filter(ap =>
          ap.payment_date === day.date && ap.status?.toLowerCase() === 'previsto'
        );

        dayExpenses.forEach(expense => {
          // Nota: contas_a_pagar não tem coluna 'expense_category', apenas chart_of_accounts
          const category = expense.chart_of_accounts || 'Sem categoria';
          categoryExpenses[category] = (categoryExpenses[category] || 0) + (expense.amount || 0);
        });

        // Include forecasted entries
        const dayForecasted = forecastedEntries.filter(e =>
          e.payment_date === day.date && e.chart_of_accounts !== 'Movimento em Dinheiro'
        );

        dayForecasted.forEach(entry => {
          // Nota: previstos não tem coluna 'expense_category', apenas chart_of_accounts
          const category = entry.chart_of_accounts || 'Sem categoria';
          categoryExpenses[category] = (categoryExpenses[category] || 0) + (entry.amount || 0);
        });
      });

      // Sort categories by amount
      const topCategories = Object.entries(categoryExpenses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, amount]) => ({
          category,
          amount,
          formatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
        }));

      // Format critical dates
      const criticalDates = negativeDays
        .sort((a, b) => a.forecastedBalance - b.forecastedBalance)
        .slice(0, 5)
        .map(day => ({
          date: new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          balance: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(day.forecastedBalance),
          balanceValue: day.forecastedBalance
        }));

      insights.push({
        type: 'warning',
        title: '⚠️ Alerta: Saldo Previsto Negativo Detectado',
        description: `Identificamos ${negativeDays.length} dia(s) com saldo previsto negativo no período analisado.`,
        details: [
          `💰 Dia mais crítico: ${new Date(criticalDay.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} com saldo de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(criticalDay.forecastedBalance)}`,
          '',
          '📊 Maiores categorias de despesa:',
          ...topCategories.map((cat, idx) => `${idx + 1}. ${cat.category}: ${cat.formatted}`),
          '',
          '📅 Dias que requerem atenção:',
          ...criticalDates.map(d => `   • ${d.date}: ${d.balance}`)
        ].join('\n'),
        severity: 'high'
      });

      // Add recommendation
      insights.push({
        type: 'recommendation',
        title: '💡 Recomendações',
        description: 'Ações sugeridas para equilibrar o fluxo de caixa:',
        details: [
          '1. Considere negociar o adiamento de pagamentos nas categorias: ' + topCategories.map(c => c.category).join(', '),
          '2. Antecipe recebimentos ou busque linhas de crédito para os dias críticos',
          '3. Revise despesas não essenciais no período',
          '4. Monitore diariamente o saldo nos dias identificados'
        ].join('\n'),
        severity: 'medium'
      });
    } else {
      insights.push({
        type: 'success',
        title: '✅ Fluxo de Caixa Saudável',
        description: 'O saldo previsto permanece positivo durante todo o período analisado.',
        details: 'Não foram identificados riscos imediatos de déficit no fluxo de caixa.',
        severity: 'low'
      });
    }

    return insights;
  }, [dailyCashFlow, accountsPayable, forecastedEntries]);

  const topAccountsImpact = useMemo(() => {
    const negativeDays = dailyCashFlow.filter(day => day.forecastedBalance < 0);

    if (negativeDays.length === 0) return [];

    const accountTotals: { [key: string]: number } = {};

    negativeDays.forEach(day => {
      const dayExpenses = getFilteredAccountsPayable.filter(ap =>
        ap.payment_date === day.date && ap.status?.toLowerCase() === 'previsto'
      );

      dayExpenses.forEach(expense => {
        const account = expense.chart_of_accounts || 'Sem categoria';
        accountTotals[account] = (accountTotals[account] || 0) + (expense.amount || 0);
      });

      const dayForecasted = getFilteredForecastedEntries.filter(e =>
        e.payment_date === day.date && e.chart_of_accounts !== 'Movimento em Dinheiro'
      );

      dayForecasted.forEach(entry => {
        const account = entry.chart_of_accounts || 'Sem categoria';
        accountTotals[account] = (accountTotals[account] || 0) + (entry.amount || 0);
      });

      const dayTransactions = getFilteredTransactions.filter(t =>
        t.transaction_date === day.date && t.amount < 0 && t.status?.toLowerCase() === 'previsto'
      );

      dayTransactions.forEach(trans => {
        const account = trans.chart_of_accounts || 'Sem categoria';
        accountTotals[account] = (accountTotals[account] || 0) + Math.abs(trans.amount || 0);
      });
    });

    return Object.entries(accountTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([account, amount]) => ({ account, amount }));
  }, [dailyCashFlow, getFilteredAccountsPayable, getFilteredForecastedEntries, getFilteredTransactions]);

  const expenseBreakdownData = useMemo(() => ({
    expenses: [],
    recommendations: []
  }), []);
  // Generate intelligent alerts data based on daily cash flow
  const alertsData = useMemo(() => {
    const alerts: any[] = [];

    // Helper to calculate top account groups for a specific date
    const getTopAccountGroups = (dateStr: string, isForecasted: boolean) => {
      const groupTotals: { [key: string]: number } = {};

      // Aggregate outflows by chart of accounts
      if (isForecasted) {
        // Forecasted outflows
        getFilteredAccountsPayable
          .filter(ap => ap.payment_date === dateStr && ap.status?.toLowerCase() === 'previsto')
          .forEach(ap => {
            const group = ap.chart_of_accounts || 'Não classificado';
            groupTotals[group] = (groupTotals[group] || 0) + Math.abs(ap.amount || 0);
          });

        getFilteredForecastedEntries
          .filter(e => e.payment_date === dateStr && e.chart_of_accounts !== 'Movimento em Dinheiro')
          .forEach(e => {
            const group = e.chart_of_accounts || 'Não classificado';
            groupTotals[group] = (groupTotals[group] || 0) + Math.abs(e.amount || 0);
          });

        getFilteredTransactions
          .filter(t => t.transaction_date === dateStr && t.amount < 0 && t.status?.toLowerCase() === 'previsto')
          .forEach(t => {
            // Nota: transacoes_financeiras não tem coluna 'description', apenas chart_of_accounts
            const group = t.chart_of_accounts || 'Não classificado';
            groupTotals[group] = (groupTotals[group] || 0) + Math.abs(t.amount || 0);
          });
      } else {
        // Actual outflows
        getFilteredAccountsPayable
          .filter(ap => ap.payment_date === dateStr && ap.status?.toLowerCase() === 'realizado')
          .forEach(ap => {
            const group = ap.chart_of_accounts || 'Não classificado';
            groupTotals[group] = (groupTotals[group] || 0) + Math.abs(ap.amount || 0);
          });

        getFilteredTransactions
          .filter(t => t.transaction_date === dateStr && t.amount < 0 && t.status?.toLowerCase() === 'realizado')
          .forEach(t => {
            // Nota: transacoes_financeiras não tem coluna 'description', apenas chart_of_accounts
            const group = t.chart_of_accounts || 'Não classificado';
            groupTotals[group] = (groupTotals[group] || 0) + Math.abs(t.amount || 0);
          });
      }

      // Sort by amount and get top 3
      return Object.entries(groupTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([group, amount]) => ({ group, amount }));
    };

    // Check for days with negative balance
    dailyCashFlow.forEach((day, index) => {
      // Alert for forecasted negative balance
      if (day.forecastedBalance < 0) {
        // Find what's causing the negative balance
        const previousDay = index > 0 ? dailyCashFlow[index - 1] : null;

        // Analyze the cause
        let reason = '';
        if (day.forecastedOutflows > day.forecastedInflows * 2) {
          reason = `Saídas previstas (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(day.forecastedOutflows)}) muito superiores às entradas`;
        } else if (day.forecastedInflows === 0 && day.forecastedOutflows > 0) {
          reason = `Nenhuma entrada prevista, mas há saídas de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(day.forecastedOutflows)}`;
        } else if (previousDay && previousDay.forecastedBalance < 50000) {
          reason = 'Saldo anterior já estava baixo, acumulando déficit';
        } else {
          reason = `Entradas insuficientes para cobrir as saídas do dia`;
        }

        alerts.push({
          date: day.date,
          type: 'shortage',
          message: reason,
          amount: day.forecastedBalance,
          topAccountGroups: getTopAccountGroups(day.date, true)
        });
      }

      // Alert for actual negative balance
      if (day.actualBalance < 0) {
        let reason = '';
        if (day.actualOutflows > day.actualInflows * 2) {
          reason = `Saídas realizadas (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(day.actualOutflows)}) muito superiores às entradas`;
        } else if (day.actualInflows === 0 && day.actualOutflows > 0) {
          reason = `Nenhuma entrada realizada, mas há saídas de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(day.actualOutflows)}`;
        } else {
          reason = `Entradas insuficientes para cobrir as saídas realizadas`;
        }

        alerts.push({
          date: day.date,
          type: 'shortage',
          message: `[REAL] ${reason}`,
          amount: day.actualBalance,
          topAccountGroups: getTopAccountGroups(day.date, false)
        });
      }
    });

    // Sort by date and return top 5 most critical
    return alerts
      .sort((a, b) => a.amount - b.amount) // Most negative first
      .slice(0, 5);
  }, [dailyCashFlow, getFilteredAccountsPayable, getFilteredForecastedEntries, getFilteredTransactions]);

  // Função para lidar com cliques no botão de desbloqueio
  const handleUnlockClick = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastUnlockClickTime;
    
    setLastUnlockClickTime(now);
    
    // Resetar contador se passou mais de 2 segundos desde o último clique
    if (timeSinceLastClick > 2000) {
      setUnlockClickCount(1);
    } else {
      setUnlockClickCount(prev => {
        const newCount = prev + 1;
        
        // Se chegou a 5 cliques, ativar desbloqueio permanente como admin
        if (newCount >= 5) {
          setIsPermanentlyUnlocked(true);
          localStorage.setItem('importPermanentlyUnlocked', 'true');
          setImportRole('admin');
          return 0;
        }
        
        return newCount;
      });
    }
  };

  return (
    <div className={`flex h-screen relative ${darkMode ? 'bg-slate-950 text-slate-50' : 'bg-[#ECF7FA] text-slate-900'} ${presentationMode ? 'fixed inset-0 z-50' : ''}`}>
      {/* Loader global de tela inteira apenas no carregamento inicial */}
      {initialLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-100">Carregando Dashboard...</p>
          </div>
        </div>
      )}

      {!presentationMode && (
      <Sidebar
        filters={filters}
        onFiltersChange={setFilters}
        onFilterApply={() => setFilterApplyTick(t => t + 1)}
        onFileUpload={handleFileUpload}
        companies={companiesForSidebar}
        groups={uniqueGroups}
        banks={availableBanks}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onTogglePresentationMode={togglePresentationMode}
        onRefresh={handleRefresh}
        onCadastrarEmpresa={() => {
          setCompanyFormModalOpen(true);
          setCompanyEditModalOpen(false);
        }}
        onEditarEmpresa={importRole === 'admin' ? () => { setCompanyEditModalOpen(true); setCompanyFormModalOpen(false); } : undefined}
      />
      )}
      
      <div className="flex-1 overflow-auto scrollbar-vertical">
        <div className={`${presentationMode ? 'p-4' : 'p-8'} ${(initialLoading || loading.isLoading) ? 'pointer-events-none select-none' : ''}`}>
          {presentationMode && (
            <div className="flex justify-between items-center mb-4">
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Dashboard Financeiro - Rede Tem Preço & X Brother</h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  {lastContasPagarUpdateLabel ? (
                    <span
                      className={`text-sm tabular-nums ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}
                      title="Data/hora do registro de contas a pagar alterado por último no banco (inclui edições no Supabase)"
                    >
                      Última atualização: {lastContasPagarUpdateLabel}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDarkMode(prev => !prev)}
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                      darkMode
                        ? 'border-slate-600/80 bg-slate-800/90 text-amber-400 hover:bg-slate-700 hover:text-amber-300'
                        : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
                    }`}
                    title={darkMode ? 'Tema claro' : 'Tema escuro'}
                    aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
                  >
                    {darkMode ? (
                      <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    ) : (
                      <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
                <button
                  onClick={togglePresentationMode}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Sair do Modo Apresentação
                </button>
              </div>
            </div>
          )}
          
          {!presentationMode && (
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className={`text-3xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Dashboard de Fluxo de Caixa</h1>
                <p className={`${darkMode ? 'text-slate-400' : 'text-gray-600'} mt-2`}>Visão geral financeira e métricas de desempenho</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  {lastContasPagarUpdateLabel ? (
                    <span
                      className={`text-sm tabular-nums ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}
                      title="Data/hora do registro de contas a pagar alterado por último no banco (inclui edições no Supabase)"
                    >
                      Última atualização: {lastContasPagarUpdateLabel}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDarkMode(prev => !prev)}
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                      darkMode
                        ? 'border-slate-600/80 bg-slate-800/90 text-amber-400 hover:bg-slate-700 hover:text-amber-300'
                        : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
                    }`}
                    title={darkMode ? 'Tema claro' : 'Tema escuro'}
                    aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
                  >
                    {darkMode ? (
                      <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    ) : (
                      <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading.isLoading && (
            <div className="bg-marsala-50 border border-marsala-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 border-2 border-marsala-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="flex-1">
                  <p className="text-marsala-800 font-medium">
                    Processando: {loading.currentFile}
                  </p>
                  {loading.currentIndex && loading.totalFiles && (
                    <p className="text-marsala-600 text-sm mt-1">
                      Arquivo {loading.currentIndex} de {loading.totalFiles}
                    </p>
                  )}
                  {loading.progress && (
                    <p className="text-marsala-700 text-sm mt-1 font-semibold">
                      {loading.progress}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {loading.allCompleted && !loading.isLoading && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-800 font-medium">
                  Todos os arquivos foram processados com sucesso!
                </p>
              </div>
            </div>
          )}

          {currentPage === 'cashflow' && (
            <>
              {/* Cash Flow Variation Cards */}
              <div className="mb-6">
                <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Variação do Fluxo de Caixa</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Initial Balance from Database */}
                  <div
                    className={`rounded-lg p-6 border-l-4 shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-all duration-300 ${
                      darkMode
                        ? 'bg-[#0F172A] border border-slate-800 border-l-sky-400 hover:shadow-[0_0_32px_rgba(59,130,246,0.45)]'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 border-l-blue-500 hover:shadow-[0_22px_55px_rgba(15,23,42,0.28)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center flex-1">
                        <div className={`p-1.5 rounded-lg shadow-sm ${darkMode ? 'bg-slate-950 text-sky-300' : 'bg-white text-blue-600'}`}>
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <h3 className={`text-xs font-semibold ml-2 ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>Saldo Inicial</h3>
                      </div>
                      {(kpiData.initialBalance?.hasBalance !== false || showLatestInitialBalance) && (
                        <button
                          onClick={() => openKPIDetail('Detalhes: Saldo Inicial', getFilteredInitialBalances, 'initial_balance', ['saldos_iniciais'])}
                          className={`p-1.5 rounded-lg shadow-sm transition-colors ${
                            darkMode ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-gray-100'
                          }`}
                          title="Ver detalhes"
                        >
                          <List className="w-4 h-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(kpiData.initialBalance?.hasBalance === false && !showLatestInitialBalance) || 
                       (showLatestInitialBalance && kpiData.initialBalance?.hasBalance === false && !kpiData.initialBalance?.isLatestBeforePeriod) ? (
                        <>
                          <div className="py-4">
                            <p className={`text-sm font-medium text-center ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                              {showLatestInitialBalance 
                                ? 'Não há saldo disponível antes do período selecionado'
                                : 'Saldo não existente para período selecionado'}
                            </p>
                          </div>
                          {!showLatestInitialBalance && (
                            <button
                              onClick={() => setShowLatestInitialBalance(true)}
                              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                darkMode 
                                  ? 'bg-sky-600 hover:bg-sky-700 text-white' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              Mostrar saldo mais recente
                            </button>
                          )}
                          {showLatestInitialBalance && (
                            <button
                              onClick={() => setShowLatestInitialBalance(false)}
                              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                darkMode 
                                  ? 'bg-slate-600 hover:bg-slate-700 text-white' 
                                  : 'bg-gray-600 hover:bg-gray-700 text-white'
                              }`}
                            >
                              Voltar
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <div>
                            <label className={`text-xs block mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                              Data do Saldo
                              {kpiData.initialBalance?.isLatestBeforePeriod && (
                                <span className={`ml-2 text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                  (mais recente antes do período)
                                </span>
                              )}
                            </label>
                            <p className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
                              {kpiData.initialBalance.date
                                ? (() => {
                                    const d = kpiData.initialBalance.date;
                                    if (typeof d === 'string' && d.length >= 10) {
                                      return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
                                    }
                                    return new Date(d).toLocaleDateString('pt-BR');
                                  })()
                                : new Date().toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div>
                            <label className={`text-xs block mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Saldo Inicial</label>
                            <p className={`text-xl font-bold ${darkMode ? 'text-sky-300' : 'text-blue-700'}`}>
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.initialBalance?.actual || 0)}
                            </p>
                          </div>
                          <div className="pt-2">
                            <p className="text-xs text-gray-500">
                              {kpiData.initialBalance?.isLatestBeforePeriod 
                                ? 'Saldo mais recente antes do período selecionado'
                                : 'Lançamento manual (saldos iniciais)'}
                            </p>
                            {kpiData.initialBalance?.isLatestBeforePeriod && (
                              <button
                                onClick={() => setShowLatestInitialBalance(false)}
                                className={`mt-2 text-xs underline ${darkMode ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700'}`}
                              >
                                Voltar ao período selecionado
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <>
                      <KPICard
                        title="Total de Recebimentos"
                        forecasted={kpiData.totalInflows.forecasted}
                        actual={kpiData.totalInflows.actual}
                        icon={<ArrowDown className="w-5 h-5" />}
                        color="green"
                        section="cashflow"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: Total de Recebimentos', getFilteredTotalInflows, 'total_inflows', ['receitas', 'transacoes_financeiras'])}
                      loading={dataLoading}
                      />
                      <KPICard
                        title="Total de Pagamentos"
                        forecasted={kpiData.totalOutflows.forecasted}
                        actual={kpiData.totalOutflows.actual}
                        icon={<ArrowUp className="w-5 h-5" />}
                        color="red"
                        section="cashflow"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: Total de Pagamentos', getFilteredTotalOutflowsTable, 'total_outflows', ['contas_a_pagar', 'transacoes_financeiras'])}
                        forecastedLabel="Previsto (por vencimento)"
                        actualLabel="Realizado (por pagamento)"
                      loading={dataLoading}
                      />
                      <KPICard
                        title="Saldo Final"
                        forecasted={kpiData.finalBalance.forecasted}
                        actual={kpiData.finalBalance.actual}
                        icon={<DollarSign className="w-5 h-5" />}
                        color="purple"
                        section="cashflow"
                        darkMode={darkMode}
                        detailsComingSoon
                      loading={dataLoading}
                      />
                  </>
                </div>
              </div>

              {/* Despesas Operacionais (tabela igual à DRE, só esta seção) */}
              <DespesasOperacionaisTable
                accountsPayable={accountsPayable}
                filters={filters}
                companies={companies}
                darkMode={darkMode}
                onRefresh={refreshWithCurrentFilters}
                loading={dataLoading}
              />

              {/* Result Delivery Cards */}
              <div className="mb-8">
                <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Entrega de Resultado</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <>
                      <KPICard
                        title="Receita Direta"
                        forecasted={kpiData.directRevenue.forecasted}
                        actual={kpiData.directRevenue.actual}
                        icon={<TrendingUp className="w-5 h-5" />}
                        color="yellow"
                        section="result"
                        darkMode={darkMode}
                        detailsComingSoon
                        forecastedLabel={
                          directRevenueSalesTotals
                            ? `Período anterior (${format(parseISO(directRevenueSalesTotals.prevStart), 'dd/MM/yy')} - ${format(parseISO(directRevenueSalesTotals.prevEnd), 'dd/MM/yy')})`
                            : 'Período anterior'
                        }
                      loading={dataLoading}
                      />
                      <KPICard
                        title="CMV"
                        forecasted={kpiData.cogs.forecasted}
                        actual={kpiData.cogs.actual}
                        percentage={kpiData.cogs.percentageOfRevenue}
                        icon={<Pill className="w-5 h-5" />}
                        color="orange"
                        section="result"
                        darkMode={darkMode}
                        detailsComingSoon
                        forecastedLabel={
                          directCmvSalesTotals
                            ? `Período anterior (${format(parseISO(directCmvSalesTotals.prevStart), 'dd/MM/yy')} - ${format(parseISO(directCmvSalesTotals.prevEnd), 'dd/MM/yy')})`
                            : 'Período anterior'
                        }
                      loading={dataLoading}
                      />
                      <KPICard
                        title="Total de Despesas"
                        forecasted={kpiData.totalExpenses.forecasted}
                        actual={kpiData.totalExpenses.actual}
                        icon={<Calculator className="w-5 h-5" />}
                        color="red"
                        section="result"
                        darkMode={darkMode}
                        forecastedLabel="Previsto (por vencimento)"
                        actualLabel="Realizado (por pagamento)"
                        onViewDetails={() => openKPIDetail('Detalhes: Total de Despesas', getFilteredTotalOutflowsTable, 'total_outflows', ['contas_a_pagar', 'transacoes_financeiras'])}
                      loading={dataLoading}
                      />
                      <KPICard
                        title="Resultado Operacional"
                        forecasted={kpiData.directRevenue.forecasted - kpiData.cogs.forecasted - kpiData.totalExpenses.forecasted}
                        actual={kpiData.directRevenue.actual - kpiData.cogs.actual - kpiData.totalExpenses.actual}
                        percentage={kpiData.directRevenue.actual !== 0 ? ((kpiData.directRevenue.actual - kpiData.cogs.actual - kpiData.totalExpenses.actual) / kpiData.directRevenue.actual) * 100 : 0}
                        icon={<Target className="w-5 h-5" />}
                        color="indigo"
                        section="result"
                        darkMode={darkMode}
                        detailsComingSoon
                      loading={dataLoading}
                      />
                  </>
                </div>

                {entregaResultadoHidden ? (
                  <div className={`mt-4 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-700/50 border border-slate-600' : 'bg-slate-100 border border-slate-300'}`}>
                    <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>Calendário, gráfico e alertas ocultos</span>
                    <button
                      type="button"
                      onClick={() => setEntregaResultadoHidden(false)}
                      className={`inline-flex items-center justify-center p-2 rounded-lg border transition-colors ${darkMode ? 'border-slate-500 bg-slate-700/50 text-sky-300 hover:bg-slate-600 hover:text-sky-200' : 'border-slate-300 bg-slate-100 text-sky-600 hover:bg-slate-200 hover:text-sky-700'}`}
                      title="Mostrar calendário, gráfico e alertas"
                      aria-label="Mostrar calendário, gráfico e alertas"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className={`mt-4 mb-4 px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-3 ${darkMode ? 'bg-amber-900/40 text-amber-200 border border-amber-700' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                    <span>Esses dados ainda estão sendo corrigidos, aguarde um momento.</span>
                    <button
                      type="button"
                      onClick={() => setEntregaResultadoHidden(true)}
                      className={`flex-shrink-0 inline-flex items-center justify-center p-2 rounded-lg border transition-colors ${darkMode ? 'border-slate-500 bg-slate-700/50 text-sky-300 hover:bg-slate-600 hover:text-sky-200' : 'border-slate-300 bg-slate-100 text-sky-600 hover:bg-slate-200 hover:text-sky-700'}`}
                      title="Ocultar calendário, gráfico e alertas"
                      aria-label="Ocultar calendário, gráfico e alertas"
                    >
                      <EyeOff className="w-5 h-5" />
                    </button>
                  </div>
                )}

              {/* Calendar, Chart and Alerts - ocultos quando entregaResultadoHidden */}
              {!entregaResultadoHidden && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
                  <div>
                    <CalendarView
                      data={calendarData}
                      year={calendarDate.year}
                      month={calendarDate.month}
                      onMonthChange={(year, month) => setCalendarDate({ year, month })}
                      darkMode={darkMode}
                      accumulatedMode={calendarAccumulatedMode}
                      onToggleAccumulatedMode={() => setCalendarAccumulatedMode(!calendarAccumulatedMode)}
                      loading={calendarDataLoading}
                    />
                  </div>
                  <div className="space-y-4">
                    {dataLoading ? (
                      <ChartSkeleton darkMode={darkMode} />
                    ) : (
                      <CashFlowChart data={cashFlowData} darkMode={darkMode} alerts={alertsData} />
                    )}
                    <CashFlowAlerts data={alertsData} darkMode={darkMode} />
                  </div>
                </div>
              )}

              {/* Monthly Comparison - sempre visível */}
              {dataLoading ? (
                <PageLoader darkMode={darkMode} message="Carregando comparação mensal..." />
              ) : (
                <MonthlyComparison 
                  rawData={monthlyComparisonRawData} 
                  darkMode={darkMode} 
                />
              )}
              </div>
            </>
          )}

          {currentPage === 'analytical' && (
            <div className="space-y-8">
              {/* Cash Flow Table */}
              <CashFlowTable data={cashFlowTableData} darkMode={darkMode} />

              {/* Analytical Insights */}
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Análise Comparativa</h2>
                <AnalyticalInsights
                  data={analyticalInsightsData}
                  cashShortageDate={dailyCashFlow.find(d => d.forecastedBalance < 0)?.date}
                  topAccounts={topAccountsImpact}
                />
              </div>

              {/* Expense Breakdown */}
              <ExpenseBreakdown 
                expenses={expenseBreakdownData.expenses}
                recommendations={expenseBreakdownData.recommendations}
              />
            </div>
          )}

          {currentPage === 'dre' && (
            <>
              {!dreWarningClosed && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className={`max-w-md w-full mx-4 rounded-lg shadow-xl ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  } border`}>
                    <div className="p-6">
                      <div className="text-center mb-6">
                        <div className="text-6xl mb-4">🚧</div>
                        <h2 className={`text-xl font-semibold mb-2 ${
                          darkMode ? 'text-slate-100' : 'text-gray-800'
                        }`}>
                          Análise DRE em desenvolvimento
                        </h2>
                        <p className={`text-sm ${
                          darkMode ? 'text-slate-300' : 'text-gray-600'
                        }`}>
                          Em breve, você terá insights completos aqui.
                        </p>
                      </div>
                      
                      <div className="flex justify-end">
                        <button
                          onClick={() => setDreWarningClosed(true)}
                          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                            darkMode 
                              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          Entendi
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {dreWarningClosed && (
                <DREPage
                  accountsPayable={accountsPayable}
                  financialTransactions={financialTransactions}
                  forecastedEntries={forecastedEntries}
                  revenuesDRE={revenuesDRE}
                  cmvDRE={cmvDRE}
                  nonOperationalAccounts={nonOperationalAccounts}
                  filters={filters}
                  companies={companies}
                  darkMode={darkMode}
                  onRefresh={refreshWithCurrentFilters}
                  loading={dataLoading}
                />
              )}
            </>
          )}

        </div>
      </div>

      <CompanyFormModal
        isOpen={companyFormModalOpen}
        onClose={() => setCompanyFormModalOpen(false)}
        onSave={handleSaveCompany}
        darkMode={darkMode}
      />
      {importRole === 'admin' && (
        <CompanyEditModal
          isOpen={companyEditModalOpen}
          onClose={() => setCompanyEditModalOpen(false)}
          companies={companies}
          onUpdate={handleUpdateCompany}
          onRefresh={handleRefreshCompanies}
          darkMode={darkMode}
        />
      )}

      <KPIDetailModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        data={modalState.type === 'initial_balance' ? getInitialBalanceDetailRecords : modalState.data}
        type={modalState.type}
        loadPaginatedData={modalState.loadPaginatedData}
        initialStartDate={modalState.initialStartDate}
        initialEndDate={modalState.initialEndDate}
        sourceTables={modalState.sourceTables}
        onReceitasManuaisSaved={refreshWithCurrentFilters}
        onSaldosIniciaisSaved={refreshWithCurrentFilters}
        onRefreshDetail={refreshWithCurrentFilters}
        validUnitCodes={companies.map((c: any) => normalizeCode(c.company_code))}
        onShowToast={(id) => setActiveToast(id)}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />

      <DuplicateFileModal
        isOpen={duplicateFileModal.isOpen}
        fileName={duplicateFileModal.fileName}
        fileType={duplicateFileModal.fileType}
        darkMode={darkMode}
        onKeepPrevious={() => setDuplicateFileModal({ isOpen: false, fileName: '', fileType: '', pendingFile: null, pendingType: null, existingImportId: '' })}
        onReplaceWithNew={async () => {
          const { existingImportId, pendingFile, pendingType, pendingIndex, pendingTotal } = duplicateFileModal;
          setDuplicateFileModal({ isOpen: false, fileName: '', fileType: '', pendingFile: null, pendingType: null, existingImportId: '' });
          if (!pendingFile || !pendingType) return;
          await deleteOldImportData(existingImportId, getTableNameFromType(pendingType));
          await loadImportsFromSupabase();
          await handleDataImport(pendingFile, pendingType, pendingIndex, pendingTotal);
        }}
      />

      {/* Sistema de Notificações */}
      <NotificationCenter />
      
      {/* Toast Notification (aparece por 10 segundos) */}
      {activeToast && notifications.find(n => n.id === activeToast) && (
        <ToastNotification
          notification={notifications.find(n => n.id === activeToast)!}
          onDismiss={() => setActiveToast(null)}
        />
      )}

      {/* Botão discreto de desbloqueio permanente */}
      <button
        type="button"
        onClick={handleUnlockClick}
        className="fixed bottom-3 right-3 w-1.5 h-1.5 rounded-full opacity-10 hover:opacity-30 transition-opacity z-50 cursor-pointer"
        style={{
          backgroundColor: darkMode ? '#cbd5e1' : '#475569'
        }}
        title=""
        aria-label=""
      />
    </div>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

export default App;