import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { DESPESAS_OP_STRUCTURE } from '../lib/despesasOpStructure';
import { parseCoaSegments, matchApSegmentsToCoaRule } from '../lib/coaApSegmentMatch';
import type { CapCoaMatchCollector } from '../lib/coaCapMatchCollector';

// Colunas de variação (Variação e % Receita) ocultas por enquanto — ver docs/OCULTOS.md
const SHOW_VARIATION_COLUMNS = false;

/** Selo no acordeão «Despesas com mercadorias» — passe para false quando não for mais novidade */
const SHOW_MERCADORIAS_NEW_BADGE = true;

export interface DespesasOperacionaisTableProps {
  accountsPayable: any[];
  filters: { startDate: string; endDate: string; groups: string[]; companies: string[] };
  companies: any[];
  darkMode?: boolean;
  onRefresh?: () => void;
  /** Data/hora da última importação de contas a pagar (ISO string), para exibir "Última atualização" */
  lastAccountsPayableImportAt?: string | null;
  /** Exibe overlay de carregamento igual ao dos cards (spinner + "Carregando...") */
  loading?: boolean;
  /** Omitir título e bloco superior (uso embutido na DRE) */
  embedded?: boolean;
  /** Apenas linhas (tr) no tbody da DRE, sem table/thead próprios */
  tbodyOnly?: boolean;
}

const normalizeCode = (code: any): string => {
  if (!code) return '';
  const strCode = String(code).trim();
  const numCode = parseInt(strCode, 10);
  return isNaN(numCode) ? strCode : String(numCode);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function formatLastUpdate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const aa = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${aa} às ${hh}:${min}`;
  } catch {
    return '';
  }
}

/** Rótulos de coluna de período (iguais aos do thead da tabela de referência). */
export function getDespesasOperacionaisPeriodLabels(filters: { startDate: string; endDate: string }) {
  let currentStart = filters.startDate?.trim() || '';
  let currentEnd = filters.endDate?.trim() || '';
  if (!currentStart || !currentEnd) {
    const now = new Date();
    currentStart = format(now, 'yyyy-MM-01');
    currentEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  }
  let prevStart = '';
  let prevEnd = '';
  if (currentStart && currentEnd) {
    const startDate = parseISO(currentStart);
    const prevMonthDate = subMonths(startDate, 1);
    prevStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd');
    prevEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd');
  }
  const currentPeriodLabel =
    currentStart && currentEnd
      ? `${format(parseISO(currentStart), 'MMM', { locale: ptBR })} ${format(parseISO(currentStart), 'yyyy')}`
      : '-';
  const previousPeriodLabel =
    prevStart && prevEnd
      ? `${format(parseISO(prevStart), 'MMM', { locale: ptBR })} ${format(parseISO(prevStart), 'yyyy')}`
      : '-';
  return { currentPeriodLabel, previousPeriodLabel };
}

export type DespesasOperacionaisCellValues = {
  prevRealizado: number;
  curRealizado: number;
  curPrevisto: number;
};

/**
 * Mesma agregação usada pela tabela (contas a pagar + período dos filtros globais + grupos/empresas).
 * Exportada para a DRE alinhar totais de EBITDA sem duplicar regras.
 */
export function computeDespesasOperacionaisValuesMap(
  accountsPayable: any[],
  filters: { startDate: string; endDate: string; groups: string[]; companies: string[] },
  companies: any[],
  capMatchCollector?: CapCoaMatchCollector
): Record<string, DespesasOperacionaisCellValues> {
  const getCurrentPeriod = () => {
    const start = filters.startDate?.trim() || '';
    const end = filters.endDate?.trim() || '';
    if (start && end) return { start, end };
    const now = new Date();
    const s = format(now, 'yyyy-MM-01');
    const e = format(endOfMonth(now), 'yyyy-MM-dd');
    return { start: s, end: e };
  };
  const getPreviousPeriod = () => {
    const { start, end } = getCurrentPeriod();
    if (!start || !end) return { start: '', end: '' };
    const startDate = parseISO(start);
    const prevMonthDate = subMonths(startDate, 1);
    const prevStart = startOfMonth(prevMonthDate);
    const prevEnd = endOfMonth(prevMonthDate);
    return { start: format(prevStart, 'yyyy-MM-dd'), end: format(prevEnd, 'yyyy-MM-dd') };
  };

  let allowedBusinessUnits: Set<string> | null = null;
  if (companies.length > 0) {
    const hasActive = filters.groups.length > 0 || filters.companies.length > 0;
    if (hasActive) {
      allowedBusinessUnits = new Set(
        companies
          .filter(
            c =>
              (filters.groups.length === 0 || filters.groups.includes(c.group_name)) &&
              (filters.companies.length === 0 ||
                filters.companies.some(
                  (code: string) =>
                    String(code).trim() === String(c.company_code ?? '').trim() ||
                    normalizeCode(code) === normalizeCode(c.company_code ?? '')
                ))
          )
          .map(c => normalizeCode(c.company_code))
      );
    }
  }

  const current = getCurrentPeriod();
  const previous = getPreviousPeriod();
  const currentStart = current.start;
  const currentEnd = current.end;
  const prevStart = previous.start;
  const prevEnd = previous.end;

  const curStart = (currentStart || '').substring(0, 10);
  const curEnd = (currentEnd || '').substring(0, 10);
  const pStart = (prevStart || '').substring(0, 10);
  const pEnd = (prevEnd || '').substring(0, 10);
  const statusPrevisto = (s: string) => ['previsto', 'pendente', 'pending'].includes((s || '').toLowerCase().trim());
  const statusRealizado = (s: string) => ['realizado', 'pago', 'paid'].includes((s || '').toLowerCase().trim());

  const prevRealizadoList = pStart && pEnd
    ? accountsPayable.filter(ap => {
        const d = (ap.payment_date || '').toString().substring(0, 10);
        return (
          d &&
          d >= pStart &&
          d <= pEnd &&
          statusRealizado(ap.status) &&
          (allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(ap.business_unit)))
        );
      })
    : [];
  const curPrevistoList = curStart && curEnd
    ? accountsPayable.filter(ap => {
        const d = (ap.due_date || '').toString().substring(0, 10);
        return (
          d &&
          d >= curStart &&
          d <= curEnd &&
          statusPrevisto(ap.status) &&
          (allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(ap.business_unit)))
        );
      })
    : [];
  const curRealizadoList = curStart && curEnd
    ? accountsPayable.filter(ap => {
        const d = (ap.payment_date || '').toString().substring(0, 10);
        return (
          d &&
          d >= curStart &&
          d <= curEnd &&
          statusRealizado(ap.status) &&
          (allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(ap.business_unit)))
        );
      })
    : [];

  const segmentsCache = new Map<string, string[]>();
  const getSegments = (coa: string): string[] => {
    if (coa == null || coa === '') return [];
    const key = String(coa).trim();
    let seg = segmentsCache.get(key);
    if (seg === undefined) {
      seg = parseCoaSegments(key);
      segmentsCache.set(key, seg);
    }
    return seg;
  };
  const matchApToAccount = (ap: any, account: any): boolean => {
    const coa = ap.chart_of_accounts;
    if (coa == null || coa === '') return false;
    const segments = getSegments(coa);
    if (segments.length === 0) return false;
    const prefix = account.chartOfAccountsPrefix;
    const name = (account.name || account.id) ?? '';
    if (prefix)
      return matchApSegmentsToCoaRule(segments, account, capMatchCollector, ap, String((account as any).id ?? account.name));
    return segments.some(seg => seg === name || seg.toLowerCase() === name.toLowerCase());
  };

  const sumFromList = (list: any[], account: any): number =>
    list.filter(ap => matchApToAccount(ap, account)).reduce((sum, ap) => sum + Math.abs(parseFloat(ap.amount || 0)), 0);

  const map: Record<string, DespesasOperacionaisCellValues> = {};
  const ZERO: DespesasOperacionaisCellValues = { prevRealizado: 0, curRealizado: 0, curPrevisto: 0 };

  for (const account of DESPESAS_OP_STRUCTURE) {
    if (account.formula === 'sum') continue;
    const key = (account as any).id ?? (account as any).name;
    map[key] = {
      prevRealizado: sumFromList(prevRealizadoList, account),
      curRealizado: sumFromList(curRealizadoList, account),
      curPrevisto: sumFromList(curPrevistoList, account)
    };
  }
  for (let i = DESPESAS_OP_STRUCTURE.length - 1; i >= 0; i--) {
    const account = DESPESAS_OP_STRUCTURE[i];
    if (account.formula !== 'sum') continue;
    const key = (account as any).id ?? (account as any).name;
    const subAccounts = DESPESAS_OP_STRUCTURE.filter(acc => acc.parent === account.id || acc.parent === account.name);
    map[key] = subAccounts.reduce(
      (acc, sub: any) => {
        const v = map[sub.id ?? sub.name] ?? ZERO;
        return {
          prevRealizado: acc.prevRealizado + v.prevRealizado,
          curRealizado: acc.curRealizado + v.curRealizado,
          curPrevisto: acc.curPrevisto + v.curPrevisto
        };
      },
      { prevRealizado: 0, curRealizado: 0, curPrevisto: 0 }
    );
  }
  return map;
}

export const DespesasOperacionaisTableInner: React.FC<DespesasOperacionaisTableProps> = ({
  accountsPayable,
  filters,
  companies,
  darkMode = false,
  onRefresh,
  lastAccountsPayableImportAt = null,
  loading = false,
  embedded = false,
  tbodyOnly = false
}) => {
  // Padrão: Despesas Operacionais expandida (filhos visíveis); ainda é possível encolher/abrir
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({
    'despesas-op': true,
    'despesas-op-mercadorias': true
  });
  const [orcamentoData, setOrcamentoData] = useState<Record<string, { orcamento: number; orcamento_estrategico: number }>>({});
  const [editingOrcamento, setEditingOrcamento] = useState<{ accountKey: string; field: 'orcamento' | 'orcamento_estrategico' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingOrcamento, setSavingOrcamento] = useState(false);

  const getCurrentPeriod = () => {
    const start = filters.startDate?.trim() || '';
    const end = filters.endDate?.trim() || '';
    if (start && end) return { start, end };
    const now = new Date();
    const s = format(now, 'yyyy-MM-01');
    const e = format(endOfMonth(now), 'yyyy-MM-dd');
    return { start: s, end: e };
  };

  const getAccountKey = (account: any): string | null => {
    if (account.budgetAccountKey) return account.budgetAccountKey;
    if (account.chartOfAccountsPrefix) return account.chartOfAccountsPrefix;
    return null;
  };

  // Para cada conta com formula === 'sum', lista de account_key dos descendentes (folhas) para somar orçamentos
  const descendantAccountKeysMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    const getDescendantKeys = (parentIdOrName: string | undefined): string[] => {
      if (!parentIdOrName) return [];
      const keys: string[] = [];
      for (const acc of DESPESAS_OP_STRUCTURE) {
        const parent = (acc as any).parent;
        if (parent !== parentIdOrName) continue;
        const key = getAccountKey(acc);
        if (key) keys.push(key);
        else {
          const subId = (acc as any).id ?? (acc as any).name;
          keys.push(...getDescendantKeys(subId));
        }
      }
      return keys;
    };
    for (const account of DESPESAS_OP_STRUCTURE) {
      if (account.formula !== 'sum') continue;
      const idOrName = (account as any).id ?? (account as any).name;
      map[idOrName] = getDescendantKeys(idOrName);
    }
    return map;
  }, []);

  const currentStart = useMemo(() => getCurrentPeriod().start, [filters.startDate, filters.endDate]);

  const valuesMap = useMemo(
    () => computeDespesasOperacionaisValuesMap(accountsPayable, filters, companies),
    [accountsPayable, filters.startDate, filters.endDate, filters.groups, filters.companies, companies]
  );

  const periodFirstDay = useCallback(() => {
    if (!currentStart) return null;
    return currentStart.substring(0, 7) + '-01';
  }, [currentStart]);

  const loadOrcamento = useCallback(async () => {
    const period = periodFirstDay();
    if (!period) return;
    const { data, error } = await supabase
      .from('orcamento_despesas_operacionais')
      .select('account_key, orcamento, orcamento_estrategico')
      .eq('period', period);
    if (error) {
      console.error('Erro ao carregar orçamento despesas operacionais:', error);
      return;
    }
    const map: Record<string, { orcamento: number; orcamento_estrategico: number }> = {};
    (data || []).forEach((row: any) => {
      map[row.account_key] = {
        orcamento: Number(row.orcamento) || 0,
        orcamento_estrategico: Number(row.orcamento_estrategico) || 0
      };
    });
    setOrcamentoData(map);
  }, [periodFirstDay]);

  useEffect(() => {
    loadOrcamento();
  }, [loadOrcamento]);

  useEffect(() => {
    if (import.meta.env?.DEV && accountsPayable.length > 0) {
      const with03 = accountsPayable
        .map(ap => ap.chart_of_accounts)
        .filter(coa => coa != null && String(coa).trim().startsWith('03'));
      const unique = [...new Set(with03)];
      if (unique.length > 0) {
        console.log('[DespesasOperacionais] chart_of_accounts que começam com 03:', unique);
      }
    }
  }, [accountsPayable]);

  const saveOrcamento = useCallback(async (accountKey: string, field: 'orcamento' | 'orcamento_estrategico', value: number) => {
    const period = periodFirstDay();
    if (!period) return;
    setSavingOrcamento(true);
    const current = orcamentoData[accountKey] || { orcamento: 0, orcamento_estrategico: 0 };
    const payload = {
      account_key: accountKey,
      period,
      orcamento: field === 'orcamento' ? value : current.orcamento,
      orcamento_estrategico: field === 'orcamento_estrategico' ? value : current.orcamento_estrategico
    };
    const { error } = await supabase.from('orcamento_despesas_operacionais').upsert(payload, {
      onConflict: 'account_key,period',
      ignoreDuplicates: false
    });
    setSavingOrcamento(false);
    setEditingOrcamento(null);
    if (error) console.error('Erro ao salvar orçamento:', error);
    else {
      setOrcamentoData(prev => ({
        ...prev,
        [accountKey]: {
          orcamento: payload.orcamento,
          orcamento_estrategico: payload.orcamento_estrategico
        }
      }));
      onRefresh?.();
    }
  }, [periodFirstDay, orcamentoData, onRefresh]);

  const shouldShowAccount = (account: any): boolean => {
    if (account.level === 1) return true;
    if (!account.parent) return true;
    return expandedAccounts[account.parent] === true;
  };

  const toggleExpand = (accountId: string) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const { currentPeriodLabel, previousPeriodLabel } = useMemo(
    () => getDespesasOperacionaisPeriodLabels(filters),
    [filters.startDate, filters.endDate]
  );

  const renderRow = (account: any, index: number) => {
    if (tbodyOnly && account.id === 'despesas-op') return null;
    if (!shouldShowAccount(account)) return null;

    const rowKey = account.id ?? account.name;
    const v = valuesMap[rowKey] ?? { prevRealizado: 0, curRealizado: 0, curPrevisto: 0 };
    const previousValue = v.prevRealizado;
    const currentValue = v.curRealizado;
    const forecastedValue = v.curPrevisto;
    const variationValue = forecastedValue - currentValue;
    const variationPercentage = forecastedValue !== 0 ? ((forecastedValue - currentValue) / forecastedValue) * 100 : 0;
    const revenueDiffValue = currentValue - forecastedValue;
    const revenueDiffPercentage = forecastedValue !== 0 ? ((currentValue - forecastedValue) / forecastedValue) * 100 : 0;

    const accountKey = getAccountKey(account);
    const isSumRow = account.formula === 'sum';
    const descendantKeys = isSumRow ? (descendantAccountKeysMap[(account as any).id ?? (account as any).name] ?? []) : [];
    const orcamento = accountKey
      ? (orcamentoData[accountKey]?.orcamento ?? 0)
      : isSumRow
        ? descendantKeys.reduce((s, k) => s + (orcamentoData[k]?.orcamento ?? 0), 0)
        : 0;
    const orcamentoEstrategico = accountKey
      ? (orcamentoData[accountKey]?.orcamento_estrategico ?? 0)
      : isSumRow
        ? descendantKeys.reduce((s, k) => s + (orcamentoData[k]?.orcamento_estrategico ?? 0), 0)
        : 0;
    const isEditingThis = editingOrcamento?.accountKey === accountKey;
    const isEditingOrc = isEditingThis && editingOrcamento?.field === 'orcamento';
    const isEditingEstrat = isEditingThis && editingOrcamento?.field === 'orcamento_estrategico';

    const paddingClass = account.level === 1 ? 'px-4' : account.level === 2 ? 'pl-8 pr-4' : 'pl-12 pr-4';
    const fontClass = account.bold ? 'font-semibold' : '';
    const bgClass = darkMode && account.bg ? account.bg.replace('bg-orange-50', 'bg-amber-950/30') : account.bg || '';
    const isExpanded = account.id && expandedAccounts[account.id];
    const hasExpandIcon = account.expandable;

    const renderOrcamentoCell = (field: 'orcamento' | 'orcamento_estrategico') => {
      const displayValue = field === 'orcamento' ? orcamento : orcamentoEstrategico;
      if (!accountKey && !isSumRow) return <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>-</td>;
      if (isSumRow) {
        return (
          <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
            {formatCurrency(displayValue)}
          </td>
        );
      }
      const isEditing = field === 'orcamento' ? isEditingOrc : isEditingEstrat;
      const key = accountKey as string;
      return (
        <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => {
                const num = parseFloat(String(editValue).replace(',', '.').replace(/\s/g, '')) || 0;
                saveOrcamento(key, field, num);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const num = parseFloat(String(editValue).replace(',', '.').replace(/\s/g, '')) || 0;
                  saveOrcamento(key, field, num);
                }
                if (e.key === 'Escape') setEditingOrcamento(null);
              }}
              className={`w-24 px-2 py-1 text-right rounded ${darkMode ? 'bg-slate-800 text-slate-100 border-slate-600' : 'bg-white border-gray-300'} border`}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingOrcamento({ accountKey: key, field });
                setEditValue(displayValue === 0 ? '' : String(displayValue).replace('.', ','));
              }}
              disabled={savingOrcamento}
              className={`w-full text-right hover:underline ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}
            >
              {formatCurrency(displayValue)}
            </button>
          )}
        </td>
      );
    };

    return (
      <tr key={index} className={bgClass}>
        <td className={`border ${paddingClass} py-3 ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-800'}`}>
          <div className="flex items-center gap-2">
            {hasExpandIcon && (
              <button
                type="button"
                onClick={() => toggleExpand(account.id)}
                className={`p-1 rounded transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-200 text-gray-600'}`}
                title={isExpanded ? 'Colapsar' : 'Expandir'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
            {!hasExpandIcon && <span className="w-6" />}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span>{account.name}</span>
              {SHOW_MERCADORIAS_NEW_BADGE && account.id === 'despesas-op-mercadorias' && (
                <span
                  className="inline-flex shrink-0 items-center rounded-md bg-gradient-to-b from-emerald-500 to-emerald-700 px-2 py-0.5 text-[10px] font-black uppercase leading-none tracking-widest text-white shadow-[0_2px_4px_rgba(0,0,0,0.25)] ring-1 ring-emerald-900/25"
                  title="Novo agrupamento"
                  aria-label="Novo"
                >
                  NEW!
                </span>
              )}
            </div>
          </div>
        </td>
        <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
          {formatCurrency(previousValue)}
        </td>
        {renderOrcamentoCell('orcamento_estrategico')}
        {renderOrcamentoCell('orcamento')}
        <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-end gap-1">
            {orcamento > 0 && forecastedValue > orcamento && (
              <span title="Previsto acima do orçamento">
                <AlertTriangle className={`w-4 h-4 shrink-0 ${darkMode ? 'text-red-400' : 'text-red-600'}`} aria-hidden />
              </span>
            )}
            <span className={
              orcamento > 0
                ? forecastedValue > orcamento
                  ? darkMode ? 'text-red-400' : 'text-red-600'
                  : forecastedValue < orcamento
                    ? darkMode ? 'text-emerald-400' : 'text-emerald-600'
                    : darkMode ? 'text-slate-100' : 'text-gray-800'
                : darkMode ? 'text-slate-100' : 'text-gray-800'
            }>
              {formatCurrency(forecastedValue)}
            </span>
          </div>
        </td>
        <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
          {formatCurrency(currentValue)}
        </td>
        {SHOW_VARIATION_COLUMNS && (
          <>
            <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              <div className="flex flex-col items-end">
                <span>{formatCurrency(variationValue)}</span>
                <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {variationPercentage >= 0 ? '+' : ''}{variationPercentage.toFixed(1)}%
                </span>
              </div>
            </td>
            <td className={`border px-4 py-3 text-right ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              <div className="flex flex-col items-end">
                <span>{formatCurrency(revenueDiffValue)}</span>
                <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {revenueDiffPercentage >= 0 ? '+' : ''}{revenueDiffPercentage.toFixed(1)}%
                </span>
              </div>
            </td>
          </>
        )}
      </tr>
    );
  };

  const lastUpdateFormatted = lastAccountsPayableImportAt ? formatLastUpdate(lastAccountsPayableImportAt) : '';

  if (tbodyOnly) {
    if (loading) {
      return (
        <tr className={darkMode ? 'bg-slate-900' : ''}>
          <td
            colSpan={6}
            className={`border px-4 py-8 text-center ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
          >
            <div className="flex flex-col items-center gap-2">
              <span className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span className={`text-xs font-medium ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                Carregando...
              </span>
            </div>
          </td>
        </tr>
      );
    }
    return (
      <>
        {DESPESAS_OP_STRUCTURE.map((account, index) => renderRow(account, index))}
      </>
    );
  }

  return (
    <div className={embedded ? 'mb-0' : 'mb-8'}>
      {!embedded && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
          <h2 className={`text-lg font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Despesas Operacionais</h2>
          {lastUpdateFormatted && (
            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} title="Última importação do importador de contas a pagar">
              Última atualização: {lastUpdateFormatted}
            </span>
          )}
        </div>
      )}
      <div
        className={`relative overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'} ${embedded ? 'shadow-none border-0' : 'shadow'}`}
      >
        <table className="min-w-full border-collapse">
          <thead>
            <tr className={darkMode ? 'bg-slate-800' : 'bg-gray-50'}>
              <th className={`border px-4 py-3 text-left text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                Conta
              </th>
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                {previousPeriodLabel}
              </th>
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                Orçamento Estratégico
              </th>
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                {currentPeriodLabel} Orçamento
              </th>
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                {currentPeriodLabel} Previsto
              </th>
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                {currentPeriodLabel} Realizado
              </th>
              {SHOW_VARIATION_COLUMNS && (
                <>
                  <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                    Variação
                  </th>
                  <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                    % Receita
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {DESPESAS_OP_STRUCTURE.map((account, index) => renderRow(account, index))}
          </tbody>
        </table>
        {/* Overlay de carregamento igual ao dos cards */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/35 dark:bg-slate-950/35 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <span className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span className={`text-xs font-medium ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                Carregando...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const DespesasOperacionaisTable = React.memo(DespesasOperacionaisTableInner);
