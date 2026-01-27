import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmOverwriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  fileType: string;
}

export const ConfirmOverwriteModal: React.FC<ConfirmOverwriteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  fileType
}) => {
  if (!isOpen) return null;

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
      faturamento_dre: 'Faturamento DRE',
      orcamento_dre: 'Orçamento DRE'
    };
    return map[type] || type;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-orange-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Confirmar sobreposição</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            Você tem certeza que deseja sobrepor?
          </p>
          <p className="text-gray-600 mb-6">
            Dessa forma, todos os dados de <span className="font-semibold">"{getTypeLabel(fileType)}"</span> serão substituídos pelos dados dessa nova planilha. Os dados anteriores serão movidos para a lixeira.
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
            >
              OK, sobrepor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

