import React from 'react';
import { X, FileWarning } from 'lucide-react';

interface DuplicateFileModalProps {
  isOpen: boolean;
  fileName: string;
  fileType: string;
  darkMode?: boolean;
  onKeepPrevious: () => void;
  onReplaceWithNew: () => void;
}

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    companies: 'Cadastro de Empresas',
    accounts_payable: 'Contas a Pagar',
    revenues: 'Receitas',
    financial_transactions: 'Lançamentos Financeiros',
    forecasted_entries: 'Lançamentos Previstos',
    revenues_dre: 'Receita DRE',
    cmv_dre: 'CMV DRE',
    initial_balances: 'Saldos Bancários',
    orcamento_dre: 'Orçamento DRE',
    receita_crediario: 'Receita Crediário',
    vendas_por_usuario: 'Entrega de Resultado'
  };
  return map[type] || type;
};

export const DuplicateFileModal: React.FC<DuplicateFileModalProps> = ({
  isOpen,
  fileName,
  fileType,
  darkMode = false,
  onKeepPrevious,
  onReplaceWithNew
}) => {
  if (!isOpen) return null;

  const typeLabel = getTypeLabel(fileType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`rounded-lg shadow-xl max-w-md w-full mx-4 ${
          darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'
        }`}
      >
        <div
          className={`flex items-center justify-between p-4 border-b ${
            darkMode ? 'border-slate-600' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center">
            <FileWarning className={`w-6 h-6 mr-2 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`} />
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
              Esse arquivo já existe
            </h3>
          </div>
          <button
            onClick={onKeepPrevious}
            className={`${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className={`mb-4 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Um arquivo com o nome <span className="font-semibold">"{fileName}"</span> já foi importado anteriormente na seção{" "}
            <span className="font-semibold">{typeLabel}</span>.
          </p>
          <p className={`mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
            O que deseja fazer?
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onKeepPrevious}
              className={`px-4 py-2 rounded-lg transition-colors order-2 sm:order-1 ${
                darkMode
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manter o anterior
            </button>
            <button
              onClick={onReplaceWithNew}
              className={`px-4 py-2 rounded-lg transition-colors order-1 sm:order-2 ${
                darkMode
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              Ficar com o novo
            </button>
          </div>
          <p className={`mt-3 text-xs ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>
            "Ficar com o novo" irá excluir o arquivo anterior do banco e importar o novo.
          </p>
        </div>
      </div>
    </div>
  );
};
