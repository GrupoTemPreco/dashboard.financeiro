import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DayData {
  date: number;
  openingBalance: number;
  forecastedRevenue: number;
  forecastedOutflows: number;
  forecastedBalance: number;
  actualBalance?: number;
}

interface CalendarViewProps {
  month: number;
  year: number;
  data: DayData[];
  onMonthChange: (year: number, month: number) => void;
  darkMode?: boolean;
  accumulatedMode?: boolean;
  onToggleAccumulatedMode?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ month, year, data, onMonthChange, darkMode = false, accumulatedMode = false, onToggleAccumulatedMode }) => {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(month, year);
  const firstDay = getFirstDayOfMonth(month, year);
  const totalCells = Math.ceil((daysInMonth + firstDay) / 7) * 7;

  const getDayData = (day: number): DayData | null => {
    return data.find(d => d.date === day) || null;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (month === 0) {
        onMonthChange(year - 1, 11);
      } else {
        onMonthChange(year, month - 1);
      }
    } else {
      if (month === 11) {
        onMonthChange(year + 1, 0);
      } else {
        onMonthChange(year, month + 1);
      }
    }
  };

  const renderDayCell = (day: number | null, index: number) => {
    if (!day) {
      return <div key={index} className={`h-24 border rounded ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}></div>;
    }

    const dayData = getDayData(day);
    const isToday = new Date().getDate() === day && 
                   new Date().getMonth() === month && 
                   new Date().getFullYear() === year;

    const isNegativeBalance = dayData && dayData.forecastedBalance < 0;
    const balanceColorClass = dayData
      ? isNegativeBalance
        ? darkMode
          ? 'bg-red-950/40 border-red-500 shadow-md'
          : 'bg-red-100 border-red-400 shadow-md'
        : darkMode
          ? 'bg-slate-900/80 border-slate-700'
          : 'bg-white'
      : darkMode
        ? 'bg-slate-900/80 border-slate-700'
        : 'bg-white';

    // Calcula o padding dinâmico baseado no maior valor
    const actualValueLength = dayData?.actualBalance !== undefined ? formatCurrency(dayData.actualBalance).length : 0;
    const forecastedValueLength = dayData?.forecastedBalance !== undefined ? formatCurrency(dayData.forecastedBalance).length : 0;
    const maxLength = Math.max(actualValueLength, forecastedValueLength);
    
    // Padding ajustado para valores grandes
    let horizontalPadding = 'px-2.5';
    let verticalPadding = 'py-1.5';
    
    if (maxLength > 18) {
      horizontalPadding = 'px-1';
      verticalPadding = 'py-1';
    } else if (maxLength > 15) {
      horizontalPadding = 'px-1.5';
      verticalPadding = 'py-1.5';
    } else if (maxLength > 12) {
      horizontalPadding = 'px-2';
      verticalPadding = 'py-1.5';
    }

    return (
      <div
        key={index}
        className={`h-24 border rounded ${horizontalPadding} ${verticalPadding} ${balanceColorClass} ${
          isToday ? (darkMode ? 'ring-2 ring-sky-500' : 'ring-2 ring-marsala-500') : ''
        }`}
      >
        <div className="flex justify-center items-center mb-1">
          <span className={`text-xs font-semibold ${isToday ? (darkMode ? 'text-sky-300' : 'text-marsala-600') : darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
            {day}
          </span>
          {isNegativeBalance && (
            <span className="ml-1 text-red-600 text-[10px]">⚠️</span>
          )}
        </div>

        {dayData && (
          <div className="space-y-0.5 text-center">
            {dayData.actualBalance !== undefined && (
              <div className="pb-0.5">
                <span className={`text-[8px] block ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>R</span>
                <span
                  className={`font-bold block leading-tight whitespace-nowrap ${
                    actualValueLength > 18 ? 'text-[7.5px]' : actualValueLength > 15 ? 'text-[8px]' : 'text-[9px]'
                  } ${
                    dayData.actualBalance < 0
                      ? darkMode
                        ? 'text-red-300'
                        : 'text-red-700'
                      : darkMode
                        ? 'text-sky-300'
                        : 'text-blue-600'
                  }`}
                >
                  {formatCurrency(dayData.actualBalance)}
                </span>
              </div>
            )}

            <div className={dayData.actualBalance !== undefined ? 'border-t pt-0.5' : ''}>
              <span className={`text-[8px] block ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>P</span>
              <span
                className={`font-bold block leading-tight whitespace-nowrap ${
                  forecastedValueLength > 18 ? 'text-[7.5px]' : forecastedValueLength > 15 ? 'text-[8px]' : 'text-[9px]'
                } ${
                  isNegativeBalance
                    ? darkMode
                      ? 'text-red-300'
                      : 'text-red-700'
                    : darkMode
                      ? 'text-emerald-300'
                      : 'text-green-600'
                }`}
              >
                {formatCurrency(dayData.forecastedBalance)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // SVG minimalista de alternância
  const ToggleIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mr-1.5"
    >
      <path
        d="M4 6L2 8L4 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6L14 8L12 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 8H14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
      <div className="flex items-center justify-between mb-6 relative">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateMonth('prev')}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-marsala-100 text-marsala-600 hover:bg-marsala-200'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-marsala-100 text-marsala-600 hover:bg-marsala-200'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        {onToggleAccumulatedMode && (
          <button
            onClick={onToggleAccumulatedMode}
            className={`px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center ${
              accumulatedMode
                ? darkMode
                  ? 'bg-sky-600 text-white hover:bg-sky-700'
                  : 'bg-sky-500 text-white hover:bg-sky-600'
                : darkMode
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={accumulatedMode ? 'Modo Acumulado: Mostra saldo final acumulado até cada dia' : 'Modo Diário: Mostra apenas movimentação de cada dia'}
          >
            <ToggleIcon />
            <span>{accumulatedMode ? 'Acumulado' : 'Diário'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5 min-w-full">
        {weekDays.map((day, index) => (
          <div
            key={index}
            className={`h-7 flex items-center justify-center font-medium text-sm ${
              darkMode ? 'bg-slate-800 text-slate-100' : 'bg-marsala-600 text-white'
            }`}
          >
            {day}
          </div>
        ))}
        
        {Array.from({ length: totalCells }, (_, index) => {
          if (index < firstDay) {
            return renderDayCell(null, index);
          }
          
          const day = index - firstDay + 1;
          if (day > daysInMonth) {
            return renderDayCell(null, index);
          }
          
          return renderDayCell(day, index);
        })}
      </div>

      <div className="flex items-center justify-center space-x-6 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
          <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Saldo Real</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
          <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Saldo Previsto</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-600 rounded-full mr-2"></div>
          <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Negativo</span>
        </div>
      </div>
    </div>
  );
};