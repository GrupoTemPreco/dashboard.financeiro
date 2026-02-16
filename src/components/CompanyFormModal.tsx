import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: { company_code: string; company_name: string; name: string; group_name: string }) => Promise<void>;
  darkMode?: boolean;
}

export const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  darkMode = false
}) => {
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const groups = ['Escritório', 'Tempreço', 'X Brothers'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validação
    if (!companyCode.trim()) {
      setError('O código da loja é obrigatório');
      return;
    }

    if (!companyName.trim()) {
      setError('O nome de identificação é obrigatório');
      return;
    }

    if (!groupName) {
      setError('O grupo é obrigatório');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        company_code: companyCode.trim(),
        company_name: companyName.trim(),
        name: companyName.trim(),
        group_name: groupName
      });
      
      // Limpar formulário
      setCompanyCode('');
      setCompanyName('');
      setGroupName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar empresa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCompanyCode('');
      setCompanyName('');
      setGroupName('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white'} rounded-lg shadow-xl max-w-md w-full mx-4`}>
        <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            Cadastrar Empresa
          </h3>
          <button
            onClick={handleClose}
            disabled={loading}
            className={`${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'} transition-colors disabled:opacity-50`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className={`mb-4 p-3 rounded-lg flex items-center ${darkMode ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
              <AlertCircle className={`w-5 h-5 mr-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
              <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Código da Loja <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 rounded-lg border ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-green-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
              } focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50`}
              placeholder="Ex: 001"
              required
            />
          </div>

          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Nome de Identificação <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 rounded-lg border ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-green-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
              } focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50`}
              placeholder="Ex: Loja Centro"
              required
            />
          </div>

          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Grupo <span className="text-red-500">*</span>
            </label>
            <select
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2 rounded-lg border ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-green-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
              } focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50`}
              required
            >
              <option value="">Selecione um grupo</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                darkMode
                  ? 'text-slate-300 bg-slate-800 hover:bg-slate-700'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
