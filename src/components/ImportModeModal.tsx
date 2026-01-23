import React from 'react';
import { X, Plus, Replace } from 'lucide-react';

interface ImportModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccumulate: () => void;
  onOverwrite: () => void;
  fileName: string;
}

export const ImportModeModal: React.FC<ImportModeModalProps> = ({
  isOpen,
  onClose,
  onAccumulate,
  onOverwrite,
  fileName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Escolha o modo de importação</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            Como deseja importar o arquivo <span className="font-semibold">"{fileName}"</span>?
          </p>
          
          <div className="space-y-3 mb-6">
            <button
              onClick={onAccumulate}
              className="w-full flex items-center p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-colors text-left"
            >
              <Plus className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <p className="font-semibold text-gray-800">Acumular com os demais dados</p>
                <p className="text-sm text-gray-600">Os dados serão adicionados sem apagar informações existentes</p>
              </div>
            </button>
            
            <button
              onClick={onOverwrite}
              className="w-full flex items-center p-4 border-2 border-orange-500 rounded-lg hover:bg-orange-50 transition-colors text-left"
            >
              <Replace className="w-6 h-6 text-orange-600 mr-3" />
              <div>
                <p className="font-semibold text-gray-800">Sobrepor dados</p>
                <p className="text-sm text-gray-600">Os dados anteriores serão movidos para a lixeira</p>
              </div>
            </button>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
