import React, { useMemo } from 'react';
import type { CalendarDayValues, CalendarHighlightMetric } from './types';

const currencyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const LABELS: Record<CalendarHighlightMetric, string> = {
  openingBalance: 'SI',
  revenues: 'Rec',
  payments: 'Pag',
  finalBalance: 'SF',
};

interface CalendarDayCellProps {
  day: CalendarDayValues | null;
  dayOfMonth: number | null;
  highlight: CalendarHighlightMetric;
  isToday: boolean;
  darkMode: boolean;
  onDayClick?: (date: string) => void;
}

function metricValue(day: CalendarDayValues, key: CalendarHighlightMetric): number {
  return day[key];
}

export const CalendarDayCell = React.memo(function CalendarDayCell({
  day,
  dayOfMonth,
  highlight,
  isToday,
  darkMode,
  onDayClick,
}: CalendarDayCellProps) {
  const metrics = useMemo(() => {
    if (!day) return null;
    const order: CalendarHighlightMetric[] = [
      'openingBalance',
      'revenues',
      'payments',
      'finalBalance',
    ];
    return order.map((key) => ({
      key,
      label: LABELS[key],
      value: metricValue(day, key),
      isHighlight: key === highlight,
    }));
  }, [day, highlight]);

  if (dayOfMonth == null) {
    return (
      <div
        className={`min-h-[5.75rem] border rounded ${
          darkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-gray-50'
        }`}
      />
    );
  }

  const isNegativeFinal = day != null && day.finalBalance < 0;
  const cellBg = day
    ? isNegativeFinal
      ? darkMode
        ? 'bg-red-950/40 border-red-500'
        : 'bg-red-50 border-red-300'
      : darkMode
        ? 'bg-slate-900/80 border-slate-700'
        : 'bg-white border-gray-200'
    : darkMode
      ? 'bg-slate-900/80 border-slate-700'
      : 'bg-white border-gray-200';

  return (
    <button
      type="button"
      onClick={() => day && onDayClick?.(day.date)}
      className={`min-h-[5.75rem] w-full text-left border rounded px-1.5 py-1 transition-shadow hover:shadow-md ${cellBg} ${
        isToday ? (darkMode ? 'ring-2 ring-sky-500' : 'ring-2 ring-marsala-500') : ''
      }`}
      title={day ? `Adicionar saldo em ${day.date}` : undefined}
    >
      <div className="flex justify-center mb-0.5">
        <span
          className={`text-xs font-semibold leading-none ${
            isToday
              ? darkMode
                ? 'text-sky-300'
                : 'text-marsala-600'
              : darkMode
                ? 'text-slate-100'
                : 'text-gray-700'
          }`}
        >
          {dayOfMonth}
        </span>
      </div>
      {metrics && (
        <div className="space-y-0.5">
          {metrics.map((m) => (
            <div key={m.key} className="flex items-baseline justify-between gap-0.5">
              <span
                className={`shrink-0 ${darkMode ? 'text-slate-500' : 'text-gray-400'} ${
                  m.isHighlight ? 'text-[10px] font-semibold' : 'text-[9px]'
                }`}
              >
                {m.label}
              </span>
              <span
                className={`text-right leading-tight whitespace-nowrap tabular-nums ${
                  m.isHighlight
                    ? `text-[11px] font-bold ${
                        m.value < 0
                          ? darkMode
                            ? 'text-red-300'
                            : 'text-red-700'
                          : darkMode
                            ? 'text-emerald-300'
                            : 'text-emerald-700'
                      }`
                    : `text-[10px] ${
                        m.value < 0
                          ? darkMode
                            ? 'text-red-400/80'
                            : 'text-red-600/80'
                          : darkMode
                            ? 'text-slate-300'
                            : 'text-gray-600'
                      }`
                }`}
              >
                {currencyFmt.format(m.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
});
