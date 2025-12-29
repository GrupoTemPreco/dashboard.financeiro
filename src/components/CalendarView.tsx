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
}

export const CalendarView: React.FC<CalendarViewProps> = ({ month, year, data, onMonthChange, darkMode = false }) => {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
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
      return <div key={index} className={`h-24 border ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}></div>;
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

    return (
      <div
        key={index}
        className={`h-32 border p-2 ${balanceColorClass} ${
          isToday ? (darkMode ? 'ring-2 ring-sky-500' : 'ring-2 ring-marsala-500') : ''
        }`}
      >
        <div className="flex justify-center items-center mb-2">
          <span className={`text-sm font-medium ${isToday ? (darkMode ? 'text-sky-300' : 'text-marsala-600') : darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
            {day}
          </span>
          {isNegativeBalance && (
            <span className="ml-1 text-red-600 text-xs">⚠️</span>
          )}
        </div>

        {dayData && (
          <div className="space-y-1 text-center">
            {dayData.actualBalance !== undefined && dayData.actualBalance !== 0 && (
              <div className="pb-0.5">
                <span className={`text-[9px] block ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>R</span>
                <span
                  className={`font-bold text-xs block leading-tight ${
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

            <div className={dayData.actualBalance !== undefined && dayData.actualBalance !== 0 ? 'border-t pt-0.5' : ''}>
              <span className={`text-[9px] block ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>P</span>
              <span
                className={`font-bold text-xs block leading-tight ${
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

  return (
      <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
      <div className="flex items-center justify-between mb-6">
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
        
        <div className="flex items-center space-x-4 text-sm">
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

      <div className="grid grid-cols-7 gap-0">
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
    </div>
  );
};