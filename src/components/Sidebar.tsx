import React, { useRef, useEffect, useMemo } from 'react';
import { Upload, Building2, Users, Calendar, Filter, BarChart3, TrendingUp, Activity, FileText, ChevronLeft, ChevronRight, Maximize, ChevronDown, Check, RefreshCw, X } from 'lucide-react';
import { Filters } from '../types/financial';

// Filtros ocultos por enquanto — cards respondem apenas ao filtro de Empresas (business_unit)
const SHOW_GROUPS_FILTER = false;
const SHOW_BANKS_FILTER = false;

interface SidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  /** Chamado ao clicar em "Aplicar filtro" para o App sempre recarregar (mesmo ao aplicar de novo com a mesma seleção) */
  onFilterApply?: () => void;
  onFileUpload: (file: File) => void;
  companies: { name: string; group: string; code: string }[];
  groups: string[];
  banks: string[];
  currentPage: string;
  onPageChange: (page: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTogglePresentationMode: () => void;
  onRefresh?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  filters,
  onFiltersChange,
  onFilterApply,
  onFileUpload,
  companies,
  groups,
  banks,
  currentPage,
  onPageChange,
  isCollapsed,
  onToggleCollapse,
  onTogglePresentationMode,
  onRefresh
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupDropdownOpen, setGroupDropdownOpen] = React.useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = React.useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = React.useState(false);
  const [periodDropdownOpen, setPeriodDropdownOpen] = React.useState(false);
  const [tempStartDate, setTempStartDate] = React.useState(filters.startDate || '');
  const [tempEndDate, setTempEndDate] = React.useState(filters.endDate || '');
  // Estado pendente: só aplicado ao clicar em "Aplicar filtro" (evita re-render a cada mudança)
  const [pendingCompanies, setPendingCompanies] = React.useState<string[]>(filters.companies);

  // Sincronizar pendentes quando os filtros aplicados mudarem (ex.: após Aplicar ou Limpar)
  useEffect(() => {
    setPendingCompanies(filters.companies);
    setTempStartDate(filters.startDate || '');
    setTempEndDate(filters.endDate || '');
  }, [filters.companies, filters.startDate, filters.endDate]);

  const handleGroupChange = (newGroups: string[]) => {
    const validCompanies = filters.companies.filter(code =>
      availableCompanies.some(c => codeMatches(c.code, code))
    );
    onFiltersChange({
      ...filters,
      groups: newGroups,
      companies: validCompanies
    });
  };

  const handleCompanyChange = (newCompanies: string[]) => {
    setPendingCompanies(newCompanies);
  };

  const handleBankChange = (newBanks: string[]) => {
    onFiltersChange({
      ...filters,
      banks: newBanks
    });
  };

  const availableCompanies = useMemo(() => {
    if (filters.groups.length === 0) return companies;
    return companies.filter(c => filters.groups.includes(c.group));
  }, [companies, filters.groups]);

  const normalizeCode = (code: string) => {
    const s = String(code || '').trim();
    const n = parseInt(s, 10);
    return isNaN(n) ? s : String(n);
  };
  const codeMatches = (a: string, b: string) => a === b || normalizeCode(a) === normalizeCode(b);
  const isCompanySelected = (code: string) => pendingCompanies.some(c => codeMatches(c, code));

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const pages = [
    { id: 'cashflow', name: 'Fluxo de Caixa', icon: TrendingUp },
    { id: 'dre', name: 'DRE', icon: FileText },
    { id: 'import', name: 'Importar Dados', icon: Upload }
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-56'} bg-gradient-to-b from-slate-950 via-blue-900 to-indigo-900 text-white h-full overflow-y-auto scrollbar-vertical shadow-xl transition-all duration-300`}>
      <div className={`${isCollapsed ? 'p-3' : 'p-4'} border-b border-sky-700 flex items-center justify-between`}>
        {!isCollapsed && (
          <div>
            <h1 className="text-lg font-bold text-white">Dashboard Financeiro</h1>
            <p className="text-xs text-sky-200 mt-1">Rede Tem Preço & X Brother</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors"
          title={isCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <div className={`${isCollapsed ? 'p-2' : 'p-4'} space-y-4`}>
        {/* Presentation Mode Button */}
        <div>
          <button
            onClick={onTogglePresentationMode}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-center'} px-3 py-2 bg-sky-500 hover:bg-sky-400 rounded-lg text-white transition-all duration-200 text-sm`}
            title="Modo Apresentação"
          >
            <Maximize className="w-4 h-4" />
            {!isCollapsed && <span className="ml-2">Modo Apresentação</span>}
          </button>
        </div>

        {/* Filters */}
        {!isCollapsed && (
        <div className="space-y-3">
          <div className="flex items-center text-blue-100 font-medium mb-3">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </div>

          {SHOW_GROUPS_FILTER && (
          <>
          {/* Group Filter */}
          <div>
            <label className="flex items-center text-xs font-medium text-blue-100 mb-2">
              <Users className="w-4 h-4 mr-2" />
              Grupos
            </label>
            <div className="relative">
              <button
                onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                className="w-full px-3 py-2 bg-blue-900/70 border border-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filters.groups.length === 0 
                    ? 'Selecionar grupos...' 
                    : `${filters.groups.length} grupo(s) selecionado(s)`
                  }
                </span>
                <ChevronDown className={`w-4 h-4 text-blue-200 transition-transform ${groupDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {groupDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-blue-950/90 border border-blue-800 rounded-md shadow-lg max-h-40 overflow-y-auto scrollbar-vertical backdrop-blur-sm">
                  {groups.map(group => (
                    <label key={group} className="flex items-center px-3 py-2 hover:bg-blue-800 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={filters.groups.includes(group)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleGroupChange([...filters.groups, group]);
                          } else {
                            handleGroupChange(filters.groups.filter(g => g !== group));
                          }
                        }}
                        className="mr-2 rounded"
                      />
                      <span className="text-white">{group}</span>
                    </label>
                  ))}
                </div>
              )}
              {groups.length === 0 && (
                <p className="text-xs text-blue-200 mt-1">Nenhum grupo disponível</p>
              )}
            </div>
          </div>
          </>
          )}

          {/* Company Filter */}
          <div>
            <label className="flex items-center text-xs font-medium text-blue-100 mb-2">
              <Building2 className="w-4 h-4 mr-2" />
              Empresas
            </label>
            <div className="relative">
              <button
                onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                className="w-full px-3 py-2 bg-blue-900/70 border border-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {pendingCompanies.length === 0
                    ? 'Selecionar empresas...'
                    : `${pendingCompanies.length} empresa(s) selecionada(s)`
                  }
                </span>
                <ChevronDown className={`w-4 h-4 text-blue-200 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {companyDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-blue-950/90 border border-blue-800 rounded-md shadow-lg max-h-72 overflow-y-auto scrollbar-vertical backdrop-blur-sm">
                  {availableCompanies.map((company, index) => (
                    <label key={`${company.code}-${company.group}-${index}`} className="flex items-center px-3 py-2 hover:bg-blue-800 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={isCompanySelected(company.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleCompanyChange([...pendingCompanies, String(company.code ?? '').trim()]);
                          } else {
                            handleCompanyChange(pendingCompanies.filter(c => !codeMatches(c, company.code)));
                          }
                        }}
                        className="mr-2 rounded"
                      />
                      <span className="text-white">{company.name} <span className="text-blue-200">({company.code})</span></span>
                    </label>
                  ))}
                </div>
              )}
              {availableCompanies.length === 0 && (
                <div className="px-3 py-2 text-xs text-blue-200">
                  {companies.length === 0 ? 'Importe a planilha de empresas primeiro' : 'Nenhuma empresa disponível para os grupos selecionados'}
                </div>
              )}
            </div>
          </div>

          {SHOW_BANKS_FILTER && (
          <div>
            <label className="flex items-center text-xs font-medium text-blue-100 mb-2">
              <Building2 className="w-4 h-4 mr-2" />
              Bancos
            </label>
            <div className="relative">
              <button
                onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                className="w-full px-3 py-2 bg-blue-900/70 border border-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filters.banks.length === 0
                    ? 'Selecionar bancos...'
                    : `${filters.banks.length} banco(s) selecionado(s)`
                  }
                </span>
                <ChevronDown className={`w-4 h-4 text-blue-200 transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {bankDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-blue-950/90 border border-blue-800 rounded-md shadow-lg max-h-40 overflow-y-auto scrollbar-vertical backdrop-blur-sm">
                  {banks.map((bank, index) => (
                    <label key={`${bank}-${index}`} className="flex items-center px-3 py-2 hover:bg-blue-800 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={filters.banks.includes(bank)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleBankChange([...filters.banks, bank]);
                          } else {
                            handleBankChange(filters.banks.filter(b => b !== bank));
                          }
                        }}
                        className="mr-2 rounded"
                      />
                      <span className="text-white">{bank}</span>
                    </label>
                  ))}
                </div>
              )}
              {banks.length === 0 && (
                <div className="px-3 py-2 text-xs text-blue-200">
                  Importe a planilha de saldos bancários primeiro
                </div>
              )}
            </div>
          </div>
          )}

          {/* Date Range */}
          <div className="space-y-2">
            <label className="flex items-center text-xs font-medium text-blue-100 mb-2">
              <Calendar className="w-4 h-4 mr-2" />
              Período
            </label>
            <div className="relative">
              <button
                onClick={() => {
                  setPeriodDropdownOpen(!periodDropdownOpen);
                  // Sincronizar valores temporários com os filtros atuais ao abrir
                  setTempStartDate(filters.startDate || '');
                  setTempEndDate(filters.endDate || '');
                }}
                className="w-full px-3 py-2 bg-blue-900/70 border border-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {filters.startDate && filters.endDate
                    ? (() => {
                        const formatDate = (dateStr: string) => {
                          const [year, month, day] = dateStr.split('-');
                          return `${day}/${month}/${year}`;
                        };
                        return `${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`;
                      })()
                    : 'Selecione o período...'
                  }
                </span>
                <ChevronDown className={`w-4 h-4 text-blue-200 transition-transform ${periodDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {periodDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-blue-950/90 border border-blue-800 rounded-md shadow-lg p-3 backdrop-blur-sm">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-blue-200 mb-1 block">Data Inicial</label>
                      <input
                        type="date"
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="w-full px-2 py-1 bg-blue-900/70 border border-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-blue-200 mb-1 block">Data Final</label>
                      <input
                        type="date"
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="w-full px-2 py-1 bg-blue-900/70 border border-blue-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
                      />
                    </div>
                    <p className="text-xs text-blue-200">Use &quot;Aplicar filtro&quot; abaixo para aplicar período e demais filtros.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botões globais: aplicam todos os filtros de uma vez (evita re-renders desnecessários) */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  companies: [...pendingCompanies],
                  startDate: tempStartDate.trim(),
                  endDate: tempEndDate.trim()
                });
                onFilterApply?.();
                setPeriodDropdownOpen(false);
                setCompanyDropdownOpen(false);
              }}
              className="flex-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Filter className="w-4 h-4" />
              Aplicar filtro
            </button>
            <button
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  companies: [],
                  startDate: '',
                  endDate: '',
                  banks: []
                });
                setPendingCompanies([]);
                setTempStartDate('');
                setTempEndDate('');
                setPeriodDropdownOpen(false);
                setCompanyDropdownOpen(false);
              }}
              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1"
              title="Limpar filtro"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          </div>
        </div>
        )}

        {/* Click outside to close dropdowns */}
        {(groupDropdownOpen || companyDropdownOpen || bankDropdownOpen || periodDropdownOpen) && (
          <div 
            className="fixed inset-0 z-5" 
            onClick={() => {
              setGroupDropdownOpen(false);
              setCompanyDropdownOpen(false);
              setBankDropdownOpen(false);
              setPeriodDropdownOpen(false);
            }}
          />
        )}

        {/* Page Navigation */}
        <div className="space-y-2">
          {!isCollapsed && (
          <div className="flex items-center text-blue-100 font-medium mb-3">
            <BarChart3 className="w-4 h-4 mr-2" />
            Páginas
          </div>
          )}
          {pages.map(page => {
            const Icon = page.icon;
            return (
              <button
                key={page.id}
                onClick={() => onPageChange(page.id)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-all duration-200 text-sm ${
                  currentPage === page.id
                    ? 'bg-sky-500 text-white shadow-md'
                    : 'text-sky-100 hover:bg-sky-700/70 hover:text-white'
                }`}
                title={isCollapsed ? page.name : undefined}
              >
                <Icon className={`w-4 h-4 ${!isCollapsed ? 'mr-2' : ''}`} />
                {!isCollapsed && page.name}
              </button>
            );
          })}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-all duration-200 text-sm text-sky-100 hover:bg-sky-700/70 hover:text-white`}
              title="Atualizar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${!isCollapsed ? 'mr-2' : ''}`} />
              {!isCollapsed && 'Atualizar Dados'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};