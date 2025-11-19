import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Download, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { ImportedFile } from '../types/financial';
import * as XLSX from 'xlsx';

interface DataImportProps {
  onFileUpload: (file: File, type: 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'transactions' | 'revenues_dre' | 'cmv_dre' | 'initial_balances', currentIndex?: number, totalFiles?: number) => Promise<void>;
  importedFiles: ImportedFile[];
  onDeleteFile: (fileId: string) => void;
}

export const DataImport: React.FC<DataImportProps> = ({
  onFileUpload,
  importedFiles,
  onDeleteFile
}) => {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
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

  const getFilesByType = (type: string) => {
    return importedFiles.filter(file => file.type === type);
  };

  const toggleCard = (type: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
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

  const renderImportedFiles = (type: string) => {
    const files = getFilesByType(type);
    if (files.length === 0) return null;

    const isExpanded = expandedCards[type] || false;

    return (
      <div className="mt-4 border-t border-gray-200 pt-4 relative">
        <button
          onClick={() => toggleCard(type)}
          className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          <span className="font-medium">
            Arquivos importados ({files.length})
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        
        {isExpanded && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="p-3 space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center flex-1 min-w-0">
                    {getStatusIcon(file.status)}
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{file.name}</p>
                      <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                        <span>{formatDate(file.uploadDate)}</span>
                        <span>{file.recordCount} registros</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{getStatusText(file.status)}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onDeleteFile(file.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2 flex-shrink-0"
                    title="Excluir arquivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
      </div>

      {/* Upload Areas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Companies Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-green-600" />
            1. Cadastro de Empresas
          </h3>
          
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'companies'
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-green-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'companies')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'companies')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => companiesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>
          
          <input
            ref={companiesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'companies')}
            className="hidden"
          />
          
          {renderImportedFiles('companies')}
        </div>

        {/* Accounts Payable Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-orange-600" />
            2. Contas a Pagar
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'accounts_payable'
                ? 'border-orange-400 bg-orange-50'
                : 'border-gray-300 hover:border-orange-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'accounts_payable')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'accounts_payable')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => accountsPayableInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={accountsPayableInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'accounts_payable')}
            className="hidden"
          />
          
          {renderImportedFiles('accounts_payable')}
        </div>

        {/* Revenues Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            3. Receitas
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'revenues'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'revenues')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'revenues')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => revenuesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={revenuesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'revenues')}
            className="hidden"
          />
          
          {renderImportedFiles('revenues')}
        </div>

        {/* Financial Transactions Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-purple-600" />
            4. Lançamentos Financeiros
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'financial_transactions'
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-300 hover:border-purple-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'financial_transactions')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'financial_transactions')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => financialTransactionsInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={financialTransactionsInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'financial_transactions')}
            className="hidden"
          />
          
          {renderImportedFiles('financial_transactions')}
        </div>

        {/* Forecasted Entries Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-teal-600" />
            5. Lançamentos Previstos
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'forecasted_entries'
                ? 'border-teal-400 bg-teal-50'
                : 'border-gray-300 hover:border-teal-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'forecasted_entries')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'forecasted_entries')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => forecastedEntriesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={forecastedEntriesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'forecasted_entries')}
            className="hidden"
          />
          
          {renderImportedFiles('forecasted_entries')}
        </div>

        {/* Revenues DRE Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-cyan-600" />
            6. Receita DRE
            {renderFormatTooltip('revenues_dre')}
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'revenues_dre'
                ? 'border-cyan-400 bg-cyan-50'
                : 'border-gray-300 hover:border-cyan-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'revenues_dre')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'revenues_dre')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => revenuesDREInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={revenuesDREInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'revenues_dre')}
            className="hidden"
          />
          
          {renderImportedFiles('revenues_dre')}
        </div>

        {/* CMV DRE Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-rose-600" />
            7. CMV DRE
            {renderFormatTooltip('cmv_dre')}
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'cmv_dre'
                ? 'border-rose-400 bg-rose-50'
                : 'border-gray-300 hover:border-rose-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'cmv_dre')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'cmv_dre')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => cmvDREInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={cmvDREInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'cmv_dre')}
            className="hidden"
          />
          
          {renderImportedFiles('cmv_dre')}
        </div>

        {/* Initial Balances Upload */}
        <div className="bg-white rounded-lg shadow-md p-4 relative">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-emerald-600" />
            8. Saldos Bancários
            {renderFormatTooltip('initial_balances')}
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver === 'initial_balances'
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-gray-300 hover:border-emerald-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'initial_balances')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'initial_balances')}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => initialBalancesInputRef.current?.click()}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Selecionar Arquivos
            </button>
            <p className="text-xs text-gray-500 mt-2">Excel (.xlsx, .xls) - Múltiplos arquivos</p>
          </div>

          <input
            ref={initialBalancesInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => handleFileSelect(e, 'initial_balances')}
            className="hidden"
          />
          
          {renderImportedFiles('initial_balances')}
        </div>
      </div>

    </div>
  );
};