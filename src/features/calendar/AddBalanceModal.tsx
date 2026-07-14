import React, { useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AddBalanceModalProps {
  open: boolean;
  date: string;
  darkMode?: boolean;
  validUnitCodes: string[];
  bankOptions?: string[];
  onClose: () => void;
  onSaved: () => void;
}

function normalizeUnit(code: string): string {
  const s = String(code || '').trim();
  const n = parseInt(s, 10);
  return isNaN(n) ? s : String(n);
}

function parseValor(v: string): number {
  if (!v || !v.trim()) return 0;
  const normalized = String(v).replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

export const AddBalanceModal: React.FC<AddBalanceModalProps> = ({
  open,
  date,
  darkMode = false,
  validUnitCodes,
  bankOptions = [],
  onClose,
  onSaved,
}) => {
  const [unidade, setUnidade] = useState('');
  const [banco, setBanco] = useState('');
  const [bancoOutro, setBancoOutro] = useState('');
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const banks = useMemo(() => {
    const uniq = Array.from(new Set(bankOptions.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    return [...uniq, 'Outro'];
  }, [bankOptions]);

  if (!open) return null;

  const resetAndClose = () => {
    setUnidade('');
    setBanco('');
    setBancoOutro('');
    setValor('');
    setObservacao('');
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    const unit = unidade.trim();
    if (!unit) {
      setError('Informe a unidade (código da empresa).');
      return;
    }
    if (validUnitCodes.length > 0 && !validUnitCodes.includes(normalizeUnit(unit))) {
      setError(`A unidade "${unit}" não existe. Cadastre a empresa antes de lançar.`);
      return;
    }
    const amount = parseValor(valor);
    if (amount === 0) {
      setError('Informe um valor diferente de zero.');
      return;
    }
    const bankName =
      banco === 'Outro' ? (bancoOutro || '').trim() || 'Outro' : (banco || '').trim() || 'Banco';

    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('saldos_iniciais').insert({
        business_unit: unit,
        bank_name: bankName,
        balance: amount,
        balance_date: date,
        observacao: observacao.trim() || null,
      });
      if (insertError) throw insertError;
      resetAndClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gravar o saldo.');
    } finally {
      setSaving(false);
    }
  };

  const panel = darkMode
    ? 'bg-slate-900 text-slate-100 border-slate-700'
    : 'bg-white text-gray-900 border-gray-200';
  const inputCls = darkMode
    ? 'w-full rounded-md border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 text-sm'
    : 'w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm';

  const [y, m, d] = date.split('-');
  const dateLabel = d && m && y ? `${d}/${m}/${y}` : date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={resetAndClose} aria-hidden />
      <div className={`relative w-full max-w-md rounded-lg border shadow-xl ${panel}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
          <h3 className="text-lg font-semibold">Adicionar saldo — {dateLabel}</h3>
          <button
            type="button"
            onClick={resetAndClose}
            className={`p-1.5 rounded-md ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Unidade *</label>
            <input
              type="text"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              placeholder="Código da empresa"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Banco</label>
            <select
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione</option>
              {banks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {banco === 'Outro' && (
              <input
                type="text"
                value={bancoOutro}
                onChange={(e) => setBancoOutro(e.target.value)}
                placeholder="Nome do banco"
                className={`${inputCls} mt-2`}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Valor *</label>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Observação</label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
              className={inputCls}
            />
          </div>
          {error && (
            <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-inherit">
          <button
            type="button"
            onClick={resetAndClose}
            className={`px-4 py-2 text-sm rounded-lg ${
              darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
