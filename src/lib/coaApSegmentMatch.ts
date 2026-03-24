import { getCapCoaPrefixRuleCount } from './coaCapPrefixRegistry';
import type { CapCoaMatchCollector } from './coaCapMatchCollector';

export type CoaCapRule = {
  chartOfAccountsPrefix?: string;
  chartOfAccountsSegmentContains?: string;
  chartOfAccountsSegmentExcludes?: string;
  name?: string;
  id?: string;
};

export function parseCoaSegments(coa: string): string[] {
  if (!coa || !String(coa).trim()) return [];
  return String(coa).trim().split(/\s*>\s*/).map((s: string) => s.trim());
}

function prefixBoundaryOk(segment: string, prefix: string): boolean {
  if (segment !== prefix && !segment.startsWith(prefix)) return false;
  const after = segment.length > prefix.length ? segment.charAt(prefix.length) : '';
  return after === '' || after === ' ' || after === '.' || after === '-' || !/[\d]/.test(after);
}

/** Match estrito: prefixo + contains + excludes */
export function segmentMatchesCoaRuleStrict(segment: string, account: CoaCapRule): boolean {
  const prefix = account.chartOfAccountsPrefix;
  const segmentContains = account.chartOfAccountsSegmentContains;
  const segmentExcludes = account.chartOfAccountsSegmentExcludes;
  const name = (account.name || account.id) ?? '';
  if (prefix) {
    if (!prefixBoundaryOk(segment, prefix)) return false;
    if (segmentExcludes && segment.toLowerCase().includes(String(segmentExcludes).toLowerCase())) return false;
    if (!segmentContains || !String(segmentContains).trim()) return false;
    return segment.toLowerCase().includes(String(segmentContains).toLowerCase().trim());
  }
  if (!name) return false;
  return segment === name || segment.toLowerCase() === name.toLowerCase();
}

/**
 * Match por plano de contas (prefixo + contains com fallback se prefixo global único).
 * `ruleLabel`: identificação da linha (ex.: id ou nome) para alertas.
 */
export function matchApSegmentsToCoaRule(
  segments: string[],
  account: CoaCapRule,
  collector: CapCoaMatchCollector | undefined,
  ap: any,
  ruleLabel: string
): boolean {
  const prefix = account.chartOfAccountsPrefix;
  if (!prefix) {
    const name = (account.name || account.id) ?? '';
    if (!name) return false;
    return segments.some(seg => seg === name || seg.toLowerCase() === name.toLowerCase());
  }

  for (const seg of segments) {
    if (segmentMatchesCoaRuleStrict(seg, account)) return true;
  }

  const containsNeedle = String(account.chartOfAccountsSegmentContains || '').trim();
  const prefixCount = getCapCoaPrefixRuleCount().get(prefix) ?? 0;

  for (const seg of segments) {
    if (!prefixBoundaryOk(seg, prefix)) continue;
    if (account.chartOfAccountsSegmentExcludes && seg.toLowerCase().includes(String(account.chartOfAccountsSegmentExcludes).toLowerCase())) {
      continue;
    }
    const hasContains = containsNeedle.length > 0;
    const containsOk = hasContains && seg.toLowerCase().includes(containsNeedle.toLowerCase());
    if (containsOk) continue;

    if (!hasContains) {
      if (prefixCount <= 1) {
        collector?.recordFallbackUniquePrefix(ap, seg, prefix, '(vazio)', ruleLabel);
        return true;
      }
      collector?.recordAmbiguousSharedPrefix(ap, seg, prefix, '(vazio)', ruleLabel);
      return false;
    }

    if (prefixCount <= 1) {
      collector?.recordFallbackUniquePrefix(ap, seg, prefix, containsNeedle, ruleLabel);
      return true;
    }
    collector?.recordAmbiguousSharedPrefix(ap, seg, prefix, containsNeedle, ruleLabel);
    return false;
  }

  return false;
}
