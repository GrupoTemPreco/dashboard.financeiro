import { format, getDaysInMonth, startOfMonth } from 'date-fns';
import type { CalendarDayValues, CalendarMonthRawData } from './types';

const toDay = (d: string | null | undefined): string =>
  d ? String(d).slice(0, 10) : '';

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const parsed = parseFloat(String(v));
  return isNaN(parsed) ? 0 : parsed;
};

const statusLower = (s: unknown) => String(s || '').toLowerCase().trim();
const isRealizado = (s: unknown) => ['realizado', 'pago'].includes(statusLower(s));
const isPrevisto = (s: unknown) => ['previsto', 'pendente'].includes(statusLower(s));

function todayLocalYmd(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Agrega o mês em O(N + D): um passe por fonte → Maps por dia → corrente linear.
 * Dia 1 opening = soma saldos com balance_date === dia 1.
 * Dias 2+ opening = finalBalance(prev) + soma saldos com balance_date === dia.
 * Pagamentos só CAP (sem transacoes_financeiras).
 */
export function computeCalendarDays(
  raw: CalendarMonthRawData,
  year: number,
  month: number
): CalendarDayValues[] {
  const today = todayLocalYmd();
  const firstDayStr = format(startOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');
  const daysInMonth = getDaysInMonth(new Date(year, month, 1));

  const revenuesByDay = new Map<string, number>();
  for (const r of raw.receitasManuais) {
    const d = toDay(r.data);
    if (!d) continue;
    revenuesByDay.set(d, (revenuesByDay.get(d) || 0) + num(r.valor));
  }

  const saldosByDay = new Map<string, number>();
  for (const s of raw.saldosIniciais) {
    const d = toDay(s.balance_date);
    if (!d) continue;
    saldosByDay.set(d, (saldosByDay.get(d) || 0) + num(s.balance));
  }

  const paymentsByDay = new Map<string, number>();
  for (const ap of raw.accountsPayable) {
    const status = ap.status;
    const paymentDate = toDay(ap.payment_date);
    const dueDate = toDay(ap.due_date);
    const amount = Math.abs(num(ap.amount));

    // Past days (strictly before today): realizado by payment_date
    if (paymentDate && paymentDate < today && isRealizado(status)) {
      paymentsByDay.set(paymentDate, (paymentsByDay.get(paymentDate) || 0) + amount);
    }
    // Today and future: previsto by due_date
    if (dueDate && dueDate >= today && isPrevisto(status)) {
      paymentsByDay.set(dueDate, (paymentsByDay.get(dueDate) || 0) + amount);
    }
  }

  const days: CalendarDayValues[] = [];
  let prevFinal = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = format(new Date(year, month, day), 'yyyy-MM-dd');
    const revenues = revenuesByDay.get(dateStr) || 0;
    const payments = paymentsByDay.get(dateStr) || 0;
    const saldoAdds = saldosByDay.get(dateStr) || 0;

    let openingBalance: number;
    if (day === 1) {
      openingBalance = saldosByDay.get(firstDayStr) || 0;
    } else {
      openingBalance = prevFinal + saldoAdds;
    }

    const finalBalance = openingBalance + revenues - payments;
    days.push({
      date: dateStr,
      dayOfMonth: day,
      openingBalance,
      revenues,
      payments,
      finalBalance,
    });
    prevFinal = finalBalance;
  }

  return days;
}
