import { DESPESAS_OP_STRUCTURE } from './despesasOpStructure';

/**
 * Contagem global de quantas linhas mapeadas usam o mesmo prefixo (D.O. + deduções + lucros + investimento + financiamento).
 * Mantido sem importar dre*.ts para evitar dependência circular com o matcher.
 */
const EXTRA_PREFIX_INSTANCES: string[] = [
  '03.1',
  '03.2',
  '03.3',
  '07.2',
  '06.2',
  '13.07',
  '13.08',
  '13.03',
  '09.15',
  '13.04',
  '11.06',
  '11.01',
  '13.17',
  '13.17',
  '13.05',
  '13.06',
  '11.08',
  '11.09',
  '11.13',
  '11.15',
  '13.10',
  '13.11',
  '13.19'
];

let cached: Map<string, number> | null = null;

export function getCapCoaPrefixRuleCount(): ReadonlyMap<string, number> {
  if (cached) return cached;
  const m = new Map<string, number>();
  const add = (p?: string) => {
    if (p == null || !String(p).trim()) return;
    const k = String(p).trim();
    m.set(k, (m.get(k) || 0) + 1);
  };
  for (const row of DESPESAS_OP_STRUCTURE as any[]) {
    add(row.chartOfAccountsPrefix);
  }
  for (const p of EXTRA_PREFIX_INSTANCES) {
    add(p);
  }
  cached = m;
  return m;
}

/** Testes / hot reload */
export function __resetCapCoaPrefixCacheForTests() {
  cached = null;
}
