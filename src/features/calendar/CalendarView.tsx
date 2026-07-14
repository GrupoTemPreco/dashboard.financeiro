import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, LineChart, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { CalendarDayCell } from './CalendarDayCell';
import { AddBalanceModal } from './AddBalanceModal';
import {
  CALENDAR_HIGHLIGHT_OPTIONS,
  type CalendarDayValues,
  type CalendarHighlightMetric,
} from './types';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface CalendarViewProps {
  month: number;
  year: number;
  days: CalendarDayValues[];
  onMonthChange: (year: number, month: number) => void;
  darkMode?: boolean;
  loading?: boolean;
  validUnitCodes: string[];
  bankOptions?: string[];
  onBalancesChanged: () => void;
  /** Abre o modal do gráfico de fluxo diário */
  onOpenCashFlowChart?: () => void;
  /** Abre o modal de alertas */
  onOpenAlerts?: () => void;
  /** Quantidade de alertas (badge no botão) */
  alertsCount?: number;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  month,
  year,
  days,
  onMonthChange,
  darkMode = false,
  loading = false,
  validUnitCodes,
  bankOptions = [],
  onBalancesChanged,
  onOpenCashFlowChart,
  onOpenAlerts,
  alertsCount = 0,
}) => {
  const [highlight, setHighlight] = useState<CalendarHighlightMetric>('finalBalance');
  const [addDate, setAddDate] = useState<string | null>(null);

  const daysByDate = useMemo(() => {
    const map = new Map<number, CalendarDayValues>();
    for (const d of days) map.set(d.dayOfMonth, d);
    return map;
  }, [days]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((daysInMonth + firstDay) / 7) * 7;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (month === 0) onMonthChange(year - 1, 11);
      else onMonthChange(year, month - 1);
    } else if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  };

  const footerBtn = darkMode
    ? 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 transition-colors'
    : 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 transition-colors';

  return (
    <div
      className={`relative w-full ${
        darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
      } rounded-lg shadow-md p-4 ${loading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
          <Loader2
            className={`w-8 h-8 animate-spin ${darkMode ? 'text-sky-400' : 'text-marsala-600'}`}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => navigateMonth('prev')}
            className={`p-2 rounded-lg transition-colors ${
              darkMode
                ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                : 'bg-marsala-100 text-marsala-600 hover:bg-marsala-200'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={() => navigateMonth('next')}
            className={`p-2 rounded-lg transition-colors ${
              darkMode
                ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                : 'bg-marsala-100 text-marsala-600 hover:bg-marsala-200'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label
            className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}
          >
            Destacar
          </label>
          <select
            value={highlight}
            onChange={(e) => setHighlight(e.target.value as CalendarHighlightMetric)}
            className={`text-sm rounded-lg px-3 py-1.5 border ${
              darkMode
                ? 'bg-slate-800 border-slate-600 text-slate-100'
                : 'bg-white border-gray-300 text-gray-800'
            }`}
          >
            {CALENDAR_HIGHLIGHT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 min-w-full">
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className={`h-6 flex items-center justify-center font-medium text-xs ${
              darkMode ? 'bg-slate-800 text-slate-100' : 'bg-marsala-600 text-white'
            }`}
          >
            {day}
          </div>
        ))}

        {Array.from({ length: totalCells }, (_, index) => {
          if (index < firstDay) {
            return (
              <CalendarDayCell
                key={`empty-${index}`}
                day={null}
                dayOfMonth={null}
                highlight={highlight}
                isToday={false}
                darkMode={darkMode}
              />
            );
          }
          const dayNum = index - firstDay + 1;
          if (dayNum > daysInMonth) {
            return (
              <CalendarDayCell
                key={`empty-end-${index}`}
                day={null}
                dayOfMonth={null}
                highlight={highlight}
                isToday={false}
                darkMode={darkMode}
              />
            );
          }
          const dayData = daysByDate.get(dayNum) || null;
          const isToday = dayData?.date === todayStr;
          return (
            <CalendarDayCell
              key={dayData?.date ?? `day-${dayNum}`}
              day={dayData}
              dayOfMonth={dayNum}
              highlight={highlight}
              isToday={!!isToday}
              darkMode={darkMode}
              onDayClick={setAddDate}
            />
          );
        })}
      </div>

      <div
        className={`mt-4 pt-4 border-t ${
          darkMode ? 'border-slate-700' : 'border-gray-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-[9rem]">
            {onOpenCashFlowChart && (
              <button
                type="button"
                onClick={onOpenCashFlowChart}
                className={footerBtn}
                title="Abrir fluxo de caixa diário"
              >
                <LineChart className="w-4 h-4 text-sky-400" />
                <span>Fluxo diário</span>
              </button>
            )}
          </div>

          <div
            className={`flex flex-wrap items-center justify-center gap-3 text-xs ${
              darkMode ? 'text-slate-400' : 'text-gray-500'
            }`}
          >
            <span>SI = Saldo Inicial</span>
            <span>Rec = Receitas</span>
            <span>Pag = Pagamentos</span>
            <span>SF = Saldo Final</span>
          </div>

          <div className="flex items-center justify-end gap-2 min-w-[9rem]">
            {onOpenAlerts && (
              <button
                type="button"
                onClick={onOpenAlerts}
                className={`${footerBtn} ${
                  alertsCount > 0
                    ? darkMode
                      ? 'border-red-500/60 text-red-300 hover:bg-red-950/40'
                      : 'border-red-300 text-red-700 hover:bg-red-50'
                    : ''
                }`}
                title="Abrir alertas de fluxo de caixa"
              >
                <AlertTriangle
                  className={`w-4 h-4 ${alertsCount > 0 ? 'text-red-400' : 'text-amber-400'}`}
                />
                <span>Alertas</span>
                {alertsCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                    {alertsCount > 99 ? '99+' : alertsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
        <p
          className={`mt-2 text-center text-[11px] ${
            darkMode ? 'text-slate-500' : 'text-gray-400'
          }`}
        >
          Clique no dia para adicionar saldo
        </p>
      </div>

      {addDate && (
        <AddBalanceModal
          open={!!addDate}
          date={addDate}
          darkMode={darkMode}
          validUnitCodes={validUnitCodes}
          bankOptions={bankOptions}
          onClose={() => setAddDate(null)}
          onSaved={() => {
            setAddDate(null);
            onBalancesChanged();
          }}
        />
      )}
    </div>
  );
};
