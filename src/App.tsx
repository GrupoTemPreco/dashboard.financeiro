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
import { ErrorModal } from './components/ErrorModal';
import { FinancialRecord, Filters, ImportedFile } from './types/financial';
import { processExcelFile, processCompaniesFile, processAccountsPayableFile, processRevenuesFile, processFinancialTransactionsFile, processForecastedEntriesFile, processRevenuesDREFile, processCMVDREFile, processInitialBalancesFile, validateFileFormat } from './utils/excelProcessor';
import { filterData, calculateKPIs } from './utils/dataProcessor';
import { DollarSign, TrendingUp, Pill, ArrowDown, ArrowUp, Calculator, Target, List, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { supabase } from './lib/supabase';

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
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
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
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    data: any[];
    type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed';
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

  // Test Supabase connection on mount
  useEffect(() => {
    testSupabaseConnection();
  }, []);

  // Load data from Supabase on mount
  useEffect(() => {
    loadDataFromSupabase();
    loadImportsFromSupabase();
  }, []);

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

  const loadDataFromSupabase = async () => {
    console.log('🔄 Starting to load data from Supabase...');
    try {
      // Load companies
      console.log('📊 Loading companies...');
      const { data: companiesData, error: companiesError } = await supabase
        .from('empresas')
        .select('*')
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

      // Load accounts payable
      let apData: any[] | null = [];
      if (hasActiveImports) {
        // Carregar todos os registros em lotes se necessário
        let allData: any[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('contas_a_pagar')
            .select('*')
            .in('import_id', activeImportIds)
            .order('payment_date', { ascending: false })
            .range(offset, offset + batchSize - 1);
          
          if (error) {
            console.error('❌ Error loading accounts payable batch:', error);
            throw error;
          }
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize; // Se retornou menos que o batch, não há mais
          } else {
            hasMore = false;
          }
        }
        
        apData = allData;
      }
      if (apData) {
        setAccountsPayable(apData);
      }

      // Load revenues
      let revenuesData: any[] | null = [];
      if (hasActiveImports) {
        const { data, error } = await supabase
          .from('receitas')
          .select('*')
          .in('import_id', activeImportIds)
          .order('payment_date', { ascending: false });

        if (error) throw error;
        revenuesData = data;
      }
      if (revenuesData) {
        console.log('Loaded revenues from Supabase:', revenuesData);
        setRevenues(revenuesData);
      }

      // Load financial transactions
      let transactionsData: any[] | null = [];
      if (hasActiveImports) {
        try {
          const { data, error } = await supabase
            .from('transacoes_financeiras')
            .select('*')
            .in('import_id', activeImportIds)
            .order('transaction_date', { ascending: false });

          if (error) {
            console.warn('⚠️ Error loading financial transactions (table may not exist):', error);
            transactionsData = [];
          } else {
            transactionsData = data;
          }
        } catch (err) {
          console.warn('⚠️ Exception loading financial transactions:', err);
          transactionsData = [];
        }
      }
      if (transactionsData) {
        setFinancialTransactions(transactionsData);
      }

      // Load forecasted entries
      let forecastedData: any[] | null = [];
      if (hasActiveImports) {
        const { data, error } = await supabase
          .from('previstos')
          .select('*')
          .in('import_id', activeImportIds)
          .order('due_date', { ascending: false });

        if (error) throw error;
        forecastedData = data;
      }
      if (forecastedData) {
        setForecastedEntries(forecastedData);
      }

      // Load revenues DRE
      let revenuesDREData: any[] | null = [];
      if (hasActiveImports) {
        const { data, error } = await supabase
          .from('receitas_dre')
          .select('*')
          .in('import_id', activeImportIds)
          .order('issue_date', { ascending: false });

        if (error) {
          console.error('❌ Error loading revenues DRE:', error);
          throw error;
        }
        revenuesDREData = data;
      }
      if (revenuesDREData) {
        setRevenuesDRE(revenuesDREData);
      }

      // Load CMV DRE
      let cmvDREData: any[] | null = [];
      if (hasActiveImports) {
        const { data, error } = await supabase
          .from('cmv_dre')
          .select('*')
          .in('import_id', activeImportIds)
          .order('issue_date', { ascending: false});

        if (error) {
          console.error('❌ Error loading CMV DRE:', error);
          throw error;
        }
        cmvDREData = data;
      }
      if (cmvDREData) {
        setCmvDRE(cmvDREData);
      }

      // Load initial_balances - carrega TODOS os dados, independente de imports
      // Carregar em bloco separado para garantir execução mesmo se outras tabelas falharem
      try {
        let initialBalancesData: any[] | null = [];
        
        // Carregar todos os saldos iniciais, independente de imports ativos
        const { data, error } = await supabase
          .from('saldos_iniciais')
          .select('*')
          .order('balance_date', { ascending: false });

        if (error) {
          console.error('❌ Error loading initial balances:', error);
          initialBalancesData = [];
        } else {
          initialBalancesData = data || [];
        }
        
        // Sempre definir o estado, mesmo se vazio
        setInitialBalances(initialBalancesData);
      } catch (initialBalanceError) {
        console.error('❌ Exception loading initial balances:', initialBalanceError);
        setInitialBalances([]);
      }

    } catch (error) {
      console.error('Error loading data from Supabase:', error);
    }
  };

  const loadImportsFromSupabase = async () => {
    try {
      const { data: importsData, error } = await supabase
        .from('importacoes')
        .select('*')
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

  const checkDuplicateFile = async (fileName: string, fileType: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('importacoes')
        .select('id')
        .eq('file_name', fileName)
        .eq('file_type', fileType)
        .order('imported_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking duplicate:', error);
        return null;
      }

      // Retorna o ID do primeiro arquivo encontrado (o mais recente)
      return data && data.length > 0 ? data[0].id : null;
    } catch (error) {
      console.error('Error checking duplicate file:', error);
      return null;
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

  const handleDataImport = async (file: File, type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances', currentIndex?: number, totalFiles?: number, shouldOverwrite?: boolean, existingImportId?: string | null) => {
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

    // Verificar duplicatas antes de processar (a menos que seja uma sobreposição confirmada)
    if (!shouldOverwrite) {
      const duplicateImportId = await checkDuplicateFile(file.name, type);
      if (duplicateImportId) {
        // Mostrar modal de confirmação
        setOverwriteModal({
          isOpen: true,
          fileName: file.name,
          fileType: type,
          existingImportId: duplicateImportId,
          pendingFile: file,
          pendingType: type,
          pendingIndex: currentIndex,
          pendingTotal: totalFiles
        });
        return; // Não processar ainda, aguardar confirmação do usuário
      }
    }

    // Se deve sobrepor e há um importId existente, deletar os dados antigos
    if (shouldOverwrite && existingImportId) {
      await deleteOldImportData(existingImportId, type);
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

  const getFilteredAccountsPayable = useMemo(() => {
    if (companies.length === 0) {
      return accountsPayable.filter(ap => {
        const dateMatch = (!filters.startDate || ap.payment_date >= filters.startDate) &&
                         (!filters.endDate || ap.payment_date <= filters.endDate);
        return dateMatch;
      });
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    return accountsPayable.filter(ap => {
      const dateMatch = (!filters.startDate || ap.payment_date >= filters.startDate) &&
                       (!filters.endDate || ap.payment_date <= filters.endDate);

      if (!hasActiveFilters) {
        return dateMatch;
      }

      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
      const normalizedBU = normalizeCode(ap.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch;
    });
  }, [accountsPayable, companies, filters]);

  const getFilteredOperationalPayments = useMemo(() => {
    return getFilteredAccountsPayable.filter(ap => {
      // Exclude non-operational accounts
      const isOperational = !nonOperationalAccounts.some(account =>
        ap.chart_of_accounts?.toLowerCase() === account.toLowerCase()
      );
      return isOperational;
    });
  }, [getFilteredAccountsPayable]);

  const getFilteredForecastedEntries = useMemo(() => {
    if (companies.length === 0) {
      return forecastedEntries.filter(entry => {
        const dateMatch = (!filters.startDate || entry.due_date >= filters.startDate) &&
                         (!filters.endDate || entry.due_date <= filters.endDate);
        return dateMatch;
      });
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    if (!hasActiveFilters) {
      return forecastedEntries.filter(entry => {
        const dateMatch = (!filters.startDate || entry.due_date >= filters.startDate) &&
                         (!filters.endDate || entry.due_date <= filters.endDate);
        return dateMatch;
      });
    }

    const filteredCompanyCodes = companies
      .filter(c => {
        const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
        const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
        return groupMatch && companyMatch;
      })
      .map(c => c.company_code);

    const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));

    return forecastedEntries.filter(entry => {
      const dateMatch = (!filters.startDate || entry.due_date >= filters.startDate) &&
                       (!filters.endDate || entry.due_date <= filters.endDate);
      const normalizedBU = normalizeCode(entry.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);
      return companyMatch && dateMatch;
    });
  }, [forecastedEntries, companies, filters]);

  const getFilteredRevenuesFromForecasted = useMemo(() => {
    return getFilteredForecastedEntries.filter(entry =>
      entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro')
    );
  }, [getFilteredForecastedEntries]);

  const getFilteredRevenues = useMemo(() => {
    if (companies.length === 0) {
      return revenues.filter(rev => {
        const dateMatch = (!filters.startDate || rev.payment_date >= filters.startDate) &&
                         (!filters.endDate || rev.payment_date <= filters.endDate);
        return dateMatch;
      });
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    return revenues.filter(rev => {
      const dateMatch = (!filters.startDate || rev.payment_date >= filters.startDate) &&
                       (!filters.endDate || rev.payment_date <= filters.endDate);

      if (!hasActiveFilters) {
        return dateMatch;
      }

      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
      const normalizedBU = normalizeCode(rev.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch;
    });
  }, [revenues, companies, filters]);

  const getFilteredTransactions = useMemo(() => {
    if (companies.length === 0) {
      return financialTransactions.filter(t => {
        const dateMatch = (!filters.startDate || t.transaction_date >= filters.startDate) &&
                         (!filters.endDate || t.transaction_date <= filters.endDate);
        return dateMatch;
      });
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    return financialTransactions.filter(t => {
      const dateMatch = (!filters.startDate || t.transaction_date >= filters.startDate) &&
                       (!filters.endDate || t.transaction_date <= filters.endDate);

      if (!hasActiveFilters) {
        return dateMatch;
      }

      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
      const normalizedBU = normalizeCode(t.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch;
    });
  }, [financialTransactions, companies, filters]);

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
        (t.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase()) ||
         t.description?.toLowerCase().includes(excluded.toLowerCase()))
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


  const openKPIDetail = (title: string, data: any[], type: 'accounts_payable' | 'revenues' | 'transactions' | 'mixed') => {
    setModalState({
      isOpen: true,
      title,
      data,
      type
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      data: [],
      type: 'generic'
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
  const forecastedEntriesTotals = useMemo(() => {
    console.log('Forecasted Entries:', forecastedEntries);

    if (companies.length === 0) {
      const filtered = forecastedEntries.filter(entry => {
        const dateMatch = (!filters.startDate || entry.due_date >= filters.startDate) &&
                         (!filters.endDate || entry.due_date <= filters.endDate);

        const isOperational = !nonOperationalAccounts.some(account =>
          entry.chart_of_accounts?.toLowerCase() === account.toLowerCase()
        );

        // Exclude "Movimento em Dinheiro" as it goes to revenues
        const isNotRevenue = !entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro');

        return dateMatch && isOperational && isNotRevenue;
      });

      const total = filtered.reduce((sum, entry) => sum + (entry.amount || 0), 0);

      return { forecasted: total, actual: 0 };
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    const filtered = forecastedEntries.filter(entry => {
      const dateMatch = (!filters.startDate || entry.due_date >= filters.startDate) &&
                       (!filters.endDate || entry.due_date <= filters.endDate);

      const isOperational = !nonOperationalAccounts.some(account =>
        entry.chart_of_accounts?.toLowerCase() === account.toLowerCase()
      );

      // Exclude "Movimento em Dinheiro" as it goes to revenues
      const isNotRevenue = !entry.chart_of_accounts?.toLowerCase().includes('movimento em dinheiro');

      if (!hasActiveFilters) {
        return dateMatch && isOperational && isNotRevenue;
      }

      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
      const normalizedBU = normalizeCode(entry.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch && isOperational && isNotRevenue;
    });

    const total = filtered.reduce((sum, entry) => sum + (entry.amount || 0), 0);

    return { forecasted: total, actual: 0 };
  }, [forecastedEntries, companies, filters]);

  // Calculate totals from revenues
  const revenueTotals = useMemo(() => {

    // If no companies are registered, show all data
    if (companies.length === 0) {
      const filtered = revenues.filter(rev => {
        const dateMatch = (!filters.startDate || rev.payment_date >= filters.startDate) &&
                         (!filters.endDate || rev.payment_date <= filters.endDate);
        return dateMatch;
      });

      const forecasted = filtered
        .filter(rev => rev.status?.toLowerCase() === 'previsto' || rev.status?.toLowerCase() === 'pendente')
        .reduce((sum, rev) => sum + (rev.amount || 0), 0);

      const forecastedFromEntries = getFilteredRevenuesFromForecasted
        .reduce((sum, entry) => sum + (entry.amount || 0), 0);

      const actual = filtered
        .filter(rev => rev.status?.toLowerCase() === 'realizado')
        .reduce((sum, rev) => sum + (rev.amount || 0), 0);

      console.log('Revenue Forecasted total (no companies):', forecasted, 'From entries:', forecastedFromEntries, 'Revenue Actual total:', actual);

      return { forecasted: forecasted + forecastedFromEntries, actual };
    }

    // If no filters are active, show all data
    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    // Filter by business_unit matching company codes and date range
    const filtered = revenues.filter(rev => {
      const dateMatch = (!filters.startDate || rev.payment_date >= filters.startDate) &&
                       (!filters.endDate || rev.payment_date <= filters.endDate);

      // If no company/group filters are active, include all records (only filter by date)
      if (!hasActiveFilters) {
        return dateMatch;
      }

      // Get filtered company codes based on selected groups and companies
      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      // Normalize company codes for comparison
      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));

      console.log('🔍 Revenue Filter Debug:', {
        selectedGroups: filters.groups,
        selectedCompanies: filters.companies,
        filteredCompanyCodes: filteredCompanyCodes,
        normalizedCompanyCodes: normalizedCompanyCodes
      });

      // Match business_unit with company codes
      const normalizedBU = normalizeCode(rev.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch;
    });

    const forecasted = filtered
      .filter(rev => rev.status?.toLowerCase() === 'previsto' || rev.status?.toLowerCase() === 'pendente')
      .reduce((sum, rev) => sum + (rev.amount || 0), 0);

    const forecastedFromEntries = getFilteredRevenuesFromForecasted
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);

    const actual = filtered
      .filter(rev => rev.status?.toLowerCase() === 'realizado')
      .reduce((sum, rev) => sum + (rev.amount || 0), 0);

    return { forecasted: forecasted + forecastedFromEntries, actual };
  }, [revenues, companies, filters, getFilteredRevenuesFromForecasted]);

  // Calculate totals from financial transactions (positive = inflow, negative = outflow)
  const transactionTotals = useMemo(() => {
    console.log('Financial Transactions:', financialTransactions);

    // If no companies are registered, show all data
    if (companies.length === 0) {
      const filtered = financialTransactions.filter(t => {
        const dateMatch = (!filters.startDate || t.transaction_date >= filters.startDate) &&
                         (!filters.endDate || t.transaction_date <= filters.endDate);

        // Exclude non-operational accounts for outflows
        const isOperational = t.amount >= 0 || !nonOperationalAccounts.some(account =>
          t.chart_of_accounts?.toLowerCase() === account.toLowerCase()
        );

        return dateMatch && isOperational;
      });

      const forecastedInflows = filtered
        .filter(t => t.status?.toLowerCase() === 'previsto' && t.amount > 0)
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const forecastedOutflows = Math.abs(filtered
        .filter(t => t.status?.toLowerCase() === 'previsto' && t.amount < 0)
        .reduce((sum, t) => sum + (t.amount || 0), 0));

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
    }

    // If no filters are active, show all data
    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    // Filter by business_unit matching company codes and date range
    const filtered = financialTransactions.filter(t => {
      const dateMatch = (!filters.startDate || t.transaction_date >= filters.startDate) &&
                       (!filters.endDate || t.transaction_date <= filters.endDate);

      // Exclude non-operational accounts for outflows
      const isOperational = t.amount >= 0 || !nonOperationalAccounts.some(account =>
        t.chart_of_accounts?.toLowerCase() === account.toLowerCase()
      );

      // If no company/group filters are active, include all records (only filter by date)
      if (!hasActiveFilters) {
        return dateMatch && isOperational;
      }

      // Get filtered company codes based on selected groups and companies
      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      // Normalize company codes for comparison
      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));

      // Match business_unit with company codes
      const normalizedBU = normalizeCode(t.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch && isOperational;
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
  }, [financialTransactions, companies, filters]);

  const cmvChartOfAccounts = [
    'Medicamentos Bonificados',
    'Medicamentos Ético',
    'Perfumaria',
    'Medicamentos Multiplos',
    'Despesas com Pagto de Mercadoria (CMV)',
    '04.8 Medicamentos Multiplos'
  ];

  // Filtro de CMV DRE (somente dados da planilha de CMV DRE)
  const getFilteredCMVDRE = useMemo(() => {
    if (companies.length === 0) {
      return cmvDRE.filter(cmv => {
        const dateMatch = (!filters.startDate || cmv.issue_date >= filters.startDate) &&
                         (!filters.endDate || cmv.issue_date <= filters.endDate);
        return dateMatch;
      });
    }

    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    return cmvDRE.filter(cmv => {
      const dateMatch = (!filters.startDate || cmv.issue_date >= filters.startDate) &&
                       (!filters.endDate || cmv.issue_date <= filters.endDate);

      if (!hasActiveFilters) {
        return dateMatch;
      }

      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
      const normalizedBU = normalizeCode(cmv.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch;
    });
  }, [cmvDRE, companies, filters]);


  // Dados detalhados para Resultado Operacional (receita - CMV - despesas)
  const getFilteredOperationalResult = useMemo(() => {
    const revenueData = getFilteredRevenues.map(r => ({
      ...r,
      source: 'revenues',
      type: 'Receita',
      category: 'Receita Direta'
    }));

    // CMV somente da planilha de CMV DRE
    const cmvData = getFilteredCMVDRE.map(item => ({
      ...item,
      source: 'cmv_dre',
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

  // CMV calculado somente da planilha de CMV DRE
  const cmvTotals = useMemo(() => {
    // A planilha de CMV DRE contém apenas registros com status 'pago' (realizado)
    // Não há dados previstos na planilha de CMV DRE
    const actual = getFilteredCMVDRE
      .reduce((sum, cmv) => sum + Math.abs(cmv.amount || 0), 0);

    return {
      forecasted: 0, // Não há dados previstos na planilha de CMV DRE
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
    const expensesFromTransactionsForecasted = getFilteredTransactions
      .filter(t => t.amount < 0 && t.status?.toLowerCase() === 'previsto' &&
        !expensesExclusionList.some(excluded =>
          (t.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase()) ||
           t.description?.toLowerCase().includes(excluded.toLowerCase()))))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    const expensesFromTransactionsActual = getFilteredTransactions
      .filter(t => t.amount < 0 && t.status?.toLowerCase() === 'realizado' &&
        !expensesExclusionList.some(excluded =>
          (t.chart_of_accounts?.toLowerCase().includes(excluded.toLowerCase()) ||
           t.description?.toLowerCase().includes(excluded.toLowerCase()))))
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

    // Calculate initial balance from database - pega o saldo inicial mais recente até a data de início do período
    // Como o saldo inicial é atualizado manualmente todos os dias, devemos pegar o mais recente <= startDate
    const balancesUpToStartDate = (getFilteredInitialBalancesRaw || [])
      .filter(bal => {
        const balanceDate = bal.balance_date;
        if (!balanceDate) return false;
        // Pega saldos até a data de início do período (ou todos se não houver filtro)
        return !filters.startDate || balanceDate <= filters.startDate;
      });

    // Agrupar por bank_name + business_unit e pegar o mais recente de cada grupo
    const latestBalancesByBankAndUnit = balancesUpToStartDate.reduce((acc, bal) => {
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

  // Raw data for MonthlyComparison (NO date filtering - component has its own period filter)
  const monthlyComparisonRawData = useMemo(() => ({
    revenues: revenues,
    accountsPayable: accountsPayable,
    forecastedEntries: forecastedEntries,
    transactions: financialTransactions,
    cmvDRE: cmvDRE,
    companies: companies,
    cmvChartOfAccounts: cmvChartOfAccounts
  }), [revenues, accountsPayable, forecastedEntries, financialTransactions, cmvDRE, companies, cmvChartOfAccounts]);

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
          const category = expense.expense_category || expense.chart_of_accounts || 'Sem categoria';
          categoryExpenses[category] = (categoryExpenses[category] || 0) + (expense.amount || 0);
        });

        // Include forecasted entries
        const dayForecasted = forecastedEntries.filter(e =>
          e.payment_date === day.date && e.chart_of_accounts !== 'Movimento em Dinheiro'
        );

        dayForecasted.forEach(entry => {
          const category = entry.expense_category || entry.chart_of_accounts || 'Sem categoria';
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
            const group = t.chart_of_accounts || t.description || 'Não classificado';
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
            const group = t.chart_of_accounts || t.description || 'Não classificado';
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
                </div>
              </div>

              {/* Result Delivery Cards */}
              <div className="mb-8">
                <h2 className={`text-lg font-bold mb-4 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Entrega de Resultado</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    title="CMV"
                    forecasted={kpiData.cogs.forecasted}
                    actual={kpiData.cogs.actual}
                    percentage={kpiData.cogs.percentageOfRevenue}
                    icon={<Pill className="w-5 h-5" />}
                    color="orange"
                    section="result"
                    darkMode={darkMode}
                    onViewDetails={() => openKPIDetail('Detalhes: CMV', getFilteredCMVDRE, 'mixed')}
                    dataSource="Carregado da planilha de CMV DRE"
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
                  <CashFlowChart data={cashFlowData} darkMode={darkMode} alerts={alertsData} />
                  <CashFlowAlerts data={alertsData} darkMode={darkMode} />
                </div>
              </div>

              {/* Monthly Comparison */}
              <MonthlyComparison 
                rawData={monthlyComparisonRawData} 
                darkMode={darkMode} 
              />
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
              overwriteModal.existingImportId
            );
          }
        }}
        fileName={overwriteModal.fileName}
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