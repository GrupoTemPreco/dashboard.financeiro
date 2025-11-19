import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';

interface MonthlyData {
  month: string;
  currentYear: {
    revenue: number;
    cogs: number;
    loans: number;
    debtRatio: number;
    revenuesByUnit?: { [unit: string]: number };
    cmvByUnit?: { [unit: string]: number };
  };
  previousYear: {
    revenue: number;
    cogs: number;
    loans: number;
    debtRatio: number;
    revenuesByUnit?: { [unit: string]: number };
    cmvByUnit?: { [unit: string]: number };
  };
}

interface MonthlyComparisonProps {
  data: MonthlyData[];
}

export const MonthlyComparison: React.FC<MonthlyComparisonProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'3months' | 'year'>('3months');
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'cogs' | 'loans'>('revenue');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getMetricData = () => {
    if (viewMode === 'year') {
      // Extended data for full year view
      const yearData = [
        ...data,
        { month: 'Abr', currentYear: { revenue: 510000, cogs: 204000, loans: 18000, debtRatio: 8.5 }, previousYear: { revenue: 480000, cogs: 192000, loans: 22000, debtRatio: 11.0 } },
        { month: 'Mai', currentYear: { revenue: 530000, cogs: 212000, loans: 16000, debtRatio: 7.8 }, previousYear: { revenue: 495000, cogs: 198000, loans: 20000, debtRatio: 10.2 } },
        { month: 'Jun', currentYear: { revenue: 550000, cogs: 220000, loans: 14000, debtRatio: 6.9 }, previousYear: { revenue: 510000, cogs: 204000, loans: 18000, debtRatio: 9.5 } },
        { month: 'Jul', currentYear: { revenue: 565000, cogs: 226000, loans: 12000, debtRatio: 6.2 }, previousYear: { revenue: 525000, cogs: 210000, loans: 16000, debtRatio: 8.8 } },
        { month: 'Ago', currentYear: { revenue: 580000, cogs: 232000, loans: 10000, debtRatio: 5.5 }, previousYear: { revenue: 540000, cogs: 216000, loans: 14000, debtRatio: 8.1 } },
        { month: 'Set', currentYear: { revenue: 595000, cogs: 238000, loans: 8000, debtRatio: 4.8 }, previousYear: { revenue: 555000, cogs: 222000, loans: 12000, debtRatio: 7.4 } },
        { month: 'Out', currentYear: { revenue: 610000, cogs: 244000, loans: 6000, debtRatio: 4.1 }, previousYear: { revenue: 570000, cogs: 228000, loans: 10000, debtRatio: 6.7 } },
        { month: 'Nov', currentYear: { revenue: 625000, cogs: 250000, loans: 4000, debtRatio: 3.4 }, previousYear: { revenue: 585000, cogs: 234000, loans: 8000, debtRatio: 6.0 } },
        { month: 'Dez', currentYear: { revenue: 640000, cogs: 256000, loans: 2000, debtRatio: 2.7 }, previousYear: { revenue: 600000, cogs: 240000, loans: 6000, debtRatio: 5.3 } }
      ];
      return yearData.map(item => ({
        month: item.month,
        current: item.currentYear[selectedMetric],
        previous: item.previousYear[selectedMetric],
        debtRatioCurrent: item.currentYear.debtRatio,
        debtRatioPrevious: item.previousYear.debtRatio,
        originalData: item
      }));
    }

    return data.map(item => ({
      month: item.month,
      current: item.currentYear[selectedMetric],
      previous: item.previousYear[selectedMetric],
      debtRatioCurrent: item.currentYear.debtRatio,
      debtRatioPrevious: item.previousYear.debtRatio,
      originalData: item
    }));
  };

  const getMetricTitle = () => {
    switch (selectedMetric) {
      case 'revenue':
        return 'Receita Direta Total';
      case 'cogs':
        return 'Custo das Mercadorias Vendidas (CMV)';
      case 'loans':
        return 'Empréstimos e Financiamentos';
      default:
        return '';
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'revenue':
        return { current: '#3b82f6', previous: '#93c5fd' };
      case 'cogs':
        return { current: '#ef4444', previous: '#fca5a5' };
      case 'loans':
        return { current: '#eab308', previous: '#fde047' };
      default:
        return { current: '#6b7280', previous: '#d1d5db' };
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const originalData = payload[0]?.payload?.originalData;

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-sm">
          <p className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">{label}</p>

          {payload.map((entry: any, index: number) => {
            if (entry.dataKey === 'debtRatioCurrent' || entry.dataKey === 'debtRatioPrevious') {
              return (
                <p key={index} className="text-sm mb-1" style={{ color: entry.color }}>
                  {entry.name}: {entry.value.toFixed(1)}%
                </p>
              );
            }

            const isCurrentYear = entry.dataKey === 'current';
            const year = isCurrentYear ? 'currentYear' : 'previousYear';
            const yearLabel = isCurrentYear ? 'Ano Atual' : 'Ano Anterior';

            return (
              <div key={index} className="mb-3">
                <p className="text-sm font-medium mb-1" style={{ color: entry.color }}>
                  {yearLabel}: {formatCurrency(entry.value)}
                </p>

                {selectedMetric === 'revenue' && originalData?.[year]?.revenuesByUnit && (
                  <div className="ml-3 mt-1 space-y-0.5">
                    {Object.entries(originalData[year].revenuesByUnit).map(([unit, value]: [string, any]) => (
                      <p key={unit} className="text-xs text-gray-600">
                        {unit}: {formatCurrency(value)}
                      </p>
                    ))}
                  </div>
                )}

                {selectedMetric === 'cogs' && originalData?.[year]?.cmvByUnit && (
                  <div className="ml-3 mt-1 space-y-0.5">
                    {Object.entries(originalData[year].cmvByUnit).map(([unit, value]: [string, any]) => (
                      <p key={unit} className="text-xs text-gray-600">
                        {unit}: {formatCurrency(value)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const colors = getMetricColor();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Análise Mês a Mês & Ano a Ano</h2>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('3months')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === '3months'
                  ? 'bg-marsala-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Últimos 3 Meses
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'year'
                  ? 'bg-marsala-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Ano
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'revenue', label: 'Receita Direta' },
          { key: 'cogs', label: 'CMV' },
          { key: 'loans', label: 'Empréstimos' }
        ].map((metric) => (
          <button
            key={metric.key}
            onClick={() => setSelectedMetric(metric.key as any)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              selectedMetric === metric.key
                ? 'bg-marsala-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={getMetricData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis 
              yAxisId="left"
              tickFormatter={(value) => formatCurrency(value)}
              stroke="#6b7280"
              fontSize={12}
            />
            {selectedMetric === 'loans' && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value}%`}
                stroke="#6b7280"
                fontSize={12}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            
            <Bar
              yAxisId="left"
              dataKey="current"
              fill={colors.current}
              name={`${getMetricTitle()} (Atual)`}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="previous"
              fill={colors.previous}
              name={`${getMetricTitle()} (Ano Anterior)`}
              radius={[2, 2, 0, 0]}
            />
            
            {selectedMetric === 'loans' && (
              <>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="debtRatioCurrent"
                  stroke="#722832"
                  strokeWidth={2}
                  dot={{ fill: '#722832', strokeWidth: 2, r: 4 }}
                  name="% Empréstimos/Receita (Atual)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="debtRatioPrevious"
                  stroke="#a1a1aa"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#a1a1aa', strokeWidth: 2, r: 4 }}
                  name="% Empréstimos/Receita (Anterior)"
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.current }}></div>
          <span className="text-gray-600">Ano Atual</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.previous }}></div>
          <span className="text-gray-600">Ano Anterior</span>
        </div>
        {selectedMetric === 'loans' && (
          <div className="flex items-center">
            <div className="w-3 h-3 bg-marsala-600 rounded-full mr-2"></div>
            <span className="text-gray-600">% Empréstimos/Receita</span>
          </div>
        )}
      </div>
    </div>
  );
};