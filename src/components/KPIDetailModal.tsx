import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Search, Loader2, ChevronDown } from 'lucide-react';

interface KPIDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed' | 'total_inflows' | 'total_outflows';
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
}

export const KPIDetailModal: React.FC<KPIDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  type,
  loadPaginatedData,
  initialStartDate = '',
  initialEndDate = ''
}) => {
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
      // Resetar estados quando o modal fechar
      setLoadedData([]);
      setCurrentPage(0);
      setTotalCount(0);
      setHasMore(false);
      setTotalSumFromServer(null);
      setSearchTerm('');
      setOriginFilter([]);
      setBusinessUnitFilter([]);
      setSupplierDescriptionFilter([]);
      setStatusFilter([]);
      setStartDate('');
      setEndDate('');
      setDateDropdownOpen(false);
      setOriginDropdownOpen(false);
      setUnitsDropdownOpen(false);
      setSupplierDropdownOpen(false);
      setStatusDropdownOpen(false);
      return;
    }

    // Se não tiver função de carregamento paginado, usar dados passados diretamente (compatibilidade)
    if (!loadPaginatedData) {
      setLoadedData(data);
      setTotalCount(data.length);
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
  }, [isOpen, loadPaginatedData, businessUnitFilter, statusFilter, startDate, endDate, initialStartDate, initialEndDate, appliedFiltersVersion]);

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
  const getSupplierOrDescriptionForItem = useCallback((item: any): string => {
    if (item.source === 'transactions' && (item.descricao != null && item.descricao !== '')) return item.descricao;
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

    if (type === 'mixed' || type === 'total_inflows' || type === 'total_outflows') {
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
    } else if (type === 'mixed' || type === 'total_inflows' || type === 'total_outflows') {
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

        <div className="inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 py-4 bg-white border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="relative lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar campo</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Pesquisar em todos os campos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Multiselect: Origem */}
              {originOptions.length > 0 && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                  <button
                    type="button"
                    onClick={() => { setOriginDropdownOpen(!originDropdownOpen); setUnitsDropdownOpen(false); setSupplierDropdownOpen(false); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <span className="truncate">
                      {originFilter.length === 0 ? 'Todas as origens' : originFilter.length === 1
                        ? originOptions.find(o => o.value === originFilter[0])?.label ?? originFilter[0]
                        : `${originFilter.length} origens`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 ml-2 flex-shrink-0 transition-transform ${originDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {originDropdownOpen && (
                    <div className="absolute z-20 mt-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
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

              {/* Multiselect: UNs */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">UNs</label>
                <button
                  type="button"
                  onClick={() => { setUnitsDropdownOpen(!unitsDropdownOpen); setOriginDropdownOpen(false); setSupplierDropdownOpen(false); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <span className="truncate">
                    {businessUnitFilter.length === 0 ? 'Todas as UNs' : businessUnitFilter.length === 1
                      ? `UN ${businessUnitFilter[0]}`
                      : `${businessUnitFilter.length} UNs`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 ml-2 flex-shrink-0 transition-transform ${unitsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {unitsDropdownOpen && (
                  <div className="absolute z-20 mt-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
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

              {/* Multiselect: Fornecedor/Descrição */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor/Descrição</label>
                <button
                  type="button"
                  onClick={() => { setSupplierDropdownOpen(!supplierDropdownOpen); setOriginDropdownOpen(false); setUnitsDropdownOpen(false); setStatusDropdownOpen(false); setDateDropdownOpen(false); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <span className="truncate">
                    {supplierDescriptionFilter.length === 0 ? 'Todos' : supplierDescriptionFilter.length === 1
                      ? supplierDescriptionFilter[0]
                      : `${supplierDescriptionFilter.length} itens`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 ml-2 flex-shrink-0 transition-transform ${supplierDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {supplierDropdownOpen && (
                  <div className="absolute z-20 mt-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
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

              {/* Multiselect: Status (apenas Total de Pagamentos) */}
              {statusOptions.length > 0 && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <button
                    type="button"
                    onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setOriginDropdownOpen(false); setUnitsDropdownOpen(false); setSupplierDropdownOpen(false); setDateDropdownOpen(false); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <span className="truncate">
                      {statusFilter.length === 0 ? 'Todos os status' : statusFilter.length === 1
                        ? statusOptions.find(o => o.value === statusFilter[0])?.label ?? statusFilter[0]
                        : `${statusFilter.length} status`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 ml-2 flex-shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {statusDropdownOpen && (
                    <div className="absolute z-20 mt-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
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
            </div>

            {/* Período (dropdown sem botão interno) + botão único Aplicar filtros */}
            <div className="flex flex-wrap items-end gap-4 mt-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
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
                  className="w-full sm:w-auto min-w-[240px] px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <span className="truncate">
                    {(startDate || initialStartDate) && (endDate || initialEndDate)
                      ? `${formatDateForDisplay(startDate || initialStartDate)} - ${formatDateForDisplay(endDate || initialEndDate)}`
                      : 'Selecione o período...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 ml-2 flex-shrink-0 transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dateDropdownOpen && (
                  <div className="absolute z-20 mt-1 left-0 w-full sm:w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Data Inicial</label>
                        <input
                          type="date"
                          value={tempStartDate}
                          onChange={(e) => setTempStartDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Data Final</label>
                        <input
                          type="date"
                          value={tempEndDate}
                          onChange={(e) => setTempEndDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Aplicar filtros
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
                className="px-6 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Limpar filtros
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
                      <td colSpan={type === 'mixed' || type === 'total_inflows' || type === 'total_outflows' ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
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

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
