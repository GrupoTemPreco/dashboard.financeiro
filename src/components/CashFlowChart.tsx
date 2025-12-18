import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface CashFlowData {
  date: string;
  actualBalance: number;
  projectedBalance: number;
  isHistorical: boolean;
}

interface CashFlowChartProps {
  data: CashFlowData[];
  darkMode?: boolean;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, darkMode = false }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} p-3 border rounded-lg shadow-lg`}>
          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100' : 'bg-white'} rounded-lg shadow-md p-4 h-full`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-lg font-bold ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>Fluxo de Caixa Diário</h2>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Saldo Real</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <span className={darkMode ? 'text-slate-300' : 'text-gray-600'}>Projeção</span>
          </div>
        </div>
      </div>

      <div className="h-56 overflow-x-auto scrollbar-horizontal">
        <div style={{ minWidth: '800px', height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f0f0f0'} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke={darkMode ? '#9ca3af' : '#6b7280'}
                fontSize={12}
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                stroke={darkMode ? '#9ca3af' : '#6b7280'}
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              
              <Area
                type="monotone"
                dataKey="actualBalance"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#actualGradient)"
                name="Saldo Real"
                connectNulls={false}
              />
              
              <Area
                type="monotone"
                dataKey="projectedBalance"
                stroke="#eab308"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#projectedGradient)"
                name="Saldo Projetado"
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`mt-4 text-xs text-center ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
        Arraste horizontalmente para visualizar até 6 meses à frente
      </div>
    </div>
  );
};