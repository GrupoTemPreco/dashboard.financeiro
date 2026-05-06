import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Search, Loader2, ChevronDown, Pencil, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotificationContext } from '../contexts/NotificationContext';
import { DataSourceNote } from './DataSourceNote';

// Referências estáveis para evitar loop de re-render ao resetar estado (!isOpen)
const EMPTY_ARR: any[] = [];
const EMPTY_ARR_NUM: number[] = [];
const EMPTY_ARR_STR: (number | string)[] = [];

interface KPIDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed' | 'total_inflows' | 'total_outflows' | 'initial_balance';
  loadPaginatedData?: (page: number, pageSize: number, filters: {
    status?: string | string[];
    businessUnit?: string | string[];
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
  }) => Promise<{ data: any[]; totalCount: number; hasMore: boolean; totalSum?: number }>;
  /** Período do dashboard ao abrir o modal (mesmo mês filtrado no card) */
  initialStartDate?: string;
  initialEndDate?: string;
  /** IDs de tabelas/importadores para exibir fonte no modal */
  sourceTables?: string[];
  /** Chamado após salvar receitas manuais (para recarregar dados no App) */
  onReceitasManuaisSaved?: () => void;
  /** Códigos de unidades/empresas válidos (company_code normalizado) para validar ao salvar receitas */
  validUnitCodes?: string[];
  /** Chamado com o id da notificação para exibir o toast na tela (sucesso/erro) */
  onShowToast?: (notificationId: string) => void;
  /** Chamado após salvar saldos iniciais (para recarregar no App) */
  onSaldosIniciaisSaved?: () => void;
  /** Chamado ao clicar em Reload para o App recarregar dados (ex.: Saldo Inicial sem loadPaginatedData) */
  onRefreshDetail?: () => void;
}

export const KPIDetailModal: React.FC<KPIDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  type,
  loadPaginatedData,
  initialStartDate = '',
  initialEndDate = '',
  sourceTables,
  onReceitasManuaisSaved,
  validUnitCodes = [],
  onShowToast,
  onSaldosIniciaisSaved,
  onRefreshDetail
}) => {
  const { addNotification } = useNotificationContext();
  const notify = useCallback((notification: Parameters<typeof addNotification>[0]) => {
    const id = addNotification(notification);
    onShowToast?.(id);
  }, [addNotification, onShowToast]);
  const normalizeUnit = useCallback((v: string) => {
    const s = String(v || '').trim();
    const n = parseInt(s, 10);
    return isNaN(n) ? s : String(n);
  }, []);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState<string[]>([]);
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string[]>([]);
  const [supplierDescriptionFilter, setSupplierDescriptionFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [appliedFiltersVersion, setAppliedFiltersVersion] = useState(0);
  const [editReceitaModalOpen, setEditReceitaModalOpen] = useState(false);
  const [editReceitaSubView, setEditReceitaSubView] = useState<'novos' | 'lancados'>('novos');
  const [editReceitaMode, setEditReceitaMode] = useState<'mes' | 'semana' | 'dia'>('mes');
  const [editReceitaRows, setEditReceitaRows] = useState<Array<{ id: string; status: string; unidade: string; conta: string; descricao: string; data: string; valor: string }>>([]);
  // Estado da aba "Lançados" (já gravados no banco)
  const [lancadosRows, setLancadosRows] = useState<Array<{ dbId: number; status: string; unidade: string; conta: string; descricao: string; data: string; valor: string }>>([]);
  const [lancadosLoading, setLancadosLoading] = useState(false);
  const [lancadosSaving, setLancadosSaving] = useState(false);
  const [lancadosDeletedIds, setLancadosDeletedIds] = useState<number[]>([]);

  // Estados do modal Editar Saldo Inicial (manual, igual receitas)
  const [editSaldoModalOpen, setEditSaldoModalOpen] = useState(false);
  const [editSaldoSubView, setEditSaldoSubView] = useState<'novos' | 'lancados'>('novos');
  const [editSaldoMode, setEditSaldoMode] = useState<'mes' | 'semana' | 'dia'>('mes');
  const [editSaldoRows, setEditSaldoRows] = useState<Array<{ id: string; unidade: string; banco: string; bancoOutro: string; valor: string; data: string }>>([]);
  const [saldoLancadosRows, setSaldoLancadosRows] = useState<Array<{ dbId: number | string; unidade: string; banco: string; valor: string; data: string }>>([]);
  const [saldoLancadosLoading, setSaldoLancadosLoading] = useState(false);
  const [saldoLancadosSaving, setSaldoLancadosSaving] = useState(false);
  const [saldoLancadosDeletedIds, setSaldoLancadosDeletedIds] = useState<(number | string)[]>([]);
  const [savingSaldo, setSavingSaldo] = useState(false);

  // Estados para paginação
  const [loadedData, setLoadedData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalSumFromServer, setTotalSumFromServer] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 500;

  // Ao abrir o modal, usar o mesmo período filtrado no dashboard (a menos que o usuário mude depois)
  useEffect(() => {
    if (isOpen && (initialStartDate || initialEndDate)) {
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
    }
  }, [isOpen, initialStartDate, initialEndDate]);

  // Carregar dados iniciais quando o modal abrir ou filtros mudarem
  useEffect(() => {
    if (!isOpen) {
      // Resetar estados quando o modal fechar (usar refs estáveis para evitar loop de re-render)
      setLoadedData(EMPTY_ARR);
      setCurrentPage(0);
      setTotalCount(0);
      setHasMore(false);
      setTotalSumFromServer(null);
      setSearchTerm('');
      setOriginFilter(EMPTY_ARR);
      setBusinessUnitFilter(EMPTY_ARR);
      setSupplierDescriptionFilter(EMPTY_ARR);
      setStatusFilter(EMPTY_ARR);
      setStartDate('');
      setEndDate('');
      setDateDropdownOpen(false);
      setOriginDropdownOpen(false);
      setUnitsDropdownOpen(false);
      setSupplierDropdownOpen(false);
      setStatusDropdownOpen(false);
      setEditReceitaModalOpen(false);
      setEditReceitaSubView('novos');
      setLancadosRows(EMPTY_ARR);
      setLancadosDeletedIds(EMPTY_ARR_NUM);
      setEditSaldoModalOpen(false);
      setEditSaldoSubView('novos');
      setSaldoLancadosRows(EMPTY_ARR);
      setSaldoLancadosDeletedIds(EMPTY_ARR_STR);
      return;
    }

    // Se não tiver função de carregamento paginado, usar dados passados diretamente (compatibilidade)
    if (!loadPaginatedData) {
      setLoadedData(Array.isArray(data) ? data : EMPTY_ARR);
      setTotalCount(Array.isArray(data) ? data.length : 0);
      setHasMore(false);
      setTotalSumFromServer(null);
      return;
    }

    // Usar período do dashboard ao abrir; depois o que o usuário escolher no modal
    const effectiveStartDate = startDate || initialStartDate;
    const effectiveEndDate = endDate || initialEndDate;

    const loadInitialData = async () => {
      setIsLoading(true);
      setCurrentPage(0);
      setLoadedData([]);

      try {
        const result = await loadPaginatedData(0, PAGE_SIZE, {
          status: statusFilter.length > 0 ? statusFilter : 'all',
          businessUnit: businessUnitFilter.length > 0 ? businessUnitFilter : 'all',
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          searchTerm: searchTerm.trim() !== '' ? searchTerm : undefined
        });

        setLoadedData(result.data);
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setTotalSumFromServer(result.totalSum ?? null);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setLoadedData([]);
        setTotalCount(0);
        setHasMore(false);
        setTotalSumFromServer(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
    // Quando há loadPaginatedData, não depender de `data` para evitar loop (parent pode passar nova ref a cada render)
  }, [isOpen, loadPaginatedData, businessUnitFilter, statusFilter, startDate, endDate, initialStartDate, initialEndDate, appliedFiltersVersion, refreshKey, ...(loadPaginatedData ? [] : [data])]);

  // Recarregar quando searchTerm mudar (com debounce)
  useEffect(() => {
    if (!isOpen || !loadPaginatedData) return;

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setCurrentPage(0);
      setLoadedData([]);

      try {
        const result = await loadPaginatedData(0, PAGE_SIZE, {
          status: statusFilter.length > 0 ? statusFilter : 'all',
          businessUnit: businessUnitFilter.length > 0 ? businessUnitFilter : 'all',
          startDate: startDate || initialStartDate,
          endDate: endDate || initialEndDate,
          searchTerm: searchTerm.trim() !== '' ? searchTerm : undefined
        });

        setLoadedData(result.data);
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setTotalSumFromServer(result.totalSum ?? null);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setLoadedData([]);
        setTotalCount(0);
        setHasMore(false);
        setTotalSumFromServer(null);
      } finally {
        setIsLoading(false);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Função para carregar mais dados
  const loadMore = async () => {
    if (!loadPaginatedData || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const result = await loadPaginatedData(nextPage, PAGE_SIZE, {
        status: statusFilter.length > 0 ? statusFilter : 'all',
        businessUnit: businessUnitFilter.length > 0 ? businessUnitFilter : 'all',
        startDate: startDate || initialStartDate,
        endDate: endDate || initialEndDate,
        searchTerm: searchTerm.trim() !== '' ? searchTerm : undefined
      });

      setLoadedData(prev => [...prev, ...result.data]);
      setCurrentPage(nextPage);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      if (result.totalSum != null) setTotalSumFromServer(result.totalSum);
    } catch (error) {
      console.error('Erro ao carregar mais dados:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return d && m && y ? `${d}/${m}/${y}` : dateStr;
  };

  // Helper para coluna Fornecedor/Descrição (usado no filtro e na tabela)
  // Para receitas (source === 'revenues') usar descricao do lançamento, não o type 'Receita'
  const getSupplierOrDescriptionForItem = useCallback((item: any): string => {
    if (item.descricao != null && item.descricao !== '') return item.descricao;
    if (item.source === 'transactions' && (item.description != null && item.description !== '')) return item.description;
    if (item.bank_name) return item.bank_name;
    if (item.creditor) return item.creditor;
    if (item.supplier) return item.supplier;
    if (item.customer) return item.customer;
    if (item.description) return item.description;
    if (item.type) return item.type;
    if (item.parcela) return `Parcela ${item.parcela}`;
    return '-';
  }, []);

  // Para tipos simples, os dados já vêm filtrados do banco
  // Para mixed/total_inflows/total_outflows: filtros de origem e fornecedor/descrição no client
  const filteredData = useMemo(() => {
    let base = loadPaginatedData ? loadedData : data;

    if (!loadPaginatedData) {
      return base.filter(item => {
        const matchesSearch = searchTerm === '' ||
          JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase());
        const matchesOrigin = originFilter.length === 0 || originFilter.includes('all') || originFilter.includes(item.source);
        const matchesBusinessUnit = businessUnitFilter.length === 0 || businessUnitFilter.includes(String(item.business_unit));
        const itemDate = item.payment_date || item.transaction_date || item.due_date || item.balance_date || item.issue_date || item.date || '';
        const matchesStartDate = !startDate || itemDate >= startDate;
        const matchesEndDate = !endDate || itemDate <= endDate;
        const matchesSupplier = supplierDescriptionFilter.length === 0 || supplierDescriptionFilter.includes(getSupplierOrDescriptionForItem(item));
        return matchesSearch && matchesOrigin && matchesBusinessUnit && matchesStartDate && matchesEndDate && matchesSupplier;
      });
    }

    if (type === 'mixed' || type === 'total_inflows' || type === 'total_outflows' || type === 'initial_balance') {
      if (originFilter.length > 0 && !originFilter.includes('all')) base = base.filter(item => originFilter.includes(item.source));
      if (searchTerm.trim() !== '') {
        const searchLower = searchTerm.toLowerCase();
        base = base.filter(item => JSON.stringify(item).toLowerCase().includes(searchLower));
      }
    }
    if (supplierDescriptionFilter.length > 0) {
      base = base.filter(item => supplierDescriptionFilter.includes(getSupplierOrDescriptionForItem(item)));
    }

    return base;
  }, [loadPaginatedData, loadedData, data, searchTerm, originFilter, businessUnitFilter, supplierDescriptionFilter, startDate, endDate, type, getSupplierOrDescriptionForItem]);

  // Obter business units únicos dos dados carregados
  const uniqueBusinessUnits = useMemo(() => {
    const units = new Set<string>();
    const dataSource = loadPaginatedData ? loadedData : data;
    dataSource.forEach(item => {
      if (item.business_unit) {
        units.add(String(item.business_unit));
      }
    });
    return Array.from(units).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [loadPaginatedData, loadedData, data]);

  // Opções de origem (para mixed, total_inflows e total_outflows)
  const originOptions = useMemo(() => {
    if (type === 'total_inflows') {
      return [
        { value: 'all', label: 'Todas as origens' },
        { value: 'revenues', label: 'Receitas' },
        { value: 'receita_crediario', label: 'Receita Crediário' },
        { value: 'transactions', label: 'Lançamentos Financeiros' }
      ];
    }
    if (type === 'total_outflows') {
      return [
        { value: 'all', label: 'Todas as origens' },
        { value: 'accounts_payable', label: 'Contas a Pagar' },
        { value: 'transactions', label: 'Lançamentos Financeiros' }
      ];
    }
    if (type === 'mixed') {
      return [
        { value: 'all', label: 'Todas as origens' },
        { value: 'revenues', label: 'Receitas' },
        { value: 'receita_crediario', label: 'Receita Crediário' },
        { value: 'transactions', label: 'Lançamentos Financeiros' },
        { value: 'accounts_payable', label: 'Contas a Pagar' },
        { value: 'forecasted_entries', label: 'Lançamentos Orçados' },
        { value: 'initial_balance', label: 'Saldo Inicial' },
        { value: 'cmv_dre', label: 'CMV DRE' }
      ];
    }
    if (type === 'initial_balance') {
      return [{ value: 'initial_balance', label: 'Saldo Inicial' }];
    }
    return [];
  }, [type]);

  // Opções de status (para total_outflows)
  const statusOptions = useMemo(() => {
    if (type === 'total_outflows') {
      return [
        { value: 'previsto', label: 'Previsto' },
        { value: 'pendente', label: 'Pendente' },
        { value: 'realizado', label: 'Realizado' },
        { value: 'pago', label: 'Pago' }
      ];
    }
    return [];
  }, [type]);

  // Valores únicos de Fornecedor/Descrição dos dados carregados
  const uniqueSupplierDescriptions = useMemo(() => {
    const dataSource = loadPaginatedData ? loadedData : data;
    const set = new Set<string>();
    dataSource.forEach(item => {
      const v = getSupplierOrDescriptionForItem(item);
      if (v && v !== '-') set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [loadPaginatedData, loadedData, data, getSupplierOrDescriptionForItem]);

  const totalAmount = useMemo(() => {
    return filteredData.reduce((sum, item) => {
      // Para saldos iniciais, usar balance se amount não estiver disponível
      const amount = item.amount !== undefined ? item.amount : (item.balance || 0);
      return sum + amount;
    }, 0);
  }, [filteredData]);

  // Total exibido: usar soma vinda do servidor (todos os registros) se houver; senão soma da página carregada
  const displayTotal = totalSumFromServer != null ? totalSumFromServer : totalAmount;

  // --- Modal Editar Receitas (Total de Recebimentos) ---
  const getEditReceitaPeriod = useCallback(() => {
    const start = initialStartDate || startDate;
    const end = initialEndDate || endDate;
    if (start && end) return { start, end };
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const first = `${y}-${m}-01`;
    const last = new Date(y, now.getMonth() + 1, 0);
    const lastStr = last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0');
    return { start: first, end: lastStr };
  }, [initialStartDate, initialEndDate, startDate, endDate]);

  const buildInitialRowsForMode = useCallback((mode: 'mes' | 'semana' | 'dia', period: { start: string; end: string }) => {
    const { start, end } = period;
    const rows: Array<{ id: string; status: string; unidade: string; conta: string; descricao: string; data: string; valor: string }> = [];
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    const newId = () => `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const emptyRow = (data: string) => ({
      id: newId(),
      status: 'previsto',
      unidade: '',
      conta: '',
      descricao: '',
      data,
      valor: ''
    });

    if (mode === 'mes') {
      rows.push(emptyRow(start));
    } else if (mode === 'semana') {
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const weekStart = new Date(cur);
        const weekStartStr = weekStart.getFullYear() + '-' + String(weekStart.getMonth() + 1).padStart(2, '0') + '-' + String(weekStart.getDate()).padStart(2, '0');
        rows.push(emptyRow(weekStartStr));
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const d = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
        rows.push(emptyRow(d));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return rows;
  }, []);

  useEffect(() => {
    if (editReceitaModalOpen && type === 'total_inflows') {
      const period = getEditReceitaPeriod();
      setEditReceitaRows(buildInitialRowsForMode(editReceitaMode, period));
    }
  }, [editReceitaModalOpen, type, editReceitaMode, getEditReceitaPeriod, buildInitialRowsForMode]);

  const handleEditReceitaModeChange = (mode: 'mes' | 'semana' | 'dia') => {
    setEditReceitaMode(mode);
    const period = getEditReceitaPeriod();
    setEditReceitaRows(buildInitialRowsForMode(mode, period));
  };

  const updateEditReceitaRow = (id: string, field: string, value: string) => {
    setEditReceitaRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeEditReceitaRow = (id: string) => {
    setEditReceitaRows(prev => prev.filter(r => r.id !== id));
  };

  const addEditReceitaRow = () => {
    const period = getEditReceitaPeriod();
    const lastData = editReceitaRows.length > 0 ? editReceitaRows[editReceitaRows.length - 1].data : period.start;
    setEditReceitaRows(prev => [...prev, {
      id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: 'previsto',
      unidade: '',
      conta: '',
      descricao: '',
      data: lastData,
      valor: ''
    }]);
  };

  const duplicatePreviousMonth = () => {
    const period = getEditReceitaPeriod();
    const [y, m] = period.start.split('-').map(Number);
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEndDate = new Date(prevYear, prevMonth, 0);
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevEndDate.getDate()).padStart(2, '0')}`;
    const prevPeriod = { start: prevStart, end: prevEnd };
    setEditReceitaRows(buildInitialRowsForMode(editReceitaMode, prevPeriod));
    // TODO: carregar dados do mês anterior do Supabase (receitas_manuais) quando a API estiver disponível
  };

  const [savingReceitas, setSavingReceitas] = useState(false);
  const saveEditReceita = async () => {
    const parseValor = (v: string) => {
      if (!v || !v.trim()) return 0;
      const normalized = String(v).replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    };
    const naoEspecificado = 'não especificado';
    const rowsWithData = editReceitaRows.filter(r => r.data || r.unidade?.trim() || r.conta?.trim() || r.descricao?.trim() || r.valor?.trim());
    const invalid = rowsWithData.some(r => !r.data?.trim() || !r.unidade?.trim() || !r.status?.trim() || parseValor(r.valor) <= 0);
    if (rowsWithData.length > 0 && invalid) {
      notify({
        type: 'error',
        title: 'Campos obrigatórios',
        message: 'Em cada linha preencha: Data, Valor, Unidade e Status. Fornecedor/Descrição e Conta podem ficar vazios (serão salvos como "não especificado").'
      });
      return;
    }
    if (validUnitCodes.length > 0) {
      const invalidUnit = editReceitaRows.find(r => r.unidade?.trim() && !validUnitCodes.includes(normalizeUnit(r.unidade)));
      if (invalidUnit) {
        notify({
          type: 'error',
          title: 'Empresa não existe',
          message: `A unidade "${invalidUnit.unidade.trim()}" não existe. Cadastre a empresa antes de lançar.`
        });
        return;
      }
    }
    const payload = editReceitaRows
      .filter(r => r.data?.trim() && r.unidade?.trim() && r.status?.trim() && parseValor(r.valor) > 0)
      .map(r => ({
        status: r.status || 'previsto',
        business_unit: r.unidade.trim(),
        conta: (r.conta || '').trim() || naoEspecificado,
        descricao: (r.descricao || '').trim() || naoEspecificado,
        data: r.data,
        valor: parseValor(r.valor)
      }));
    if (payload.length === 0) {
      setEditReceitaModalOpen(false);
      return;
    }
    setSavingReceitas(true);
    try {
      const { error } = await supabase.from('receitas_manuais').insert(payload);
      if (error) throw error;
      notify({
        type: 'success',
        title: 'Recebimentos salvos',
        message: `${payload.length} lançamento(s) gravado(s) com sucesso.`
      });
      onReceitasManuaisSaved?.();
      setEditReceitaModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar receitas manuais:', err);
      notify({
        type: 'error',
        title: 'Erro ao salvar',
        message: err instanceof Error ? err.message : 'Não foi possível gravar os recebimentos.'
      });
    } finally {
      setSavingReceitas(false);
    }
  };

  // --- Aba "Lançados": carregar e editar o que já está no banco ---
  const fetchLancados = useCallback(async () => {
    const period = getEditReceitaPeriod();
    setLancadosLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('receitas_manuais')
        .select('id, status, business_unit, conta, descricao, data, valor')
        .gte('data', period.start)
        .lte('data', period.end)
        .order('data');
      if (error) throw error;
      setLancadosRows((rows || []).map(r => ({
        dbId: r.id,
        status: r.status || 'previsto',
        unidade: (r as { business_unit?: string; unidade?: string }).business_unit ?? (r as { unidade?: string }).unidade ?? '',
        conta: r.conta || '',
        descricao: r.descricao || '',
        data: r.data || '',
        valor: r.valor != null ? String(r.valor) : ''
      })));
      setLancadosDeletedIds([]);
    } catch (e) {
      console.error('Erro ao carregar lançados:', e);
    } finally {
      setLancadosLoading(false);
    }
  }, [getEditReceitaPeriod]);

  useEffect(() => {
    if (editReceitaModalOpen && type === 'total_inflows' && editReceitaSubView === 'lancados') {
      fetchLancados();
    }
  }, [editReceitaModalOpen, type, editReceitaSubView, fetchLancados]);

  const updateLancadosRow = (dbId: number, field: string, value: string) => {
    setLancadosRows(prev => prev.map(r => r.dbId === dbId ? { ...r, [field]: value } : r));
  };

  const removeLancadosRow = (dbId: number) => {
    setLancadosRows(prev => prev.filter(r => r.dbId !== dbId));
    setLancadosDeletedIds(prev => [...prev, dbId]);
  };

  const saveLancados = async () => {
    const parseValor = (v: string) => {
      if (!v || !v.trim()) return 0;
      const normalized = String(v).replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    };
    const naoEspecificado = 'não especificado';
    const invalid = lancadosRows.some(r => !r.data?.trim() || !r.unidade?.trim() || !r.status?.trim() || parseValor(r.valor) <= 0);
    if (lancadosRows.length > 0 && invalid) {
      notify({
        type: 'error',
        title: 'Campos obrigatórios',
        message: 'Em cada linha preencha: Data, Valor, Unidade e Status. Fornecedor/Descrição e Conta podem ficar vazios (serão salvos como "não especificado").'
      });
      return;
    }
    if (validUnitCodes.length > 0) {
      const invalidUnit = lancadosRows.find(r => r.unidade?.trim() && !validUnitCodes.includes(normalizeUnit(r.unidade)));
      if (invalidUnit) {
        notify({
          type: 'error',
          title: 'Empresa não existe',
          message: `A unidade "${invalidUnit.unidade.trim()}" não existe. Cadastre a empresa antes de lançar.`
        });
        return;
      }
    }
    setLancadosSaving(true);
    try {
      for (const id of lancadosDeletedIds) {
        const { error } = await supabase.from('receitas_manuais').delete().eq('id', id);
        if (error) throw error;
      }
      for (const row of lancadosRows) {
        const { error } = await supabase.from('receitas_manuais').update({
          status: row.status || 'previsto',
          business_unit: row.unidade.trim(),
          conta: (row.conta || '').trim() || naoEspecificado,
          descricao: (row.descricao || '').trim() || naoEspecificado,
          data: row.data,
          valor: parseValor(row.valor),
          updated_at: new Date().toISOString()
        }).eq('id', row.dbId);
        if (error) throw error;
      }
      notify({
        type: 'success',
        title: 'Alterações salvas',
        message: 'Lançados atualizados com sucesso.'
      });
      onReceitasManuaisSaved?.();
      await fetchLancados();
    } catch (err) {
      console.error('Erro ao salvar lançados:', err);
      notify({
        type: 'error',
        title: 'Erro ao salvar',
        message: err instanceof Error ? err.message : 'Não foi possível atualizar os lançados.'
      });
    } finally {
      setLancadosSaving(false);
    }
  };

  // --- Modal Editar Saldo Inicial (manual: unidade, banco, valor, data) ---
  const bankOptionsForSaldo = useMemo(() => {
    if (type !== 'initial_balance') return [];
    const source = loadPaginatedData ? loadedData : data;
    const names = (source || []).map((i: any) => i.bank_name).filter((x: any) => x != null && x !== '');
    const uniq = Array.from(new Set(names)).sort((a, b) => String(a).localeCompare(String(b)));
    return [...uniq, 'Outro'];
  }, [type, loadPaginatedData, loadedData, data]);

  const buildInitialSaldoRows = useCallback((mode: 'mes' | 'semana' | 'dia', period: { start: string; end: string }) => {
    const { start, end } = period;
    const rows: Array<{ id: string; unidade: string; banco: string; bancoOutro: string; valor: string; data: string }> = [];
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const newId = () => `saldo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const emptyRow = (dataStr: string) => ({ id: newId(), unidade: '', banco: '', bancoOutro: '', data: dataStr, valor: '' });
    if (mode === 'mes') {
      rows.push(emptyRow(start));
    } else if (mode === 'semana') {
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const weekStartStr = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
        rows.push(emptyRow(weekStartStr));
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const d = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') + '-' + String(cur.getDate()).padStart(2, '0');
        rows.push(emptyRow(d));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return rows;
  }, []);

  useEffect(() => {
    if (editSaldoModalOpen && type === 'initial_balance') {
      const period = getEditReceitaPeriod();
      setEditSaldoRows(buildInitialSaldoRows(editSaldoMode, period));
    }
  }, [editSaldoModalOpen, type, editSaldoMode, getEditReceitaPeriod, buildInitialSaldoRows]);

  const updateEditSaldoRow = (id: string, field: string, value: string) => {
    setEditSaldoRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const removeEditSaldoRow = (id: string) => {
    setEditSaldoRows(prev => prev.filter(r => r.id !== id));
  };
  const addEditSaldoRow = () => {
    const period = getEditReceitaPeriod();
    const lastData = editSaldoRows.length > 0 ? editSaldoRows[editSaldoRows.length - 1].data : period.start;
    setEditSaldoRows(prev => [...prev, {
      id: `saldo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      unidade: '',
      banco: '',
      bancoOutro: '',
      data: lastData,
      valor: ''
    }]);
  };
  const duplicatePreviousMonthSaldo = () => {
    const period = getEditReceitaPeriod();
    const [y, m] = period.start.split('-').map(Number);
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEndDate = new Date(prevYear, prevMonth, 0);
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevEndDate.getDate()).padStart(2, '0')}`;
    setEditSaldoRows(buildInitialSaldoRows(editSaldoMode, { start: prevStart, end: prevEnd }));
  };

  const saveEditSaldo = async () => {
    const parseValor = (v: string) => {
      if (!v || !v.trim()) return 0;
      const normalized = String(v).replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    };
    // Em "Semana/Dia", a data vem pré-preenchida em todas as linhas.
    // Para permitir salvamento parcial, validamos apenas linhas efetivamente iniciadas.
    const hasMeaningfulInput = (r: { unidade?: string; banco?: string; bancoOutro?: string; valor?: string }) =>
      !!(r.unidade?.trim() || r.banco || r.bancoOutro?.trim() || r.valor?.trim());
    const rowsWithData = editSaldoRows.filter(r => hasMeaningfulInput(r));
    const invalid = rowsWithData.some(r => !r.data?.trim() || !r.unidade?.trim() || parseValor(r.valor) === 0);
    if (rowsWithData.length > 0 && invalid) {
      notify({ type: 'error', title: 'Campos obrigatórios', message: 'Em cada linha preencha: Unidade, Banco (ou Outro), Valor e Data.' });
      return;
    }
    if (validUnitCodes.length > 0) {
      const invalidUnit = editSaldoRows.find(r => r.unidade?.trim() && !validUnitCodes.includes(normalizeUnit(r.unidade)));
      if (invalidUnit) {
        notify({ type: 'error', title: 'Empresa não existe', message: `A unidade "${invalidUnit.unidade.trim()}" não existe. Cadastre a empresa antes de lançar.` });
        return;
      }
    }
    const payload = editSaldoRows
      .filter(r => r.data?.trim() && r.unidade?.trim() && parseValor(r.valor) !== 0)
      .map(r => ({
        business_unit: r.unidade.trim(),
        bank_name: r.banco === 'Outro' ? (r.bancoOutro || '').trim() || 'Outro' : r.banco,
        balance: parseValor(r.valor),
        balance_date: r.data
      }));
    if (payload.length === 0) {
      setEditSaldoModalOpen(false);
      return;
    }
    setSavingSaldo(true);
    try {
      const { error } = await supabase.from('saldos_iniciais').insert(payload);
      if (error) throw error;
      notify({ type: 'success', title: 'Saldos iniciais salvos', message: `${payload.length} lançamento(s) gravado(s) com sucesso.` });
      onSaldosIniciaisSaved?.();
      setEditSaldoModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar saldos iniciais:', err);
      notify({ type: 'error', title: 'Erro ao salvar', message: err instanceof Error ? err.message : 'Não foi possível gravar os saldos.' });
    } finally {
      setSavingSaldo(false);
    }
  };

  const fetchSaldoLancados = useCallback(async () => {
    const period = getEditReceitaPeriod();
    setSaldoLancadosLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('saldos_iniciais')
        .select('id, business_unit, bank_name, balance, balance_date')
        .gte('balance_date', period.start)
        .lte('balance_date', period.end)
        .order('balance_date', { ascending: false });
      if (error) throw error;
      setSaldoLancadosRows((rows || []).map(r => ({
        dbId: r.id,
        unidade: r.business_unit || '',
        banco: r.bank_name || '',
        valor: r.balance != null ? String(r.balance) : '',
        data: r.balance_date || ''
      })));
      setSaldoLancadosDeletedIds([]);
    } catch (e) {
      console.error('Erro ao carregar saldos lançados:', e);
    } finally {
      setSaldoLancadosLoading(false);
    }
  }, [getEditReceitaPeriod]);

  useEffect(() => {
    if (editSaldoModalOpen && type === 'initial_balance' && editSaldoSubView === 'lancados') {
      fetchSaldoLancados();
    }
  }, [editSaldoModalOpen, type, editSaldoSubView, fetchSaldoLancados]);

  const updateSaldoLancadosRow = (dbId: number | string, field: string, value: string) => {
    setSaldoLancadosRows(prev => prev.map(r => r.dbId === dbId ? { ...r, [field]: value } : r));
  };
  const removeSaldoLancadosRow = (dbId: number | string) => {
    setSaldoLancadosRows(prev => prev.filter(r => r.dbId !== dbId));
    setSaldoLancadosDeletedIds(prev => [...prev, dbId]);
  };
  const saveSaldoLancados = async () => {
    const parseValor = (v: string) => {
      if (!v || !v.trim()) return 0;
      const normalized = String(v).replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    };
    const invalid = saldoLancadosRows.some(r => !r.data?.trim() || !r.unidade?.trim() || parseValor(r.valor) === 0);
    if (saldoLancadosRows.length > 0 && invalid) {
      notify({ type: 'error', title: 'Campos obrigatórios', message: 'Em cada linha preencha: Unidade, Banco, Valor e Data.' });
      return;
    }
    if (validUnitCodes.length > 0) {
      const invalidUnit = saldoLancadosRows.find(r => r.unidade?.trim() && !validUnitCodes.includes(normalizeUnit(r.unidade)));
      if (invalidUnit) {
        notify({ type: 'error', title: 'Empresa não existe', message: `A unidade "${invalidUnit.unidade.trim()}" não existe. Cadastre a empresa antes de lançar.` });
        return;
      }
    }
    setSaldoLancadosSaving(true);
    try {
      for (const id of saldoLancadosDeletedIds) {
        const { error } = await supabase.from('saldos_iniciais').delete().eq('id', id);
        if (error) throw error;
      }
      for (const row of saldoLancadosRows) {
        const { error } = await supabase.from('saldos_iniciais').update({
          business_unit: row.unidade.trim(),
          bank_name: (row.banco || '').trim() || 'Outro',
          balance: parseValor(row.valor),
          balance_date: row.data
        }).eq('id', row.dbId);
        if (error) throw error;
      }
      notify({ type: 'success', title: 'Alterações salvas', message: 'Saldos iniciais atualizados com sucesso.' });
      onSaldosIniciaisSaved?.();
      await fetchSaldoLancados();
    } catch (err) {
      console.error('Erro ao salvar saldos lançados:', err);
      notify({ type: 'error', title: 'Erro ao salvar', message: err instanceof Error ? err.message : 'Não foi possível atualizar os saldos.' });
    } finally {
      setSaldoLancadosSaving(false);
    }
  };

  if (!isOpen) return null;

  const renderTableHeaders = () => {
    if (type === 'accounts_payable') {
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UN</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Conta</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Credor</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data Pagamento</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Valor</th>
        </>
      );
    } else if (type === 'revenues') {
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UN</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Conta</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cliente</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data Pagamento</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Valor</th>
        </>
      );
    } else if (type === 'transactions') {
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UN</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Descrição</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Valor</th>
        </>
      );
    } else if (type === 'mixed' || type === 'total_inflows' || type === 'total_outflows') {
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Origem</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">UN</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Conta</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Fornecedor/Descrição</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data</th>
          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Valor</th>
        </>
      );
    }
    return null;
  };

  const renderTableRow = (item: any, index: number) => {
    if (type === 'accounts_payable') {
      return (
        <tr key={index} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              item.status?.toLowerCase() === 'realizado'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {item.status}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.business_unit}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.chart_of_accounts}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.creditor}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.payment_date)}</td>
          <td className="px-4 py-3 text-sm text-gray-900 font-semibold text-right">{formatCurrency(item.amount)}</td>
        </tr>
      );
    } else if (type === 'revenues') {
      return (
        <tr key={index} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              item.status?.toLowerCase() === 'realizado'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {item.status}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.business_unit}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.chart_of_accounts}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.customer}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.payment_date)}</td>
          <td className="px-4 py-3 text-sm text-gray-900 font-semibold text-right">{formatCurrency(item.amount)}</td>
        </tr>
      );
    } else if (type === 'transactions') {
      return (
        <tr key={index} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              item.status?.toLowerCase() === 'realizado'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {item.status}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.business_unit}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.descricao ?? item.description ?? '-'}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.transaction_date)}</td>
          <td className="px-4 py-3 text-sm text-gray-900 font-semibold text-right">{formatCurrency(Math.abs(item.amount))}</td>
        </tr>
      );
    } else if (type === 'mixed' || type === 'total_inflows' || type === 'total_outflows' || type === 'initial_balance') {
      const getSourceLabel = (source: string) => {
        if (source === 'accounts_payable') return 'Contas a Pagar';
        if (source === 'forecasted_entries') return 'Lançamentos Orçados';
        if (source === 'transactions') return 'Lançamentos Financeiros';
        if (source === 'revenues') return 'Receitas';
        if (source === 'receita_crediario') return 'Receita Crediário';
        if (source === 'initial_balance') return 'Saldo Inicial';
        if (source === 'cmv_dre') return 'CMV DRE';
        return source || '-';
      };

      const getDate = () => {
        if (item.balance_date) return formatDate(item.balance_date);
        if (item.payment_date) return formatDate(item.payment_date);
        if (item.due_date) return formatDate(item.due_date);
        if (item.transaction_date) return formatDate(item.transaction_date);
        if (item.issue_date) return formatDate(item.issue_date);
        if (item.date) return formatDate(item.date);
        return '-';
      };

      const getAccountOrCategory = () => {
        if (item.category) return item.category;
        if (item.chart_of_accounts) return item.chart_of_accounts;
        if (item.type) return item.type;
        return '-';
      };

      const getAmount = () => {
        // Para saldos iniciais, usar balance se amount não estiver disponível
        return item.amount !== undefined ? item.amount : (item.balance || 0);
      };

      const getAmountColor = () => {
        const amount = getAmount();
        if (amount < 0) return 'text-red-600';
        if (amount > 0) return 'text-green-600';
        return 'text-gray-900';
      };

      return (
        <tr key={index} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {getSourceLabel(item.source)}
            </span>
          </td>
          <td className="px-4 py-3 text-sm">
            {item.status ? (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.status?.toLowerCase() === 'realizado' || item.status?.toLowerCase() === 'paga'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {item.status}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-gray-700">{item.business_unit || '-'}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{getAccountOrCategory()}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{getSupplierOrDescriptionForItem(item)}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{getDate()}</td>
          <td className={`px-4 py-3 text-sm font-semibold text-right ${getAmountColor()}`}>
            {formatCurrency(getAmount())}
          </td>
        </tr>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-6xl my-8 overflow-visible text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <div className="flex items-center gap-2">
              {type === 'total_inflows' && (
                <button
                  type="button"
                  onClick={() => {
                    const period = getEditReceitaPeriod();
                    setEditReceitaRows(buildInitialRowsForMode(editReceitaMode, period));
                    setEditReceitaModalOpen(true);
                  }}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar recebimentos"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
              {type === 'initial_balance' && (
                <button
                  type="button"
                  onClick={() => {
                    const period = getEditReceitaPeriod();
                    setEditSaldoRows(buildInitialSaldoRows(editSaldoMode, period));
                    setEditSaldoModalOpen(true);
                  }}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar saldos iniciais"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="px-6 py-3 bg-white border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-shrink-0 min-w-[140px] max-w-[200px]">
                <label htmlFor="kpi-detail-search" className="sr-only">Pesquisar campo</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    id="kpi-detail-search"
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  />
                </div>
              </div>

              {originOptions.length > 0 && (
                <div className="relative flex-shrink-0 min-w-[120px]">
                  <label className="sr-only">Origem</label>
                  <button
                    type="button"
                    onClick={() => { setOriginDropdownOpen(!originDropdownOpen); setUnitsDropdownOpen(false); setSupplierDropdownOpen(false); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
                    className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <span className="truncate">
                      {originFilter.length === 0 ? 'Origem' : originFilter.length === 1
                        ? originOptions.find(o => o.value === originFilter[0])?.label ?? originFilter[0]
                        : `${originFilter.length} origens`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 ml-1 flex-shrink-0 transition-transform ${originDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {originDropdownOpen && (
                    <div className="absolute z-[100] mt-1 left-0 w-full min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
                      {originOptions.map(opt => (
                        <label key={opt.value} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={originFilter.includes(opt.value)}
                            onChange={(e) => {
                              if (e.target.checked) setOriginFilter([...originFilter, opt.value]);
                              else setOriginFilter(originFilter.filter(v => v !== opt.value));
                            }}
                            className="mr-2 rounded border-gray-300"
                          />
                          <span className="text-gray-800">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative flex-shrink-0 min-w-[90px]">
                <label className="sr-only">UNs</label>
                <button
                  type="button"
                  onClick={() => { setUnitsDropdownOpen(!unitsDropdownOpen); setOriginDropdownOpen(false); setSupplierDropdownOpen(false); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <span className="truncate">
                    {businessUnitFilter.length === 0 ? 'UNs' : businessUnitFilter.length === 1
                      ? businessUnitFilter[0]
                      : `${businessUnitFilter.length} UNs`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 ml-1 flex-shrink-0 transition-transform ${unitsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {unitsDropdownOpen && (
                  <div className="absolute z-[100] mt-1 left-0 w-full min-w-[140px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
                    {uniqueBusinessUnits.map(unit => (
                      <label key={unit} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={businessUnitFilter.includes(unit)}
                          onChange={(e) => {
                            if (e.target.checked) setBusinessUnitFilter([...businessUnitFilter, unit]);
                            else setBusinessUnitFilter(businessUnitFilter.filter(u => u !== unit));
                          }}
                          className="mr-2 rounded border-gray-300"
                        />
                        <span className="text-gray-800">UN {unit}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative flex-shrink-0 min-w-[100px]">
                <label className="sr-only">Fornecedor/Descrição</label>
                <button
                  type="button"
                  onClick={() => { setSupplierDropdownOpen(!supplierDropdownOpen); setOriginDropdownOpen(false); setUnitsDropdownOpen(false); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <span className="truncate">
                    {supplierDescriptionFilter.length === 0 ? 'Fornec.' : supplierDescriptionFilter.length === 1
                      ? (supplierDescriptionFilter[0].length > 12 ? supplierDescriptionFilter[0].slice(0, 12) + '…' : supplierDescriptionFilter[0])
                      : `${supplierDescriptionFilter.length} itens`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 ml-1 flex-shrink-0 transition-transform ${supplierDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {supplierDropdownOpen && (
                  <div className="absolute z-[100] mt-1 left-0 w-full min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
                    {uniqueSupplierDescriptions.map(val => (
                      <label key={val} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={supplierDescriptionFilter.includes(val)}
                          onChange={(e) => {
                            if (e.target.checked) setSupplierDescriptionFilter([...supplierDescriptionFilter, val]);
                            else setSupplierDescriptionFilter(supplierDescriptionFilter.filter(s => s !== val));
                          }}
                          className="mr-2 rounded border-gray-300"
                        />
                        <span className="text-gray-800 truncate" title={val}>{val}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {statusOptions.length > 0 && (
                <div className="relative flex-shrink-0 min-w-[100px]">
                  <label className="sr-only">Status</label>
                  <button
                    type="button"
                    onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setOriginDropdownOpen(false); setUnitsDropdownOpen(false); setSupplierDropdownOpen(false); setDateDropdownOpen(false); }}
                    className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <span className="truncate">
                      {statusFilter.length === 0 ? 'Status' : statusFilter.length === 1
                        ? statusOptions.find(o => o.value === statusFilter[0])?.label ?? statusFilter[0]
                        : `${statusFilter.length} status`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 ml-1 flex-shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {statusDropdownOpen && (
                    <div className="absolute z-[100] mt-1 left-0 w-full min-w-[140px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
                      {statusOptions.map(opt => (
                        <label key={opt.value} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={statusFilter.includes(opt.value)}
                            onChange={(e) => {
                              if (e.target.checked) setStatusFilter([...statusFilter, opt.value]);
                              else setStatusFilter(statusFilter.filter(s => s !== opt.value));
                            }}
                            className="mr-2 rounded border-gray-300"
                          />
                          <span className="text-gray-800">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative flex-shrink-0 min-w-[200px]">
                <label className="sr-only">Período</label>
                <button
                  type="button"
                  onClick={() => {
                    setDateDropdownOpen(!dateDropdownOpen);
                    setOriginDropdownOpen(false);
                    setUnitsDropdownOpen(false);
                    setSupplierDropdownOpen(false);
                    setStatusDropdownOpen(false);
                    setTempStartDate(startDate || initialStartDate);
                    setTempEndDate(endDate || initialEndDate);
                  }}
                  className="w-full px-3 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <span className="truncate">
                    {(startDate || initialStartDate) && (endDate || initialEndDate)
                      ? `${formatDateForDisplay(startDate || initialStartDate)} - ${formatDateForDisplay(endDate || initialEndDate)}`
                      : 'Período'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 ml-1 flex-shrink-0 transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dateDropdownOpen && (
                  <div className="absolute z-[100] mt-1 left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Data Inicial</label>
                        <input
                          type="date"
                          value={tempStartDate}
                          onChange={(e) => setTempStartDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Data Final</label>
                        <input
                          type="date"
                          value={tempEndDate}
                          onChange={(e) => setTempEndDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStartDate(tempStartDate);
                  setEndDate(tempEndDate);
                  setDateDropdownOpen(false);
                  setOriginDropdownOpen(false);
                  setUnitsDropdownOpen(false);
                  setSupplierDropdownOpen(false);
                  setStatusDropdownOpen(false);
                  setAppliedFiltersVersion(v => v + 1);
                }}
                className="flex-shrink-0 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={() => {
                  setOriginFilter([]);
                  setBusinessUnitFilter([]);
                  setSupplierDescriptionFilter([]);
                  setStatusFilter([]);
                  setStartDate(initialStartDate);
                  setEndDate(initialEndDate);
                  setTempStartDate(initialStartDate);
                  setTempEndDate(initialEndDate);
                  setDateDropdownOpen(false);
                  setOriginDropdownOpen(false);
                  setUnitsDropdownOpen(false);
                  setSupplierDropdownOpen(false);
                  setStatusDropdownOpen(false);
                  setAppliedFiltersVersion(v => v + 1);
                }}
                className="flex-shrink-0 px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-md transition-colors"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  onRefreshDetail?.();
                  setRefreshKey(k => k + 1);
                }}
                className="flex-shrink-0 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Atualizar lista"
                aria-label="Atualizar lista"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {(dateDropdownOpen || originDropdownOpen || unitsDropdownOpen || supplierDropdownOpen || statusDropdownOpen) && (
              <div className="fixed inset-0 z-[9]" aria-hidden onClick={() => { setDateDropdownOpen(false); setOriginDropdownOpen(false); setUnitsDropdownOpen(false); setSupplierDropdownOpen(false); setStatusDropdownOpen(false); }} />
            )}
          </div>

          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {isLoading ? (
                  <span>Carregando...</span>
                ) : (
                  <>
                    Mostrando <span className="font-semibold text-gray-900">{filteredData.length}</span> de <span className="font-semibold text-gray-900">{loadPaginatedData ? totalCount : data.length}</span> registros
                    {loadPaginatedData && hasMore && (
                      <span className="ml-2 text-xs text-gray-500">(carregue mais para ver todos)</span>
                    )}
                  </>
                )}
              </span>
              <span className="text-lg font-bold text-gray-900">
                Total: {formatCurrency(displayTotal)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto" style={{ maxHeight: '60vh' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600">Carregando dados...</span>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {renderTableHeaders()}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.length > 0 ? (
                    filteredData.map((item, index) => renderTableRow(item, index))
                  ) : (
                    <tr>
                      <td colSpan={type === 'mixed' || type === 'total_inflows' || type === 'total_outflows' || type === 'initial_balance' ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {loadPaginatedData && hasMore && !isLoading && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Carregando mais...
                  </>
                ) : (
                  `Carregar mais (${totalCount - filteredData.length} restantes)`
                )}
              </button>
            </div>
          )}

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center">
            {sourceTables && sourceTables.length > 0 && (
              <DataSourceNote tables={sourceTables} darkMode={false} />
            )}
          </div>
        </div>

        {/* Modal Editar Receitas (Total de Recebimentos) - abre ao clicar no lápis */}
        {type === 'total_inflows' && editReceitaModalOpen && (
          <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 py-8">
              <div className="fixed inset-0 bg-black/50" onClick={() => { setEditReceitaModalOpen(false); setEditReceitaSubView('novos'); setLancadosRows([]); setLancadosDeletedIds([]); }} aria-hidden />
              <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl text-left" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-gray-900">Editar recebimentos (receitas manuais)</h3>
                    <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setEditReceitaSubView('novos')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editReceitaSubView === 'novos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        Novos
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditReceitaSubView('lancados')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editReceitaSubView === 'lancados' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        Lançados
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setEditReceitaModalOpen(false); setEditReceitaSubView('novos'); setLancadosRows([]); setLancadosDeletedIds([]); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {editReceitaSubView === 'lancados' ? (
                    <>
                      <p className="text-sm text-gray-600">Lançamentos já gravados no período do filtro. Edite os campos e clique em &quot;Salvar alterações&quot; ou remova linhas com o X.</p>
                      {lancadosLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '50vh' }}>
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase w-12">Nº</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Unidade</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Conta</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Fornecedor/Descrição</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Valor</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-12"></th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {lancadosRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                                      Nenhum lançamento no período.
                                    </td>
                                  </tr>
                                ) : (
                                  lancadosRows.map((row, index) => (
                                    <tr key={row.dbId} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-sm text-gray-600 font-medium">{index + 1}</td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={row.status}
                                          onChange={e => updateLancadosRow(row.dbId, 'status', e.target.value)}
                                          className="w-full min-w-[100px] text-sm text-gray-900 border border-gray-300 rounded-md py-1.5"
                                        >
                                          <option value="previsto">Previsto</option>
                                          <option value="realizado">Realizado</option>
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          value={row.unidade}
                                          onChange={e => updateLancadosRow(row.dbId, 'unidade', e.target.value)}
                                          placeholder="UN"
                                          className="w-full min-w-[80px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          value={row.conta}
                                          onChange={e => updateLancadosRow(row.dbId, 'conta', e.target.value)}
                                          placeholder="Conta"
                                          className="w-full min-w-[120px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          value={row.descricao}
                                          onChange={e => updateLancadosRow(row.dbId, 'descricao', e.target.value)}
                                          placeholder="Fornecedor/Descrição"
                                          className="w-full min-w-[160px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="date"
                                          value={row.data}
                                          onChange={e => updateLancadosRow(row.dbId, 'data', e.target.value)}
                                          className="w-full min-w-[120px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <input
                                          type="text"
                                          value={row.valor}
                                          onChange={e => updateLancadosRow(row.dbId, 'valor', e.target.value)}
                                          placeholder="0,00"
                                          className="w-full min-w-[100px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 text-right"
                                        />
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => removeLancadosRow(row.dbId)}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                          title="Remover lançamento"
                                          aria-label="Remover lançamento"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={saveLancados}
                              disabled={lancadosSaving || (lancadosRows.length === 0 && lancadosDeletedIds.length === 0)}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {lancadosSaving ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                  <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Editar por</label>
                    <div className="flex gap-2">
                      {(['mes', 'semana', 'dia'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleEditReceitaModeChange(mode)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editReceitaMode === mode
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {mode === 'mes' ? 'Mês' : mode === 'semana' ? 'Semana' : 'Dia'}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {editReceitaMode === 'mes' && 'Uma linha com o valor total do mês.'}
                      {editReceitaMode === 'semana' && 'Uma linha por semana no período.'}
                      {editReceitaMode === 'dia' && 'Uma linha por dia no período.'}
                    </p>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '50vh' }}>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase w-12">Nº</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Unidade</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Conta</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Fornecedor/Descrição</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Valor</th>
                          <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {editReceitaRows.map((row, index) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-600 font-medium">{index + 1}</td>
                            <td className="px-3 py-2">
                              <select
                                value={row.status}
                                onChange={e => updateEditReceitaRow(row.id, 'status', e.target.value)}
                                className="w-full min-w-[100px] text-sm text-gray-900 border border-gray-300 rounded-md py-1.5"
                              >
                                <option value="previsto">Previsto</option>
                                <option value="realizado">Realizado</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.unidade}
                                onChange={e => updateEditReceitaRow(row.id, 'unidade', e.target.value)}
                                placeholder="UN"
                                className="w-full min-w-[80px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.conta}
                                onChange={e => updateEditReceitaRow(row.id, 'conta', e.target.value)}
                                placeholder="Conta"
                                className="w-full min-w-[120px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.descricao}
                                onChange={e => updateEditReceitaRow(row.id, 'descricao', e.target.value)}
                                placeholder="Fornecedor/Descrição"
                                className="w-full min-w-[160px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={row.data}
                                onChange={e => updateEditReceitaRow(row.id, 'data', e.target.value)}
                                className="w-full min-w-[120px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="text"
                                value={row.valor}
                                onChange={e => updateEditReceitaRow(row.id, 'valor', e.target.value)}
                                placeholder="0,00"
                                className="w-full min-w-[100px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 text-right"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeEditReceitaRow(row.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Remover linha"
                                aria-label="Remover linha"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={addEditReceitaRow}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar linha
                    </button>
                    <button
                      type="button"
                      onClick={duplicatePreviousMonth}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Duplicar mês anterior
                    </button>
                    <button
                      type="button"
                      onClick={saveEditReceita}
                      disabled={savingReceitas}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {savingReceitas ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                  </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Saldo Inicial (manual: unidade, banco, valor, data) */}
        {type === 'initial_balance' && editSaldoModalOpen && (
          <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 py-8">
              <div className="fixed inset-0 bg-black/50" onClick={() => { setEditSaldoModalOpen(false); setEditSaldoSubView('novos'); setSaldoLancadosRows([]); setSaldoLancadosDeletedIds([]); }} aria-hidden />
              <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl text-left" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-gray-900">Editar saldos iniciais</h3>
                    <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                      <button type="button" onClick={() => setEditSaldoSubView('novos')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editSaldoSubView === 'novos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Novos</button>
                      <button type="button" onClick={() => setEditSaldoSubView('lancados')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editSaldoSubView === 'lancados' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Lançados</button>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setEditSaldoModalOpen(false); setEditSaldoSubView('novos'); setSaldoLancadosRows([]); setSaldoLancadosDeletedIds([]); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {editSaldoSubView === 'lancados' ? (
                    <>
                      <p className="text-sm text-gray-600">Saldos já gravados no período do filtro. Edite e clique em &quot;Salvar alterações&quot; ou remova com o X.</p>
                      {saldoLancadosLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                      ) : (
                        <>
                          <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '50vh' }}>
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase w-12">Nº</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Unidade</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Banco</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Valor</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-12"></th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {saldoLancadosRows.length === 0 ? (
                                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Nenhum saldo no período.</td></tr>
                                ) : (
                                  saldoLancadosRows.map((row, index) => (
                                    <tr key={String(row.dbId)} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-sm text-gray-600 font-medium">{index + 1}</td>
                                      <td className="px-3 py-2">
                                        <input type="text" value={row.unidade} onChange={e => updateSaldoLancadosRow(row.dbId, 'unidade', e.target.value)} placeholder="UN" className="w-full min-w-[80px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5" />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input type="text" value={row.banco} onChange={e => updateSaldoLancadosRow(row.dbId, 'banco', e.target.value)} placeholder="Banco" className="w-full min-w-[120px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5" />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input type="date" value={row.data} onChange={e => updateSaldoLancadosRow(row.dbId, 'data', e.target.value)} className="w-full min-w-[120px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5" />
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <input type="text" value={row.valor} onChange={e => updateSaldoLancadosRow(row.dbId, 'valor', e.target.value)} placeholder="0,00" className="w-full min-w-[100px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 text-right" />
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        <button type="button" onClick={() => removeSaldoLancadosRow(row.dbId)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="Remover"><X className="w-4 h-4" /></button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button type="button" onClick={saveSaldoLancados} disabled={saldoLancadosSaving || (saldoLancadosRows.length === 0 && saldoLancadosDeletedIds.length === 0)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">{saldoLancadosSaving ? 'Salvando...' : 'Salvar alterações'}</button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Editar por</label>
                        <div className="flex gap-2">
                          {(['mes', 'semana', 'dia'] as const).map(mode => (
                            <button key={mode} type="button" onClick={() => { setEditSaldoMode(mode); const period = getEditReceitaPeriod(); setEditSaldoRows(buildInitialSaldoRows(mode, period)); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${editSaldoMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{mode === 'mes' ? 'Mês' : mode === 'semana' ? 'Semana' : 'Dia'}</button>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{editSaldoMode === 'mes' && 'Uma linha com o valor do mês.'}{editSaldoMode === 'semana' && 'Uma linha por semana.'}{editSaldoMode === 'dia' && 'Uma linha por dia.'}</p>
                      </div>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg" style={{ maxHeight: '50vh' }}>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase w-12">Nº</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Unidade</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Banco</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Data</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Valor</th>
                              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {editSaldoRows.map((row, index) => (
                              <tr key={row.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm text-gray-600 font-medium">{index + 1}</td>
                                <td className="px-3 py-2">
                                  <input type="text" value={row.unidade} onChange={e => updateEditSaldoRow(row.id, 'unidade', e.target.value)} placeholder="UN" className="w-full min-w-[80px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5" />
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-col gap-1">
                                    <select value={row.banco} onChange={e => updateEditSaldoRow(row.id, 'banco', e.target.value)} className="w-full min-w-[140px] text-sm text-gray-900 border border-gray-300 rounded-md py-1.5">
                                      {bankOptionsForSaldo.map(b => (<option key={b} value={b}>{b}</option>))}
                                    </select>
                                    {row.banco === 'Outro' && (
                                      <input type="text" value={row.bancoOutro} onChange={e => updateEditSaldoRow(row.id, 'bancoOutro', e.target.value)} placeholder="Nome do banco (ou deixe em branco)" className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <input type="date" value={row.data} onChange={e => updateEditSaldoRow(row.id, 'data', e.target.value)} className="w-full min-w-[120px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5" />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input type="text" value={row.valor} onChange={e => updateEditSaldoRow(row.id, 'valor', e.target.value)} placeholder="0,00" className="w-full min-w-[100px] text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 text-right" />
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <button type="button" onClick={() => removeEditSaldoRow(row.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="Remover"><X className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button type="button" onClick={addEditSaldoRow} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"><Plus className="w-4 h-4" /> Adicionar linha</button>
                        <button type="button" onClick={duplicatePreviousMonthSaldo} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Duplicar mês anterior</button>
                        <button type="button" onClick={saveEditSaldo} disabled={savingSaldo} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">{savingSaldo ? 'Salvando...' : 'Salvar'}</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
