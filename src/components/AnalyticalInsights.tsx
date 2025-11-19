import React from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';

interface InsightData {
  category: string;
  forecasted: number;
  actual: number;
  variance: number;
  variancePercentage: number;
  trend: 'up' | 'down' | 'stable';
}

interface TopAccount {
  account: string;
  amount: number;
}

interface AnalyticalInsightsProps {
  data: InsightData[];
  cashShortageDate?: string;
  topAccounts?: TopAccount[];
}

export const AnalyticalInsights: React.FC<AnalyticalInsightsProps> = ({ data, cashShortageDate, topAccounts }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600';
    if (variance < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Cash Shortage Alert */}
      {cashShortageDate && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Alerta de Fluxo de Caixa</h3>
              <p className="text-sm text-red-700 mb-3">
                Entrada de caixa necessária em <strong>{formatDate(cashShortageDate)}</strong> para evitar saldo negativo.
              </p>

              {topAccounts && topAccounts.length > 0 && (
                <div className="bg-white rounded p-3 mt-2">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Principais Planos de Conta Impactando:</h4>
                  <div className="space-y-1.5">
                    {topAccounts.map((acc, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-gray-700 flex items-center">
                          <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center mr-2 text-[10px] font-semibold">{idx + 1}</span>
                          {acc.account}
                        </span>
                        <span className="font-semibold text-red-600">{formatCurrency(acc.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.map((insight, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-800">{insight.category}</h4>
              {getTrendIcon(insight.trend)}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Previsto:</span>
                <span className="font-medium">{formatCurrency(insight.forecasted)}</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Realizado:</span>
                <span className="font-medium">{formatCurrency(insight.actual)}</span>
              </div>
              
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Variação:</span>
                  <span className={`font-semibold ${getVarianceColor(insight.variance)}`}>
                    {insight.variance > 0 ? '+' : ''}{formatCurrency(insight.variance)}
                  </span>
                </div>
                
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-600">%:</span>
                  <span className={`font-semibold ${getVarianceColor(insight.variance)}`}>
                    {insight.variancePercentage > 0 ? '+' : ''}{insight.variancePercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};