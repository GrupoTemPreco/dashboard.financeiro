import { useState, useEffect, useMemo } from 'react';
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
import { DataImport } from './components/DataImport';
import { DREPage } from './components/DREPage';
import { ConfirmOverwriteModal } from './components/ConfirmOverwriteModal';
import { ImportModeModal } from './components/ImportModeModal';
import { ConfirmAccumulateModal } from './components/ConfirmAccumulateModal';
import { ErrorModal } from './components/ErrorModal';
import { CardSkeleton } from './components/CardSkeleton';
import { ChartSkeleton } from './components/ChartSkeleton';
import { PageLoader } from './components/PageLoader';
import { FinancialRecord, Filters, ImportedFile } from './types/financial';
import { processExcelFile, processCompaniesFile, processAccountsPayableFile, processRevenuesFile, processFinancialTransactionsFile, processForecastedEntriesFile, processRevenuesDREFile, processCMVDREFile, processInitialBalancesFile, validateFileFormat } from './utils/excelProcessor';
import { filterData, calculateKPIs } from './utils/dataProcessor';
import { DollarSign, TrendingUp, Pill, ArrowDown, ArrowUp, Calculator, Target, List, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { supabase } from './lib/supabase';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const IMPORT_ADMIN_CODE =
  import.meta.env.VITE_IMPORT_ADMIN_CODE || 'admin123';
const IMPORT_USER_CODE =
  import.meta.env.VITE_IMPORT_USER_CODE || 'user123';

function App() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [accountsPayable, setAccountsPayable] = useState<any[]>([]);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);
  const [forecastedEntries, setForecastedEntries] = useState<any[]>([]);
  const [revenuesDRE, setRevenuesDRE] = useState<any[]>([]);
  const [cmvDRE, setCmvDRE] = useState<any[]>([]);
  const [initialBalances, setInitialBalances] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState('cashflow');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    companies: [],
    groups: [],
    banks: [],
    startDate: '',
    endDate: ''
  });
  const [calendarDate, setCalendarDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });
  const [calendarAccumulatedMode, setCalendarAccumulatedMode] = useState(false); // false = diário, true = acumulado
  const [loading, setLoading] = useState<{
    isLoading: boolean;
    currentFile?: string;
    currentIndex?: number;
    totalFiles?: number;
    allCompleted?: boolean;
  }>({
    isLoading: false
  });
  const [dataLoading, setDataLoading] = useState(false);
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    data: any[];
    type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed';
    loadPaginatedData?: (page: number, pageSize: number, filters: any) => Promise<{ data: any[]; totalCount: number; hasMore: boolean }>;
  }>({
    isOpen: false,
    title: '',
    data: [],
    type: 'generic'
  });
  const [overwriteModal, setOverwriteModal] = useState<{
    isOpen: boolean;
    fileName: string;
    fileType: string;
    existingImportId: string | null;
    pendingFile: File | null;
    pendingType: string | null;
    pendingIndex?: number;
    pendingTotal?: number;
  }>({
    isOpen: false,
    fileName: '',
    fileType: '',
    existingImportId: null,
    pendingFile: null,
    pendingType: null
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
  const [importModeModal, setImportModeModal] = useState<{
    isOpen: boolean;
    fileName: string;
    fileType: string;
    pendingFile: File | null;
    pendingType: string | null;
    pendingIndex?: number;
    pendingTotal?: number;
  }>({
    isOpen: false,
    fileName: '',
    fileType: '',
    pendingFile: null,
    pendingType: null
  });
  const [confirmAccumulateModal, setConfirmAccumulateModal] = useState<{
    isOpen: boolean;
    fileName: string;
    fileType: string;
    pendingFile: File | null;
    pendingType: string | null;
    pendingIndex?: number;
    pendingTotal?: number;
  }>({
    isOpen: false,
    fileName: '',
    fileType: '',
    pendingFile: null,
    pendingType: null
  });
  const [importRole, setImportRole] = useState<'none' | 'user' | 'admin'>('none');
  const [importAuthError, setImportAuthError] = useState('');
  const [isPermanentlyUnlocked, setIsPermanentlyUnlocked] = useState(false);
  const [dreWarningClosed, setDreWarningClosed] = useState(false);
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

  // Sempre que sair da página de importação, resetar autenticação (exceto se estiver desbloqueado permanentemente)
  useEffect(() => {
    if (currentPage !== 'import' && importRole !== 'none' && !isPermanentlyUnlocked) {
      setImportRole('none');
      setImportAuthError('');
    } else if (currentPage === 'import' && isPermanentlyUnlocked && importRole === 'none') {
      // Se estiver na página de importação e estiver desbloqueado, garantir acesso como admin
      setImportRole('admin');
    }
  }, [currentPage, isPermanentlyUnlocked, importRole]);

  // Resetar aviso do DRE quando acessar a página
  useEffect(() => {
    if (currentPage === 'dre') {
      setDreWarningClosed(false);
    }
  }, [currentPage]);

  // Helper function to normalize business unit codes (remove leading zeros)
  const normalizeCode = (code: any): string => {
    if (!code) return '';
    const strCode = String(code).trim();
    const numCode = parseInt(strCode);
    return isNaN(numCode) ? strCode : String(numCode);
  };

  // Helper function to get filtered business units based on filters
  // Returns array of normalized business unit codes, or null if no filter is active
  const getFilteredBusinessUnits = (): string[] | null => {
    // Se não há empresas cadastradas ou não há filtros ativos, retorna null (sem filtro)
    if (companies.length === 0) return null;

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;
    if (!hasActiveFilters) return null;

    // Filtra empresas baseado em grupos e empresas selecionados
    const filteredCompanyCodes = companies
      .filter(c => {
        const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
        const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
        return groupMatch && companyMatch;
      })
      .map(c => normalizeCode(c.company_code));

    // Retorna null se não houver filtros aplicados (mostra tudo)
    return filteredCompanyCodes.length > 0 ? filteredCompanyCodes : null;
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

  // Load data from Supabase on mount and when filters change
  useEffect(() => {
    loadDataFromSupabase();
    loadImportsFromSupabase();
  }, []);

  // Recarregar dados quando filtros de data, empresas ou grupos mudarem
  useEffect(() => {
    loadDataFromSupabase();
  }, [filters.startDate, filters.endDate, filters.companies, filters.groups]);

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

  const loadDataFromSupabase = async (customStartDate?: string, customEndDate?: string) => {
    console.log('🔄 Starting to load data from Supabase...');
    setDataLoading(true);
    
    try {
      // Determinar período: usar filtros se existirem e não estiverem vazios, senão mês atual
      let startDate: string;
      let endDate: string;
    
      if (customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      } else if (filters.startDate && filters.endDate && filters.startDate.trim() !== '' && filters.endDate.trim() !== '') {
        // Usa filtros apenas se não estiverem vazios
        startDate = filters.startDate;
        endDate = filters.endDate;
      } else {
        // Se não houver filtros, usa o mês atual
        const defaultPeriod = getDefaultPeriod();
        startDate = defaultPeriod.start;
        endDate = defaultPeriod.end;
      }
    
      console.log('📅 Carregando dados do período:', { startDate, endDate });
      // Load companies (não filtra por data - sempre carrega tudo)
      console.log('📊 Loading companies...');
      const { data: companiesData, error: companiesError } = await supabase
        .from('empresas')
        .select('id, company_code, company_name, group_name')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('❌ Error loading companies:', companiesError);
        throw companiesError;
      }
      if (companiesData) {
        setCompanies(companiesData);
      }

      // Buscar imports ativos (não deletados) para filtrar dados por import_id
      const { data: importsData, error: importsError } = await supabase
        .from('importacoes')
        .select('id, is_deleted');

      if (importsError) throw importsError;

      const activeImportIds = (importsData || [])
        .filter((imp: any) => !imp.is_deleted)
        .map((imp: any) => imp.id);

      const hasActiveImports = activeImportIds.length > 0;

      // Obter business units filtrados (para otimizar queries com índices compostos)
      const filteredBusinessUnits = getFilteredBusinessUnits();

      // Load accounts payable - FILTRADO POR DATA E BUSINESS_UNIT NO BANCO (otimizado com índices)
      let apData: any[] | null = [];
      if (hasActiveImports) {
        // Carregar registros do período em lotes
        let allData: any[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          let query = supabase
            .from('contas_a_pagar')
            .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, creditor, id')
            .in('import_id', activeImportIds);
          
          // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          
          query = query
            .gte('payment_date', startDate)
            .lte('payment_date', endDate)
            .order('payment_date', { ascending: false })
            .range(offset, offset + batchSize - 1);
          
          const { data, error } = await query;
          
          if (error) {
            console.error('❌ Error loading accounts payable batch:', error);
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
        
        apData = allData;
        console.log(`✅ Carregados ${apData.length} registros de contas_a_pagar do período ${startDate} a ${endDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (apData) {
        setAccountsPayable(apData);
      }

      // Load revenues - FILTRADO POR DATA E BUSINESS_UNIT NO BANCO (otimizado com índices)
      let revenuesData: any[] | null = [];
      if (hasActiveImports) {
        let query = supabase
          .from('receitas')
          .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, id')
          .in('import_id', activeImportIds);
        
        // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        }
        
        const { data, error } = await query
          .gte('payment_date', startDate)
          .lte('payment_date', endDate)
          .order('payment_date', { ascending: false });

        if (error) throw error;
        revenuesData = data;
        console.log(`✅ Carregados ${revenuesData?.length || 0} registros de receitas do período ${startDate} a ${endDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (revenuesData) {
        setRevenues(revenuesData);
      }

      // Load financial transactions - FILTRADO POR DATA E BUSINESS_UNIT NO BANCO (otimizado com índices)
      let transactionsData: any[] | null = [];
      if (hasActiveImports) {
        try {
          let query = supabase
            .from('transacoes_financeiras')
            .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, id')
            .in('import_id', activeImportIds);
          
          // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
          if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
            query = query.in('business_unit', filteredBusinessUnits);
          }
          
          const { data, error } = await query
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .order('transaction_date', { ascending: false });

          if (error) {
            console.warn('⚠️ Error loading financial transactions (table may not exist):', error);
            transactionsData = [];
          } else {
            transactionsData = data;
            console.log(`✅ Carregados ${transactionsData?.length || 0} registros de transacoes_financeiras do período ${startDate} a ${endDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
          }
        } catch (err) {
          console.warn('⚠️ Exception loading financial transactions:', err);
          transactionsData = [];
        }
      }
      if (transactionsData) {
        setFinancialTransactions(transactionsData);
      }

      // Load forecasted entries - FILTRADO POR DATA E BUSINESS_UNIT NO BANCO (otimizado com índices)
      let forecastedData: any[] | null = [];
      if (hasActiveImports) {
        let query = supabase
          .from('previstos')
          .select('import_id, business_unit, due_date, amount, status, chart_of_accounts, supplier, id')
          .in('import_id', activeImportIds);
        
        // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        }
        
        const { data, error } = await query
          .gte('due_date', startDate)
          .lte('due_date', endDate)
          .order('due_date', { ascending: false });

        if (error) throw error;
        forecastedData = data;
        console.log(`✅ Carregados ${forecastedData?.length || 0} registros de previstos do período ${startDate} a ${endDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (forecastedData) {
        setForecastedEntries(forecastedData);
      }

      // Load revenues DRE - Carregar período amplo (últimos 24 meses) para permitir navegação na tela DRE
      // A tela DRE filtra localmente conforme o usuário navega entre meses
      let revenuesDREData: any[] | null = [];
      if (hasActiveImports) {
        // Calcular período amplo: últimos 24 meses a partir da data final
        const wideEndDate = endDate;
        const wideStartDate = new Date(new Date(wideEndDate).setMonth(new Date(wideEndDate).getMonth() - 24))
          .toISOString()
          .split('T')[0];
        
        let query = supabase
          .from('receitas_dre')
          .select('import_id, business_unit, issue_date, amount, id')
          .in('import_id', activeImportIds);
        
        // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        }
        
        const { data, error } = await query
          .gte('issue_date', wideStartDate)
          .lte('issue_date', wideEndDate)
          .order('issue_date', { ascending: false });

        if (error) {
          console.error('❌ Error loading revenues DRE:', error);
          throw error;
        }
        revenuesDREData = data;
        console.log(`✅ Carregados ${revenuesDREData?.length || 0} registros de receitas_dre do período amplo ${wideStartDate} a ${wideEndDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (revenuesDREData) {
        setRevenuesDRE(revenuesDREData);
      }

      // Load CMV DRE - Carregar período amplo (últimos 24 meses) para permitir navegação na tela DRE
      // A tela DRE filtra localmente conforme o usuário navega entre meses
      let cmvDREData: any[] | null = [];
      if (hasActiveImports) {
        // Calcular período amplo: últimos 24 meses a partir da data final
        const wideEndDate = endDate;
        const wideStartDate = new Date(new Date(wideEndDate).setMonth(new Date(wideEndDate).getMonth() - 24))
          .toISOString()
          .split('T')[0];
        
        let query = supabase
          .from('cmv_dre')
          .select('import_id, business_unit, issue_date, amount, chart_of_accounts, status, id')
          .in('import_id', activeImportIds);
        
        // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        }
        
        const { data, error } = await query
          .gte('issue_date', wideStartDate)
          .lte('issue_date', wideEndDate)
          .order('issue_date', { ascending: false});

        if (error) {
          console.error('❌ Error loading CMV DRE:', error);
          throw error;
        }
        cmvDREData = data;
        console.log(`✅ Carregados ${cmvDREData?.length || 0} registros de cmv_dre do período amplo ${wideStartDate} a ${wideEndDate}${filteredBusinessUnits ? ` (filtrado por ${filteredBusinessUnits.length} business units)` : ''}`);
      }
      if (cmvDREData) {
        setCmvDRE(cmvDREData);
      }

      // Load initial_balances - FILTRADO POR DATA NO BANCO
      // Carregar em bloco separado para garantir execução mesmo se outras tabelas falharem
      try {
        let initialBalancesData: any[] | null = [];
        
        // Carregar saldos iniciais até a data final do período (pode ter múltiplas datas por banco)
        let query = supabase
          .from('saldos_iniciais')
          .select('import_id, business_unit, balance_date, balance, bank_name, id')
          .lte('balance_date', endDate)
          .order('balance_date', { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error('❌ Error loading initial balances:', error);
          initialBalancesData = [];
        } else {
          initialBalancesData = data || [];
          console.log(`✅ Carregados ${initialBalancesData.length} registros de saldos_iniciais até ${endDate}`);
        }
        
        // Sempre definir o estado, mesmo se vazio
        setInitialBalances(initialBalancesData);
      } catch (initialBalanceError) {
        console.error('❌ Exception loading initial balances:', initialBalanceError);
        setInitialBalances([]);
      }

    } catch (error) {
      console.error('Error loading data from Supabase:', error);
    } finally {
      setDataLoading(false);
    }
  };

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
          type: imp.file_type,
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


  const moveOldImportsToTrash = async (fileType: string) => {
    try {
      console.log(`🗑️ Movendo imports antigos do tipo ${fileType} para a lixeira`);
      
      // Buscar todos os imports ativos do mesmo tipo
      const { data: oldImports, error: fetchError } = await supabase
        .from('importacoes')
        .select('id')
        .eq('file_type', fileType)
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
      
      // Delete data from the appropriate table based on file type
      if (fileType === 'accounts_payable') {
        const { error } = await supabase
          .from('contas_a_pagar')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de contas a pagar deletados');
      } else if (fileType === 'revenues') {
        const { error } = await supabase
          .from('receitas')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de receitas deletados');
      } else if (fileType === 'financial_transactions') {
        const { error } = await supabase
          .from('transacoes_financeiras')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de transações financeiras deletados');
      } else if (fileType === 'forecasted_entries') {
        const { error } = await supabase
          .from('previstos')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de lançamentos previstos deletados');
      } else if (fileType === 'revenues_dre') {
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
      } else if (fileType === 'initial_balances') {
        const { error } = await supabase
          .from('saldos_iniciais')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de saldos iniciais deletados');
      } else if (fileType === 'companies') {
        // Para companies, não deletamos por import_id pois não há essa coluna
        // O upsert na função handleDataImport já atualiza os dados existentes
        console.log('ℹ️ Companies usa upsert, não é necessário deletar dados antigos');
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

  const handleDataImport = async (file: File, type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances', currentIndex?: number, totalFiles?: number, shouldOverwrite?: boolean, shouldAccumulate?: boolean) => {
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

    try {
      // Create import record in database first
      const { data: importRecord, error: importError } = await supabase
        .from('importacoes')
        .insert({
          file_name: file.name,
          file_type: type,
          record_count: 0
        })
        .select()
        .single();

      if (importError) throw importError;

      const importId = importRecord.id;

      // Create new file entry for UI
      const newFile = {
        id: importId,
        name: file.name,
        type,
        uploadDate: new Date().toISOString(),
        recordCount: 0,
        status: 'processing' as const
      };

      setImportedFiles(prev => [...prev, newFile]);

      let recordCount = 0;

      if (type === 'companies') {
        const importedCompanies = await processCompaniesFile(file);
        console.log('Empresas importadas:', importedCompanies);

        // Save to Supabase
        const { error } = await supabase
          .from('empresas')
          .upsert(importedCompanies, { onConflict: 'company_code' });

        if (error) throw error;

        setCompanies(importedCompanies);
        recordCount = importedCompanies.length;
        console.log('Saved companies to Supabase');
      } else if (type === 'accounts_payable') {
        const importedAccountsPayable = await processAccountsPayableFile(file);
        console.log('Contas a pagar importadas:', importedAccountsPayable);

        // Add import_id to each record
        const recordsWithImportId = importedAccountsPayable.map(record => ({
          ...record,
          import_id: importId
        }));

        // Save to Supabase
        const { error } = await supabase
          .from('contas_a_pagar')
          .insert(recordsWithImportId);

        if (error) throw error;

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedAccountsPayable.length;
        console.log('Saved accounts payable to Supabase');
      } else if (type === 'revenues') {
        const importedRevenues = await processRevenuesFile(file);
        console.log('Receitas importadas:', importedRevenues);

        // Add import_id to each record
        const recordsWithImportId = importedRevenues.map(record => ({
          ...record,
          import_id: importId
        }));

        // Save to Supabase
        const { error } = await supabase
          .from('receitas')
          .insert(recordsWithImportId);

        if (error) throw error;

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedRevenues.length;
        console.log('Saved revenues to Supabase');
      } else if (type === 'financial_transactions') {
        const importedTransactions = await processFinancialTransactionsFile(file);
        console.log('Lançamentos financeiros importados:', importedTransactions);

        // Add import_id to each record
        const recordsWithImportId = importedTransactions.map(record => ({
          ...record,
          import_id: importId
        }));

        // Save to Supabase
        const { error } = await supabase
          .from('transacoes_financeiras')
          .insert(recordsWithImportId);

        if (error) throw error;

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedTransactions.length;
        console.log('Saved financial transactions to Supabase');
      } else if (type === 'forecasted_entries') {
        console.log('Starting forecasted entries import...');
        const importedEntries = await processForecastedEntriesFile(file);
        console.log('Lançamentos previstos importados:', importedEntries);
        console.log('Number of entries:', importedEntries.length);

        if (importedEntries.length === 0) {
          throw new Error('Nenhum lançamento previsto foi processado. Verifique o formato do arquivo.');
        }

        // Add import_id to each record
        const recordsWithImportId = importedEntries.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log('Records to insert:', recordsWithImportId);

        // Save to Supabase PREVISTOS table
        const { data: insertedData, error } = await supabase
          .from('previstos')
          .insert(recordsWithImportId)
          .select();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        console.log('Inserted data:', insertedData);

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedEntries.length;
        console.log('Saved forecasted entries to Supabase');
      } else if (type === 'revenues_dre') {
        console.log('🔵 Starting revenues DRE import...');
        console.log('📁 File info:', { name: file.name, size: file.size, type: file.type });
        const importedRevenuesDRE = await processRevenuesDREFile(file);
        console.log('✅ Receitas DRE importadas:', importedRevenuesDRE);
        console.log('📊 Number of entries:', importedRevenuesDRE.length);

        if (importedRevenuesDRE.length === 0) {
          throw new Error('Nenhuma receita DRE foi processada. Verifique o formato do arquivo.');
        }

        // Add import_id to each record
        const recordsWithImportId = importedRevenuesDRE.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log('Records to insert:', recordsWithImportId);

        // Save to Supabase revenues_dre table
        const { data: insertedData, error } = await supabase
          .from('receitas_dre')
          .insert(recordsWithImportId)
          .select();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        console.log('Inserted data:', insertedData);

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedRevenuesDRE.length;
        console.log('Saved revenues DRE to Supabase');
      } else if (type === 'cmv_dre') {
        console.log('Starting CMV DRE import...');
        const importedCMVDRE = await processCMVDREFile(file);
        console.log('CMV DRE importado:', importedCMVDRE);
        console.log('Number of entries:', importedCMVDRE.length);

        if (importedCMVDRE.length === 0) {
          throw new Error('Nenhum CMV DRE foi processado. Verifique o formato do arquivo.');
        }

        // Add import_id to each record
        const recordsWithImportId = importedCMVDRE.map(record => ({
          ...record,
          import_id: importId
        }));

        console.log('Records to insert:', recordsWithImportId);

        // Save to Supabase cmv_dre table
        const { data: insertedData, error } = await supabase
          .from('cmv_dre')
          .insert(recordsWithImportId)
          .select();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        console.log('Inserted data:', insertedData);

        // Reload from database to get proper IDs
        await loadDataFromSupabase();
        await loadMonthlyComparisonData(); // Recarregar dados do MonthlyComparison
        recordCount = importedCMVDRE.length;
        console.log('Saved CMV DRE to Supabase');
      } else if (type === 'initial_balances') {
        console.log('Starting Initial Balances import...');
        const importedBalances = await processInitialBalancesFile(file);
        console.log('Initial Balances importados:', importedBalances);

        if (importedBalances.length === 0) {
          throw new Error('Nenhum saldo foi processado. Verifique o formato do arquivo.');
        }

        // Add import_id to each record
        const recordsWithImportId = importedBalances.map(record => ({
          ...record,
          import_id: importId
        }));

        // Save to Supabase initial_balances table
        const { data: insertedData, error } = await supabase
          .from('saldos_iniciais')
          .insert(recordsWithImportId)
          .select();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        console.log('Inserted data:', insertedData);

        // Reload from database
        await loadDataFromSupabase();
        recordCount = importedBalances.length;
        console.log('Saved Initial Balances to Supabase');
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
      alert(`Erro ao importar arquivo: ${errorMessage}\n\nVeja o console (F12) para mais detalhes.`);

      setImportedFiles(prev =>
        prev.map(f =>
          f.id === Date.now().toString()
            ? { ...f, status: 'error' as const }
            : f
        )
      );
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

  const handleFileSelectWithMode = (
    file: File,
    type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances',
    currentIndex?: number,
    totalFiles?: number
  ) => {
    setImportModeModal({
      isOpen: true,
      fileName: file.name,
      fileType: type,
      pendingFile: file,
      pendingType: type,
      pendingIndex: currentIndex,
      pendingTotal: totalFiles
    });
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
        // Usa a função existente que deleta dados relacionados + registro de import
        await deleteOldImportData(fileId, fileType);
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

  const getFilteredOperationalPayments = useMemo(() => {
    return getFilteredAccountsPayable.filter(ap => {
      // Exclude non-operational accounts
      const isOperational = !nonOperationalAccounts.some(account =>
        ap.chart_of_accounts?.toLowerCase() === account.toLowerCase()
      );
      return isOperational;
    });
  }, [getFilteredAccountsPayable]);

  // Dados já vêm filtrados do banco por data e business_unit quando há filtros ativos
  // Não precisa refiltrar aqui - apenas retorna os dados como estão
  const getFilteredForecastedEntries = useMemo(() => {
    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Então apenas retornamos os dados como estão
    return forecastedEntries;
  }, [forecastedEntries]);

  const getFilteredRevenuesFromForecasted = useMemo(() => {
    return getFilteredForecastedEntries.filter(entry =>
      entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro')
    );
  }, [getFilteredForecastedEntries]);

  // Dados já vêm filtrados do banco por data e business_unit quando há filtros ativos
  // Não precisa refiltrar aqui - apenas retorna os dados como estão
  const getFilteredRevenues = useMemo(() => {
    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Então apenas retornamos os dados como estão
    return revenues;
  }, [revenues]);

  // Dados já vêm filtrados do banco por data e business_unit quando há filtros ativos
  // Não precisa refiltrar aqui - apenas retorna os dados como estão
  const getFilteredTransactions = useMemo(() => {
    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Então apenas retornamos os dados como estão
    return financialTransactions;
  }, [financialTransactions]);

  const getFilteredExpenses = useMemo(() => {
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

    const fromAccountsPayable = getFilteredAccountsPayable.filter(ap =>
      !expensesExclusionList.some(excluded =>
        ap.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())
      )
    );

    const fromForecastedEntries = getFilteredForecastedEntries.filter(e =>
      !expensesExclusionList.some(excluded =>
        e.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())
      )
    );

    const fromTransactions = getFilteredTransactions.filter(t =>
      t.amount < 0 &&
      !expensesExclusionList.some(excluded =>
        // Nota: transacoes_financeiras não tem coluna 'description', apenas chart_of_accounts
        t.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())
      )
    );

    return [
      ...fromAccountsPayable.map(item => ({ ...item, source: 'accounts_payable' })),
      ...fromForecastedEntries.map(item => ({ ...item, source: 'forecasted_entries' })),
      ...fromTransactions.map(item => ({ ...item, source: 'transactions' }))
    ];
  }, [getFilteredAccountsPayable, getFilteredForecastedEntries, getFilteredTransactions]);

  // Saldos iniciais filtrados por empresas/grupos e período (sem agrupar, para cálculos)
  const getFilteredInitialBalancesRaw = useMemo(() => {
    let filtered = initialBalances;

    // Filtrar por data do saldo (balance_date) - considera saldos dentro ou antes do período
    // Se há filtro de data inicial, considera apenas saldos com balance_date <= endDate
    // (ou seja, saldos válidos até o final do período)
    if (filters.endDate) {
      filtered = filtered.filter(bal => {
        const balanceDate = bal.balance_date;
        if (!balanceDate) return true; // Se não tem data, mantém
        return balanceDate <= filters.endDate;
      });
    }

    // Se não há empresas cadastradas, retorna apenas com filtro de data
    if (companies.length === 0) {
      return filtered;
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    // Se não há filtros de empresa/grupo ativos, retorna apenas com filtro de data
    if (!hasActiveFilters) {
      return filtered;
    }

    // Filtra saldos baseado em grupos e empresas selecionados
    const filteredCompanyCodes = companies
      .filter(c => {
        const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
        const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
        return groupMatch && companyMatch;
      })
      .map(c => c.company_code);

    const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));

    return filtered.filter(bal => {
      const normalizedBU = normalizeCode(bal.business_unit);
      return normalizedCompanyCodes.includes(normalizedBU);
    });
  }, [initialBalances, companies, filters.groups, filters.companies, filters.endDate]);

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

  // Dados detalhados para Total de Recebimentos (receitas + transações positivas)
  const getFilteredTotalInflows = useMemo(() => {
    const revenuesData = getFilteredRevenues.map(r => ({
      ...r,
      source: 'revenues',
      type: 'Receita'
    }));

    const transactionsData = getFilteredTransactions
      .filter(t => t.amount > 0)
      .map(t => ({
        ...t,
        source: 'transactions',
        type: 'Transação Financeira',
        amount: Math.abs(t.amount)
      }));

    return [...revenuesData, ...transactionsData];
  }, [getFilteredRevenues, getFilteredTransactions]);

  // Dados detalhados para Total de Pagamentos (pagamentos + transações negativas)
  const getFilteredTotalOutflows = useMemo(() => {
    const apData = getFilteredOperationalPayments.map(ap => ({
      ...ap,
      source: 'accounts_payable',
      type: 'Conta a Pagar'
    }));

    const transactionsData = getFilteredTransactions
      .filter(t => t.amount < 0)
      .map(t => ({
        ...t,
        source: 'transactions',
        type: 'Transação Financeira',
        amount: Math.abs(t.amount)
      }));

    return [...apData, ...transactionsData];
  }, [getFilteredOperationalPayments, getFilteredTransactions]);

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
    type: 'accounts_payable' | 'revenues' | 'transactions' | 'mixed',
    page: number,
    pageSize: number,
    filters: {
      status?: string;
      businessUnit?: string;
      startDate?: string;
      endDate?: string;
      searchTerm?: string;
    }
  ): Promise<{ data: any[]; totalCount: number; hasMore: boolean }> => {
    try {
      // Buscar imports ativos
      const { data: importsData } = await supabase
        .from('importacoes')
        .select('id, is_deleted');

      const activeImportIds = (importsData || [])
        .filter((imp: any) => !imp.is_deleted)
        .map((imp: any) => imp.id);

      if (activeImportIds.length === 0) {
        return { data: [], totalCount: 0, hasMore: false };
      }

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
        let query = supabase
          .from('contas_a_pagar')
          .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, creditor, id', { count: 'exact' })
          .in('import_id', activeImportIds);

        // Aplicar filtros de business_unit (do filtro global ou do modal)
        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
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
          .from('receitas')
          .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, id', { count: 'exact' })
          .in('import_id', activeImportIds);

        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
        } else if (filters.businessUnit && filters.businessUnit !== 'all') {
          query = query.eq('business_unit', filters.businessUnit);
        }

        if (baseStartDate) {
          query = query.gte('payment_date', baseStartDate);
        }
        if (baseEndDate) {
          query = query.lte('payment_date', baseEndDate);
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
          .order('payment_date', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        return {
          data: data || [],
          totalCount: count || 0,
          hasMore: (count || 0) > offset + pageSize
        };
      } else if (type === 'transactions') {
        let query = supabase
          .from('transacoes_financeiras')
          .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, id', { count: 'exact' })
          .in('import_id', activeImportIds);

        if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
          query = query.in('business_unit', filteredBusinessUnits);
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
      } else if (type === 'mixed') {
        // Para mixed, carregar de múltiplas fontes e combinar
        // Por enquanto, vamos carregar todas as fontes e combinar
        // (pode ser otimizado depois para carregar cada fonte paginada)
        const [revenuesResult, apResult, transactionsResult, forecastedResult, balancesResult] = await Promise.all([
          // Receitas
          (async () => {
            let query = supabase
              .from('receitas')
              .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, id', { count: 'exact' })
              .in('import_id', activeImportIds);

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
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
            return (data || []).map(r => ({ ...r, source: 'revenues', type: 'Receita' }));
          })(),
          // Contas a pagar
          (async () => {
            let query = supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, creditor, id', { count: 'exact' })
              .in('import_id', activeImportIds);

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
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
            let query = supabase
              .from('transacoes_financeiras')
              .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, id', { count: 'exact' })
              .in('import_id', activeImportIds);

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
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
            let query = supabase
              .from('previstos')
              .select('import_id, business_unit, due_date, amount, status, chart_of_accounts, supplier, id', { count: 'exact' })
              .in('import_id', activeImportIds);

            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
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

  const openKPIDetail = (title: string, data: any[], type: 'accounts_payable' | 'revenues' | 'transactions' | 'mixed') => {
    // Criar função de carregamento paginado para o modal
    const loadPaginatedData = async (
      page: number,
      pageSize: number,
      filters: {
        status?: string;
        businessUnit?: string;
        startDate?: string;
        endDate?: string;
        searchTerm?: string;
      }
    ) => {
      return await loadPaginatedDataForModal(type, page, pageSize, filters);
    };

    setModalState({
      isOpen: true,
      title,
      data: data, // Manter para compatibilidade com código que ainda não usa paginação
      type,
      loadPaginatedData
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      data: [],
      type: 'generic',
      loadPaginatedData: undefined
    });
  };

  // Calculate totals from accounts payable (usando dados filtrados por empresas/grupos)
  const accountsPayableTotals = useMemo(() => {
    // Realizado: soma os valores filtrados por empresas/grupos
    const actual = getFilteredAccountsPayable
      .filter(ap => ap.status?.toLowerCase() === 'realizado')
      .reduce((sum, ap) => {
        const amount = parseFloat(ap.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    // Previsto: soma os valores filtrados por empresas/grupos
    const forecasted = getFilteredAccountsPayable
      .filter(ap => ap.status?.toLowerCase() === 'previsto')
      .reduce((sum, ap) => {
        const amount = parseFloat(ap.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

    return { forecasted, actual };
  }, [getFilteredAccountsPayable]);

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

  // Calculate totals from revenues
  // Dados já vêm filtrados do banco por data e business_unit
  // Apenas calcula totais por status (previsto/realizado)
  const revenueTotals = useMemo(() => {
    // Os dados já vêm filtrados do banco em loadDataFromSupabase:
    // - Por data (startDate/endDate)
    // - Por business_unit (quando há filtros de empresas/grupos)
    // Apenas calculamos totais por status aqui
    const forecasted = revenues
      .filter(rev => rev.status?.toLowerCase() === 'previsto' || rev.status?.toLowerCase() === 'pendente')
      .reduce((sum, rev) => sum + (rev.amount || 0), 0);

    const forecastedFromEntries = getFilteredRevenuesFromForecasted
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);

    const actual = revenues
      .filter(rev => rev.status?.toLowerCase() === 'realizado')
      .reduce((sum, rev) => sum + (rev.amount || 0), 0);

    return { forecasted: forecasted + forecastedFromEntries, actual };
  }, [revenues, getFilteredRevenuesFromForecasted]);

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

    // Forecasted
    const forecastedInflows = filtered
      .filter(t => t.status?.toLowerCase() === 'previsto' && t.amount > 0)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const forecastedOutflows = Math.abs(filtered
      .filter(t => t.status?.toLowerCase() === 'previsto' && t.amount < 0)
      .reduce((sum, t) => sum + (t.amount || 0), 0));

    // Actual
    const actualInflows = filtered
      .filter(t => t.status?.toLowerCase() === 'realizado' && t.amount > 0)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const actualOutflows = Math.abs(filtered
      .filter(t => t.status?.toLowerCase() === 'realizado' && t.amount < 0)
      .reduce((sum, t) => sum + (t.amount || 0), 0));

    return {
      inflows: { forecasted: forecastedInflows, actual: actualInflows },
      outflows: { forecasted: forecastedOutflows, actual: actualOutflows }
    };
  }, [financialTransactions, nonOperationalAccounts]);

  const cmvChartOfAccounts = [
    'Medicamentos Bonificados',
    'Medicamentos Ético',
    'Perfumaria',
    'Medicamentos Multiplos',
    'Despesas com Pagto de Mercadoria (CMV)',
    '04.8 Medicamentos Multiplos'
  ];

  // Filtro de CMV - dados de contas_a_pagar com categoria "04.0DESPESAS COM MERCADORIA"
  const getFilteredCMVDRE = useMemo(() => {
    // Filtrar contas_a_pagar pela categoria específica
    const cmvFromAP = getFilteredAccountsPayable.filter(ap => {
      const chartOfAccounts = (ap.chart_of_accounts || '').toUpperCase();
      // Verificar se contém "04.0" seguido de "DESPESAS COM MERCADORIA" (aceita espaço e singular/plural)
      // Aceita: "04.0DESPESAS COM MERCADORIA", "04.0 DESPESAS COM MERCADORIA", "04.0DESPESAS COM MERCADORIAS", etc.
      return chartOfAccounts.includes('04.0') && 
             chartOfAccounts.includes('DESPESAS COM MERCADORIA');
    });

    // Mapear para o formato esperado (compatível com o formato antigo de cmvDRE)
    return cmvFromAP.map(ap => ({
      id: ap.id,
      status: ap.status,
      business_unit: ap.business_unit,
      chart_of_accounts: ap.chart_of_accounts,
      issue_date: ap.payment_date, // Usar payment_date como issue_date para compatibilidade
      amount: ap.amount,
      creditor: ap.creditor,
      payment_date: ap.payment_date,
      import_id: ap.import_id,
      created_at: ap.created_at,
      updated_at: ap.updated_at
    }));
  }, [getFilteredAccountsPayable]);


  // Dados detalhados para Resultado Operacional (receita - CMV - despesas)
  const getFilteredOperationalResult = useMemo(() => {
    const revenueData = getFilteredRevenues.map(r => ({
      ...r,
      source: 'revenues',
      type: 'Receita',
      category: 'Receita Direta'
    }));

    // CMV de contas_a_pagar com categoria "04.0DESPESAS COM MERCADORIA"
    const cmvData = getFilteredCMVDRE.map(item => ({
      ...item,
      source: 'accounts_payable',
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
  }, [getFilteredRevenues, getFilteredCMVDRE, getFilteredExpenses]);

  // CMV calculado de contas_a_pagar com categoria "04.0DESPESAS COM MERCADORIA"
  const cmvTotals = useMemo(() => {
    // Separar por status: 'realizado' ou 'paga' = actual, 'previsto' ou 'pendente' = forecasted
    const actual = getFilteredCMVDRE
      .filter(cmv => {
        const status = (cmv.status || '').toLowerCase();
        return status === 'realizado' || status === 'paga';
      })
      .reduce((sum, cmv) => sum + Math.abs(cmv.amount || 0), 0);

    const forecasted = getFilteredCMVDRE
      .filter(cmv => {
        const status = (cmv.status || '').toLowerCase();
        return status === 'previsto' || status === 'pendente';
      })
      .reduce((sum, cmv) => sum + Math.abs(cmv.amount || 0), 0);

    return {
      forecasted: forecasted,
      actual: actual
    };
  }, [getFilteredCMVDRE]);

  const kpiData = useMemo(() => {
    const baseKpis = calculateKPIs(filteredData);

    // Receita Direta = apenas receitas (sem baseKpis que vem de records antigos)
    // Deve corresponder a getFilteredRevenues
    const totalRevenueForecasted = revenueTotals.forecasted;
    const totalRevenueActual = revenueTotals.actual;

    // Add accounts payable to forecasted and actual outflows
    // Add revenues to forecasted and actual inflows
    // Add financial transactions (positive to inflows, negative to outflows)
    // Total de Recebimentos = Receitas + Transações positivas
    const totalInflowsForecasted = revenueTotals.forecasted + transactionTotals.inflows.forecasted;
    const totalInflowsActual = revenueTotals.actual + transactionTotals.inflows.actual;
    
    // Total de Pagamentos = Contas a Pagar + Transações negativas
    // Deve corresponder a getFilteredTotalOutflows (getFilteredOperationalPayments + transações negativas)
    const totalOutflowsForecasted = accountsPayableTotals.forecasted + transactionTotals.outflows.forecasted;
    const totalOutflowsActual = accountsPayableTotals.actual + transactionTotals.outflows.actual;

    // Calculate Total Expenses (excluding specific accounts)
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

    // Filter Accounts Payable
    const expensesFromAPForecasted = getFilteredAccountsPayable
      .filter(ap => ap.status?.toLowerCase() === 'previsto' &&
        !expensesExclusionList.some(excluded => ap.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())))
      .reduce((sum, ap) => sum + Math.abs(ap.amount || 0), 0);

    const expensesFromAPActual = getFilteredAccountsPayable
      .filter(ap => ap.status?.toLowerCase() === 'realizado' &&
        !expensesExclusionList.some(excluded => ap.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())))
      .reduce((sum, ap) => sum + Math.abs(ap.amount || 0), 0);

    // Filter Forecasted Entries
    const expensesFromForecastedForecasted = getFilteredForecastedEntries
      .filter(e => e.status?.toLowerCase() !== 'paga' &&
        !expensesExclusionList.some(excluded => e.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())))
      .reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

    const expensesFromForecastedActual = getFilteredForecastedEntries
      .filter(e => e.status?.toLowerCase() === 'paga' &&
        !expensesExclusionList.some(excluded => e.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())))
      .reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);

    // Filter Financial Transactions (outflows only)
    // Nota: transacoes_financeiras não tem coluna 'description', apenas chart_of_accounts
    const expensesFromTransactionsForecasted = getFilteredTransactions
      .filter(t => t.amount < 0 && t.status?.toLowerCase() === 'previsto' &&
        !expensesExclusionList.some(excluded =>
          t.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    const expensesFromTransactionsActual = getFilteredTransactions
      .filter(t => t.amount < 0 && t.status?.toLowerCase() === 'realizado' &&
        !expensesExclusionList.some(excluded =>
          t.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase())))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    const totalExpensesForecasted = expensesFromAPForecasted + expensesFromForecastedForecasted + expensesFromTransactionsForecasted;
    const totalExpensesActual = expensesFromAPActual + expensesFromForecastedActual + expensesFromTransactionsActual;

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

    // Calculate initial balance from database - pega o saldo inicial mais recente disponível
    // Como o saldo inicial é atualizado manualmente todos os dias, devemos sempre pegar o mais recente
    // independente do filtro de período (o saldo inicial é dinâmico e atualizado diariamente)
    const allBalances = (getFilteredInitialBalancesRaw || [])
      .filter(bal => {
        const balanceDate = bal.balance_date;
        return !!balanceDate; // Apenas filtra saldos com data válida
      });

    // Agrupar por bank_name + business_unit e pegar o mais recente de cada grupo
    const latestBalancesByBankAndUnit = allBalances.reduce((acc, bal) => {
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
    const calculatedInitialBalance = Object.values(latestBalancesByBankAndUnit)
      .reduce((sum: number, bal: any) => {
        const balanceValue = bal?.balance;
        if (balanceValue === null || balanceValue === undefined || balanceValue === '') {
          return sum;
        }
        const parsed = parseFloat(String(balanceValue));
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);

    // Get the latest balance date for display - pega a data mais recente dos saldos usados
    const balanceDates = Object.values(latestBalancesByBankAndUnit)
      .map((bal: any) => bal.balance_date)
      .filter(date => date) // Remove datas vazias
      .sort()
      .reverse(); // Ordena do mais recente para o mais antigo

    const calculatedInitialBalanceDate = balanceDates.length > 0 ? balanceDates[0] : (filters.startDate || new Date().toISOString().split('T')[0]);

    result.initialBalance = {
      forecasted: calculatedInitialBalance || 0,
      actual: calculatedInitialBalance || 0,
      date: calculatedInitialBalanceDate
    };
    
    // Saldo Final = Saldo Inicial + Total de Recebimentos - Total de Pagamentos
    // Usa os valores exatos dos cards para garantir consistência
    result.finalBalance = {
      forecasted: result.initialBalance.forecasted + result.totalInflows.forecasted - result.totalOutflows.forecasted,
      actual: result.initialBalance.actual + result.totalInflows.actual - result.totalOutflows.actual
    };

    return result;
  }, [filteredData, accountsPayableTotals, forecastedEntriesTotals, revenueTotals, transactionTotals, cmvTotals, getFilteredInitialBalancesRaw, companies, filters]);


  // Saldo inicial para o calendário (SEM filtro de período, apenas empresas/grupos)
  const getCalendarInitialBalances = useMemo(() => {
    // Se não há empresas cadastradas, mostra todos os saldos
    if (companies.length === 0) {
      return initialBalances;
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    // Se não há filtros ativos, mostra todos os saldos
    if (!hasActiveFilters) {
      return initialBalances;
    }

    // Filtra saldos baseado em grupos e empresas selecionados (SEM filtro de data)
    const filteredCompanyCodes = companies
      .filter(c => {
        const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
        const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
        return groupMatch && companyMatch;
      })
      .map(c => c.company_code);

    const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));

    return initialBalances.filter(bal => {
      const normalizedBU = normalizeCode(bal.business_unit);
      return normalizedCompanyCodes.includes(normalizedBU);
    });
  }, [initialBalances, companies, filters.groups, filters.companies]);

  // Calculate daily cash flow based on actual data from database (SEM filtro de período)
  const dailyCashFlow = useMemo(() => {
    // Calcula para um range amplo que cubra qualquer mês que o calendário possa mostrar
    // Vai de 6 meses atrás até 18 meses à frente para garantir que cubra qualquer navegação
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1); // 6 meses atrás
    const endDate = new Date(today.getFullYear(), today.getMonth() + 18, 0); // 18 meses à frente (último dia do mês)

    const days: any[] = [];
    
    // Filtro de empresas/grupos (mesmo usado no calendário)
    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;
    const filteredCompanyCodes = companies
      .filter(c => {
        const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
        const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
        return groupMatch && companyMatch;
      })
      .map(c => c.company_code);
    const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
    
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
        const forecastedRevenues = revenues
          .filter(r => filterByCompany(r) && r.payment_date <= dateStr && (r.status?.toLowerCase() === 'previsto' || r.status?.toLowerCase() === 'pendente'))
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        const forecastedFromEntries = forecastedEntries
          .filter(e => filterByCompany(e) && e.due_date <= dateStr && e.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro'))
          .reduce((sum, e) => sum + (e.amount || 0), 0);

        const forecastedTransactionsInflows = financialTransactions
          .filter(t => filterByCompany(t) && t.transaction_date <= dateStr && t.amount > 0 && t.status?.toLowerCase() === 'previsto')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        dayForecastedInflows = forecastedRevenues + forecastedFromEntries + forecastedTransactionsInflows;

        // Recebimentos Realizados acumulados até dateStr
        const actualRevenues = revenues
          .filter(r => filterByCompany(r) && r.payment_date <= dateStr && r.status?.toLowerCase() === 'realizado')
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        const actualTransactionsInflows = financialTransactions
          .filter(t => filterByCompany(t) && t.transaction_date <= dateStr && t.amount > 0 && t.status?.toLowerCase() === 'realizado')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        dayActualInflows = actualRevenues + actualTransactionsInflows;

        // Pagamentos Previstos acumulados até dateStr
        const forecastedOutflowsAccountsPayable = accountsPayable
          .filter(ap => filterByCompany(ap) && ap.payment_date <= dateStr && ap.status?.toLowerCase() === 'previsto')
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
        dayForecastedInflows = revenues
          .filter(r => filterByCompany(r) && r.payment_date === dateStr && (r.status?.toLowerCase() === 'previsto' || r.status?.toLowerCase() === 'pendente'))
          .reduce((sum, r) => sum + (r.amount || 0), 0) +
          forecastedEntries
            .filter(e => filterByCompany(e) && e.due_date === dateStr && e.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro'))
            .reduce((sum, e) => sum + (e.amount || 0), 0) +
          financialTransactions
            .filter(t => filterByCompany(t) && t.transaction_date === dateStr && t.amount > 0 && t.status?.toLowerCase() === 'previsto')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        // Recebimentos Realizados DO dia específico (apenas === dateStr)
        dayActualInflows = revenues
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
  }, [revenues, accountsPayable, forecastedEntries, financialTransactions, initialBalances, companies, filters.groups, filters.companies, calendarAccumulatedMode]);

  const calendarData = useMemo(() => {
    const year = calendarDate.year;
    const month = calendarDate.month;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = dailyCashFlow.find(d => d.date === dateStr);

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
  }, [dailyCashFlow, calendarDate.year, calendarDate.month, getCalendarInitialBalances]);

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

    if (companies.length > 0) {
      const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

      if (hasActiveFilters) {
        const filteredCompanyCodes = companies
          .filter(c => {
            const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
            const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
            return groupMatch && companyMatch;
          })
          .map(c => c.company_code);

        filteredBalances = initialBalances.filter(bal => {
          const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
          const normalizedBU = normalizeCode(bal.business_unit);
          return normalizedCompanyCodes.includes(normalizedBU);
        });
      }
    }

    // Get unique bank names
    return [...new Set(filteredBalances.map(b => b.bank_name))];
  }, [initialBalances, companies, filters.groups, filters.companies]);

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
    revenues: any[];
    accountsPayable: any[];
    forecastedEntries: any[];
    transactions: any[];
    cmvDRE: any[];
    companies: any[];
    cmvChartOfAccounts: string[];
  }>({
    revenues: [],
    accountsPayable: [],
    forecastedEntries: [],
    transactions: [],
    cmvDRE: [],
    companies: [],
    cmvChartOfAccounts: []
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

      // Obter business units filtrados (para otimizar queries com índices compostos)
      const filteredBusinessUnits = getFilteredBusinessUnits();

      // Carregar TODOS os dados disponíveis (sem limite de data) para garantir comparação ano a ano completa
      // Não limitamos por data porque o componente MonthlyComparison tem seu próprio filtro de período
      // Mas aplicamos filtro de business_unit se houver filtros ativos (otimização com índices)
      console.log('📅 Carregando TODOS os dados disponíveis para MonthlyComparison (sem filtro de data)...');

      // Carregar todos os dados necessários
      let revenuesResult: any = { data: [], error: null };
      let apResult: any = { data: [], error: null };
      let transactionsResult: any = { data: [], error: null };
      let forecastedResult: any = { data: [], error: null };
      let cmvDREResult: any = { data: [], error: null };

      if (hasActiveImports) {
        try {
          // Carregar receitas em lotes para evitar limite do Supabase
          let allRevenues: any[] = [];
          const batchSize = 1000;
          let offset = 0;
          let hasMore = true;
          
          while (hasMore) {
            let query = supabase
              .from('receitas')
              .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, id')
              .in('import_id', activeImportIds);
            
            // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            }
            
            const batch = await query
              .order('payment_date', { ascending: false })
              .range(offset, offset + batchSize - 1);
            
            if (batch.error) {
              console.error('❌ Erro ao carregar receitas para MonthlyComparison:', batch.error);
              break;
            }
            
            if (batch.data && batch.data.length > 0) {
              allRevenues = [...allRevenues, ...batch.data];
              offset += batchSize;
              hasMore = batch.data.length === batchSize;
            } else {
              hasMore = false;
            }
          }
          
          revenuesResult = { data: allRevenues, error: null };
        } catch (err) {
          console.error('❌ Exceção ao carregar receitas para MonthlyComparison:', err);
          revenuesResult = { data: [], error: err };
        }

        try {
          // Carregar contas_a_pagar em lotes para evitar limite do Supabase
          let allAP: any[] = [];
          const batchSize = 1000;
          let offset = 0;
          let hasMore = true;
          
          while (hasMore) {
            let query = supabase
              .from('contas_a_pagar')
              .select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, creditor, id')
              .in('import_id', activeImportIds);
            
            // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
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

        try {
          // Carregar transacoes_financeiras em lotes para evitar limite do Supabase
          let allTransactions: any[] = [];
          const batchSize = 1000;
          let offset = 0;
          let hasMore = true;
          
          while (hasMore) {
            let query = supabase
              .from('transacoes_financeiras')
              .select('import_id, business_unit, transaction_date, amount, status, chart_of_accounts, id')
              .in('import_id', activeImportIds);
            
            // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            }
            
            const batch = await query
              .order('transaction_date', { ascending: false })
              .range(offset, offset + batchSize - 1);
            
            if (batch.error) {
              console.error('❌ Erro ao carregar transacoes_financeiras para MonthlyComparison:', batch.error);
              break;
            }
            
            if (batch.data && batch.data.length > 0) {
              allTransactions = [...allTransactions, ...batch.data];
              offset += batchSize;
              hasMore = batch.data.length === batchSize;
            } else {
              hasMore = false;
            }
          }
          
          transactionsResult = { data: allTransactions, error: null };
        } catch (err) {
          console.error('❌ Exceção ao carregar transacoes_financeiras para MonthlyComparison:', err);
          transactionsResult = { data: [], error: err };
        }

        try {
          // Carregar previstos em lotes para evitar limite do Supabase
          let allForecasted: any[] = [];
          const batchSize = 1000;
          let offset = 0;
          let hasMore = true;
          
          while (hasMore) {
            let query = supabase
              .from('previstos')
              .select('import_id, business_unit, due_date, amount, status, chart_of_accounts, supplier, id')
              .in('import_id', activeImportIds);
            
            // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            }
            
            const batch = await query
              .order('due_date', { ascending: false })
              .range(offset, offset + batchSize - 1);
            
            if (batch.error) {
              console.error('❌ Erro ao carregar previstos para MonthlyComparison:', batch.error);
              break;
            }
            
            if (batch.data && batch.data.length > 0) {
              allForecasted = [...allForecasted, ...batch.data];
              offset += batchSize;
              hasMore = batch.data.length === batchSize;
            } else {
              hasMore = false;
            }
          }
          
          forecastedResult = { data: allForecasted, error: null };
        } catch (err) {
          console.error('❌ Exceção ao carregar previstos para MonthlyComparison:', err);
          forecastedResult = { data: [], error: err };
        }

        try {
          // Carregar cmv_dre em lotes para evitar limite do Supabase
          let allCMVDRE: any[] = [];
          const batchSize = 1000;
          let offset = 0;
          let hasMore = true;
          
          while (hasMore) {
            let query = supabase
              .from('cmv_dre')
              .select('import_id, business_unit, issue_date, amount, chart_of_accounts, status, id')
              .in('import_id', activeImportIds);
            
            // Aplicar filtro de business_unit se houver filtros ativos (usa índice composto)
            if (filteredBusinessUnits && filteredBusinessUnits.length > 0) {
              query = query.in('business_unit', filteredBusinessUnits);
            }
            
            const batch = await query
              .order('issue_date', { ascending: false })
              .range(offset, offset + batchSize - 1);
            
            if (batch.error) {
              console.error('❌ Erro ao carregar cmv_dre para MonthlyComparison:', batch.error);
              break;
            }
            
            if (batch.data && batch.data.length > 0) {
              allCMVDRE = [...allCMVDRE, ...batch.data];
              offset += batchSize;
              hasMore = batch.data.length === batchSize;
            } else {
              hasMore = false;
            }
          }
          
          cmvDREResult = { data: allCMVDRE, error: null };
        } catch (err) {
          console.error('❌ Exceção ao carregar cmv_dre para MonthlyComparison:', err);
          cmvDREResult = { data: [], error: err };
        }
      }

      const newData = {
        revenues: revenuesResult.data || [],
        accountsPayable: apResult.data || [],
        forecastedEntries: forecastedResult.data || [],
        transactions: transactionsResult.data || [],
        cmvDRE: cmvDREResult.data || [],
        companies: companies, // Usa companies já carregadas do estado
        cmvChartOfAccounts: cmvChartOfAccounts // Usa cmvChartOfAccounts (constante)
      };

      console.log('✅ Dados completos carregados para MonthlyComparison:', {
        revenues: newData.revenues.length,
        accountsPayable: newData.accountsPayable.length,
        transactions: newData.transactions.length,
        forecastedEntries: newData.forecastedEntries.length,
        cmvDRE: newData.cmvDRE.length,
        companies: newData.companies.length,
        hasActiveImports
      });

      setMonthlyComparisonData(newData);
    } catch (error) {
      console.error('❌ Erro ao carregar dados para MonthlyComparison:', error);
    }
  };

  // Carregar dados do MonthlyComparison quando companies for carregado ou quando houver novas importações
  // Também recarregar quando filtros de empresas/grupos mudarem
  useEffect(() => {
    // Só carregar se companies já foi carregado
    if (companies.length > 0) {
      loadMonthlyComparisonData();
    }
  }, [companies.length, filters.companies, filters.groups]); // Recarregar quando companies ou filtros mudarem
  
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
    <div className={`flex h-screen ${darkMode ? 'bg-slate-950 text-slate-50' : 'bg-[#ECF7FA] text-slate-900'} ${presentationMode ? 'fixed inset-0 z-50' : ''}`}>
      {!presentationMode && (
      <Sidebar
        filters={filters}
        onFiltersChange={setFilters}
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
      />
      )}
      
      <div className="flex-1 overflow-auto scrollbar-vertical">
        <div className={`${presentationMode ? 'p-4' : 'p-8'}`}>
          {presentationMode && (
            <div className="flex justify-between items-center mb-4">
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Dashboard Financeiro - Rede Tem Preço & X Brother</h1>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDarkMode(prev => !prev)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 hover:bg-white shadow-sm border border-slate-200 text-xs font-medium text-gray-700 transition-colors"
                  title={darkMode ? 'Usar tema claro' : 'Usar tema escuro'}
                >
                  {darkMode ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Tema claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-slate-700" />
                      <span>Tema escuro</span>
                    </>
                  )}
                </button>
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
                <button
                  type="button"
                  onClick={() => setDarkMode(prev => !prev)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 hover:bg-white shadow-sm border border-slate-200 text-xs font-medium text-gray-700 transition-colors"
                  title={darkMode ? 'Usar tema claro' : 'Usar tema escuro'}
                >
                  {darkMode ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Tema claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-slate-700" />
                      <span>Tema escuro</span>
                    </>
                  )}
                </button>
                {currentPage === 'import' && importRole !== 'none' && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportRole('none');
                      setImportAuthError('');
                      // Desativar desbloqueio permanente ao sair
                      setIsPermanentlyUnlocked(false);
                      localStorage.removeItem('importPermanentlyUnlocked');
                    }}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 shadow-sm"
                  >
                    Sair
                  </button>
                )}
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
                      <button
                        onClick={() => openKPIDetail('Detalhes: Saldo Inicial', getFilteredInitialBalances, 'mixed')}
                        className={`p-1.5 rounded-lg shadow-sm transition-colors ${
                          darkMode ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-gray-100'
                        }`}
                        title="Ver detalhes"
                      >
                        <List className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={`text-xs block mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Data do Saldo</label>
                        <p className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
                          {kpiData.initialBalance.date
                            ? new Date(kpiData.initialBalance.date).toLocaleDateString('pt-BR')
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
                          Carregado da planilha de saldos bancários
                        </p>
                      </div>
                    </div>
                  </div>
                  {dataLoading ? (
                    <>
                      <CardSkeleton darkMode={darkMode} />
                      <CardSkeleton darkMode={darkMode} />
                      <CardSkeleton darkMode={darkMode} />
                    </>
                  ) : (
                    <>
                      <KPICard
                        title="Total de Recebimentos"
                        forecasted={kpiData.totalInflows.forecasted}
                        actual={kpiData.totalInflows.actual}
                        icon={<ArrowDown className="w-5 h-5" />}
                        color="green"
                        section="cashflow"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: Total de Recebimentos', getFilteredTotalInflows, 'mixed')}
                        dataSource="Carregado das planilhas de receitas e transações financeiras"
                      />
                      <KPICard
                        title="Total de Pagamentos"
                        forecasted={kpiData.totalOutflows.forecasted}
                        actual={kpiData.totalOutflows.actual}
                        icon={<ArrowUp className="w-5 h-5" />}
                        color="red"
                        section="cashflow"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: Total de Pagamentos', getFilteredTotalOutflows, 'mixed')}
                        dataSource="Carregado das planilhas de contas a pagar e transações financeiras"
                      />
                      <KPICard
                        title="Saldo Final"
                        forecasted={kpiData.finalBalance.forecasted}
                        actual={kpiData.finalBalance.actual}
                        icon={<DollarSign className="w-5 h-5" />}
                        color="purple"
                        section="cashflow"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: Saldo Final', getFilteredFinalBalance, 'mixed')}
                        dataSource="Calculado: Saldo Inicial + Recebimentos - Pagamentos"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Result Delivery Cards */}
              <div className="mb-8">
                <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Entrega de Resultado</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {dataLoading ? (
                    <>
                      <CardSkeleton darkMode={darkMode} />
                      <CardSkeleton darkMode={darkMode} />
                      <CardSkeleton darkMode={darkMode} />
                      <CardSkeleton darkMode={darkMode} />
                    </>
                  ) : (
                    <>
                      <KPICard
                        title="Receita Direta"
                        forecasted={kpiData.directRevenue.forecasted}
                        actual={kpiData.directRevenue.actual}
                        icon={<TrendingUp className="w-5 h-5" />}
                        color="yellow"
                        section="result"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: Receita Direta', getFilteredRevenues, 'revenues')}
                        dataSource="Carregado da planilha de receitas"
                      />
                      <KPICard
                        title="CMV DRE"
                        forecasted={kpiData.cogs.forecasted}
                        actual={kpiData.cogs.actual}
                        percentage={kpiData.cogs.percentageOfRevenue}
                        icon={<Pill className="w-5 h-5" />}
                        color="orange"
                        section="result"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: CMV', getFilteredCMVDRE, 'mixed')}
                        dataSource="Carregado de contas a pagar (categoria: 04.0DESPESAS COM MERCADORIA)"
                      />
                      <KPICard
                        title="Total de Despesas"
                        forecasted={kpiData.totalExpenses.forecasted}
                        actual={kpiData.totalExpenses.actual}
                        icon={<Calculator className="w-5 h-5" />}
                        color="red"
                        section="result"
                        darkMode={darkMode}
                        onViewDetails={() => openKPIDetail('Detalhes: Total de Despesas', getFilteredExpenses, 'mixed')}
                        dataSource="Carregado das planilhas de contas a pagar, previstos e transações financeiras"
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
                        onViewDetails={() => openKPIDetail('Detalhes: Resultado Operacional', getFilteredOperationalResult, 'mixed')}
                        dataSource="Calculado: Receita Direta - CMV - Total de Despesas"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Calendar and Chart Section */}
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

              {/* Monthly Comparison */}
              {dataLoading ? (
                <PageLoader darkMode={darkMode} message="Carregando comparação mensal..." />
              ) : (
                <MonthlyComparison 
                  rawData={monthlyComparisonRawData} 
                  darkMode={darkMode} 
                />
              )}
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
                />
              )}
            </>
          )}

          {currentPage === 'import' && (
            <div className="space-y-4">
              {importRole === 'none' ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className={`max-w-md w-full shadow-lg rounded-xl border p-6 ${
                    darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
                  }`}>
                    <h2 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                      Área restrita de importação
                    </h2>
                    <p className={`text-xs mb-4 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                      Para acessar a importação de dados, escolha o tipo de
                      acesso e informe o código correspondente.
                    </p>
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget as HTMLFormElement);
                        const code = String(formData.get('accessCode') || '').trim();
                        const role = String(formData.get('role') || 'user') as
                          | 'user'
                          | 'admin';
                        if (!code) {
                          setImportAuthError('Informe o código de acesso.');
                          return;
                        }
                        const expectedCode =
                          role === 'admin' ? IMPORT_ADMIN_CODE : IMPORT_USER_CODE;
                        if (code !== expectedCode) {
                          setImportAuthError('Código inválido para o tipo selecionado.');
                          return;
                        }
                        setImportRole(role);
                        setImportAuthError('');
                      }}
                    >
                      <div>
                        <span className={`block text-xs font-medium mb-1 ${darkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                          Tipo de acesso
                        </span>
                        <div className="flex items-center gap-4 text-xs">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name="role"
                              value="user"
                              defaultChecked
                              className={`h-3 w-3 text-blue-500 ${darkMode ? 'border-slate-600' : 'border-gray-300'}`}
                            />
                            <span>Usuário (visualização / importação)</span>
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name="role"
                              value="admin"
                              className={`h-3 w-3 text-blue-500 ${darkMode ? 'border-slate-600' : 'border-gray-300'}`}
                            />
                            <span>Admin (todas as ações)</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="accessCode"
                          className={`block text-xs font-medium mb-1 ${darkMode ? 'text-slate-200' : 'text-gray-700'}`}
                        >
                          Código de acesso
                        </label>
                        <div className="relative">
                          <input
                            id="accessCode"
                            name="accessCode"
                            type={showAccessCode ? 'text' : 'password'}
                            className={`w-full rounded-md px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              darkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-300'
                            }`}
                            placeholder="Digite o código"
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAccessCode(prev => !prev)}
                            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                            title={showAccessCode ? 'Ocultar código' : 'Mostrar código'}
                            tabIndex={-1}
                          >
                            {showAccessCode ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      {importAuthError && (
                        <p className="text-xs text-red-600">{importAuthError}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Entrar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <DataImport
                  onFileUpload={handleDataImport}
                  onFileSelectWithMode={handleFileSelectWithMode}
                  importedFiles={importedFiles}
                  onDeleteFile={handleDeleteFile}
                  onRestoreFile={handleRestoreFile}
                  onPermanentDeleteFile={handlePermanentDeleteFile}
                  onEmptyTrash={handleEmptyTrash}
                  isAdmin={importRole === 'admin'}
                  darkMode={darkMode}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <KPIDetailModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        data={modalState.data}
        type={modalState.type}
        loadPaginatedData={modalState.loadPaginatedData}
      />

      <ImportModeModal
        isOpen={importModeModal.isOpen}
        onClose={() => setImportModeModal({ ...importModeModal, isOpen: false })}
        onAccumulate={() => {
          setImportModeModal({ ...importModeModal, isOpen: false });
          setConfirmAccumulateModal({
            isOpen: true,
            fileName: importModeModal.fileName,
            fileType: importModeModal.fileType,
            pendingFile: importModeModal.pendingFile,
            pendingType: importModeModal.pendingType,
            pendingIndex: importModeModal.pendingIndex,
            pendingTotal: importModeModal.pendingTotal
          });
        }}
        onOverwrite={() => {
          setImportModeModal({ ...importModeModal, isOpen: false });
          setOverwriteModal({
            isOpen: true,
            fileName: importModeModal.fileName,
            fileType: importModeModal.fileType,
            existingImportId: null,
            pendingFile: importModeModal.pendingFile,
            pendingType: importModeModal.pendingType,
            pendingIndex: importModeModal.pendingIndex,
            pendingTotal: importModeModal.pendingTotal
          });
        }}
        fileName={importModeModal.fileName}
      />

      <ConfirmAccumulateModal
        isOpen={confirmAccumulateModal.isOpen}
        onClose={() => setConfirmAccumulateModal({ ...confirmAccumulateModal, isOpen: false })}
        onConfirm={async () => {
          if (confirmAccumulateModal.pendingFile && confirmAccumulateModal.pendingType) {
            setConfirmAccumulateModal({ ...confirmAccumulateModal, isOpen: false });
            await handleDataImport(
              confirmAccumulateModal.pendingFile,
              confirmAccumulateModal.pendingType as any,
              confirmAccumulateModal.pendingIndex,
              confirmAccumulateModal.pendingTotal,
              false, // shouldOverwrite
              true // shouldAccumulate
            );
          }
        }}
        fileName={confirmAccumulateModal.fileName}
      />

      <ConfirmOverwriteModal
        isOpen={overwriteModal.isOpen}
        onClose={() => setOverwriteModal({ ...overwriteModal, isOpen: false })}
        onConfirm={async () => {
          if (overwriteModal.pendingFile && overwriteModal.pendingType) {
            setOverwriteModal({ ...overwriteModal, isOpen: false });
            await handleDataImport(
              overwriteModal.pendingFile,
              overwriteModal.pendingType as any,
              overwriteModal.pendingIndex,
              overwriteModal.pendingTotal,
              true, // shouldOverwrite
              false // shouldAccumulate
            );
          }
        }}
        fileName={overwriteModal.fileName}
        fileType={overwriteModal.fileType}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />

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

export default App;