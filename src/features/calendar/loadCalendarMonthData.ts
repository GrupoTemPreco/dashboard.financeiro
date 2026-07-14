import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../../lib/supabase';
import type { CalendarMonthRawData } from './types';

function applyContasAPagarImportFilter(query: any, activeImportIds: string[]): any {
  if (activeImportIds.length > 0) {
    return query.or(`import_id.in.(${activeImportIds.join(',')}),import_id.is.null`);
  }
  return query.is('import_id', null);
}

async function fetchAllPages<T>(
  fetchPage: (offset: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await fetchPage(offset);
    if (error) throw error;
    if (data?.length) {
      all.push(...data);
      offset += 1000;
      hasMore = data.length === 1000;
    } else {
      hasMore = false;
    }
  }
  return all;
}

export interface LoadCalendarMonthParams {
  year: number;
  month: number; // 0-based
  businessUnits: string[] | null;
}

export async function loadCalendarMonthData({
  year,
  month,
  businessUnits,
}: LoadCalendarMonthParams): Promise<CalendarMonthRawData> {
  const rangeStart = format(startOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');
  const rangeEnd = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');

  const { data: importsData, error: importsError } = await supabase
    .from('importacoes')
    .select('id, is_deleted');
  if (importsError) throw importsError;

  const activeImportIds = (importsData || [])
    .filter((imp: any) => !imp.is_deleted)
    .map((imp: any) => imp.id);

  const withBu = <Q extends { in: (col: string, vals: string[]) => Q }>(q: Q): Q => {
    if (businessUnits?.length) return q.in('business_unit', businessUnits);
    return q;
  };

  const [apPayment, apDue, receitasManuais, saldosIniciais] = await Promise.all([
    fetchAllPages(async (offset) => {
      let q = applyContasAPagarImportFilter(
        supabase
          .from('contas_a_pagar')
          .select('import_id, business_unit, payment_date, due_date, amount, status, id'),
        activeImportIds
      )
        .not('payment_date', 'is', null)
        .gte('payment_date', rangeStart)
        .lte('payment_date', rangeEnd);
      q = withBu(q);
      return q.order('payment_date', { ascending: false }).range(offset, offset + 999);
    }),
    fetchAllPages(async (offset) => {
      let q = applyContasAPagarImportFilter(
        supabase
          .from('contas_a_pagar')
          .select('import_id, business_unit, payment_date, due_date, amount, status, id'),
        activeImportIds
      )
        .gte('due_date', rangeStart)
        .lte('due_date', rangeEnd);
      q = withBu(q);
      return q.order('due_date', { ascending: false }).range(offset, offset + 999);
    }),
    fetchAllPages(async (offset) => {
      let q = supabase
        .from('receitas_manuais')
        .select('id, status, business_unit, conta, descricao, data, valor')
        .gte('data', rangeStart)
        .lte('data', rangeEnd)
        .order('data', { ascending: false });
      if (businessUnits?.length) q = q.in('business_unit', businessUnits);
      return q.range(offset, offset + 999);
    }),
    fetchAllPages(async (offset) => {
      let q = supabase
        .from('saldos_iniciais')
        .select('id, business_unit, bank_name, balance, balance_date, observacao')
        .gte('balance_date', rangeStart)
        .lte('balance_date', rangeEnd)
        .order('balance_date', { ascending: false });
      if (businessUnits?.length) q = q.in('business_unit', businessUnits);
      return q.range(offset, offset + 999);
    }),
  ]);

  const apById = new Map<string | number, any>();
  for (const row of apPayment) apById.set(row.id, row);
  for (const row of apDue) {
    if (!apById.has(row.id)) apById.set(row.id, row);
  }

  return {
    accountsPayable: Array.from(apById.values()),
    receitasManuais,
    saldosIniciais,
  };
}
