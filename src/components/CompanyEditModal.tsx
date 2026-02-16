import React, { useState, useEffect } from 'react';
import { X, Edit2, Save, XCircle, AlertCircle } from 'lucide-react';

interface Company {
  id: string;
  company_code: string;
  company_name: string;
  name: string;
  group_name: string;
}

interface CompanyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  onUpdate: (id: string, company: { company_code: string; company_name: string; name: string; group_name: string }) => Promise<void>;
  onRefresh: () => Promise<void>;
  darkMode?: boolean;
}

export const CompanyEditModal: React.FC<CompanyEditModalProps> = ({
  isOpen,
  onClose,
  companies,
  onUpdate,
  onRefresh,
  darkMode = false
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedCompanies, setEditedCompanies] = useState<Record<string, { company_code: string; company_name: string; group_name: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const groups = ['Escritório', 'Tempreço', 'X Brothers'];

  useEffect(() => {
    if (isOpen) {
      // Resetar estados ao abrir o modal
      setEditingId(null);
      setEditedCompanies({});
      setErrors({});
      setLoading({});
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleEdit = (company: Company) => {
    setEditingId(company.id);
    setEditedCompanies({
      ...editedCompanies,
      [company.id]: {
        company_code: company.company_code,
        company_name: company.company_name,
        group_name: company.group_name
      }
    });
    setErrors({ ...errors, [company.id]: '' });
  };

  const handleCancel = (id: string) => {
    setEditingId(null);
    const newEdited = { ...editedCompanies };
    delete newEdited[id];
    setEditedCompanies(newEdited);
    const newErrors = { ...errors };
    delete newErrors[id];
    setErrors(newErrors);
  };

  const handleChange = (id: string, field: 'company_code' | 'company_name' | 'group_name', value: string) => {
    setEditedCompanies({
      ...editedCompanies,
      [id]: {
        ...editedCompanies[id],
        [field]: value
      }
    });
    // Limpar erro do campo ao editar
    if (errors[id]) {
      setErrors({ ...errors, [id]: '' });
    }
  };

  const validate = (id: string, edited: { company_code: string; company_name: string; group_name: string }): string | null => {
    if (!edited.company_code.trim()) {
      return 'O código da loja é obrigatório';
    }

    if (!edited.company_name.trim()) {
      return 'O nome de identificação é obrigatório';
    }

    if (!edited.group_name) {
      return 'O grupo é obrigatório';
    }

    // Verificar se o código já existe em outra empresa
    const existingCompany = companies.find(
      c => c.id !== id && c.company_code.toLowerCase() === edited.company_code.toLowerCase().trim()
    );
    if (existingCompany) {
      return 'Já existe uma empresa com este código da loja';
    }

    return null;
  };

  const handleSave = async (id: string) => {
    const edited = editedCompanies[id];
    if (!edited) return;

    const error = validate(id, edited);
    if (error) {
      setErrors({ ...errors, [id]: error });
      return;
    }

    setLoading({ ...loading, [id]: true });
    try {
      await onUpdate(id, {
        company_code: edited.company_code.trim(),
        company_name: edited.company_name.trim(),
        name: edited.company_name.trim(),
        group_name: edited.group_name
      });

      // Recarregar lista de empresas
      await onRefresh();

      // Limpar estados
      setEditingId(null);
      const newEdited = { ...editedCompanies };
      delete newEdited[id];
      setEditedCompanies(newEdited);
      const newErrors = { ...errors };
      delete newErrors[id];
      setErrors(newErrors);
    } catch (err: any) {
      setErrors({ ...errors, [id]: err.message || 'Erro ao atualizar empresa. Tente novamente.' });
    } finally {
      setLoading({ ...loading, [id]: false });
    }
  };

  const filteredCompanies = companies
    .filter(company => {
      const search = searchTerm.toLowerCase();
      return (
        company.company_code.toLowerCase().includes(search) ||
        company.company_name.toLowerCase().includes(search) ||
        company.group_name.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      // Ordenar por código da loja em ordem crescente
      // Extrair números do código para ordenação numérica natural
      const codeA = a.company_code.trim();
      const codeB = b.company_code.trim();
      
      // Função para extrair número do código (ex: "loja 2" -> 2, "14" -> 14, "10.1" -> 10.1)
      const extractNumber = (code: string): number | null => {
        // Tentar encontrar número no código (pode ser inteiro ou decimal)
        const match = code.match(/(\d+\.?\d*)/);
        if (match) {
          const num = parseFloat(match[1]);
          return isNaN(num) ? null : num;
        }
        return null;
      };
      
      const numA = extractNumber(codeA);
      const numB = extractNumber(codeB);
      
      // Se ambos têm números, comparar numericamente
      if (numA !== null && numB !== null) {
        if (numA !== numB) {
          return numA - numB;
        }
        // Se os números são iguais, comparar o código completo como string
        return codeA.localeCompare(codeB, 'pt-BR', { numeric: true });
      }
      
      // Se apenas um tem número, o que tem número vem primeiro
      if (numA !== null) return -1;
      if (numB !== null) return 1;
      
      // Se nenhum tem número, comparar como string com ordenação natural
      return codeA.localeCompare(codeB, 'pt-BR', { numeric: true });
    });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${darkMode ? 'bg-[#0F172A] border border-slate-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col`}>
        <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            Editar Empresas ({companies.length})
          </h3>
          <button
            onClick={onClose}
            className={`${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Busca */}
        <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, nome ou grupo..."
            className={`w-full px-3 py-2 rounded-lg border ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-green-500'
                : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
            } focus:outline-none focus:ring-1 focus:ring-green-500`}
          />
        </div>

        {/* Lista de empresas */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredCompanies.length === 0 ? (
            <div className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              {searchTerm ? 'Nenhuma empresa encontrada com os filtros aplicados.' : 'Nenhuma empresa cadastrada.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCompanies.map((company) => {
                const isEditing = editingId === company.id;
                const edited = editedCompanies[company.id];
                const error = errors[company.id];
                const isLoading = loading[company.id];

                return (
                  <div
                    key={company.id}
                    className={`p-4 rounded-lg border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        {error && (
                          <div className={`p-2 rounded-lg flex items-center ${darkMode ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
                            <AlertCircle className={`w-4 h-4 mr-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
                            <p className={`text-xs ${darkMode ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                              Código da Loja <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={edited?.company_code || ''}
                              onChange={(e) => handleChange(company.id, 'company_code', e.target.value)}
                              disabled={isLoading}
                              className={`w-full px-2 py-1.5 text-sm rounded border ${
                                darkMode
                                  ? 'bg-slate-900 border-slate-600 text-slate-100 focus:border-green-500'
                                  : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                              } focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50`}
                            />
                          </div>

                          <div>
                            <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                              Nome de Identificação <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={edited?.company_name || ''}
                              onChange={(e) => handleChange(company.id, 'company_name', e.target.value)}
                              disabled={isLoading}
                              className={`w-full px-2 py-1.5 text-sm rounded border ${
                                darkMode
                                  ? 'bg-slate-900 border-slate-600 text-slate-100 focus:border-green-500'
                                  : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                              } focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50`}
                            />
                          </div>

                          <div>
                            <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                              Grupo <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={edited?.group_name || ''}
                              onChange={(e) => handleChange(company.id, 'group_name', e.target.value)}
                              disabled={isLoading}
                              className={`w-full px-2 py-1.5 text-sm rounded border ${
                                darkMode
                                  ? 'bg-slate-900 border-slate-600 text-slate-100 focus:border-green-500'
                                  : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                              } focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50`}
                            >
                              <option value="">Selecione</option>
                              {groups.map((group) => (
                                <option key={group} value={group}>
                                  {group}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 mt-3">
                          <button
                            onClick={() => handleCancel(company.id)}
                            disabled={isLoading}
                            className={`px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 ${
                              darkMode
                                ? 'text-slate-300 bg-slate-700 hover:bg-slate-600'
                                : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                            }`}
                          >
                            <XCircle className="w-4 h-4 inline mr-1" />
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSave(company.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          >
                            <Save className="w-4 h-4 inline mr-1" />
                            {isLoading ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                              Código da Loja
                            </p>
                            <p className={`font-medium ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                              {company.company_code}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                              Nome de Identificação
                            </p>
                            <p className={`font-medium ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                              {company.company_name}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs font-medium mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                              Grupo
                            </p>
                            <p className={`font-medium ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                              {company.group_name}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleEdit(company)}
                          className={`ml-4 px-3 py-1.5 text-sm rounded transition-colors ${
                            darkMode
                              ? 'text-blue-400 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800'
                              : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                          }`}
                        >
                          <Edit2 className="w-4 h-4 inline mr-1" />
                          Editar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className={`p-4 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg transition-colors ${
                darkMode
                  ? 'text-slate-300 bg-slate-800 hover:bg-slate-700'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
