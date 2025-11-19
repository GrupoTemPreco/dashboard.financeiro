import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Download, Info } from 'lucide-react';
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
  const companiesInputRef = useRef<HTMLInputElement>(null);
  const accountsPayableInputRef = useRef<HTMLInputElement>(null);
  const revenuesInputRef = useRef<HTMLInputElement>(null);
  const financialTransactionsInputRef = useRef<HTMLInputElement>(null);
  const forecastedEntriesInputRef = useRef<HTMLInputElement>(null);
  const transactionsInputRef = useRef<HTMLInputElement>(null);
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

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <Info className="w-6 h-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Instruções de Importação</h3>
            <div className="space-y-4 text-sm text-blue-700">
              <div>
                <h4 className="font-medium mb-2">1. Cadastro de Empresas</h4>
                <p className="mb-2">Importe primeiro o arquivo com o cadastro das empresas. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Código da empresa</li>
                  <li>Coluna B: Nome da empresa</li>
                  <li>Coluna C: Grupo</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">2. Contas a Pagar</h4>
                <p className="mb-2">Importe o arquivo com as contas a pagar. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Status (paga ou pendente)</li>
                  <li>Coluna B: Unidade de negócio</li>
                  <li>Coluna C: Plano de contas</li>
                  <li>Coluna D: Credor (fornecedor)</li>
                  <li>Coluna E: Data de pagamento (xx/xx/xxxx)</li>
                  <li>Coluna F: Valor</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">3. Receitas</h4>
                <p className="mb-2">Importe o arquivo com as receitas. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Status (recebida ou pendente)</li>
                  <li>Coluna B: Unidade de negócio</li>
                  <li>Coluna C: Plano de contas</li>
                  <li>Coluna D: Data de pagamento (xx/xx/xxxx)</li>
                  <li>Coluna E: Valor</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">4. Lançamentos Financeiros</h4>
                <p className="mb-2">Importe o arquivo com os lançamentos financeiros. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Status (paga ou pendente)</li>
                  <li>Coluna B: Unidade de negócio</li>
                  <li>Coluna C: Plano de contas</li>
                  <li>Coluna D: Data (xx/xx/xxxx)</li>
                  <li>Coluna E: Valor (positivo = recebimento, negativo = pagamento)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">5. Lançamentos Previstos</h4>
                <p className="mb-2">Importe o arquivo com os lançamentos previstos. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Status (paga/pendente)</li>
                  <li>Coluna B: Unidade de negócio</li>
                  <li>Coluna C: Plano de contas</li>
                  <li>Coluna D: Credor (fornecedor)</li>
                  <li>Coluna E: Data de vencimento (xx/xx/xxxx)</li>
                  <li>Coluna F: Valor</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">6. Receita DRE</h4>
                <p className="mb-2">Importe o arquivo com as receitas para DRE. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Status (recebida ou pendente)</li>
                  <li>Coluna B: Unidade de negócio</li>
                  <li>Coluna C: Plano de contas</li>
                  <li>Coluna D: Data de emissão (xx/xx/xxxx)</li>
                  <li>Coluna E: Valor</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">7. CMV DRE</h4>
                <p className="mb-2">Importe o arquivo com o CMV para DRE. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Status (recebida ou pendente)</li>
                  <li>Coluna B: Unidade de negócio</li>
                  <li>Coluna C: Plano de contas</li>
                  <li>Coluna D: Data de emissão (xx/xx/xxxx)</li>
                  <li>Coluna E: Valor</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">8. Saldos Bancários</h4>
                <p className="mb-2">Importe o arquivo com os saldos iniciais. O arquivo deve conter:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Coluna A: Unidade de negócio</li>
                  <li>Coluna B: Banco (nome do banco)</li>
                  <li>Coluna C: Saldo (valor)</li>
                  <li>Coluna D: Data do saldo (xx/xx/xxxx)</li>
                </ul>
              </div>

              <div className="bg-blue-100 rounded-md p-3 mt-4">
                <p className="font-medium">Formato aceito:</p>
                <p>Arquivos Excel (.xlsx, .xls) com cabeçalhos na primeira linha</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Areas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Companies Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-green-600" />
            1. Cadastro de Empresas
          </h3>
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'companies'
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-green-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'companies')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'companies')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => companiesInputRef.current?.click()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
        </div>

        {/* Accounts Payable Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-orange-600" />
            2. Contas a Pagar
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'accounts_payable'
                ? 'border-orange-400 bg-orange-50'
                : 'border-gray-300 hover:border-orange-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'accounts_payable')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'accounts_payable')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => accountsPayableInputRef.current?.click()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
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
        </div>

        {/* Revenues Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            3. Receitas
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'revenues'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'revenues')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'revenues')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => revenuesInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        </div>

        {/* Financial Transactions Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-purple-600" />
            4. Lançamentos Financeiros
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'financial_transactions'
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-300 hover:border-purple-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'financial_transactions')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'financial_transactions')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => financialTransactionsInputRef.current?.click()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
        </div>

        {/* Forecasted Entries Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-teal-600" />
            5. Lançamentos Previstos
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'forecasted_entries'
                ? 'border-teal-400 bg-teal-50'
                : 'border-gray-300 hover:border-teal-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'forecasted_entries')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'forecasted_entries')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => forecastedEntriesInputRef.current?.click()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
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
        </div>

        {/* Revenues DRE Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-cyan-600" />
            6. Receita DRE
          </h3>

          <div className="mb-4 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
            <p className="text-sm text-cyan-900 mb-2 font-medium">Formato esperado:</p>
            <ul className="text-xs text-cyan-800 space-y-1 ml-4">
              <li>• Status: Somente "Recebida"</li>
              <li>• Unidade de Negócio: Número da empresa cadastrada</li>
              <li>• Plano de Contas: Somente "Receita Bruta"</li>
              <li>• Data de Emissão: Formato data (DD/MM/AAAA)</li>
              <li>• Valor: Formato numérico</li>
            </ul>
            <a
              href="/templates/template_receita_dre.xlsx"
              download
              className="inline-flex items-center mt-2 text-xs text-cyan-700 hover:text-cyan-900 font-medium"
            >
              <Download className="w-3 h-3 mr-1" />
              Baixar modelo de exemplo
            </a>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'revenues_dre'
                ? 'border-cyan-400 bg-cyan-50'
                : 'border-gray-300 hover:border-cyan-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'revenues_dre')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'revenues_dre')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => revenuesDREInputRef.current?.click()}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
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
        </div>

        {/* CMV DRE Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-rose-600" />
            7. CMV DRE
          </h3>

          <div className="mb-4 p-3 bg-rose-50 rounded-lg border border-rose-200">
            <p className="text-sm text-rose-900 mb-2 font-medium">Formato esperado:</p>
            <ul className="text-xs text-rose-800 space-y-1 ml-4">
              <li>• Status: Somente "Pago"</li>
              <li>• Unidade de Negócio: Número da empresa cadastrada</li>
              <li>• Plano de Contas: Somente "CMV"</li>
              <li>• Data de Emissão: Formato data (DD/MM/AAAA)</li>
              <li>• Valor: Formato numérico</li>
            </ul>
            <a
              href="/templates/template_cmv_dre.xlsx"
              download
              className="inline-flex items-center mt-2 text-xs text-rose-700 hover:text-rose-900 font-medium"
            >
              <Download className="w-3 h-3 mr-1" />
              Baixar modelo de exemplo
            </a>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'cmv_dre'
                ? 'border-rose-400 bg-rose-50'
                : 'border-gray-300 hover:border-rose-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'cmv_dre')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'cmv_dre')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => cmvDREInputRef.current?.click()}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
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
        </div>

        {/* Initial Balances Upload */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-emerald-600" />
            8. Saldos Bancários
          </h3>

          <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm text-emerald-900 mb-2 font-medium">Formato esperado:</p>
            <ul className="text-xs text-emerald-800 space-y-1 ml-4">
              <li>• Unidade de Negócio: Número da empresa cadastrada</li>
              <li>• Banco: Nome do banco</li>
              <li>• Saldo: Valor do saldo inicial</li>
              <li>• Data do Saldo: Formato data (DD/MM/AAAA)</li>
            </ul>
            <a
              href="/templates/template_saldos_bancarios.xlsx"
              download
              className="inline-flex items-center mt-2 text-xs text-emerald-700 hover:text-emerald-900 font-medium"
            >
              <Download className="w-3 h-3 mr-1" />
              Baixar modelo de exemplo
            </a>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver === 'initial_balances'
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-gray-300 hover:border-emerald-400'
            }`}
            onDragOver={(e) => handleDragOver(e, 'initial_balances')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'initial_balances')}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Arraste os arquivos aqui ou</p>
            <button
              onClick={() => initialBalancesInputRef.current?.click()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
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
        </div>
      </div>

      {/* Template Downloads */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Download className="w-5 h-5 mr-2 text-green-600" />
          Modelos de Arquivo
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={downloadCompaniesTemplate}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-green-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-800">Modelo - Empresas</p>
                <p className="text-sm text-gray-600">Template para cadastro</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={downloadAccountsPayableTemplate}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-orange-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-800">Modelo - Contas a Pagar</p>
                <p className="text-sm text-gray-600">Template para despesas</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={downloadRevenuesTemplate}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-blue-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-800">Modelo - Receitas</p>
                <p className="text-sm text-gray-600">Template para receitas</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={downloadFinancialTransactionsTemplate}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-purple-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-800">Modelo - Lançamentos</p>
                <p className="text-sm text-gray-600">Template para lançamentos</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={downloadForecastedEntriesTemplate}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-teal-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-800">Modelo - Lançamentos Previstos</p>
                <p className="text-sm text-gray-600">Template para previstos</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={downloadRevenuesDRETemplate}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-cyan-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-800">Modelo - Receita DRE</p>
                <p className="text-sm text-gray-600">Template para receitas</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={downloadCMVDRETemplate}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-rose-600 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-800">Modelo - CMV DRE</p>
                <p className="text-sm text-gray-600">Template para CMV</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Imported Files Management */}
      {importedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Arquivos Importados</h3>

          <div className="space-y-3">
            {importedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center">
                  {getStatusIcon(file.status)}
                  <div className="ml-3">
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="capitalize">
                        {file.type === 'companies' ? 'Empresas' : file.type === 'accounts_payable' ? 'Contas a Pagar' : 'Transações'}
                      </span>
                      <span>{formatDate(file.uploadDate)}</span>
                      <span>{file.recordCount} registros</span>
                    </div>
                    <p className="text-xs text-gray-500">{getStatusText(file.status)}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => onDeleteFile(file.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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