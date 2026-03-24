export type CapCoaMatchIssueKind = 'fallback_unique_prefix' | 'ambiguous_shared_prefix';

export type CapCoaMatchIssue = {
  kind: CapCoaMatchIssueKind;
  dedupeKey: string;
  /** Linha da DRE / regra que recebeu o valor (fallback) ou que estava sendo testada */
  ruleLabel: string;
  prefix: string;
  expectedContains: string;
  segmentMatched: string;
  /** Snapshot do lançamento CAP para correção no BD */
  launch: Record<string, unknown>;
};

function stableApKey(ap: any): string {
  const id = ap?.id != null ? String(ap.id) : '';
  const coa = ap?.chart_of_accounts != null ? String(ap.chart_of_accounts) : '';
  const pd = ap?.payment_date != null ? String(ap.payment_date).substring(0, 10) : '';
  const dd = ap?.due_date != null ? String(ap.due_date).substring(0, 10) : '';
  const amt = ap?.amount != null ? String(ap.amount) : '';
  const bu = ap?.business_unit != null ? String(ap.business_unit) : '';
  return [id, coa, pd, dd, amt, bu].join('|');
}

export function snapshotAccountsPayableLaunch(ap: any): Record<string, unknown> {
  if (!ap || typeof ap !== 'object') return {};
  const o = ap as Record<string, any>;
  const pick = (k: string) => (o[k] !== undefined ? o[k] : undefined);
  return {
    id: pick('id'),
    chart_of_accounts: pick('chart_of_accounts'),
    amount: pick('amount'),
    payment_date: pick('payment_date'),
    due_date: pick('due_date'),
    status: pick('status'),
    business_unit: pick('business_unit'),
    supplier_name: pick('supplier_name'),
    description: pick('description'),
    document_number: pick('document_number'),
    cost_center: pick('cost_center'),
    category: pick('category')
  };
}

export function formatCapCoaLaunchMessage(launch: Record<string, unknown>): string {
  const lines: string[] = [];
  const add = (label: string, v: unknown) => {
    if (v !== undefined && v !== null && String(v) !== '') lines.push(`${label}: ${v}`);
  };
  add('ID', launch.id);
  add('Plano de contas', launch.chart_of_accounts);
  add('Valor', launch.amount);
  add('Pagamento', launch.payment_date);
  add('Vencimento', launch.due_date);
  add('Status', launch.status);
  add('Unidade', launch.business_unit);
  add('Fornecedor', launch.supplier_name);
  add('Descrição', launch.description);
  add('Documento', launch.document_number);
  return lines.join('\n');
}

/** Coletor opcional nas agregações CAP; deduplica por chave estável. */
export class CapCoaMatchCollector {
  private readonly issues = new Map<string, CapCoaMatchIssue>();

  recordFallbackUniquePrefix(
    ap: any,
    segment: string,
    prefix: string,
    expectedContains: string,
    ruleLabel: string
  ): void {
    const apKey = stableApKey(ap);
    const dedupeKey = `fb|${apKey}|${prefix}|${ruleLabel}`;
    if (this.issues.has(dedupeKey)) return;
    this.issues.set(dedupeKey, {
      kind: 'fallback_unique_prefix',
      dedupeKey,
      ruleLabel,
      prefix,
      expectedContains,
      segmentMatched: segment,
      launch: snapshotAccountsPayableLaunch(ap)
    });
  }

  recordAmbiguousSharedPrefix(ap: any, segment: string, prefix: string, expectedContains: string, ruleLabel: string): void {
    const apKey = stableApKey(ap);
    const dedupeKey = `am|${apKey}|${prefix}`;
    if (this.issues.has(dedupeKey)) return;
    this.issues.set(dedupeKey, {
      kind: 'ambiguous_shared_prefix',
      dedupeKey,
      ruleLabel,
      prefix,
      expectedContains,
      segmentMatched: segment,
      launch: snapshotAccountsPayableLaunch(ap)
    });
  }

  getIssues(): CapCoaMatchIssue[] {
    return Array.from(this.issues.values());
  }
}
