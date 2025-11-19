import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Pill, ArrowUpDown, List } from 'lucide-react';

interface KPICardProps {
  title: string;
  forecasted: number;
  actual: number;
  percentage?: number;
  icon: React.ReactNode;
  color: 'yellow' | 'red' | 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'indigo';
  section?: 'cashflow' | 'result';
  onViewDetails?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  forecasted,
  actual,
  percentage,
  icon,
  color,
  section,
  onViewDetails
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const getColorClasses = () => {
    switch (color) {
      case 'yellow':
        return {
          bg: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200',
          border: 'border-l-yellow-500',
          icon: 'text-yellow-600',
          accent: 'text-yellow-700'
        };
      case 'red':
        return {
          bg: 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200',
          border: 'border-l-red-500',
          icon: 'text-red-600',
          accent: 'text-red-700'
        };
      case 'blue':
        return {
          bg: 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200',
          border: 'border-l-blue-500',
          icon: 'text-blue-600',
          accent: 'text-blue-700'
        };
      case 'green':
        return {
          bg: 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200',
          border: 'border-l-green-500',
          icon: 'text-green-600',
          accent: 'text-green-700'
        };
      case 'purple':
        return {
          bg: 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200',
          border: 'border-l-purple-500',
          icon: 'text-purple-600',
          accent: 'text-purple-700'
        };
      case 'orange':
        return {
          bg: 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200',
          border: 'border-l-orange-500',
          icon: 'text-orange-600',
          accent: 'text-orange-700'
        };
      case 'teal':
        return {
          bg: 'bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200',
          border: 'border-l-teal-500',
          icon: 'text-teal-600',
          accent: 'text-teal-700'
        };
      case 'indigo':
        return {
          bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200',
          border: 'border-l-indigo-500',
          icon: 'text-indigo-600',
          accent: 'text-indigo-700'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200',
          border: 'border-l-gray-500',
          icon: 'text-gray-600',
          accent: 'text-gray-700'
        };
    }
  };

  const colors = getColorClasses();
  const difference = actual - forecasted;
  const isPositive = difference >= 0;

  return (
    <div className={`${colors.bg} rounded-lg shadow-md p-4 border-l-4 ${colors.border} hover:shadow-lg transition-all duration-200`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center flex-1">
          <div className={`p-1.5 rounded-lg bg-white shadow-sm ${colors.icon}`}>
            {icon}
          </div>
          <h3 className="text-xs font-semibold text-gray-700 ml-2">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="p-1.5 rounded-lg bg-white hover:bg-gray-100 shadow-sm transition-colors"
              title="Ver detalhes"
            >
              <List className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">Previsto</span>
          <span className="text-sm font-semibold text-gray-700">
            {formatCurrency(forecasted)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">Realizado</span>
          <span className={`text-lg font-bold ${colors.accent}`}>
            {formatCurrency(actual)}
          </span>
        </div>
        
        {percentage !== undefined && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">% sobre Receita</span>
              <span className="text-sm font-semibold text-gray-700">
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        
        <div className="pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">Variação</span>
            <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{formatCurrency(difference)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};