import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { DESPESAS_OP_ROOT_SECTION_IDS, DESPESAS_OP_STRUCTURE, despesasOpValuesMapKey } from '../lib/despesasOpStructure';
import { parseCoaSegments, matchApSegmentsToCoaRule } from '../lib/coaApSegmentMatch';
import type { CapCoaMatchCollector } from '../lib/coaCapMatchCollector';

// Colunas de variação (Variação e % Receita) ocultas por enquanto — ver docs/OCULTOS.md
const SHOW_VARIATION_COLUMNS = false;
const SHOW_BUDGET_COLUMNS = false;

/** Selo no acordeão «Despesas com mercadorias» — passe para false quando não for mais novidade */
const SHOW_MERCADORIAS_NEW_BADGE = true;

export interface DespesasOperacionaisTableProps {
  accountsPayable: any[];
  vendasPorUsuarioRows?: any[];
  filters: { startDate: string; endDate: string; groups: string[]; companies: string[] };
  companies: any[];
  darkMode?: boolean;
  onRefresh?: () => void;
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
const formatPercentage = (value: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;

/** Formata data/hora para o selo "Última atualização" (fuso do navegador). */
export function formatLastUpdate(isoString: string): string {
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
    const key = despesasOpValuesMapKey(account);
    map[key] = {
      prevRealizado: sumFromList(prevRealizadoList, account),
      curRealizado: sumFromList(curRealizadoList, account),
      curPrevisto: sumFromList(curPrevistoList, account)
    };
  }
  for (let i = DESPESAS_OP_STRUCTURE.length - 1; i >= 0; i--) {
    const account = DESPESAS_OP_STRUCTURE[i];
    if (account.formula !== 'sum') continue;
    const key = despesasOpValuesMapKey(account);
    const subAccounts = DESPESAS_OP_STRUCTURE.filter(acc => acc.parent === account.id || acc.parent === account.name);
    map[key] = subAccounts.reduce(
      (acc, sub: any) => {
        const v = map[despesasOpValuesMapKey(sub)] ?? ZERO;
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
  vendasPorUsuarioRows = [],
  filters,
  companies,
  darkMode = false,
  onRefresh,
  loading = false,
  embedded = false,
  tbodyOnly = false
}) => {
  const [isByStoreModalOpen, setIsByStoreModalOpen] = useState(false);
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
          const subId = despesasOpValuesMapKey(acc);
          keys.push(...getDescendantKeys(subId));
        }
      }
      return keys;
    };
    for (const account of DESPESAS_OP_STRUCTURE) {
      if (account.formula !== 'sum') continue;
      const idOrName = despesasOpValuesMapKey(account);
      map[idOrName] = getDescendantKeys(idOrName);
    }
    return map;
  }, []);

  const currentStart = useMemo(() => getCurrentPeriod().start, [filters.startDate, filters.endDate]);
  const previousPeriod = useMemo(() => {
    if (!currentStart) return { start: '', end: '' };
    const prevMonthDate = subMonths(parseISO(currentStart), 1);
    return {
      start: format(startOfMonth(prevMonthDate), 'yyyy-MM-dd'),
      end: format(endOfMonth(prevMonthDate), 'yyyy-MM-dd')
    };
  }, [currentStart]);

  const mercadoriasComparison = useMemo(() => {
    const current = getCurrentPeriod();
    const curStart = (current.start || '').substring(0, 10);
    const curEnd = (current.end || '').substring(0, 10);
    const prevStart = (previousPeriod.start || '').substring(0, 10);
    const prevEnd = (previousPeriod.end || '').substring(0, 10);
    const toDate = (v: any) => (v == null ? '' : String(v).split('T')[0]);
    const num = (v: any) => Number(v) || 0;
    const statusLower = (s: any) => String(s || '').toLowerCase().trim();
    const isRealizado = (s: any) => ['realizado', 'pago', 'paid'].includes(statusLower(s));
    const isMercadorias04 = (coa: any) => String(coa || '').toLowerCase().includes('04.0');

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
    const businessUnitAllowed = (businessUnit: any) =>
      allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(businessUnit));

    const faturamentoPrev = (vendasPorUsuarioRows || [])
      .filter(r => {
        const d = toDate(r.data);
        return d && d >= prevStart && d <= prevEnd && businessUnitAllowed(r.business_unit);
      })
      .reduce((sum, r) => sum + num(r.amount), 0);
    const faturamentoAtual = (vendasPorUsuarioRows || [])
      .filter(r => {
        const d = toDate(r.data);
        return d && d >= curStart && d <= curEnd && businessUnitAllowed(r.business_unit);
      })
      .reduce((sum, r) => sum + num(r.amount), 0);

    const cmvPrev = (accountsPayable || [])
      .filter(ap => {
        const d = toDate(ap.payment_date);
        return (
          d &&
          d >= prevStart &&
          d <= prevEnd &&
          isRealizado(ap.status) &&
          isMercadorias04(ap.chart_of_accounts) &&
          businessUnitAllowed(ap.business_unit)
        );
      })
      .reduce((sum, ap) => sum + Math.abs(num(ap.amount)), 0);

    const cmvAtual = (accountsPayable || [])
      .filter(ap => {
        const d = toDate(ap.payment_date);
        return (
          d &&
          d >= curStart &&
          d <= curEnd &&
          isRealizado(ap.status) &&
          isMercadorias04(ap.chart_of_accounts) &&
          businessUnitAllowed(ap.business_unit)
        );
      })
      .reduce((sum, ap) => sum + Math.abs(num(ap.amount)), 0);

    return { faturamentoPrev, cmvPrev, faturamentoAtual, cmvAtual };
  }, [accountsPayable, vendasPorUsuarioRows, companies, filters.groups, filters.companies, filters.startDate, filters.endDate, previousPeriod.start, previousPeriod.end]);

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
  const isCurrentMonthOpenForTrend = useMemo(() => {
    const current = getCurrentPeriod();
    const start = (current.start || '').substring(0, 10);
    if (!start) return false;
    const d = parseISO(start);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }, [filters.startDate, filters.endDate]);

  const getIndicatorClass = useCallback((metric: 'cmv' | 'cap', percent: number) => {
    if (!Number.isFinite(percent)) return darkMode ? 'text-slate-100' : 'text-gray-800';
    if (metric === 'cmv') {
      if (percent <= 60) return darkMode ? 'text-emerald-400' : 'text-emerald-600';
      if (percent <= 62.5) return darkMode ? 'text-amber-400' : 'text-amber-600';
      return darkMode ? 'text-red-400' : 'text-red-600';
    }
    if (percent <= 20) return darkMode ? 'text-emerald-400' : 'text-emerald-600';
    if (percent <= 22.5) return darkMode ? 'text-amber-400' : 'text-amber-600';
    return darkMode ? 'text-red-400' : 'text-red-600';
  }, [darkMode]);

  const byStoreComparisonRows = useMemo(() => {
    const current = getCurrentPeriod();
    const curStart = (current.start || '').substring(0, 10);
    const curEnd = (current.end || '').substring(0, 10);
    const prevStart = (previousPeriod.start || '').substring(0, 10);
    const prevEnd = (previousPeriod.end || '').substring(0, 10);
    const today = new Date();
    const currentStartDate = curStart ? parseISO(curStart) : null;
    const isCurrentMonthOpen =
      currentStartDate != null &&
      currentStartDate.getFullYear() === today.getFullYear() &&
      currentStartDate.getMonth() === today.getMonth();
    const prevEndDay = prevEnd ? Number(prevEnd.substring(8, 10)) : 0;
    const cappedPrevDay = prevEndDay > 0 ? Math.min(today.getDate(), prevEndDay) : today.getDate();
    const prevComparableEnd = prevStart ? `${prevStart.substring(0, 8)}${String(cappedPrevDay).padStart(2, '0')}` : '';
    const toDate = (v: any) => (v == null ? '' : String(v).split('T')[0]);
    const num = (v: any) => Number(v) || 0;
    const statusLower = (s: any) => String(s || '').toLowerCase().trim();
    const isRealizado = (s: any) => ['realizado', 'pago', 'paid'].includes(statusLower(s));
    const isMercadorias04 = (coa: any) => String(coa || '').toLowerCase().includes('04.0');
    const despesasOperacionaisLeafAccounts = DESPESAS_OP_STRUCTURE.filter(
      account => account.formula !== 'sum' && account.parent !== 'despesas-op-mercadorias'
    );
    const segmentsCache = new Map<string, string[]>();
    const getSegments = (coa: any): string[] => {
      if (coa == null || coa === '') return [];
      const key = String(coa).trim();
      let seg = segmentsCache.get(key);
      if (seg === undefined) {
        seg = parseCoaSegments(key);
        segmentsCache.set(key, seg);
      }
      return seg;
    };
    const apMatchesAccount = (ap: any, account: any): boolean => {
      const segments = getSegments(ap.chart_of_accounts);
      if (segments.length === 0) return false;
      const prefix = account.chartOfAccountsPrefix;
      const name = (account.name || account.id) ?? '';
      if (prefix) return matchApSegmentsToCoaRule(segments, account);
      return segments.some(seg => seg === name || seg.toLowerCase() === name.toLowerCase());
    };
    const isCapDespesasOperacionais = (ap: any) =>
      despesasOperacionaisLeafAccounts.some(account => apMatchesAccount(ap, account));

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
    const businessUnitAllowed = (businessUnit: any) =>
      allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(businessUnit));

    const companyNameByCode = new Map<string, string>();
    for (const c of companies || []) {
      const code = normalizeCode(c.company_code);
      if (!code) continue;
      const name = String(c.company_name || c.name || c.fantasy_name || c.razao_social || c.group_name || code).trim();
      companyNameByCode.set(code, name || code);
    }

    const bucket = new Map<string, {
      businessUnit: string;
      loja: string;
      faturamentoPrev: number;
      faturamentoPrevComparativo: number;
      capPrev: number;
      cmvPrev: number;
      faturamentoAtual: number;
      capAtual: number;
      cmvAtual: number;
    }>();

    const ensureRow = (rawBusinessUnit: any) => {
      const code = normalizeCode(rawBusinessUnit || 'Sem unidade');
      if (!bucket.has(code)) {
        bucket.set(code, {
          businessUnit: code,
          loja: companyNameByCode.get(code) || String(rawBusinessUnit || code),
          faturamentoPrev: 0,
          faturamentoPrevComparativo: 0,
          capPrev: 0,
          cmvPrev: 0,
          faturamentoAtual: 0,
          capAtual: 0,
          cmvAtual: 0
        });
      }
      return bucket.get(code)!;
    };

    for (const sale of vendasPorUsuarioRows || []) {
      if (!businessUnitAllowed(sale.business_unit)) continue;
      const d = toDate(sale.data);
      if (!d) continue;
      const row = ensureRow(sale.business_unit);
      if (d >= prevStart && d <= prevEnd) row.faturamentoPrev += num(sale.amount);
      if (d >= prevStart && d <= prevComparableEnd) row.faturamentoPrevComparativo += num(sale.amount);
      if (d >= curStart && d <= curEnd) row.faturamentoAtual += num(sale.amount);
    }

    for (const ap of accountsPayable || []) {
      if (!businessUnitAllowed(ap.business_unit)) continue;
      if (!isRealizado(ap.status)) continue;
      const d = toDate(ap.payment_date);
      if (!d) continue;
      const row = ensureRow(ap.business_unit);
      const amount = Math.abs(num(ap.amount));
      const isCmv = isMercadorias04(ap.chart_of_accounts);
      const isCap = isCapDespesasOperacionais(ap);
      if (d >= prevStart && d <= prevEnd) {
        if (isCmv) row.cmvPrev += amount;
        else if (isCap) row.capPrev += amount;
      }
      if (d >= curStart && d <= curEnd) {
        if (isCmv) row.cmvAtual += amount;
        else if (isCap) row.capAtual += amount;
      }
    }

    return Array.from(bucket.values()).sort((a, b) => b.capAtual - a.capAtual);
  }, [
    accountsPayable,
    vendasPorUsuarioRows,
    companies,
    filters.groups,
    filters.companies,
    filters.startDate,
    filters.endDate,
    previousPeriod.start,
    previousPeriod.end
  ]);

  const byStoreTotals = useMemo(() => {
    return byStoreComparisonRows.reduce(
      (acc, row) => ({
        faturamentoPrev: acc.faturamentoPrev + row.faturamentoPrev,
        faturamentoPrevComparativo: acc.faturamentoPrevComparativo + row.faturamentoPrevComparativo,
        capPrev: acc.capPrev + row.capPrev,
        cmvPrev: acc.cmvPrev + row.cmvPrev,
        faturamentoAtual: acc.faturamentoAtual + row.faturamentoAtual,
        capAtual: acc.capAtual + row.capAtual,
        cmvAtual: acc.cmvAtual + row.cmvAtual
      }),
      { faturamentoPrev: 0, faturamentoPrevComparativo: 0, capPrev: 0, cmvPrev: 0, faturamentoAtual: 0, capAtual: 0, cmvAtual: 0 }
    );
  }, [byStoreComparisonRows]);

  const totalGeral = useMemo(() => {
    const z = { prevRealizado: 0, curRealizado: 0, curPrevisto: 0, orcamento: 0, orcamentoEstrategico: 0 };
    for (const id of DESPESAS_OP_ROOT_SECTION_IDS) {
      const v = valuesMap[id];
      if (v) {
        z.prevRealizado += v.prevRealizado;
        z.curRealizado += v.curRealizado;
        z.curPrevisto += v.curPrevisto;
      }
      const keys = descendantAccountKeysMap[id] ?? [];
      for (const k of keys) {
        const o = orcamentoData[k];
        z.orcamento += o?.orcamento ?? 0;
        z.orcamentoEstrategico += o?.orcamento_estrategico ?? 0;
      }
    }
    return z;
  }, [valuesMap, orcamentoData, descendantAccountKeysMap]);

  const renderTotalGeralRow = () => {
    const fontClass = 'font-bold';
    const bgClass = darkMode ? 'bg-slate-800/80' : 'bg-slate-100';
    const orc = totalGeral.orcamento;
    const orcEst = totalGeral.orcamentoEstrategico;
    const forecastedValue = totalGeral.curPrevisto;
    const prevRevenue = mercadoriasComparison.faturamentoPrev;
    const curRevenue = mercadoriasComparison.faturamentoAtual;
    const prevRealizadoPct = prevRevenue > 0 ? (totalGeral.prevRealizado / prevRevenue) * 100 : null;
    const curRealizadoPct = curRevenue > 0 ? (totalGeral.curRealizado / curRevenue) * 100 : null;
    return (
      <tr key="total-geral-despesas" className={bgClass}>
        <td
          className={`border px-4 py-3 ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}
        >
          <div className="flex items-center gap-2">
            <span className="w-6" />
            <span>Total geral</span>
          </div>
        </td>
        {!tbodyOnly && (
          <>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              {formatCurrency(mercadoriasComparison.faturamentoPrev)}
            </td>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              <span className={prevRealizadoPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : (darkMode ? 'text-slate-100' : 'text-gray-800')}>
                {formatCurrency(totalGeral.prevRealizado)}{prevRealizadoPct == null ? '' : ` (${formatPercentage(prevRealizadoPct)})`}
              </span>
            </td>
          </>
        )}
        {tbodyOnly && (
          <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
            {formatCurrency(totalGeral.prevRealizado)}
          </td>
        )}
        {SHOW_BUDGET_COLUMNS && (
          <>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              {formatCurrency(orcEst)}
            </td>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              {formatCurrency(orc)}
            </td>
          </>
        )}
        <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-end gap-1">
            {orc > 0 && forecastedValue > orc && (
              <span title="Previsto acima do orçamento">
                <AlertTriangle className={`w-4 h-4 shrink-0 ${darkMode ? 'text-red-400' : 'text-red-600'}`} aria-hidden />
              </span>
            )}
            <span
              className={
                orc > 0
                  ? forecastedValue > orc
                    ? darkMode
                      ? 'text-red-400'
                      : 'text-red-600'
                    : forecastedValue < orc
                      ? darkMode
                        ? 'text-emerald-400'
                        : 'text-emerald-600'
                      : darkMode
                        ? 'text-slate-100'
                        : 'text-gray-800'
                  : darkMode
                    ? 'text-slate-100'
                    : 'text-gray-800'
              }
            >
              {formatCurrency(forecastedValue)}
            </span>
          </div>
        </td>
        {!tbodyOnly && (
          <>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              {formatCurrency(mercadoriasComparison.faturamentoAtual)}
            </td>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
              <span className={curRealizadoPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : (darkMode ? 'text-slate-100' : 'text-gray-800')}>
                {formatCurrency(totalGeral.curRealizado)}{curRealizadoPct == null ? '' : ` (${formatPercentage(curRealizadoPct)})`}
              </span>
            </td>
          </>
        )}
        {tbodyOnly && (
          <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
            {formatCurrency(totalGeral.curRealizado)}
          </td>
        )}
        {SHOW_VARIATION_COLUMNS && (
          <>
            <td
              className={`border px-4 py-3 text-right text-slate-500 ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
            >
              —
            </td>
            <td
              className={`border px-4 py-3 text-right text-slate-500 ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
            >
              —
            </td>
          </>
        )}
      </tr>
    );
  };

  const renderRow = (account: any, index: number) => {
    if (tbodyOnly && account.id === 'despesas-op') return null;
    if (!shouldShowAccount(account)) return null;

    const rowKey = despesasOpValuesMapKey(account);
    const v = valuesMap[rowKey] ?? { prevRealizado: 0, curRealizado: 0, curPrevisto: 0 };
    const showRevenueColumns = !tbodyOnly && account.level === 1;
    const isMercadoriasRow = rowKey === 'despesas-op-mercadorias';
    const isMercadoriasDescendant = account.parent === 'despesas-op-mercadorias';
    const realizedIndicatorMetric: 'cmv' | 'cap' = isMercadoriasRow || isMercadoriasDescendant ? 'cmv' : 'cap';
    const previousValue = v.prevRealizado;
    const currentValue = v.curRealizado;
    const forecastedValue = v.curPrevisto;
    const variationValue = forecastedValue - currentValue;
    const variationPercentage = forecastedValue !== 0 ? ((forecastedValue - currentValue) / forecastedValue) * 100 : 0;
    const revenueDiffValue = currentValue - forecastedValue;
    const revenueDiffPercentage = forecastedValue !== 0 ? ((currentValue - forecastedValue) / forecastedValue) * 100 : 0;
    const prevRevenue = mercadoriasComparison.faturamentoPrev;
    const curRevenue = mercadoriasComparison.faturamentoAtual;
    const prevRealizadoPct = prevRevenue > 0 ? (previousValue / prevRevenue) * 100 : null;
    const curRealizadoPct = curRevenue > 0 ? (currentValue / curRevenue) * 100 : null;

    const accountKey = getAccountKey(account);
    const isSumRow = account.formula === 'sum';
    const descendantKeys = isSumRow ? (descendantAccountKeysMap[despesasOpValuesMapKey(account)] ?? []) : [];
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
        {!tbodyOnly && (
          <>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-slate-500'}`}>
              {showRevenueColumns ? formatCurrency(mercadoriasComparison.faturamentoPrev) : '-'}
            </td>
            <td className={`border px-4 py-3 text-right tabular-nums ${fontClass} ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              {showRevenueColumns ? (
                <span className={prevRealizadoPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass(realizedIndicatorMetric, prevRealizadoPct)}>
                  {formatCurrency(previousValue)}{prevRealizadoPct == null ? '' : ` (${isMercadoriasRow ? `CMV ${formatPercentage(prevRealizadoPct)}` : formatPercentage(prevRealizadoPct)})`}
                </span>
              ) : (
                <span className={prevRealizadoPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : (darkMode ? 'text-slate-100' : 'text-gray-800')}>
                  {formatCurrency(previousValue)}
                  {prevRealizadoPct == null ? '' : ` (${isMercadoriasDescendant ? `CMV ${formatPercentage(prevRealizadoPct)}` : formatPercentage(prevRealizadoPct)})`}
                </span>
              )}
            </td>
          </>
        )}
        {tbodyOnly && (
          <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
            {formatCurrency(previousValue)}
          </td>
        )}
        {SHOW_BUDGET_COLUMNS && (
          <>
            {renderOrcamentoCell('orcamento_estrategico')}
            {renderOrcamentoCell('orcamento')}
          </>
        )}
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
        {!tbodyOnly && (
          <>
            <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-slate-500'}`}>
              {showRevenueColumns ? formatCurrency(mercadoriasComparison.faturamentoAtual) : '-'}
            </td>
            <td className={`border px-4 py-3 text-right tabular-nums ${fontClass} ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              {showRevenueColumns ? (
                <span className={curRealizadoPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass(realizedIndicatorMetric, curRealizadoPct)}>
                  {formatCurrency(currentValue)}{curRealizadoPct == null ? '' : ` (${isMercadoriasRow ? `CMV ${formatPercentage(curRealizadoPct)}` : formatPercentage(curRealizadoPct)})`}
                </span>
              ) : (
                <span className={curRealizadoPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : (darkMode ? 'text-slate-100' : 'text-gray-800')}>
                  {formatCurrency(currentValue)}
                  {curRealizadoPct == null ? '' : ` (${isMercadoriasDescendant ? `CMV ${formatPercentage(curRealizadoPct)}` : formatPercentage(curRealizadoPct)})`}
                </span>
              )}
            </td>
          </>
        )}
        {tbodyOnly && (
          <td className={`border px-4 py-3 text-right ${fontClass} ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200'}`}>
            {formatCurrency(currentValue)}
          </td>
        )}
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

  if (tbodyOnly) {
    const visibleColumnCount = SHOW_BUDGET_COLUMNS ? 6 : 4;
    if (loading) {
      return (
        <tr className={darkMode ? 'bg-slate-900' : ''}>
          <td
            colSpan={visibleColumnCount}
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
        {renderTotalGeralRow()}
        {DESPESAS_OP_STRUCTURE.map((account, index) => renderRow(account, index))}
      </>
    );
  }

  return (
    <div className={embedded ? 'mb-0' : 'mb-8'}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className={`text-lg font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Despesas Operacionais</h2>
          <button
            type="button"
            onClick={() => setIsByStoreModalOpen(true)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              darkMode
                ? 'bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700'
                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
            }`}
          >
            Ver por loja
          </button>
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
                Faturamento (mês anterior)
              </th>
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                {previousPeriodLabel} Realizado
              </th>
              {SHOW_BUDGET_COLUMNS && (
                <>
                  <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                    Orçamento Estratégico
                  </th>
                  <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                    {currentPeriodLabel} Orçamento
                  </th>
                </>
              )}
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                {currentPeriodLabel} Previsto
              </th>
              <th className={`border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-700'}`}>
                Faturamento (mês atual)
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
            {renderTotalGeralRow()}
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
      {isByStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-7xl max-h-[88vh] overflow-hidden rounded-lg border shadow-xl ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-base font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>Despesas Operacionais por loja</h3>
              <button
                type="button"
                onClick={() => setIsByStoreModalOpen(false)}
                className={`px-2 py-1 rounded text-sm ${darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Fechar
              </button>
            </div>
            <div className="overflow-auto max-h-[76vh]">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className={darkMode ? 'bg-slate-800' : 'bg-gray-50'}>
                    <th className={`sticky top-0 border px-4 py-3 text-left text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'}`}>Loja</th>
                    <th className={`sticky top-0 border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'}`}>Faturamento {previousPeriodLabel}</th>
                    <th className={`sticky top-0 border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'}`}>CAP {previousPeriodLabel}</th>
                    <th className={`sticky top-0 border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'}`}>CMV {previousPeriodLabel}</th>
                    <th className={`sticky top-0 border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'}`}>Faturamento {currentPeriodLabel}</th>
                    <th className={`sticky top-0 border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'}`}>CAP {currentPeriodLabel}</th>
                    <th className={`sticky top-0 border px-4 py-3 text-right text-sm font-semibold ${darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'}`}>CMV {currentPeriodLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {byStoreComparisonRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`border px-4 py-8 text-center text-sm ${darkMode ? 'border-slate-700 text-slate-400' : 'border-gray-200 text-gray-500'}`}>
                        Sem dados para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {byStoreComparisonRows.map(row => {
                        const capPrevPct = row.faturamentoPrev > 0 ? (row.capPrev / row.faturamentoPrev) * 100 : null;
                        const cmvPrevPct = row.faturamentoPrev > 0 ? (row.cmvPrev / row.faturamentoPrev) * 100 : null;
                        const capAtualPct = row.faturamentoAtual > 0 ? (row.capAtual / row.faturamentoAtual) * 100 : null;
                        const cmvAtualPct = row.faturamentoAtual > 0 ? (row.cmvAtual / row.faturamentoAtual) * 100 : null;
                        const faturamentoComparativo = isCurrentMonthOpenForTrend ? row.faturamentoPrevComparativo : row.faturamentoPrev;
                        const faturamentoTrend: 'up' | 'down' | 'equal' =
                          row.faturamentoAtual > faturamentoComparativo ? 'up' : row.faturamentoAtual < faturamentoComparativo ? 'down' : 'equal';
                        const faturamentoTrendClass =
                          faturamentoTrend === 'up'
                            ? (darkMode ? 'text-emerald-400' : 'text-emerald-600')
                            : faturamentoTrend === 'down'
                              ? (darkMode ? 'text-red-400' : 'text-red-600')
                              : (darkMode ? 'text-amber-400' : 'text-amber-600');
                        const faturamentoTrendSymbol = faturamentoTrend === 'up' ? '↑' : faturamentoTrend === 'down' ? '↓' : '=';
                        return (
                          <tr key={row.businessUnit} className={darkMode ? 'hover:bg-slate-800/40' : 'hover:bg-gray-50'}>
                            <td className={`border px-4 py-3 text-sm ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>{row.loja}</td>
                            <td className={`border px-4 py-3 text-right text-sm ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>{formatCurrency(row.faturamentoPrev)}</td>
                            <td className={`border px-4 py-3 text-right text-sm ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={capPrevPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cap', capPrevPct)}>
                                {formatCurrency(row.capPrev)}{capPrevPct == null ? '' : ` (${formatPercentage(capPrevPct)})`}
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={cmvPrevPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cmv', cmvPrevPct)}>
                                {cmvPrevPct == null ? '-' : `${formatCurrency(row.cmvPrev)} (${formatPercentage(cmvPrevPct)})`}
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className="inline-flex items-center justify-end gap-2">
                                <span>{formatCurrency(row.faturamentoAtual)}</span>
                                <span className={`font-bold ${faturamentoTrendClass}`} title={isCurrentMonthOpenForTrend ? 'Comparado ao acumulado até hoje do mês anterior' : 'Comparado ao mês anterior fechado'}>
                                  {faturamentoTrendSymbol}
                                </span>
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={capAtualPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cap', capAtualPct)}>
                                {formatCurrency(row.capAtual)}{capAtualPct == null ? '' : ` (${formatPercentage(capAtualPct)})`}
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={cmvAtualPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cmv', cmvAtualPct)}>
                                {cmvAtualPct == null ? '-' : `${formatCurrency(row.cmvAtual)} (${formatPercentage(cmvAtualPct)})`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const capPrevPct = byStoreTotals.faturamentoPrev > 0 ? (byStoreTotals.capPrev / byStoreTotals.faturamentoPrev) * 100 : null;
                        const cmvPrevPct = byStoreTotals.faturamentoPrev > 0 ? (byStoreTotals.cmvPrev / byStoreTotals.faturamentoPrev) * 100 : null;
                        const capAtualPct = byStoreTotals.faturamentoAtual > 0 ? (byStoreTotals.capAtual / byStoreTotals.faturamentoAtual) * 100 : null;
                        const cmvAtualPct = byStoreTotals.faturamentoAtual > 0 ? (byStoreTotals.cmvAtual / byStoreTotals.faturamentoAtual) * 100 : null;
                        const faturamentoComparativoTotal = isCurrentMonthOpenForTrend ? byStoreTotals.faturamentoPrevComparativo : byStoreTotals.faturamentoPrev;
                        const faturamentoTrendTotal: 'up' | 'down' | 'equal' =
                          byStoreTotals.faturamentoAtual > faturamentoComparativoTotal
                            ? 'up'
                            : byStoreTotals.faturamentoAtual < faturamentoComparativoTotal
                              ? 'down'
                              : 'equal';
                        const faturamentoTrendTotalClass =
                          faturamentoTrendTotal === 'up'
                            ? (darkMode ? 'text-emerald-400' : 'text-emerald-600')
                            : faturamentoTrendTotal === 'down'
                              ? (darkMode ? 'text-red-400' : 'text-red-600')
                              : (darkMode ? 'text-amber-400' : 'text-amber-600');
                        const faturamentoTrendTotalSymbol = faturamentoTrendTotal === 'up' ? '↑' : faturamentoTrendTotal === 'down' ? '↓' : '=';
                        return (
                          <tr className={darkMode ? 'bg-slate-800/70' : 'bg-gray-100'}>
                            <td className={`border px-4 py-3 text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>Total</td>
                            <td className={`border px-4 py-3 text-right text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>{formatCurrency(byStoreTotals.faturamentoPrev)}</td>
                            <td className={`border px-4 py-3 text-right text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={capPrevPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cap', capPrevPct)}>
                                {formatCurrency(byStoreTotals.capPrev)}{capPrevPct == null ? '' : ` (${formatPercentage(capPrevPct)})`}
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={cmvPrevPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cmv', cmvPrevPct)}>
                                {cmvPrevPct == null ? '-' : `${formatCurrency(byStoreTotals.cmvPrev)} (${formatPercentage(cmvPrevPct)})`}
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className="inline-flex items-center justify-end gap-2">
                                <span>{formatCurrency(byStoreTotals.faturamentoAtual)}</span>
                                <span className={`font-bold ${faturamentoTrendTotalClass}`} title={isCurrentMonthOpenForTrend ? 'Comparado ao acumulado até hoje do mês anterior' : 'Comparado ao mês anterior fechado'}>
                                  {faturamentoTrendTotalSymbol}
                                </span>
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={capAtualPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cap', capAtualPct)}>
                                {formatCurrency(byStoreTotals.capAtual)}{capAtualPct == null ? '' : ` (${formatPercentage(capAtualPct)})`}
                              </span>
                            </td>
                            <td className={`border px-4 py-3 text-right text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
                              <span className={cmvAtualPct == null ? (darkMode ? 'text-slate-500' : 'text-gray-400') : getIndicatorClass('cmv', cmvAtualPct)}>
                                {cmvAtualPct == null ? '-' : `${formatCurrency(byStoreTotals.cmvAtual)} (${formatPercentage(cmvAtualPct)})`}
                              </span>
                            </td>
                          </tr>
                        );
                      })()}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DespesasOperacionaisTable = React.memo(DespesasOperacionaisTableInner);
