import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { AlertTriangle, ChevronDown } from 'lucide-react';

interface CashFlowData {
  date: string;
  actualBalance: number;
  projectedBalance: number;
  isHistorical: boolean;
}

interface AlertData {
  date: string;
  type: 'shortage' | 'expenses';
  message: string;
  amount: number;
  topAccountGroups?: { group: string; amount: number }[];
}

interface CashFlowChartProps {
  data: CashFlowData[];
  darkMode?: boolean;
  alerts?: AlertData[];
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, darkMode = false, alerts = [] }) => {
  const [alertsDropdownOpen, setAlertsDropdownOpen] = useState(false);
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
    <div className={`${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100' : 'bg-white'} rounded-lg shadow-md p-4 h-full relative`}>
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

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {false && alerts.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setAlertsDropdownOpen(!alertsDropdownOpen)}
                className={`flex items-center gap-1.5 transition-colors ${
                  darkMode
                    ? 'text-red-300 hover:text-red-200'
                    : 'text-red-600 hover:text-red-700'
                }`}
                title="Ver alertas de fluxo de caixa"
              >
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-semibold">{alerts.length}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${alertsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {alertsDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setAlertsDropdownOpen(false)}
                  ></div>
                  <div className={`absolute top-full left-0 mt-2 w-[600px] max-h-[600px] overflow-y-auto z-20 rounded-lg shadow-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-white border-gray-200'
                  }`}>
                  <div className="p-4">
                    <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
                      Alertas de Fluxo de Caixa ({alerts.length})
                    </h3>
                    <div className="space-y-3">
                      {alerts.map((alert, index) => (
                        <div
                          key={index}
                          className={`border rounded-lg p-3 ${
                            alert.type === 'shortage' 
                              ? darkMode
                                ? 'bg-red-950/40 border-red-700'
                                : 'bg-red-50 border-red-200'
                              : darkMode
                                ? 'bg-amber-950/40 border-amber-700'
                                : 'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                  alert.type === 'shortage' 
                                    ? darkMode
                                      ? 'bg-red-900'
                                      : 'bg-red-100'
                                    : darkMode
                                      ? 'bg-amber-900'
                                      : 'bg-yellow-100'
                                }`}
                              >
                                <AlertTriangle
                                  className={`w-3 h-3 ${
                                    alert.type === 'shortage'
                                      ? darkMode
                                        ? 'text-red-200'
                                        : 'text-red-600'
                                      : darkMode
                                        ? 'text-amber-200'
                                        : 'text-yellow-600'
                                  }`}
                                />
                              </div>
                            </div>
                            <div className="ml-2 flex-1">
                              <h4
                                className={`text-xs font-medium mb-1 ${
                                  alert.type === 'shortage'
                                    ? darkMode
                                      ? 'text-red-100'
                                      : 'text-red-800'
                                    : darkMode
                                      ? 'text-amber-100'
                                      : 'text-yellow-800'
                                }`}
                              >
                                {new Date(alert.date).toLocaleDateString('pt-BR', { 
                                  day: '2-digit', 
                                  month: '2-digit',
                                  year: 'numeric'
                                })} - Saldo: {formatCurrency(alert.amount)}
                              </h4>
                              <p
                                className={`text-xs ${
                                  alert.type === 'shortage'
                                    ? darkMode
                                      ? 'text-red-200'
                                      : 'text-red-700'
                                    : darkMode
                                      ? 'text-amber-200'
                                      : 'text-yellow-700'
                                }`}
                              >
                                {alert.message}
                              </p>
                              {alert.topAccountGroups && alert.topAccountGroups.length > 0 && (
                                <div
                                  className={`mt-2 pt-2 border-t ${
                                    alert.type === 'shortage'
                                      ? darkMode
                                        ? 'border-red-700'
                                        : 'border-red-200'
                                      : darkMode
                                        ? 'border-amber-700'
                                        : 'border-yellow-200'
                                  }`}
                                >
                                  <p
                                    className={`text-xs font-medium mb-1 ${
                                      alert.type === 'shortage'
                                        ? darkMode
                                          ? 'text-red-100'
                                          : 'text-red-800'
                                        : darkMode
                                          ? 'text-amber-100'
                                          : 'text-yellow-800'
                                    }`}
                                  >
                                    Principais grupos impactando:
                                  </p>
                                  <ul className="space-y-1">
                                    {alert.topAccountGroups.map((group, idx) => (
                                      <li
                                        key={idx}
                                        className={`text-xs ${
                                          alert.type === 'shortage'
                                            ? darkMode
                                              ? 'text-red-200'
                                              : 'text-red-600'
                                            : darkMode
                                              ? 'text-amber-200'
                                              : 'text-yellow-600'
                                        }`}
                                      >
                                        • {group.group}: {formatCurrency(group.amount)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
              )}
            </div>
          )}
          <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            Arraste horizontalmente para visualizar até 6 meses à frente
          </div>
        </div>
      </div>
    </div>
  );
};