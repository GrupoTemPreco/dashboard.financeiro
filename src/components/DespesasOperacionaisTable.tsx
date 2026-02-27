import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

// Colunas de variação (Variação e % Receita) ocultas por enquanto — ver docs/OCULTOS.md
const SHOW_VARIATION_COLUMNS = false;

// Estrutura apenas da seção Despesas Operacionais (igual à DRE)
// chartOfAccountsPrefix + chartOfAccountsSegmentContains: evita pegar "03.1 Despesas Operacionais" (grupo) e pega só a conta específica (ex.: "03.1 Simples Nacional...")
const DESPESAS_OP_STRUCTURE = [
  { id: 'despesas-op', name: 'Despesas Operacionais', level: 1, editable: false, bg: 'bg-orange-50', bold: true, formula: 'sum', parent: null as string | null, expandable: true },
  { id: 'imposto-venda', name: 'Imposto sobre venda', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Simples Nacional pago no período (R$)', level: 3, editable: true, bg: '', parent: 'imposto-venda', chartOfAccountsPrefix: '03.1', chartOfAccountsSegmentContains: 'Simples Nacional' },
  { name: 'ICMS Pago No Período', level: 3, editable: true, bg: '', parent: 'imposto-venda', chartOfAccountsPrefix: '03.2', chartOfAccountsSegmentContains: 'ICMS' },
  { name: 'Parcelamento de Divida Ativa pago no período', level: 3, editable: true, bg: '', parent: 'imposto-venda', chartOfAccountsPrefix: '03.3', chartOfAccountsSegmentContains: 'Parcelamento' },
  { id: 'despesas-op-pessoal', name: 'Despesas operacionais com pessoal', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Salários Fixos + Horas Extras', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.01', chartOfAccountsSegmentContains: 'Salários' },
  { name: 'Custo com Motoboy', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.16', chartOfAccountsSegmentContains: 'Motoboy' },
  { name: 'Convênio Makebella', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.15', chartOfAccountsSegmentContains: 'Makebella' },
  { name: 'Comissões e Premiações Sobre Vendas', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.02', chartOfAccountsSegmentContains: 'Comissões' },
  { name: '13º. Salário e Férias', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.03', chartOfAccountsSegmentContains: 'Férias' },
  { name: 'Endomarketing', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.04', chartOfAccountsSegmentContains: 'Endomarketing' },
  { name: 'Vale Transporte', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.05', chartOfAccountsSegmentContains: 'Vale' },
  { name: 'Encargos - FGTS', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.06', chartOfAccountsSegmentContains: 'FGTS' },
  { name: 'Encargos - INSS / IRPF', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.07', chartOfAccountsSegmentContains: 'IRPF' },
  { name: 'FGTS Multa Recisória', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.08', chartOfAccountsSegmentContains: 'Multa' },
  { name: 'Verba Rescisória', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.09', chartOfAccountsSegmentContains: 'Verba' },
  { name: 'Uniforme', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.10', chartOfAccountsSegmentContains: 'Uniforme' },
  { name: 'Exames Médicos', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.11', chartOfAccountsSegmentContains: 'Exames' },
  { name: 'Encargo em Atraso - INSS / IRRF', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.12', chartOfAccountsSegmentContains: 'IRRF' },
  { name: 'Encargo em Atraso - FGTS', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.13', chartOfAccountsSegmentContains: 'Atraso' },
  { name: 'Indenização Trabalhista', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.14', chartOfAccountsSegmentContains: 'Indenização' },
  { name: 'Pró-Labore', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '06.1', chartOfAccountsSegmentContains: 'Labore' },
  { id: 'despesas-op-assessorias', name: 'Despesas operacionais com assessorias', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Aluguel do POS de Cartão e Crédito', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.1', chartOfAccountsSegmentContains: 'POS' },
  { name: 'Escritório de Contabilidade', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.2', chartOfAccountsSegmentContains: 'Contabilidade' },
  { name: 'Assessoria Jurídica', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.3', chartOfAccountsSegmentContains: 'Juridica' },
  { name: 'Cursos, Treinamentos e Despesas de Viagem', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.4', chartOfAccountsSegmentContains: 'Cursos' },
  { name: 'Entidades', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.5', chartOfAccountsSegmentContains: 'Entidades' },
  { name: 'Manutenção de Software + Hardware', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.6', chartOfAccountsSegmentContains: 'Software' },
  { name: 'Outras Despesas com Assessorias', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.7', chartOfAccountsSegmentContains: 'Outras' },
  { name: 'Mensalidades', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.8', chartOfAccountsSegmentContains: 'Mensalidades' },
  { name: 'Alarmes e Segurança', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.9', chartOfAccountsSegmentContains: 'Alarmes' },
  { name: 'Sistemas e Servidores', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.10', chartOfAccountsSegmentContains: 'Sistemas' },
  { id: 'despesas-op-admin', name: 'Despesas operacionais administrativas', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Seguro da Empresa (Imóvel e Veículos)', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.1', chartOfAccountsSegmentContains: 'Seguro' },
  { name: 'Manutenção de Veículos', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.2', chartOfAccountsSegmentContains: 'Manutenção' },
  { name: 'Prosegur', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.2', chartOfAccountsSegmentContains: 'Prosegur' },
  { name: 'Combustível Operacional', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.3', chartOfAccountsSegmentContains: 'Combustível' },
  { name: 'Prestador de Serviço Terceirizado', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.4', chartOfAccountsSegmentContains: 'Terceirizado' },
  { id: 'despesas-op-func', name: 'Despesas operacionais com funcionamento', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Aluguel', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.01', chartOfAccountsSegmentContains: 'Aluguel' },
  { name: 'IPTU', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.02', chartOfAccountsSegmentContains: 'IPTU' },
  { name: 'Energia Elétrica', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.03', chartOfAccountsSegmentContains: 'Energia' },
  { name: 'Água / Esgoto', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.04', chartOfAccountsSegmentContains: 'Água' },
  { name: 'Telefone / Acesso a Internet', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.05', chartOfAccountsSegmentContains: 'Telefone' },
  { name: 'Consumo Interno', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.06', chartOfAccountsSegmentContains: 'Consumo Interno', chartOfAccountsSegmentExcludes: 'Lojas' },
  { name: 'Mat.Limpeza / Faxina', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.07', chartOfAccountsSegmentContains: 'Limpeza' },
  { name: 'Manutenção de Instalações', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.08', chartOfAccountsSegmentContains: 'Instalações' },
  { name: 'Taxas e Licenças da Farmácia', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.09', chartOfAccountsSegmentContains: 'Taxas' },
  { name: 'TFE -Tx Fiscalização Estabelecimento', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.10', chartOfAccountsSegmentContains: 'TFE' },
  { name: 'TFA - Tx de Fiscalização Anuncios', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.11', chartOfAccountsSegmentContains: 'TFA' },
  { name: 'Promoção e Propaganda', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.12', chartOfAccountsSegmentContains: 'Promoção' },
  { name: 'Outras Despesas de Funcionamento', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.13', chartOfAccountsSegmentContains: 'Outras' },
  { name: 'Consumo Interno - Lojas', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.14', chartOfAccountsSegmentContains: 'Lojas' },
  { id: 'despesas-financeiras', name: 'Despesas financeiras', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Juros de Cheque, Duplicatas e Demais Juros', level: 3, editable: true, bg: '', parent: 'despesas-financeiras', chartOfAccountsPrefix: '10.1', chartOfAccountsSegmentContains: 'Juros' },
  { name: 'Tarifas Bancárias', level: 3, editable: true, bg: '', parent: 'despesas-financeiras', chartOfAccountsPrefix: '10.2', chartOfAccountsSegmentContains: 'Tarifas' },
  { id: 'despesas-extras', name: 'Despesas Extras', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Produtos Vencidos', level: 3, editable: true, bg: '', parent: 'despesas-extras', chartOfAccountsPrefix: '13.01', chartOfAccountsSegmentContains: 'Produtos Vencidos' },
  { name: 'Quebra de Inventário', level: 3, editable: true, bg: '', parent: 'despesas-extras', chartOfAccountsPrefix: '13.02', chartOfAccountsSegmentContains: 'Quebra' },
  { name: 'Fundo de Troco - Lojas', level: 3, editable: true, bg: '', parent: 'despesas-extras', chartOfAccountsPrefix: '13.12', chartOfAccountsSegmentContains: 'Fundo de Troco' },
  { id: 'despesas-rateio', name: 'Despesas com rateio', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Aporte Escritório', level: 3, editable: true, bg: '', parent: 'despesas-rateio', chartOfAccountsPrefix: '13.18', chartOfAccountsSegmentContains: 'Aporte' },
];

export interface DespesasOperacionaisTableProps {
  accountsPayable: any[];
  filters: { startDate: string; endDate: string; groups: string[]; companies: string[] };
  companies: any[];
  darkMode?: boolean;
  onRefresh?: () => void;
  /** Data/hora da última importação de contas a pagar (ISO string), para exibir "Última atualização" */
  lastAccountsPayableImportAt?: string | null;
}

const normalizeCode = (code: any): string => {
  if (!code) return '';
  const strCode = String(code).trim();
  const numCode = parseInt(strCode, 10);
  return isNaN(numCode) ? strCode : String(numCode);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function parseCoaSegments(coa: string): string[] {
  if (!coa || !String(coa).trim()) return [];
  return String(coa).trim().split(/\s*>\s*/).map((s: string) => s.trim());
}

function segmentMatchesAccount(segment: string, account: any): boolean {
  const prefix = account.chartOfAccountsPrefix;
  const segmentContains = account.chartOfAccountsSegmentContains;
  const segmentExcludes = account.chartOfAccountsSegmentExcludes;
  const name = (account.name || account.id) ?? '';
  if (prefix) {
    if (segment !== prefix && !segment.startsWith(prefix)) return false;
    const after = segment.length > prefix.length ? segment.charAt(prefix.length) : '';
    const prefixOk = after === '' || after === ' ' || after === '.' || after === '-' || !/[\d]/.test(after);
    if (!prefixOk) return false;
    if (segmentExcludes && segment.toLowerCase().includes((segmentExcludes as string).toLowerCase())) return false;
    if (segmentContains) return segment.toLowerCase().includes(segmentContains.toLowerCase());
    return true;
  }
  if (!name) return false;
  return segment === name || segment.toLowerCase() === name.toLowerCase();
}

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

export const DespesasOperacionaisTableInner: React.FC<DespesasOperacionaisTableProps> = ({
  accountsPayable,
  filters,
  companies,
  darkMode = false,
  onRefresh,
  lastAccountsPayableImportAt = null
}) => {
  // Padrão: Despesas Operacionais expandida (filhos visíveis); ainda é possível encolher/abrir
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({ 'despesas-op': true });
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
    const e = format(now, 'yyyy-MM-dd');
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

  const allowedBusinessUnits = useMemo(() => {
    if (companies.length === 0) return null;
    const hasActive = filters.groups.length > 0 || filters.companies.length > 0;
    if (!hasActive) return null;
    return new Set(companies
      .filter(c => (filters.groups.length === 0 || filters.groups.includes(c.group_name)) && (filters.companies.length === 0 || filters.companies.some((code: string) => String(code).trim() === String(c.company_code ?? '').trim() || normalizeCode(code) === normalizeCode(c.company_code ?? ''))))
      .map(c => normalizeCode(c.company_code)));
  }, [companies, filters.groups, filters.companies]);

  const getAccountKey = (account: any): string | null => {
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

  const { currentStart, currentEnd, prevStart, prevEnd } = useMemo(() => {
    const current = getCurrentPeriod();
    const previous = getPreviousPeriod();
    return {
      currentStart: current.start,
      currentEnd: current.end,
      prevStart: previous.start,
      prevEnd: previous.end
    };
  }, [filters.startDate, filters.endDate]);

  const valuesMap = useMemo(() => {
    const curStart = (currentStart || '').substring(0, 10);
    const curEnd = (currentEnd || '').substring(0, 10);
    const pStart = (prevStart || '').substring(0, 10);
    const pEnd = (prevEnd || '').substring(0, 10);
    const statusPrevisto = (s: string) => ['previsto', 'pendente', 'pending'].includes((s || '').toLowerCase().trim());
    const statusRealizado = (s: string) => ['realizado', 'pago', 'paid'].includes((s || '').toLowerCase().trim());

    const prevRealizadoList = pStart && pEnd ? accountsPayable.filter(ap => {
      const d = (ap.payment_date || '').toString().substring(0, 10);
      return d && d >= pStart && d <= pEnd && statusRealizado(ap.status) && (allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(ap.business_unit)));
    }) : [];
    const curPrevistoList = curStart && curEnd ? accountsPayable.filter(ap => {
      const d = (ap.due_date || '').toString().substring(0, 10);
      return d && d >= curStart && d <= curEnd && statusPrevisto(ap.status) && (allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(ap.business_unit)));
    }) : [];
    const curRealizadoList = curStart && curEnd ? accountsPayable.filter(ap => {
      const d = (ap.payment_date || '').toString().substring(0, 10);
      return d && d >= curStart && d <= curEnd && statusRealizado(ap.status) && (allowedBusinessUnits === null || allowedBusinessUnits.has(normalizeCode(ap.business_unit)));
    }) : [];

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
      if (prefix) return segments.some(seg => segmentMatchesAccount(seg, account));
      return segments.some(seg => seg === name || seg.toLowerCase() === name.toLowerCase());
    };

    const sumFromList = (list: any[], account: any): number =>
      list.filter(ap => matchApToAccount(ap, account)).reduce((sum, ap) => sum + Math.abs(parseFloat(ap.amount || 0)), 0);

    const map: Record<string, { prevRealizado: number; curRealizado: number; curPrevisto: number }> = {};
    const ZERO = { prevRealizado: 0, curRealizado: 0, curPrevisto: 0 };

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
          return { prevRealizado: acc.prevRealizado + v.prevRealizado, curRealizado: acc.curRealizado + v.curRealizado, curPrevisto: acc.curPrevisto + v.curPrevisto };
        },
        { prevRealizado: 0, curRealizado: 0, curPrevisto: 0 }
      );
    }
    return map;
  }, [accountsPayable, currentStart, currentEnd, prevStart, prevEnd, allowedBusinessUnits]);

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

  const currentPeriodLabel = useMemo(
    () => (currentStart && currentEnd ? `${format(parseISO(currentStart), 'MMM', { locale: ptBR })} ${format(parseISO(currentStart), 'yyyy')}` : '-'),
    [currentStart, currentEnd]
  );
  const previousPeriodLabel = useMemo(
    () => (prevStart && prevEnd ? `${format(parseISO(prevStart), 'MMM', { locale: ptBR })} ${format(parseISO(prevStart), 'yyyy')}` : '-'),
    [prevStart, prevEnd]
  );

  const renderRow = (account: any, index: number) => {
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
            <span>{account.name}</span>
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

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Despesas Operacionais</h2>
        {lastUpdateFormatted && (
          <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} title="Última importação do importador de contas a pagar">
            Última atualização: {lastUpdateFormatted}
          </span>
        )}
      </div>
      <div className={`overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'} shadow`}>
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
      </div>
    </div>
  );
};

export const DespesasOperacionaisTable = React.memo(DespesasOperacionaisTableInner);
