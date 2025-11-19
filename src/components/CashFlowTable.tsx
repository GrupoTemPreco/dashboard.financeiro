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
}

export const CashFlowTable: React.FC<CashFlowTableProps> = ({ data }) => {
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Estrutura de Fluxo de Caixa</h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-marsala-600 text-white'
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
                  ? 'bg-marsala-600 text-white'
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
              className="p-2 rounded-lg bg-marsala-100 text-marsala-600 hover:bg-marsala-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
              {getMonthName(currentMonth)} {currentYear}
            </span>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 rounded-lg bg-marsala-100 text-marsala-600 hover:bg-marsala-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">
                Categoria
              </th>
              {columns.map((column, index) => (
                <th key={index} className="border border-gray-200 px-3 py-3 text-center text-sm font-semibold text-gray-700 min-w-[120px]">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={`${row.type === 'inflow' ? 'bg-green-50' : 'bg-red-50'} hover:bg-opacity-75`}>
                <td className="border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 sticky left-0 bg-inherit z-10">
                  <div>
                    <div className="font-semibold">{row.category}</div>
                    {row.subcategory && (
                      <div className="text-xs text-gray-600 ml-2">• {row.subcategory}</div>
                    )}
                  </div>
                </td>
                {columns.map((column, colIndex) => {
                  const monthData = row.months[column] || { forecasted: 0, actual: 0 };
                  return (
                    <td key={colIndex} className="border border-gray-200 px-3 py-3 text-center">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">
                          P: {formatCurrency(monthData.forecasted)}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
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

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
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