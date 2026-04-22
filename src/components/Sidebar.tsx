import React, { useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Users, Calendar, Filter, BarChart3, TrendingUp, Activity, FileText, ChevronLeft, ChevronRight, Maximize, ChevronDown, Check, RefreshCw, X, Plus, Edit2 } from 'lucide-react';
import { Filters } from '../types/financial';

// Filtro de grupos ativo — filtra por group_name (empresas/lojas do grupo)
const SHOW_GROUPS_FILTER = true;
const SHOW_BANKS_FILTER = false;
const SHOW_REFRESH_BUTTON = false;

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
  onCadastrarEmpresa: () => void;
  /** Se ausente, o item "Editar empresa" não é exibido (apenas admin). */
  onEditarEmpresa?: () => void;
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
  onRefresh,
  onCadastrarEmpresa,
  onEditarEmpresa
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupDropdownOpen, setGroupDropdownOpen] = React.useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = React.useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = React.useState(false);
  const [periodDropdownOpen, setPeriodDropdownOpen] = React.useState(false);
  const [empresasMenuOpen, setEmpresasMenuOpen] = React.useState(false);
  const [empresasMenuPos, setEmpresasMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const empresasNavBtnRef = useRef<HTMLButtonElement | null>(null);
  const [tempStartDate, setTempStartDate] = React.useState(filters.startDate || '');
  const [tempEndDate, setTempEndDate] = React.useState(filters.endDate || '');
  // Estado pendente: todos os filtros só são aplicados ao clicar em "Aplicar filtro"
  const [pendingGroups, setPendingGroups] = React.useState<string[]>(filters.groups);
  const [pendingCompanies, setPendingCompanies] = React.useState<string[]>(filters.companies);
  const [pendingBanks, setPendingBanks] = React.useState<string[]>(filters.banks);

  // Sincronizar pendentes quando os filtros aplicados mudarem (ex.: após Aplicar ou Limpar)
  useEffect(() => {
    setPendingGroups(filters.groups);
    setPendingCompanies(filters.companies);
    setPendingBanks(filters.banks);
    setTempStartDate(filters.startDate || '');
    setTempEndDate(filters.endDate || '');
  }, [filters.groups, filters.companies, filters.banks, filters.startDate, filters.endDate]);

  const handleGroupChange = (newGroups: string[]) => {
    setPendingGroups(newGroups);
    // Remover empresas que não pertencem mais aos grupos selecionados
    const newAvailableCompanies = companies.filter(c => newGroups.length === 0 || newGroups.includes(c.group));
    setPendingCompanies(prev => prev.filter(code => newAvailableCompanies.some(c => codeMatches(c.code, code))));
  };

  const handleCompanyChange = (newCompanies: string[]) => {
    setPendingCompanies(newCompanies);
  };

  const handleBankChange = (newBanks: string[]) => {
    setPendingBanks(newBanks);
  };

  const availableCompanies = useMemo(() => {
    const activeGroups = pendingGroups.length > 0 ? pendingGroups : filters.groups;
    if (activeGroups.length === 0) return companies;
    return companies.filter(c => activeGroups.includes(c.group));
  }, [companies, pendingGroups, filters.groups]);

  const normalizeCode = (code: string) => {
    const s = String(code || '').trim();
    const n = parseInt(s, 10);
    return isNaN(n) ? s : String(n);
  };
  const codeMatches = (a: string, b: string) => a === b || normalizeCode(a) === normalizeCode(b);
  const isCompanySelected = (code: string) => pendingCompanies.some(c => codeMatches(c, code));

  const updateEmpresasMenuPos = useCallback(() => {
    const el = empresasNavBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const menuWidth = 208;
    const vw = window.innerWidth;
    let left = r.right + gap;
    if (left + menuWidth > vw - 8) {
      left = Math.max(8, r.left - menuWidth - gap);
    }
    setEmpresasMenuPos({ top: r.top, left });
  }, []);

  useLayoutEffect(() => {
    if (!empresasMenuOpen) {
      setEmpresasMenuPos(null);
      return;
    }
    updateEmpresasMenuPos();
    const onReposition = () => updateEmpresasMenuPos();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [empresasMenuOpen, updateEmpresasMenuPos]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const pages = [
    { id: 'cashflow', name: 'Fluxo de Caixa', icon: TrendingUp },
    { id: 'dre', name: 'DRE', icon: FileText }
  ];

  return (
    <div
      className={`${isCollapsed ? 'w-16' : 'w-56'} shrink-0 flex flex-col min-h-0 bg-gradient-to-b from-slate-950 via-blue-900 to-indigo-900 text-white h-full overflow-y-auto overflow-x-hidden scrollbar-vertical shadow-xl transition-[width] duration-300`}
    >
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
                  {pendingGroups.length === 0 
                    ? 'Selecionar grupos...' 
                    : `${pendingGroups.length} grupo(s) selecionado(s)`
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
                        checked={pendingGroups.includes(group)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleGroupChange([...pendingGroups, group]);
                          } else {
                            handleGroupChange(pendingGroups.filter(g => g !== group));
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
                    ? 'Selecionar empresa(s)...'
                    : pendingCompanies.length === 1
                      ? (() => {
                          const code = pendingCompanies[0];
                          const c = availableCompanies.find(x => codeMatches(x.code, code));
                          return c ? c.name : code;
                        })()
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
                          const code = String(company.code ?? '').trim();
                          if (e.target.checked) {
                            handleCompanyChange([...pendingCompanies, code]);
                          } else {
                            handleCompanyChange(pendingCompanies.filter(c => !codeMatches(c, code)));
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
                  {pendingBanks.length === 0
                    ? 'Selecionar bancos...'
                    : `${pendingBanks.length} banco(s) selecionado(s)`
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
                        checked={pendingBanks.includes(bank)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleBankChange([...pendingBanks, bank]);
                          } else {
                            handleBankChange(pendingBanks.filter(b => b !== bank));
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

          {/* Botões Aplicar/Limpar — acima do Período para o dropdown não escondê-los */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  groups: [...pendingGroups],
                  companies: [...pendingCompanies],
                  banks: [...pendingBanks],
                  startDate: tempStartDate.trim(),
                  endDate: tempEndDate.trim()
                });
                onFilterApply?.();
                setGroupDropdownOpen(false);
                setCompanyDropdownOpen(false);
                setBankDropdownOpen(false);
                setPeriodDropdownOpen(false);
              }}
              className="flex-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Filter className="w-4 h-4" />
              Aplicar filtro
            </button>
            <button
              onClick={() => {
                setPendingGroups([]);
                setPendingCompanies([]);
                setPendingBanks([]);
                setTempStartDate('');
                setTempEndDate('');
                onFiltersChange({
                  ...filters,
                  groups: [],
                  companies: [],
                  banks: [],
                  startDate: '',
                  endDate: ''
                });
                onFilterApply?.();
                setGroupDropdownOpen(false);
                setCompanyDropdownOpen(false);
                setBankDropdownOpen(false);
                setPeriodDropdownOpen(false);
              }}
              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1"
              title="Limpar filtros"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          </div>

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
                    <p className="text-xs text-blue-200">Use &quot;Aplicar filtro&quot; acima para aplicar período e demais filtros.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Click outside to fechar dropdowns (menu Empresas usa portal com backdrop próprio) */}
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

          <div className="min-w-0">
            <button
              type="button"
              ref={empresasNavBtnRef}
              onClick={e => {
                e.stopPropagation();
                setEmpresasMenuOpen(v => !v);
                setGroupDropdownOpen(false);
                setCompanyDropdownOpen(false);
                setBankDropdownOpen(false);
                setPeriodDropdownOpen(false);
              }}
              className={`w-full min-w-0 flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 rounded-lg transition-all duration-200 text-sm ${
                empresasMenuOpen
                  ? 'bg-sky-600/50 text-white'
                  : 'text-sky-100 hover:bg-sky-700/70 hover:text-white'
              }`}
              title="Empresas"
              aria-haspopup="menu"
              aria-expanded={empresasMenuOpen}
            >
              <Building2 className={`w-4 h-4 shrink-0 ${!isCollapsed ? 'mr-2' : ''}`} />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left truncate">Empresas</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-blue-200 transition-transform ${empresasMenuOpen ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            </button>
            {empresasMenuOpen &&
              typeof document !== 'undefined' &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[200] bg-slate-950/20"
                    aria-hidden
                    onClick={() => setEmpresasMenuOpen(false)}
                  />
                  {empresasMenuPos && (
                    <div
                      role="menu"
                      className="fixed z-[210] w-52 min-w-[13rem] rounded-lg border border-blue-800/90 bg-blue-950/98 py-0.5 shadow-2xl backdrop-blur-sm"
                      style={{ top: empresasMenuPos.top, left: empresasMenuPos.left }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-2.5 py-1.5 text-xs sm:text-sm text-sky-100 hover:bg-blue-800/80 flex items-center gap-2"
                        onClick={() => {
                          setEmpresasMenuOpen(false);
                          onCadastrarEmpresa();
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        Cadastrar empresa
                      </button>
                      {onEditarEmpresa && (
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full text-left px-2.5 py-1.5 text-xs sm:text-sm text-sky-100 hover:bg-blue-800/80 flex items-center gap-2"
                          onClick={() => {
                            setEmpresasMenuOpen(false);
                            onEditarEmpresa();
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5 shrink-0 text-sky-300" />
                          Editar empresa
                        </button>
                      )}
                    </div>
                  )}
                </>,
                document.body
              )}
          </div>

          {/* Refresh Button — oculto por padrão */}
          {SHOW_REFRESH_BUTTON && onRefresh && (
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