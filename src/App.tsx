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
import { FinancialRecord, Filters } from './types/financial';
import { processExcelFile, processCompaniesFile, processAccountsPayableFile, processRevenuesFile, processFinancialTransactionsFile, processForecastedEntriesFile, processRevenuesDREFile, processCMVDREFile, processInitialBalancesFile, validateFileFormat } from './utils/excelProcessor';
import { filterData, calculateKPIs } from './utils/dataProcessor';
import { DollarSign, TrendingUp, Pill, ArrowDown, ArrowUp, Calculator, Target, List } from 'lucide-react';
import { supabase } from './lib/supabase';

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
  const [loading, setLoading] = useState<{
    isLoading: boolean;
    currentFile?: string;
    currentIndex?: number;
    totalFiles?: number;
    allCompleted?: boolean;
  }>({
    isLoading: false
  });
  const [importedFiles, setImportedFiles] = useState<any[]>([
    // Start with empty imported files list
  ]);
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
    console.log('📍 URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('🔑 Chave anônima configurada:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Sim' : 'Não');
    
    try {
      // Teste básico: verificar se o cliente foi criado
      if (!supabase) {
        throw new Error('Cliente Supabase não foi criado');
      }
      console.log('✅ Cliente Supabase criado com sucesso');

      // Teste de conexão: fazer uma query simples (mesmo que retorne vazio, confirma que a conexão funciona)
      const { error, count } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('❌ Erro na conexão:', error.message);
        console.error('Código do erro:', error.code);
        console.error('Detalhes completos:', error);
        return;
      }

      console.log('✅ Conexão com Supabase funcionando perfeitamente!');
      console.log(`📊 Total de registros na tabela companies: ${count || 0}`);
    } catch (error: any) {
      console.error('❌ Erro ao testar conexão:', error.message);
      console.error('Erro completo:', error);
    }
  };

  const loadDataFromSupabase = async () => {
    console.log('🔄 Starting to load data from Supabase...');
    try {
      // Load companies
      console.log('📊 Loading companies...');
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('❌ Error loading companies:', companiesError);
        throw companiesError;
      }
      if (companiesData) {
        console.log('✅ Loaded companies from Supabase:', companiesData.length, 'records');
        console.log('Companies data:', companiesData);
        setCompanies(companiesData);
      }

      // Load accounts payable
      console.log('💰 Loading accounts payable...');
      const { data: apData, error: apError } = await supabase
        .from('CONTAS A PAGAR')
        .select('*')
        .order('payment_date', { ascending: false });

      if (apError) {
        console.error('❌ Error loading accounts payable:', apError);
        throw apError;
      }
      if (apData) {
        console.log('✅ Loaded accounts payable from Supabase:', apData.length, 'records');
        console.log('Accounts payable data:', apData);
        setAccountsPayable(apData);
      } else {
        console.log('⚠️ No accounts payable data returned');
      }

      // Load revenues
      const { data: revenuesData, error: revenuesError } = await supabase
        .from('revenues')
        .select('*')
        .order('payment_date', { ascending: false });

      if (revenuesError) throw revenuesError;
      if (revenuesData) {
        console.log('Loaded revenues from Supabase:', revenuesData);
        setRevenues(revenuesData);
      }

      // Load financial transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('financial_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;
      if (transactionsData) {
        console.log('Loaded financial transactions from Supabase:', transactionsData);
        setFinancialTransactions(transactionsData);
      }

      // Load forecasted entries
      const { data: forecastedData, error: forecastedError } = await supabase
        .from('PREVISTOS')
        .select('*')
        .order('due_date', { ascending: false });

      if (forecastedError) throw forecastedError;
      if (forecastedData) {
        console.log('Loaded forecasted entries from Supabase:', forecastedData);
        setForecastedEntries(forecastedData);
      }

      // Load revenues DRE
      console.log('📊 Loading revenues DRE...');
      const { data: revenuesDREData, error: revenuesDREError } = await supabase
        .from('revenues_dre')
        .select('*')
        .order('issue_date', { ascending: false });

      if (revenuesDREError) {
        console.error('❌ Error loading revenues DRE:', revenuesDREError);
        throw revenuesDREError;
      }
      if (revenuesDREData) {
        console.log('✅ Loaded revenues DRE from Supabase:', revenuesDREData.length, 'records');
        if (revenuesDREData.length > 0) {
          console.log('📋 Sample revenues DRE data (first 3 records):', revenuesDREData.slice(0, 3));
          console.log('📅 Date range in revenues DRE:', {
            min: revenuesDREData.map((r: any) => r.issue_date).sort()[0],
            max: revenuesDREData.map((r: any) => r.issue_date).sort().reverse()[0]
          });
          console.log('🏢 Business units in revenues DRE:', [...new Set(revenuesDREData.map((r: any) => r.business_unit))]);
        } else {
          console.warn('⚠️ No revenues DRE data found in database');
        }
        setRevenuesDRE(revenuesDREData);
      } else {
        console.warn('⚠️ revenuesDREData is null or undefined');
      }

      // Load CMV DRE
      console.log('📊 Loading CMV DRE...');
      const { data: cmvDREData, error: cmvDREError } = await supabase
        .from('cmv_dre')
        .select('*')
        .order('issue_date', { ascending: false});

      if (cmvDREError) {
        console.error('❌ Error loading CMV DRE:', cmvDREError);
        throw cmvDREError;
      }
      if (cmvDREData) {
        console.log('✅ Loaded CMV DRE from Supabase:', cmvDREData.length, 'records');
        if (cmvDREData.length > 0) {
          console.log('📋 Sample CMV DRE data (first 3 records):', cmvDREData.slice(0, 3));
          console.log('📅 Date range in CMV DRE:', {
            min: cmvDREData.map((c: any) => c.issue_date).sort()[0],
            max: cmvDREData.map((c: any) => c.issue_date).sort().reverse()[0]
          });
          console.log('🏢 Business units in CMV DRE:', [...new Set(cmvDREData.map((c: any) => c.business_unit))]);
        } else {
          console.warn('⚠️ No CMV DRE data found in database');
        }
        setCmvDRE(cmvDREData);
      } else {
        console.warn('⚠️ cmvDREData is null or undefined');
      }

      // Load initial_balances
      console.log('📊 Loading initial balances...');
      const { data: initialBalancesData, error: initialBalancesError } = await supabase
        .from('initial_balances')
        .select('*');

      if (initialBalancesError) {
        console.error('❌ Error loading initial balances:', initialBalancesError);
        throw initialBalancesError;
      }
      if (initialBalancesData) {
        console.log('✅ Loaded initial balances from Supabase:', initialBalancesData.length, 'records');
        setInitialBalances(initialBalancesData);
      }

    } catch (error) {
      console.error('Error loading data from Supabase:', error);
    }
  };

  const loadImportsFromSupabase = async () => {
    try {
      const { data: importsData, error } = await supabase
        .from('imports')
        .select('*')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      if (importsData) {
        const formattedImports = importsData.map((imp: any) => ({
          id: imp.id,
          name: imp.file_name,
          type: imp.file_type,
          uploadDate: imp.imported_at,
          recordCount: imp.record_count,
          status: 'success' as const
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
        .from('imports')
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
          .from('CONTAS A PAGAR')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de contas a pagar deletados');
      } else if (fileType === 'revenues') {
        const { error } = await supabase
          .from('revenues')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de receitas deletados');
      } else if (fileType === 'financial_transactions') {
        const { error } = await supabase
          .from('financial_transactions')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de transações financeiras deletados');
      } else if (fileType === 'forecasted_entries') {
        const { error } = await supabase
          .from('PREVISTOS')
          .delete()
          .eq('import_id', importId);
        if (error) throw error;
        console.log('✅ Dados de lançamentos previstos deletados');
      } else if (fileType === 'revenues_dre') {
        const { error } = await supabase
          .from('revenues_dre')
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
          .from('initial_balances')
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
        .from('imports')
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
        .from('imports')
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
          .from('companies')
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
          .from('CONTAS A PAGAR')
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
          .from('revenues')
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
          .from('financial_transactions')
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
          .from('PREVISTOS')
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
          .from('revenues_dre')
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
          .from('initial_balances')
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
        .from('imports')
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

  const handleDeleteFile = async (fileId: string) => {
    try {
      // Delete the import record (CASCADE will delete related data)
      const { error } = await supabase
        .from('imports')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      // Remove from UI
      setImportedFiles(prev => prev.filter(f => f.id !== fileId));

      // Reload data from Supabase after deletion
      await loadDataFromSupabase();
    } catch (error) {
      console.error('Error deleting import:', error);
      alert('Erro ao excluir importação');
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

  // Dados detalhados para Saldo Inicial (saldos bancários)
  const getFilteredInitialBalances = useMemo(() => {
    return initialBalances.filter(bal => {
      if (companies.length === 0) return true;
      const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;
      if (!hasActiveFilters) return true;

      const filteredCompanyCodes = companies
        .filter(c => {
          const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
          const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
          return groupMatch && companyMatch;
        })
        .map(c => c.company_code);

      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
      const normalizedBU = normalizeCode(bal.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);
      const bankMatch = filters.banks.length === 0 || filters.banks.includes(bal.bank_name);

      return companyMatch && bankMatch;
    });
  }, [initialBalances, companies, filters]);

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

  // Calculate totals from accounts payable
  const accountsPayableTotals = useMemo(() => {
    console.log('Accounts Payable:', accountsPayable);
    console.log('Filters:', filters);
    console.log('Companies:', companies);

    // If no companies are registered, show all data
    if (companies.length === 0) {
      const filtered = accountsPayable.filter(ap => {
        const dateMatch = (!filters.startDate || ap.payment_date >= filters.startDate) &&
                         (!filters.endDate || ap.payment_date <= filters.endDate);

        // Exclude non-operational accounts
        const isOperational = !nonOperationalAccounts.some(account =>
          ap.chart_of_accounts?.toLowerCase() === account.toLowerCase()
        );

        return dateMatch && isOperational;
      });

      const forecasted = filtered
        .filter(ap => ap.status?.toLowerCase() === 'previsto')
        .reduce((sum, ap) => sum + (ap.amount || 0), 0);

      const actual = filtered
        .filter(ap => ap.status?.toLowerCase() === 'realizado')
        .reduce((sum, ap) => sum + (ap.amount || 0), 0);

      // console.log('AP Forecasted total (no companies):', forecasted, 'AP Actual total:', actual);

      return { forecasted, actual };
    }

    // If no filters are active, show all data
    const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;

    // Filter by business_unit matching company codes and date range
    const filtered = accountsPayable.filter(ap => {
      const dateMatch = (!filters.startDate || ap.payment_date >= filters.startDate) &&
                       (!filters.endDate || ap.payment_date <= filters.endDate);

      // Exclude non-operational accounts
      const isOperational = !nonOperationalAccounts.some(account =>
        ap.chart_of_accounts?.toLowerCase() === account.toLowerCase()
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

      // Normalize company codes for comparison (remove leading zeros)
      const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));

      console.log('🔍 AP Filter Debug:', {
        selectedGroups: filters.groups,
        selectedCompanies: filters.companies,
        filteredCompanyCodes: filteredCompanyCodes,
        normalizedCompanyCodes: normalizedCompanyCodes
      });

      // Match business_unit with company codes
      const normalizedBU = normalizeCode(ap.business_unit);
      const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

      return companyMatch && dateMatch && isOperational;
    });

    const forecasted = filtered
      .filter(ap => ap.status?.toLowerCase() === 'previsto')
      .reduce((sum, ap) => sum + (ap.amount || 0), 0);

    const actual = filtered
      .filter(ap => ap.status?.toLowerCase() === 'realizado')
      .reduce((sum, ap) => sum + (ap.amount || 0), 0);

    // console.log('AP Forecasted total:', forecasted, 'AP Actual total:', actual);

    return { forecasted, actual };
  }, [accountsPayable, companies, filters]);

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
    console.log('Revenues:', revenues);

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

    console.log('Revenue Forecasted total:', forecasted, 'From entries:', forecastedFromEntries, 'Revenue Actual total:', actual);

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

      console.log('Transaction totals (no companies) - Inflows:', forecastedInflows, actualInflows, 'Outflows:', forecastedOutflows, actualOutflows);

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

    console.log('Transaction Inflows (Forecasted/Actual):', forecastedInflows, actualInflows);
    console.log('Transaction Outflows (Forecasted/Actual):', forecastedOutflows, actualOutflows);

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

  const getFilteredCMV = useMemo(() => {
    return getFilteredAccountsPayable.filter(ap =>
      cmvChartOfAccounts.some(chartName =>
        ap.chart_of_accounts?.toLowerCase().includes(chartName.toLowerCase())
      )
    );
  }, [getFilteredAccountsPayable]);

  const getFilteredCMVFromForecasted = useMemo(() => {
    return getFilteredForecastedEntries.filter(entry =>
      cmvChartOfAccounts.some(chartName =>
        entry.chart_of_accounts?.toLowerCase().includes(chartName.toLowerCase())
      )
    );
  }, [getFilteredForecastedEntries]);

  const getFilteredCMVFromTransactions = useMemo(() => {
    return getFilteredTransactions.filter(t =>
      cmvChartOfAccounts.some(chartName =>
        t.chart_of_accounts?.toLowerCase().includes(chartName.toLowerCase())
      )
    );
  }, [getFilteredTransactions]);

  // Dados detalhados para Resultado Operacional (receita - CMV - despesas)
  const getFilteredOperationalResult = useMemo(() => {
    const revenueData = getFilteredRevenues.map(r => ({
      ...r,
      source: 'revenues',
      type: 'Receita',
      category: 'Receita Direta'
    }));

    const cmvData = [
      ...getFilteredCMV.map(item => ({
        ...item,
        source: 'accounts_payable',
        type: 'CMV',
        category: 'Custo de Mercadoria Vendida',
        amount: -Math.abs(item.amount || 0) // Negativo para custo
      })),
      ...getFilteredCMVFromForecasted.map(item => ({
        ...item,
        source: 'forecasted_entries',
        type: 'CMV',
        category: 'Custo de Mercadoria Vendida',
        amount: -Math.abs(item.amount || 0)
      })),
      ...getFilteredCMVFromTransactions.map(item => ({
        ...item,
        source: 'transactions',
        type: 'CMV',
        category: 'Custo de Mercadoria Vendida',
        amount: -Math.abs(item.amount || 0)
      }))
    ];

    const expensesData = getFilteredExpenses.map(item => ({
      ...item,
      type: 'Despesa',
      category: 'Despesa Operacional',
      amount: -Math.abs(item.amount || 0) // Negativo para despesa
    }));

    return [...revenueData, ...cmvData, ...expensesData];
  }, [getFilteredRevenues, getFilteredCMV, getFilteredCMVFromForecasted, getFilteredCMVFromTransactions, getFilteredExpenses]);

  const cmvTotals = useMemo(() => {
    const forecastedFromAP = getFilteredCMV
      .filter(ap => ap.status?.toLowerCase() === 'previsto')
      .reduce((sum, ap) => sum + (ap.amount || 0), 0);

    const forecastedFromEntries = getFilteredCMVFromForecasted
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);

    const forecastedFromTransactions = getFilteredCMVFromTransactions
      .filter(t => t.status?.toLowerCase() === 'previsto')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    const actualFromAP = getFilteredCMV
      .filter(ap => ap.status?.toLowerCase() === 'realizado')
      .reduce((sum, ap) => sum + (ap.amount || 0), 0);

    const actualFromTransactions = getFilteredCMVFromTransactions
      .filter(t => t.status?.toLowerCase() === 'realizado')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    return {
      forecasted: forecastedFromAP + forecastedFromEntries + forecastedFromTransactions,
      actual: actualFromAP + actualFromTransactions
    };
  }, [getFilteredCMV, getFilteredCMVFromForecasted, getFilteredCMVFromTransactions]);

  const kpiData = useMemo(() => {
    const baseKpis = calculateKPIs(filteredData);

    console.log('=== KPI CALCULATION ===');
    console.log('Base KPIs:', baseKpis);
    console.log('Accounts Payable Totals:', accountsPayableTotals);
    console.log('Forecasted Entries Totals:', forecastedEntriesTotals);
    console.log('Revenue Totals:', revenueTotals);
    console.log('Transaction Totals:', transactionTotals);
    console.log('CMV Totals:', cmvTotals);

    const totalRevenueForecasted = baseKpis.directRevenue.forecasted + revenueTotals.forecasted;
    const totalRevenueActual = baseKpis.directRevenue.actual + revenueTotals.actual;

    // Add accounts payable to forecasted and actual outflows
    // Add revenues to forecasted and actual inflows
    // Add financial transactions (positive to inflows, negative to outflows)
    const totalInflowsForecasted = baseKpis.totalInflows.forecasted + revenueTotals.forecasted + transactionTotals.inflows.forecasted;
    const totalInflowsActual = baseKpis.totalInflows.actual + revenueTotals.actual + transactionTotals.inflows.actual;
    const totalOutflowsForecasted = baseKpis.totalOutflows.forecasted + accountsPayableTotals.forecasted + forecastedEntriesTotals.forecasted + transactionTotals.outflows.forecasted;
    const totalOutflowsActual = baseKpis.totalOutflows.actual + accountsPayableTotals.actual + transactionTotals.outflows.actual;

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

    // Calculate initial balance from database filtered by company and bank
    const calculatedInitialBalance = initialBalances
      .filter(bal => {
        // Apply company/group filters
        if (companies.length === 0) return true;
        const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;
        if (!hasActiveFilters) return true;

        const filteredCompanyCodes = companies
          .filter(c => {
            const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
            const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
            return groupMatch && companyMatch;
          })
          .map(c => c.company_code);

        const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
        const normalizedBU = normalizeCode(bal.business_unit);
        const companyMatch = normalizedCompanyCodes.includes(normalizedBU);

        // Apply bank filter
        const bankMatch = filters.banks.length === 0 || filters.banks.includes(bal.bank_name);

        return companyMatch && bankMatch;
      })
      .reduce((sum, bal) => sum + parseFloat(bal.balance || 0), 0);

    // Get the earliest balance date for display
    const balanceDates = initialBalances
      .filter(bal => {
        if (companies.length === 0) return true;
        const hasActiveFilters = filters.groups.length > 0 || filters.companies.length > 0;
        if (!hasActiveFilters) return true;

        const filteredCompanyCodes = companies
          .filter(c => {
            const groupMatch = filters.groups.length === 0 || filters.groups.includes(c.group_name);
            const companyMatch = filters.companies.length === 0 || filters.companies.includes(c.company_name);
            return groupMatch && companyMatch;
          })
          .map(c => c.company_code);

        const normalizedCompanyCodes = filteredCompanyCodes.map(code => normalizeCode(code));
        const normalizedBU = normalizeCode(bal.business_unit);
        const companyMatch = normalizedCompanyCodes.includes(normalizedBU);
        const bankMatch = filters.banks.length === 0 || filters.banks.includes(bal.bank_name);

        return companyMatch && bankMatch;
      })
      .map(bal => bal.balance_date)
      .sort();

    const calculatedInitialBalanceDate = balanceDates.length > 0 ? balanceDates[0] : new Date().toISOString().split('T')[0];

    result.initialBalance = {
      forecasted: calculatedInitialBalance,
      actual: calculatedInitialBalance,
      date: calculatedInitialBalanceDate
    };
    result.finalBalance = {
      forecasted: calculatedInitialBalance + totalInflowsForecasted - totalOutflowsForecasted,
      actual: calculatedInitialBalance + totalInflowsActual - totalOutflowsActual
    };

    console.log('Final KPI Data:', result);
    console.log('Calculated Initial Balance:', calculatedInitialBalance);
    console.log('Balance Date:', calculatedInitialBalanceDate);
    console.log('===================');

    return result;
  }, [filteredData, accountsPayableTotals, forecastedEntriesTotals, revenueTotals, transactionTotals, cmvTotals, initialBalances, companies, filters]);

  // Calculate daily cash flow based on actual data from database
  const dailyCashFlow = useMemo(() => {
    // Start from current month (November) and go 90 days forward
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
    const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // Today + 90 days

    const days: any[] = [];
    const initialBalanceValue = kpiData.initialBalance.actual;
    let currentBalance = { forecasted: initialBalanceValue, actual: initialBalanceValue };

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Calculate forecasted inflows for this day (FILTERED)
      const forecastedInflows = [
        ...getFilteredRevenues.filter(r => r.payment_date === dateStr && (r.status?.toLowerCase() === 'previsto' || r.status?.toLowerCase() === 'pendente')),
        ...getFilteredForecastedEntries.filter(e => e.payment_date === dateStr && e.chart_of_accounts === 'Movimento em Dinheiro' && e.status?.toLowerCase() === 'pendente' && e.creditor === 'Orçado'),
        ...getFilteredTransactions.filter(t => t.transaction_date === dateStr && t.amount > 0 && t.status?.toLowerCase() === 'previsto')
      ].reduce((sum, item) => sum + Math.abs(item.amount || 0), 0);

      // Calculate actual inflows for this day (FILTERED)
      const actualInflows = [
        ...getFilteredRevenues.filter(r => r.payment_date === dateStr && r.status?.toLowerCase() === 'realizado'),
        ...getFilteredTransactions.filter(t => t.transaction_date === dateStr && t.amount > 0 && t.status?.toLowerCase() === 'realizado')
      ].reduce((sum, item) => sum + Math.abs(item.amount || 0), 0);

      // Calculate forecasted outflows for this day (FILTERED)
      const forecastedOutflows = [
        ...getFilteredAccountsPayable.filter(ap => ap.payment_date === dateStr && ap.status?.toLowerCase() === 'previsto'),
        ...getFilteredForecastedEntries.filter(e => e.payment_date === dateStr && e.chart_of_accounts !== 'Movimento em Dinheiro'),
        ...getFilteredTransactions.filter(t => t.transaction_date === dateStr && t.amount < 0 && t.status?.toLowerCase() === 'previsto')
      ].reduce((sum, item) => sum + Math.abs(item.amount || 0), 0);

      // Calculate actual outflows for this day (FILTERED)
      const actualOutflows = [
        ...getFilteredAccountsPayable.filter(ap => ap.payment_date === dateStr && ap.status?.toLowerCase() === 'realizado'),
        ...getFilteredTransactions.filter(t => t.transaction_date === dateStr && t.amount < 0 && t.status?.toLowerCase() === 'realizado')
      ].reduce((sum, item) => sum + Math.abs(item.amount || 0), 0);

      days.push({
        date: dateStr,
        forecastedInflows,
        actualInflows,
        forecastedOutflows,
        actualOutflows,
        forecastedBalance: currentBalance.forecasted + forecastedInflows - forecastedOutflows,
        actualBalance: currentBalance.actual + actualInflows - actualOutflows
      });

      // Update running balance for next day
      currentBalance = {
        forecasted: currentBalance.forecasted + forecastedInflows - forecastedOutflows,
        actual: currentBalance.actual + actualInflows - actualOutflows
      };
    }

    return days;
  }, [getFilteredRevenues, getFilteredAccountsPayable, getFilteredForecastedEntries, getFilteredTransactions, filters, kpiData]);

  const calendarData = useMemo(() => {
    const year = calendarDate.year;
    const month = calendarDate.month;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = [];

    // Use the final forecasted balance from KPI (considering all 90 days)
    const finalForecastedBalance = kpiData.finalBalance.forecasted;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = dailyCashFlow.find(d => d.date === dateStr);

      if (dayData) {
        calendarDays.push({
          date: day,
          openingBalance: 0,
          forecastedRevenue: dayData.forecastedInflows,
          forecastedOutflows: dayData.forecastedOutflows,
          forecastedBalance: finalForecastedBalance,
          actualBalance: dayData.actualBalance
        });
      } else {
        calendarDays.push({
          date: day,
          openingBalance: 0,
          forecastedRevenue: 0,
          forecastedOutflows: 0,
          forecastedBalance: finalForecastedBalance,
          actualBalance: 0
        });
      }
    }

    return calendarDays;
  }, [dailyCashFlow, calendarDate.year, calendarDate.month, kpiData.finalBalance.forecasted]);

  const uniqueGroups = useMemo(() => [...new Set(companies.map(c => c.group_name))], [companies]);
  const companiesForSidebar = useMemo(() =>
    companies.map(c => {
      console.log('Mapeando empresa para sidebar:', c);
      const mapped = { name: c.company_name, group: c.group_name, code: c.company_code };
      console.log('Empresa mapeada:', mapped);
      return mapped;
    }),
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

  const monthlyComparisonData = useMemo(() => {
    // Group data by month and year
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    const monthlyDataCurrent: { [key: string]: {
      revenues: number,
      cmv: number,
      loans: number,
      revenuesByUnit: { [unit: string]: number },
      cmvByUnit: { [unit: string]: number }
    } } = {};
    const monthlyDataPrevious: { [key: string]: {
      revenues: number,
      cmv: number,
      loans: number,
      revenuesByUnit: { [unit: string]: number },
      cmvByUnit: { [unit: string]: number }
    } } = {};

    // Helper to initialize month data
    const initMonthData = () => ({
      revenues: 0,
      cmv: 0,
      loans: 0,
      revenuesByUnit: {},
      cmvByUnit: {}
    });

    // Process revenues (Receita Direta) - Only REALIZED - FILTERED
    getFilteredRevenues.forEach(rev => {
      if (rev.payment_date && rev.status?.toLowerCase() === 'realizado') {
        const date = new Date(rev.payment_date);
        const year = date.getFullYear();
        const monthKey = `${date.getMonth() + 1}`.padStart(2, '0'); // 01-12
        const amount = rev.amount || 0;

        const company = companies.find(c => c.company_code === rev.company_code);
        const unit = company?.company_name || 'Não classificado';

        if (year === currentYear) {
          if (!monthlyDataCurrent[monthKey]) monthlyDataCurrent[monthKey] = initMonthData();
          monthlyDataCurrent[monthKey].revenues += amount;
          monthlyDataCurrent[monthKey].revenuesByUnit[unit] = (monthlyDataCurrent[monthKey].revenuesByUnit[unit] || 0) + amount;
        } else if (year === previousYear) {
          if (!monthlyDataPrevious[monthKey]) monthlyDataPrevious[monthKey] = initMonthData();
          monthlyDataPrevious[monthKey].revenues += amount;
          monthlyDataPrevious[monthKey].revenuesByUnit[unit] = (monthlyDataPrevious[monthKey].revenuesByUnit[unit] || 0) + amount;
        }
      }
    });

    // Process CMV from accounts payable - Only REALIZED - FILTERED
    // Use same chart of accounts as KPI calculation
    getFilteredAccountsPayable.forEach(ap => {
      if (ap.payment_date && ap.status?.toLowerCase() === 'realizado') {
        const isCMV = cmvChartOfAccounts.some(chartName =>
          ap.chart_of_accounts?.toLowerCase().includes(chartName.toLowerCase())
        );

        if (isCMV) {
          const date = new Date(ap.payment_date);
          const year = date.getFullYear();
          const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
          const amount = ap.amount || 0;

          const company = companies.find(c => c.company_code === ap.company_code);
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
      }
    });

    // Also process CMV from forecasted entries - Only REALIZED - FILTERED
    getFilteredForecastedEntries.forEach(entry => {
      if (entry.payment_date && entry.status?.toLowerCase() === 'paga') {
        const isCMV = cmvChartOfAccounts.some(chartName =>
          entry.chart_of_accounts?.toLowerCase().includes(chartName.toLowerCase())
        );

        if (isCMV) {
          const date = new Date(entry.payment_date);
          const year = date.getFullYear();
          const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
          const amount = entry.amount || 0;

          const company = companies.find(c => c.company_code === entry.company_code);
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
      }
    });

    // Also process CMV from financial transactions - Only REALIZED - FILTERED
    getFilteredTransactions.forEach(trans => {
      if (trans.transaction_date && trans.status?.toLowerCase() === 'realizado') {
        const isCMV = cmvChartOfAccounts.some(chartName =>
          trans.chart_of_accounts?.toLowerCase().includes(chartName.toLowerCase())
        );

        if (isCMV) {
          const date = new Date(trans.transaction_date);
          const year = date.getFullYear();
          const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
          const amount = Math.abs(trans.amount || 0);

          const company = companies.find(c => c.company_code === trans.company_code);
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
      }
    });

    // Process Loans (Empréstimos) - Only REALIZED
    const loanAccounts = ['Pagamento de Empréstimo', 'Financiamento', 'Pagamento Via Cartão'];

    const processLoans = (items: any[], dateField: string, accountField: string) => {
      items.forEach(item => {
        if (item[dateField] && item[accountField] && item.status?.toLowerCase() === 'realizado') {
          const isLoan = loanAccounts.some(loan =>
            item[accountField]?.toLowerCase().includes(loan.toLowerCase())
          );

          if (isLoan) {
            const date = new Date(item[dateField]);
            const year = date.getFullYear();
            const monthKey = `${date.getMonth() + 1}`.padStart(2, '0');
            const amount = Math.abs(item.amount || 0);

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
    };

    processLoans(getFilteredAccountsPayable, 'payment_date', 'chart_of_accounts');
    processLoans(getFilteredForecastedEntries, 'payment_date', 'chart_of_accounts');
    processLoans(getFilteredTransactions, 'transaction_date', 'description');

    // Convert to array format expected by component
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const result = [];

    for (let month = 1; month <= 12; month++) {
      const monthKey = `${month}`.padStart(2, '0');
      const currentData = monthlyDataCurrent[monthKey] || initMonthData();
      const previousData = monthlyDataPrevious[monthKey] || initMonthData();

      // Calculate debt ratio (loans / revenue * 100)
      const currentDebtRatio = currentData.revenues > 0 ? (currentData.loans / currentData.revenues) * 100 : 0;
      const previousDebtRatio = previousData.revenues > 0 ? (previousData.loans / previousData.revenues) * 100 : 0;

      result.push({
        month: monthNames[month - 1],
        currentYear: {
          revenue: currentData.revenues,
          cogs: currentData.cmv,
          loans: currentData.loans,
          debtRatio: currentDebtRatio,
          revenuesByUnit: currentData.revenuesByUnit,
          cmvByUnit: currentData.cmvByUnit
        },
        previousYear: {
          revenue: previousData.revenues,
          cogs: previousData.cmv,
          loans: previousData.loans,
          debtRatio: previousDebtRatio,
          revenuesByUnit: previousData.revenuesByUnit,
          cmvByUnit: previousData.cmvByUnit
        }
      });
    }

    // Return only last 3 months by default
    return result.slice(-3);
  }, [getFilteredRevenues, getFilteredAccountsPayable, getFilteredForecastedEntries, getFilteredTransactions]);

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

  return (
    <div className={`flex h-screen bg-gray-50 ${presentationMode ? 'fixed inset-0 z-50' : ''}`}>
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
      
      <div className="flex-1 overflow-auto">
        <div className={`${presentationMode ? 'p-4' : 'p-8'}`}>
          {presentationMode && (
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Financeiro - Rede Tem Preço & X Brother</h1>
              <button
                onClick={togglePresentationMode}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Sair do Modo Apresentação
              </button>
            </div>
          )}
          
          {!presentationMode && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Fluxo de Caixa</h1>
            <p className="text-gray-600 mt-2">Visão geral financeira e métricas de desempenho</p>
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
                <h2 className="text-lg font-bold text-gray-800 mb-4">Variação do Fluxo de Caixa</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Initial Balance from Database */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg shadow-md p-6 border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center flex-1">
                        <div className="p-1.5 rounded-lg bg-white shadow-sm text-blue-600">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <h3 className="text-xs font-semibold text-gray-700 ml-2">Saldo Inicial</h3>
                      </div>
                      <button
                        onClick={() => openKPIDetail('Detalhes: Saldo Inicial', getFilteredInitialBalances, 'mixed')}
                        className="p-1.5 rounded-lg bg-white hover:bg-gray-100 shadow-sm transition-colors"
                        title="Ver detalhes"
                      >
                        <List className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Data do Saldo</label>
                        <p className="text-sm font-medium text-gray-700">
                          {kpiData.initialBalance.date
                            ? new Date(kpiData.initialBalance.date).toLocaleDateString('pt-BR')
                            : new Date().toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Saldo Inicial</label>
                        <p className="text-xl font-bold text-blue-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.initialBalance.actual)}
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
                    onViewDetails={() => openKPIDetail('Detalhes: Total de Recebimentos', getFilteredTotalInflows, 'mixed')}
                  />
                  <KPICard
                    title="Total de Pagamentos"
                    forecasted={kpiData.totalOutflows.forecasted}
                    actual={kpiData.totalOutflows.actual}
                    icon={<ArrowUp className="w-5 h-5" />}
                    color="red"
                    section="cashflow"
                    onViewDetails={() => openKPIDetail('Detalhes: Total de Pagamentos', getFilteredTotalOutflows, 'mixed')}
                  />
                  <KPICard
                    title="Saldo Final"
                    forecasted={kpiData.finalBalance.forecasted}
                    actual={kpiData.finalBalance.actual}
                    icon={<DollarSign className="w-5 h-5" />}
                    color="purple"
                    section="cashflow"
                    onViewDetails={() => openKPIDetail('Detalhes: Saldo Final', getFilteredFinalBalance, 'mixed')}
                  />
                </div>
              </div>

              {/* Result Delivery Cards */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Entrega de Resultado</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard
                    title="Receita Direta"
                    forecasted={kpiData.directRevenue.forecasted}
                    actual={kpiData.directRevenue.actual}
                    icon={<TrendingUp className="w-5 h-5" />}
                    color="yellow"
                    section="result"
                    onViewDetails={() => openKPIDetail('Detalhes: Receita Direta', getFilteredRevenues, 'revenues')}
                  />
                  <KPICard
                    title="CMV"
                    forecasted={kpiData.cogs.forecasted}
                    actual={kpiData.cogs.actual}
                    percentage={kpiData.cogs.percentageOfRevenue}
                    icon={<Pill className="w-5 h-5" />}
                    color="orange"
                    section="result"
                    onViewDetails={() => openKPIDetail('Detalhes: CMV', getFilteredCMV, 'accounts_payable')}
                  />
                  <KPICard
                    title="Total de Despesas"
                    forecasted={kpiData.totalExpenses.forecasted}
                    actual={kpiData.totalExpenses.actual}
                    icon={<Calculator className="w-5 h-5" />}
                    color="red"
                    section="result"
                    onViewDetails={() => openKPIDetail('Detalhes: Total de Despesas', getFilteredExpenses, 'mixed')}
                  />
                  <KPICard
                    title="Resultado Operacional"
                    forecasted={kpiData.directRevenue.forecasted - kpiData.cogs.forecasted - kpiData.totalExpenses.forecasted}
                    actual={kpiData.directRevenue.actual - kpiData.cogs.actual - kpiData.totalExpenses.actual}
                    percentage={kpiData.directRevenue.actual !== 0 ? ((kpiData.directRevenue.actual - kpiData.cogs.actual - kpiData.totalExpenses.actual) / kpiData.directRevenue.actual) * 100 : 0}
                    icon={<Target className="w-5 h-5" />}
                    color="indigo"
                    section="result"
                    onViewDetails={() => openKPIDetail('Detalhes: Resultado Operacional', getFilteredOperationalResult, 'mixed')}
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
                  />
                </div>
                <div className="space-y-4">
                  <CashFlowChart data={cashFlowData} />
                  <CashFlowAlerts data={alertsData} />
                </div>
              </div>

              {/* Monthly Comparison */}
              <MonthlyComparison data={monthlyComparisonData} />
            </>
          )}

          {currentPage === 'analytical' && (
            <div className="space-y-8">
              {/* Cash Flow Table */}
              <CashFlowTable data={cashFlowTableData} />

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
            <DREPage
              accountsPayable={accountsPayable}
              financialTransactions={financialTransactions}
              revenuesDRE={revenuesDRE}
              cmvDRE={cmvDRE}
              nonOperationalAccounts={nonOperationalAccounts}
              filters={filters}
              companies={companies}
            />
          )}

          {currentPage === 'import' && (
            <div>
              <DataImport
                onFileUpload={handleDataImport}
                importedFiles={importedFiles}
                onDeleteFile={handleDeleteFile}
              />
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
    </div>
  );
}

export default App;