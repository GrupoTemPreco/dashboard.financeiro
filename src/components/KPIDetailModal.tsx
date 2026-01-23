import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';

interface KPIDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  type: 'accounts_payable' | 'revenues' | 'transactions' | 'generic' | 'mixed';
  loadPaginatedData?: (page: number, pageSize: number, filters: {
    status?: string;
    businessUnit?: string;
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
  }) => Promise<{ data: any[]; totalCount: number; hasMore: boolean }>;
}

export const KPIDetailModal: React.FC<KPIDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  type,
  loadPaginatedData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'previsto' | 'realizado'>('all');
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Estados para paginação
  const [loadedData, setLoadedData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 500;

  // Carregar dados iniciais quando o modal abrir ou filtros mudarem
  useEffect(() => {
    if (!isOpen) {
      // Resetar estados quando o modal fechar
      setLoadedData([]);
      setCurrentPage(0);
      setTotalCount(0);
      setHasMore(false);
      setSearchTerm('');
      setStatusFilter('all');
      setBusinessUnitFilter('all');
      setStartDate('');
      setEndDate('');
      return;
    }

    // Se não tiver função de carregamento paginado, usar dados passados diretamente (compatibilidade)
    if (!loadPaginatedData) {
      setLoadedData(data);
      setTotalCount(data.length);
      setHasMore(false);
      return;
    }

    // Carregar primeira página
    const loadInitialData = async () => {
      setIsLoading(true);
      setCurrentPage(0);
      setLoadedData([]);

      try {
        const result = await loadPaginatedData(0, PAGE_SIZE, {
          status: statusFilter,
          businessUnit: businessUnitFilter,
          startDate,
          endDate,
          searchTerm: searchTerm.trim() !== '' ? searchTerm : undefined
        });

        setLoadedData(result.data);
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setLoadedData([]);
        setTotalCount(0);
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [isOpen, loadPaginatedData, statusFilter, businessUnitFilter, startDate, endDate]);

  // Recarregar quando searchTerm mudar (com debounce)
  useEffect(() => {
    if (!isOpen || !loadPaginatedData) return;

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setCurrentPage(0);
      setLoadedData([]);

      try {
        const result = await loadPaginatedData(0, PAGE_SIZE, {
          status: statusFilter,
          businessUnit: businessUnitFilter,
          startDate,
          endDate,
          searchTerm: searchTerm.trim() !== '' ? searchTerm : undefined
        });

        setLoadedData(result.data);
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setLoadedData([]);
        setTotalCount(0);
        setHasMore(false);
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
        status: statusFilter,
        businessUnit: businessUnitFilter,
        startDate,
        endDate,
        searchTerm: searchTerm.trim() !== '' ? searchTerm : undefined
      });

      setLoadedData(prev => [...prev, ...result.data]);
      setCurrentPage(nextPage);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
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

  // Para tipos simples, os dados já vêm filtrados do banco
  // Para mixed, pode precisar de filtro adicional no front (busca de texto)
  const filteredData = useMemo(() => {
    if (!loadPaginatedData) {
      // Modo compatibilidade: usar dados passados diretamente
      return data.filter(item => {
        const matchesSearch = searchTerm === '' ||
          JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' ||
          item.status?.toLowerCase() === statusFilter ||
          (statusFilter === 'realizado' && (item.status?.toLowerCase() === 'paga' || !item.status));

        const matchesBusinessUnit = businessUnitFilter === 'all' ||
          String(item.business_unit) === businessUnitFilter;

        const itemDate = item.payment_date || item.transaction_date || item.due_date || item.balance_date || item.issue_date || item.date || '';
        const matchesStartDate = !startDate || itemDate >= startDate;
        const matchesEndDate = !endDate || itemDate <= endDate;

        return matchesSearch && matchesStatus && matchesBusinessUnit && matchesStartDate && matchesEndDate;
      });
    }

    // Com paginação: os dados já vêm filtrados do banco, mas para mixed pode precisar busca adicional
    if (type === 'mixed' && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      return loadedData.filter(item => 
        JSON.stringify(item).toLowerCase().includes(searchLower)
      );
    }

    return loadedData;
  }, [loadPaginatedData, loadedData, data, searchTerm, statusFilter, businessUnitFilter, startDate, endDate, type]);

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

  const totalAmount = useMemo(() => {
    return filteredData.reduce((sum, item) => {
      // Para saldos iniciais, usar balance se amount não estiver disponível
      const amount = item.amount !== undefined ? item.amount : (item.balance || 0);
      return sum + amount;
    }, 0);
  }, [filteredData]);

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
    } else if (type === 'mixed') {
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
          <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.transaction_date)}</td>
          <td className="px-4 py-3 text-sm text-gray-900 font-semibold text-right">{formatCurrency(Math.abs(item.amount))}</td>
        </tr>
      );
    } else if (type === 'mixed') {
      const getSourceLabel = (source: string) => {
        if (source === 'accounts_payable') return 'Contas a Pagar';
        if (source === 'forecasted_entries') return 'Lançamentos Orçados';
        if (source === 'transactions') return 'Lançamentos Financeiros';
        if (source === 'revenues') return 'Receitas';
        if (source === 'initial_balance') return 'Saldo Inicial';
        if (source === 'cmv_dre') return 'CMV DRE';
        return source || '-';
      };

      const getSupplierOrDescription = () => {
        if (item.bank_name) return item.bank_name;
        if (item.creditor) return item.creditor;
        if (item.supplier) return item.supplier;
        if (item.customer) return item.customer;
        if (item.description) return item.description;
        if (item.type) return item.type;
        return '-';
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
          <td className="px-4 py-3 text-sm text-gray-700">{getSupplierOrDescription()}</td>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Pesquisar em todos os campos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os Status</option>
                <option value="realizado">Realizado</option>
                <option value="previsto">Previsto</option>
              </select>
              <select
                value={businessUnitFilter}
                onChange={(e) => setBusinessUnitFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas as UNs</option>
                {uniqueBusinessUnits.map(unit => (
                  <option key={unit} value={unit}>UN {unit}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
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
                Total: {formatCurrency(totalAmount)}
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
                      <td colSpan={type === 'mixed' ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
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
