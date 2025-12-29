import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, BarChart3 } from 'lucide-react';

interface CashFlowData {
  category: string;
  subcategory?: string;
  type: 'inflow' | 'outflow';
  months: { [key: string]: { forecasted: number; actual: number } };
}

interface CashFlowTableProps {
  data: CashFlowData[];
  darkMode?: boolean;
}

export const CashFlowTable: React.FC<CashFlowTableProps> = ({ data, darkMode = false }) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getMonthName = (month: number) => {
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return months[month];
  };

  const generateColumns = () => {
    if (viewMode === 'monthly') {
      const columns = [];
      for (let i = -2; i <= 3; i++) {
        const month = (currentMonth + i + 12) % 12;
        const year = currentYear + Math.floor((currentMonth + i) / 12);
        columns.push(`${getMonthName(month)}/${year}`);
      }
      return columns;
    } else {
      // Daily view - show current month days
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    }
  };

  const columns = generateColumns();

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  return (
    <div className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Estrutura de Fluxo de Caixa</h2>
        
        <div className="flex items-center space-x-4">
          <div className={`flex rounded-lg p-1 ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'monthly'
                  ? darkMode
                    ? 'bg-sky-500 text-white'
                    : 'bg-marsala-600 text-white'
                  : darkMode
                    ? 'text-slate-300 hover:text-slate-100'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1 inline" />
              Mensal
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'daily'
                  ? darkMode
                    ? 'bg-sky-500 text-white'
                    : 'bg-marsala-600 text-white'
                  : darkMode
                    ? 'text-slate-300 hover:text-slate-100'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-1 inline" />
              Diário
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth('prev')}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-marsala-100 text-marsala-600 hover:bg-marsala-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`text-sm font-medium min-w-[100px] text-center ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
              {getMonthName(currentMonth)} {currentYear}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-marsala-100 text-marsala-600 hover:bg-marsala-200'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className={darkMode ? 'bg-slate-800' : 'bg-gray-50'}>
              <th className={`border px-4 py-3 text-left text-sm font-semibold sticky left-0 z-10 ${
                darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700 bg-gray-50'
              }`}>
                Categoria
              </th>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`border px-3 py-3 text-center text-sm font-semibold min-w-[120px] ${
                    darkMode ? 'border-slate-700 text-slate-100 bg-slate-800' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`hover:bg-opacity-80 ${
                  row.type === 'inflow'
                    ? darkMode
                      ? 'bg-emerald-950/30'
                      : 'bg-green-50'
                    : darkMode
                      ? 'bg-rose-950/30'
                      : 'bg-red-50'
                }`}
              >
                <td
                  className={`border px-4 py-3 text-sm font-medium sticky left-0 bg-inherit z-10 ${
                    darkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-800'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{row.category}</div>
                    {row.subcategory && (
                      <div className={`text-xs ml-2 ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>• {row.subcategory}</div>
                    )}
                  </div>
                </td>
                {columns.map((column, colIndex) => {
                  const monthData = row.months[column] || { forecasted: 0, actual: 0 };
                  return (
                    <td
                      key={colIndex}
                      className={`border px-3 py-3 text-center ${
                        darkMode ? 'border-slate-800 text-slate-100' : 'border-gray-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                          P: {formatCurrency(monthData.forecasted)}
                        </div>
                        <div className={`text-sm font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                          R: {formatCurrency(monthData.actual)}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`mt-4 flex items-center justify-between text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></div>
            <span>Entradas</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded mr-2"></div>
            <span>Saídas</span>
          </div>
        </div>
        <div className="text-xs">
          P: Previsto | R: Realizado
        </div>
      </div>
    </div>
  );
};