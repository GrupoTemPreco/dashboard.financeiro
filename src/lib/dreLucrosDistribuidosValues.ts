import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { parseCoaSegments, matchApSegmentsToCoaRule } from './coaApSegmentMatch';
import type { CapCoaMatchCollector } from './coaCapMatchCollector';

/** Plano de contas: 07.2 Distribuição de Lucro; 06.2 Capital de Investimentos */
const LUCROS_DISTRIBUIDOS_LEAVES = [
  {
    id: 'lucros-distribuicao',
    name: 'Distribuição de Lucros',
    chartOfAccountsPrefix: '07.2',
    chartOfAccountsSegmentContains: 'Distribuição'
  },
  {
    id: 'lucros-capital-investimentos',
    name: 'Capital de Investimentos',
    chartOfAccountsPrefix: '06.2',
    chartOfAccountsSegmentContains: 'Investimentos'
  }
] as const;

export type DreLucrosDistribuidosCellValues = {
  prevRealizado: number;
  curRealizado: number;
  curPrevisto: number;
};

function normalizeCode(code: any): string {
  if (!code) return '';
  const strCode = String(code).trim();
  const numCode = parseInt(strCode, 10);
  return isNaN(numCode) ? strCode : String(numCode);
}

/**
 * Lucros distribuídos (despesas não operacionais): mesma base que deduções/D.O.
 * Chaves: lucros-distribuicao, lucros-capital-investimentos, lucros-distrib (total).
 */
export function computeLucrosDistribuidosValuesMap(
  accountsPayable: any[],
  filters: { startDate: string; endDate: string; groups: string[]; companies: string[] },
  companies: any[],
  capMatchCollector?: CapCoaMatchCollector
): Record<string, DreLucrosDistribuidosCellValues> {
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
  const curStart = (current.start || '').substring(0, 10);
  const curEnd = (current.end || '').substring(0, 10);
  const pStart = (previous.start || '').substring(0, 10);
  const pEnd = (previous.end || '').substring(0, 10);
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
  const matchApToAccount = (ap: any, account: (typeof LUCROS_DISTRIBUIDOS_LEAVES)[number]): boolean => {
    const coa = ap.chart_of_accounts;
    if (coa == null || coa === '') return false;
    const segments = getSegments(coa);
    if (segments.length === 0) return false;
    return matchApSegmentsToCoaRule(segments, account, capMatchCollector, ap, account.id);
  };

  const sumFromList = (list: any[], account: (typeof LUCROS_DISTRIBUIDOS_LEAVES)[number]): number =>
    list.filter(ap => matchApToAccount(ap, account)).reduce((sum, ap) => sum + Math.abs(parseFloat(ap.amount || 0)), 0);

  const map: Record<string, DreLucrosDistribuidosCellValues> = {};
  const ZERO: DreLucrosDistribuidosCellValues = { prevRealizado: 0, curRealizado: 0, curPrevisto: 0 };

  for (const account of LUCROS_DISTRIBUIDOS_LEAVES) {
    map[account.id] = {
      prevRealizado: sumFromList(prevRealizadoList, account),
      curRealizado: sumFromList(curRealizadoList, account),
      curPrevisto: sumFromList(curPrevistoList, account)
    };
  }

  map['lucros-distrib'] = LUCROS_DISTRIBUIDOS_LEAVES.reduce(
    (acc, leaf) => {
      const v = map[leaf.id] ?? ZERO;
      return {
        prevRealizado: acc.prevRealizado + v.prevRealizado,
        curRealizado: acc.curRealizado + v.curRealizado,
        curPrevisto: acc.curPrevisto + v.curPrevisto
      };
    },
    { ...ZERO }
  );

  return map;
}
