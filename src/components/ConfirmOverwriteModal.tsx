import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmOverwriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
}

export const ConfirmOverwriteModal: React.FC<ConfirmOverwriteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-orange-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Arquivo já importado</h3>
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
            O arquivo <span className="font-semibold">"{fileName}"</span> já foi importado anteriormente.
          </p>
          <p className="text-gray-600 mb-6">
            Deseja sobrepor o arquivo anterior? O arquivo mais recente substituirá os dados do arquivo anterior.
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Não
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Sim, sobrepor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

