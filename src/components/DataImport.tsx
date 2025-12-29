import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Download, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { ImportedFile } from '../types/financial';
import * as XLSX from 'xlsx';

interface DataImportProps {
  onFileUpload: (file: File, type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances', currentIndex?: number, totalFiles?: number) => Promise<void>;
  importedFiles: ImportedFile[];
  onDeleteFile: (fileId: string) => void;
  onRestoreFile: (fileId: string) => void;
  onPermanentDeleteFile: (fileId: string) => void;
  onEmptyTrash: () => void;
  isAdmin: boolean;
  darkMode?: boolean;
}

export const DataImport: React.FC<DataImportProps> = ({
  onFileUpload,
  importedFiles,
  onDeleteFile,
  onRestoreFile,
  onPermanentDeleteFile,
  onEmptyTrash,
  isAdmin,
  darkMode = false
}) => {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importedFilesOpen, setImportedFilesOpen] = useState(false);
  const [selectedImportDate, setSelectedImportDate] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    all: true,
    trash: false
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const companiesInputRef = useRef<HTMLInputElement>(null);
  const accountsPayableInputRef = useRef<HTMLInputElement>(null);
  const revenuesInputRef = useRef<HTMLInputElement>(null);
  const financialTransactionsInputRef = useRef<HTMLInputElement>(null);
  const forecastedEntriesInputRef = useRef<HTMLInputElement>(null);
  const revenuesDREInputRef = useRef<HTMLInputElement>(null);
  const cmvDREInputRef = useRef<HTMLInputElement>(null);
  const initialBalancesInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOver(type);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = async (e: React.DragEvent, type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances') => {
    e.preventDefault();
    setDragOver(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Processar todos os arquivos sequencialmente
      for (let i = 0; i < files.length; i++) {
        await onFileUpload(files[i], type, i + 1, files.length);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances') => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Processar todos os arquivos selecionados sequencialmente
      for (let i = 0; i < files.length; i++) {
        await onFileUpload(files[i], type, i + 1, files.length);
      }
      // Limpar o input para permitir selecionar os mesmos arquivos novamente
      e.target.value = '';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Importado com sucesso';
      case 'error':
        return 'Erro na importação';
      default:
        return 'Processando...';
    }
  };

  const handleSingleDelete = (fileId: string, fileName: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir o arquivo "${fileName}"?`
    );
    if (confirmed) {
      onDeleteFile(fileId);
      setSelectedFileIds((prev) => prev.filter((id) => id !== fileId));
    }
  };

  const handleToggleSelection = (fileId: string) => {
    if (!isAdmin) return;
    setSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleDeleteSelected = () => {
    if (!isAdmin) return;
    if (selectedFileIds.length === 0) return;

    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir ${selectedFileIds.length} arquivo(s) selecionado(s)?`
    );

    if (!confirmed) return;

    selectedFileIds.forEach((id) => onDeleteFile(id));
    setSelectedFileIds([]);
    setSelectionMode(false);
  };

  const downloadCompaniesTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Código', 'Grupo', 'Nome da Empresa'],
      ['001', 'Grupo A', 'Empresa Exemplo 1'],
      ['002', 'Grupo A', 'Empresa Exemplo 2'],
      ['003', 'Grupo B', 'Empresa Exemplo 3']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
    XLSX.writeFile(wb, 'modelo_empresas.xlsx');
  };

  const downloadAccountsPayableTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Credor', 'Data de Pagamento', 'Valor'],
      ['pendente', 'Unidade 1', 'Fornecedores', 'Fornecedor ABC', '15/01/2024', 5000],
      ['paga', 'Unidade 2', 'Salários', 'Folha de Pagamento', '10/01/2024', 15000],
      ['pendente', 'Unidade 1', 'Serviços', 'Prestador XYZ', '20/01/2024', 3500]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar');
    XLSX.writeFile(wb, 'modelo_contas_a_pagar.xlsx');
  };

  const downloadRevenuesTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Data de Pagamento', 'Valor'],
      ['pendente', 'Unidade 1', 'Vendas', '15/01/2024', 10000],
      ['recebida', 'Unidade 2', 'Serviços', '10/01/2024', 25000],
      ['pendente', 'Unidade 1', 'Produtos', '20/01/2024', 15000]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receitas');
    XLSX.writeFile(wb, 'modelo_receitas.xlsx');
  };

  const downloadFinancialTransactionsTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Data', 'Valor'],
      ['pendente', 'Unidade 1', 'Vendas', '15/01/2024', 5000],
      ['paga', 'Unidade 2', 'Fornecedores', '10/01/2024', -3000],
      ['pendente', 'Unidade 1', 'Serviços', '20/01/2024', 8000],
      ['paga', 'Unidade 3', 'Despesas', '12/01/2024', -1500]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');
    XLSX.writeFile(wb, 'modelo_lancamentos_financeiros.xlsx');
  };

  const downloadForecastedEntriesTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Credor', 'Data de Vencimento', 'Valor'],
      ['pendente', 'Unidade 1', 'Fornecedores', 'Fornecedor ABC', '25/01/2024', 7500],
      ['pendente', 'Unidade 2', 'Serviços', 'Prestador XYZ', '30/01/2024', 4200],
      ['pendente', 'Unidade 1', 'Salários', 'Folha de Pagamento', '05/02/2024', 18000]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos Previstos');
    XLSX.writeFile(wb, 'modelo_lancamentos_previstos.xlsx');
  };

  const downloadRevenuesDRETemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Data de Emissão', 'Valor'],
      ['recebida', 'Unidade 1', 'Vendas Produto A', '15/01/2024', 25000],
      ['pendente', 'Unidade 2', 'Serviços Mensais', '20/01/2024', 18000],
      ['recebida', 'Unidade 1', 'Vendas Produto B', '22/01/2024', 32000]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receita DRE');
    XLSX.writeFile(wb, 'modelo_receita_dre.xlsx');
  };

  const downloadCMVDRETemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Data de Emissão', 'Valor'],
      ['recebida', 'Unidade 1', 'Custo Produto A', '15/01/2024', 12000],
      ['pendente', 'Unidade 2', 'Custo Serviços', '20/01/2024', 8000],
      ['recebida', 'Unidade 1', 'Custo Produto B', '22/01/2024', 15000]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CMV DRE');
    XLSX.writeFile(wb, 'modelo_cmv_dre.xlsx');
  };

  const renderFormatTooltip = (type: 'revenues_dre' | 'cmv_dre' | 'initial_balances') => {
    const formatInfo = {
      revenues_dre: {
        title: 'Formato esperado - Receita DRE',
        items: [
          'Status: Somente "Recebida"',
          'Unidade de Negócio: Número da empresa cadastrada',
          'Plano de Contas: Somente "Receita Bruta"',
          'Data de Emissão: Formato data (DD/MM/AAAA)',
          'Valor: Formato numérico'
        ],
        templateLink: '/templates/template_receita_dre.xlsx',
        color: 'cyan'
      },
      cmv_dre: {
        title: 'Formato esperado - CMV DRE',
        items: [
          'Status: Somente "Pago"',
          'Unidade de Negócio: Número da empresa cadastrada',
          'Plano de Contas: Somente "CMV"',
          'Data de Emissão: Formato data (DD/MM/AAAA)',
          'Valor: Formato numérico'
        ],
        templateLink: '/templates/template_cmv_dre.xlsx',
        color: 'rose'
      },
      initial_balances: {
        title: 'Formato esperado - Saldos Bancários',
        items: [
          'Unidade de Negócio: Número da empresa cadastrada',
          'Banco: Nome do banco',
          'Saldo: Valor do saldo inicial',
          'Data do Saldo: Formato data (DD/MM/AAAA)'
        ],
        templateLink: '/templates/template_saldos_bancarios.xlsx',
        color: 'emerald'
      }
    };

    const info = formatInfo[type];
    const colorClasses: Record<string, string> = {
      cyan: 'bg-cyan-50 border-cyan-200 text-cyan-900',
      rose: 'bg-rose-50 border-rose-200 text-rose-900',
      emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900'
    };

    return (
      <div className="relative group">
        <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help ml-2" />
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
          <div className={`p-3 rounded-lg border ${colorClasses[info.color] || ''}`}>
            <p className="text-sm font-medium mb-2">{info.title}</p>
            <ul className="text-xs space-y-1 ml-4 mb-3">
              {info.items.map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
            <a
              href={info.templateLink}
              download
              className="inline-flex items-center text-xs font-medium hover:underline"
            >
              <Download className="w-3 h-3 mr-1" />
              Baixar modelo de exemplo
            </a>
          </div>
        </div>
      </div>
    );
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      companies: 'Cadastro de Empresas',
      accounts_payable: 'Contas a Pagar',
      revenues: 'Receitas',
      financial_transactions: 'Lançamentos Financeiros',
      forecasted_entries: 'Lançamentos Previstos',
      revenues_dre: 'Receita DRE',
      cmv_dre: 'CMV DRE',
      initial_balances: 'Saldos Bancários'
    };
    return map[type] || type;
  };

  const renderImportedFilesDropdown = () => {
    const activeFiles = importedFiles.filter(file => !file.isDeleted);
    const trashedFiles = importedFiles.filter(file => file.isDeleted);
    const hasFiles = activeFiles.length > 0;

    // Aplica filtro de data (data de importação)
    const dateFilteredFiles = selectedImportDate
      ? activeFiles.filter((file) => {
          const fileDate = new Date(file.uploadDate);
          const isoDate = fileDate.toISOString().slice(0, 10); // yyyy-mm-dd
          return isoDate === selectedImportDate;
        })
      : activeFiles;

    const typeOrder = [
      'all',
      'companies',
      'accounts_payable',
      'revenues',
      'financial_transactions',
      'forecasted_entries',
      'revenues_dre',
      'cmv_dre',
      'initial_balances'
    ];

    const toggleSection = (key: string) => {
      setExpandedSections((prev) => ({
        ...prev,
        [key]: !prev[key]
      }));
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black bg-opacity-40"
          onClick={() => setImportedFilesOpen(false)}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[80vh] overflow-hidden border border-gray-200">
          <div className="px-6 pt-4 pb-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Arquivos importados
              </h3>
              <button
                onClick={() => setImportedFilesOpen(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 uppercase tracking-wide"
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">
                  Filtrar por data de importação:
                </span>
                <input
                  type="date"
                  value={selectedImportDate}
                  onChange={(e) => setSelectedImportDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
                {selectedImportDate && (
                  <button
                    onClick={() => setSelectedImportDate('')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="hidden sm:flex text-[11px] text-gray-500">
                <span>
                  Clique em cada linha para expandir os arquivos por tipo e data.
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)] bg-white">
            {!hasFiles && (
              <p className="text-sm text-gray-500">
                Nenhum arquivo foi importado ainda.
              </p>
            )}

            {hasFiles && dateFilteredFiles.length === 0 && (
              <p className="text-sm text-gray-500">
                Nenhum arquivo encontrado para a data selecionada.
              </p>
            )}

            {typeOrder.map((typeKey) => {
              const filesForType =
                typeKey === 'all'
                  ? dateFilteredFiles
                  : dateFilteredFiles.filter((file) => file.type === typeKey);

              if (!hasFiles && filesForType.length === 0) {
                return null;
              }

              // Agrupa por data dentro do tipo
              const filesByDate: Record<string, ImportedFile[]> = {};
              filesForType.forEach((file) => {
                const dateLabel = new Date(file.uploadDate).toLocaleDateString('pt-BR');
                if (!filesByDate[dateLabel]) {
                  filesByDate[dateLabel] = [];
                }
                filesByDate[dateLabel].push(file);
              });

              const dateKeys = Object.keys(filesByDate);
              const isExpanded = expandedSections[typeKey] ?? typeKey === 'all';

              const headerLabel =
                typeKey === 'all' ? 'Todos' : getTypeLabel(typeKey);

              const totalCount = filesForType.length;

              return (
                <div key={typeKey} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(typeKey)}
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm font-medium ${
                      typeKey === 'all'
                        ? 'bg-gray-100'
                        : 'bg-white'
                    } hover:bg-gray-50 transition-colors`}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </span>
                      <span className="text-gray-800">{headerLabel}</span>
                    </div>
                    <span className="text-xs text-gray-600">
                      {totalCount} arquivo{totalCount === 1 ? '' : 's'}
                    </span>
                  </button>

                  {isExpanded && totalCount > 0 && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] text-gray-600">
                          {totalCount} arquivo{totalCount === 1 ? '' : 's'} neste grupo
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectionMode((prev) => !prev);
                              if (selectionMode) {
                                setSelectedFileIds([]);
                              }
                            }}
                            className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            {selectionMode ? 'Cancelar seleção' : 'Selecionar arquivos'}
                          </button>
                        )}
                      </div>
                      {selectionMode && isAdmin && (
                        <div className="flex flex-wrap items-center justify-between mb-3 gap-2 text-[11px] text-gray-600">
                          <div className="flex items-center gap-3">
                            <span>
                              {selectedFileIds.length} arquivo
                              {selectedFileIds.length === 1 ? '' : 's'} selecionado
                              {selectedFileIds.length === 1 ? '' : 's'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                // seleciona todos os arquivos deste grupo
                                const allIdsInGroup = filesForType.map((f) => f.id);
                                const allSelected = allIdsInGroup.every((id) =>
                                  selectedFileIds.includes(id)
                                );
                                if (allSelected) {
                                  // desmarca todos deste grupo
                                  setSelectedFileIds((prev) =>
                                    prev.filter((id) => !allIdsInGroup.includes(id))
                                  );
                                } else {
                                  // adiciona os que faltam
                                  setSelectedFileIds((prev) => [
                                    ...prev,
                                    ...allIdsInGroup.filter((id) => !prev.includes(id))
                                  ]);
                                }
                              }}
                              className="px-2 py-1 rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium"
                            >
                              Selecionar todos
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleDeleteSelected}
                            disabled={selectedFileIds.length === 0}
                            className={`px-2 py-1 rounded-md border text-[11px] font-medium ${
                              selectedFileIds.length === 0
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-100'
                                : 'border-red-600 text-red-600 hover:bg-red-50'
                            }`}
                          >
                            Excluir selecionados
                          </button>
                        </div>
                      )}
                      {dateKeys.map((date) => {
                        const files = filesByDate[date];

                        return (
                          <div key={date} className="mb-4 last:mb-0">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">
                              {date} ({files.length})
                            </h4>
                            <div className="space-y-2">
                              {files.map((file) => (
                                <div
                                  key={file.id}
                                  className={`flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg ${
                                    selectionMode && selectedFileIds.includes(file.id)
                                      ? 'ring-1 ring-blue-400'
                                      : ''
                                  }`}
                                >
                                  <div className="flex items-center flex-1 min-w-0">
                                    {selectionMode && isAdmin && (
                                      <input
                                        type="checkbox"
                                        checked={selectedFileIds.includes(file.id)}
                                        onChange={() => handleToggleSelection(file.id)}
                                        className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-2"
                                      />
                                    )}
                                    {getStatusIcon(file.status)}
                                    <div className="ml-3 flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <p className="font-medium text-gray-800 truncate">
                                          {file.name}
                                        </p>
                                        <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-medium text-blue-700 border border-blue-100 flex-shrink-0">
                                          {getTypeLabel(file.type)}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                                        <span>{formatDate(file.uploadDate)}</span>
                                        <span>{file.recordCount} registros</span>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {getStatusText(file.status)}
                                      </p>
                                    </div>
                                  </div>

                                  {isAdmin && (
                                    <button
                                      onClick={() => handleSingleDelete(file.id, file.name)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2 flex-shrink-0"
                                      title="Excluir arquivo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Lixeira */}
            {isAdmin && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections(prev => ({
                    ...prev,
                    trash: !prev.trash
                  }))
                }
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 transition-colors rounded-lg border border-gray-200"
              >
                <div className="flex items-center">
                  <span className="mr-2">
                    {expandedSections.trash ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                  <span className="text-gray-800">Lixeira</span>
                </div>
                <span className="text-xs text-gray-600">
                  {trashedFiles.length} arquivo
                  {trashedFiles.length === 1 ? '' : 's'} na lixeira
                </span>
              </button>

              {expandedSections.trash && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-gray-600">
                      Arquivos apagados recentemente (não utilizados no sistema)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (trashedFiles.length === 0) return;
                        const confirmed = window.confirm(
                          `Tem certeza de que deseja esvaziar a lixeira? ${trashedFiles.length} arquivo(s) serão excluídos permanentemente.`
                        );
                        if (!confirmed) return;
                        onEmptyTrash();
                      }}
                      disabled={trashedFiles.length === 0}
                      className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-medium border ${
                        trashedFiles.length === 0
                          ? 'border-gray-200 text-gray-300 bg-gray-100 cursor-not-allowed'
                          : 'border-red-600 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      Esvaziar lixeira
                    </button>
                  </div>

                  {trashedFiles.length === 0 && (
                    <p className="text-xs text-gray-500">
                      Nenhum arquivo na lixeira no momento.
                    </p>
                  )}

                  {trashedFiles.length > 0 && (
                    <div className="mt-2 space-y-4">
                      {Object.entries(
                        trashedFiles.reduce<Record<string, ImportedFile[]>>(
                          (acc, file) => {
                            const dateLabel = new Date(
                              file.uploadDate
                            ).toLocaleDateString('pt-BR');
                            if (!acc[dateLabel]) acc[dateLabel] = [];
                            acc[dateLabel].push(file);
                            return acc;
                          },
                          {}
                        )
                      ).map(([date, files]) => (
                        <div key={date}>
                          <h5 className="text-xs font-semibold text-gray-700 mb-2">
                            {date} ({files.length})
                          </h5>
                          <div className="space-y-2">
                            {files.map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                              >
                                <div className="flex items-center flex-1 min-w-0">
                                  {getStatusIcon(file.status)}
                                  <div className="ml-3 flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="font-medium text-gray-800 truncate">
                                        {file.name}
                                      </p>
                                      <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full bg-gray-200 text-[10px] font-medium text-gray-800 border border-gray-300 flex-shrink-0">
                                        {getTypeLabel(file.type)}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                                      <span>{formatDate(file.uploadDate)}</span>
                                      <span>{file.recordCount} registros</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Arquivo na lixeira (não utilizado no sistema)
                                    </p>
                                  </div>
                                </div>

                                {isAdmin && (
                                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => onRestoreFile(file.id)}
                                      className="px-2 py-1 rounded-md text-[11px] font-medium border border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                                    >
                                      Restaurar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const confirmed = window.confirm(
                                          `Tem certeza de que deseja excluir permanentemente o arquivo "${file.name}"? Esta ação não pode ser desfeita.`
                                        );
                                        if (!confirmed) return;
                                        onPermanentDeleteFile(file.id);
                                      }}
                                      className="px-2 py-1 rounded-md text-[11px] font-medium border border-red-600 text-red-600 hover:bg-red-50"
                                    >
                                      Excluir permanentemente
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Instructions and Templates Dropdowns */}
      <div className="flex flex-wrap gap-3">
        {/* Instructions Dropdown */}
        <div className="relative flex-1 min-w-[200px]">
          <button
            onClick={() => setInstructionsOpen(!instructionsOpen)}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Info className="w-5 h-5 mr-2" />
            <span className="font-medium">Instruções de Importação</span>
            {instructionsOpen ? (
              <ChevronUp className="w-4 h-4 ml-2" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-2" />
            )}
          </button>
        
          {instructionsOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">Instruções de Importação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-blue-700">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">1. Cadastro de Empresas</h4>
                  <p className="mb-2 text-xs">Importe primeiro o arquivo com o cadastro das empresas:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Código da empresa</li>
                    <li>• Coluna B: Nome da empresa</li>
                    <li>• Coluna C: Grupo</li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">2. Contas a Pagar</h4>
                  <p className="mb-2 text-xs">Importe o arquivo com as contas a pagar:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Status (paga ou pendente)</li>
                    <li>• Coluna B: Unidade de negócio</li>
                    <li>• Coluna C: Plano de contas</li>
                    <li>• Coluna D: Credor (fornecedor)</li>
                    <li>• Coluna E: Data de pagamento</li>
                    <li>• Coluna F: Valor</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">3. Receitas</h4>
                  <p className="mb-2 text-xs">Importe o arquivo com as receitas:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Status (recebida ou pendente)</li>
                    <li>• Coluna B: Unidade de negócio</li>
                    <li>• Coluna C: Plano de contas</li>
                    <li>• Coluna D: Data de pagamento</li>
                    <li>• Coluna E: Valor</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">4. Lançamentos Financeiros</h4>
                  <p className="mb-2 text-xs">Importe o arquivo com os lançamentos:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Status (paga ou pendente)</li>
                    <li>• Coluna B: Unidade de negócio</li>
                    <li>• Coluna C: Plano de contas</li>
                    <li>• Coluna D: Data (xx/xx/xxxx)</li>
                    <li>• Coluna E: Valor (+ recebimento, - pagamento)</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">5. Lançamentos Previstos</h4>
                  <p className="mb-2 text-xs">Importe o arquivo com os lançamentos previstos:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Status (paga/pendente)</li>
                    <li>• Coluna B: Unidade de negócio</li>
                    <li>• Coluna C: Plano de contas</li>
                    <li>• Coluna D: Credor (fornecedor)</li>
                    <li>• Coluna E: Data de vencimento</li>
                    <li>• Coluna F: Valor</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">6. Receita DRE</h4>
                  <p className="mb-2 text-xs">Importe o arquivo com as receitas para DRE:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Status (recebida ou pendente)</li>
                    <li>• Coluna B: Unidade de negócio</li>
                    <li>• Coluna C: Plano de contas</li>
                    <li>• Coluna D: Data de emissão</li>
                    <li>• Coluna E: Valor</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">7. CMV DRE</h4>
                  <p className="mb-2 text-xs">Importe o arquivo com o CMV para DRE:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Status (recebida ou pendente)</li>
                    <li>• Coluna B: Unidade de negócio</li>
                    <li>• Coluna C: Plano de contas</li>
                    <li>• Coluna D: Data de emissão</li>
                    <li>• Coluna E: Valor</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 text-blue-800">8. Saldos Bancários</h4>
                  <p className="mb-2 text-xs">Importe o arquivo com os saldos iniciais:</p>
                  <ul className="text-xs space-y-1 ml-3">
                    <li>• Coluna A: Unidade de negócio</li>
                    <li>• Coluna B: Banco (nome do banco)</li>
                    <li>• Coluna C: Saldo (valor)</li>
                    <li>• Coluna D: Data do saldo</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 bg-blue-100 rounded-md p-3">
                <p className="font-medium text-sm text-blue-800">Formato aceito:</p>
                <p className="text-xs text-blue-700">Arquivos Excel (.xlsx, .xls) com cabeçalhos na primeira linha</p>
              </div>
            </div>
          )}
        </div>

        {/* Templates Dropdown */}
        <div className="relative flex-1 min-w-[200px]">
          <button
            onClick={() => setTemplatesOpen(!templatesOpen)}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5 mr-2" />
            <span className="font-medium">Modelos de Arquivo</span>
            {templatesOpen ? (
              <ChevronUp className="w-4 h-4 ml-2" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-2" />
            )}
          </button>
          
          {templatesOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Modelos de Arquivo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={downloadCompaniesTemplate}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">Modelo - Empresas</p>
                      <p className="text-xs text-gray-600">Template para cadastro</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>

                <button
                  onClick={downloadAccountsPayableTemplate}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-orange-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">Modelo - Contas a Pagar</p>
                      <p className="text-xs text-gray-600">Template para despesas</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>

                <button
                  onClick={downloadRevenuesTemplate}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">Modelo - Receitas</p>
                      <p className="text-xs text-gray-600">Template para receitas</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>

                <button
                  onClick={downloadFinancialTransactionsTemplate}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-purple-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">Modelo - Lançamentos</p>
                      <p className="text-xs text-gray-600">Template para lançamentos</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>

                <button
                  onClick={downloadForecastedEntriesTemplate}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-teal-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">Modelo - Lançamentos Previstos</p>
                      <p className="text-xs text-gray-600">Template para previstos</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>

                <button
                  onClick={downloadRevenuesDRETemplate}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-cyan-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">Modelo - Receita DRE</p>
                      <p className="text-xs text-gray-600">Template para receitas</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>

                <button
                  onClick={downloadCMVDRETemplate}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-rose-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-gray-800">Modelo - CMV DRE</p>
                      <p className="text-xs text-gray-600">Template para CMV</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Imported Files Dropdown */}
        <div className="relative flex-1 min-w-[200px]">
          <button
            onClick={() => setImportedFilesOpen(!importedFilesOpen)}
            className="w-full flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            <FileText className="w-5 h-5 mr-2" />
            <span className="font-medium">Arquivos importados</span>
            {importedFilesOpen ? (
              <ChevronUp className="w-4 h-4 ml-2" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-2" />
            )}
          </button>

          {importedFilesOpen && renderImportedFilesDropdown()}
        </div>
      </div>

      {/* Upload Areas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Companies Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-green-600" />
            1. Cadastro de Empresas
          </h3>
          
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'companies'
                ? darkMode
                  ? 'border-green-400 bg-emerald-950/20'
                  : 'border-green-400 bg-green-50'
                : darkMode
                  ? 'border-slate-600 hover:border-green-400'
                : 'border-gray-300 hover:border-green-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'companies')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'companies')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => companiesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>
          
          <input
            ref={companiesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'companies')}
            className="hidden"
          />
        </div>

        {/* Accounts Payable Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-orange-600" />
            2. Contas a Pagar
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'accounts_payable'
                ? darkMode
                  ? 'border-orange-400 bg-amber-950/20'
                  : 'border-orange-400 bg-orange-50'
                : darkMode
                  ? 'border-slate-600 hover:border-orange-400'
                : 'border-gray-300 hover:border-orange-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'accounts_payable')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'accounts_payable')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => accountsPayableInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={accountsPayableInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'accounts_payable')}
            className="hidden"
          />
        </div>

        {/* Revenues Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            3. Receitas
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'revenues'
                ? darkMode
                  ? 'border-blue-400 bg-sky-950/20'
                  : 'border-blue-400 bg-blue-50'
                : darkMode
                  ? 'border-slate-600 hover:border-blue-400'
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'revenues')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'revenues')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => revenuesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={revenuesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'revenues')}
            className="hidden"
          />
        </div>

        {/* Financial Transactions Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-purple-600" />
            4. Lançamentos Financeiros
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'financial_transactions'
                ? darkMode
                  ? 'border-purple-400 bg-violet-950/20'
                  : 'border-purple-400 bg-purple-50'
                : darkMode
                  ? 'border-slate-600 hover:border-purple-400'
                : 'border-gray-300 hover:border-purple-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'financial_transactions')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'financial_transactions')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => financialTransactionsInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={financialTransactionsInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'financial_transactions')}
            className="hidden"
          />
        </div>

        {/* Forecasted Entries Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-teal-600" />
            5. Lançamentos Previstos
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'forecasted_entries'
                ? darkMode
                  ? 'border-teal-400 bg-teal-950/20'
                  : 'border-teal-400 bg-teal-50'
                : darkMode
                  ? 'border-slate-600 hover:border-teal-400'
                : 'border-gray-300 hover:border-teal-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'forecasted_entries')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'forecasted_entries')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => forecastedEntriesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={forecastedEntriesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'forecasted_entries')}
            className="hidden"
          />
        </div>

        {/* Revenues DRE Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-cyan-600" />
            6. Receita DRE
            {renderFormatTooltip('revenues_dre')}
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'revenues_dre'
                ? darkMode
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-cyan-400 bg-cyan-50'
                : darkMode
                  ? 'border-slate-600 hover:border-cyan-400'
                : 'border-gray-300 hover:border-cyan-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'revenues_dre')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'revenues_dre')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => revenuesDREInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={revenuesDREInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'revenues_dre')}
            className="hidden"
          />
        </div>

        {/* CMV DRE Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-rose-600" />
            7. CMV DRE
            {renderFormatTooltip('cmv_dre')}
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'cmv_dre'
                ? darkMode
                  ? 'border-rose-400 bg-rose-950/20'
                  : 'border-rose-400 bg-rose-50'
                : darkMode
                  ? 'border-slate-600 hover:border-rose-400'
                : 'border-gray-300 hover:border-rose-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'cmv_dre')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'cmv_dre')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => cmvDREInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={cmvDREInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'cmv_dre')}
            className="hidden"
          />
        </div>

        {/* Initial Balances Upload */}
        <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white shadow-md'} rounded-lg p-4 relative`}>
          <h3 className={`text-base font-semibold mb-3 flex items-center ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            <FileText className="w-5 h-5 mr-2 text-emerald-600" />
            8. Saldos Bancários
            {renderFormatTooltip('initial_balances')}
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'initial_balances'
                ? darkMode
                  ? 'border-emerald-400 bg-emerald-950/20'
                  : 'border-emerald-400 bg-emerald-50'
                : darkMode
                  ? 'border-slate-600 hover:border-emerald-400'
                : 'border-gray-300 hover:border-emerald-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'initial_balances')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'initial_balances')}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} />
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Arraste os arquivos aqui ou</p>
            <button
              onClick={() => initialBalancesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={initialBalancesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'initial_balances')}
            className="hidden"
          />
        </div>
      </div>

    </div>
  );
};