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
  darkMode?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  forecasted,
  actual,
  percentage,
  icon,
  color,
  section,
  onViewDetails,
  darkMode = false
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
    if (darkMode) {
      switch (color) {
        case 'yellow':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-amber-400',
            icon: 'text-amber-300 bg-slate-900',
            accent: 'text-amber-300',
            glow: 'hover:shadow-[0_0_32px_rgba(245,158,11,0.45)]'
          } as any;
        case 'red':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-rose-400',
            icon: 'text-rose-300 bg-slate-900',
            accent: 'text-rose-300',
            glow: 'hover:shadow-[0_0_32px_rgba(248,113,113,0.45)]'
          } as any;
        case 'blue':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-sky-400',
            icon: 'text-sky-300 bg-slate-900',
            accent: 'text-sky-300',
            glow: 'hover:shadow-[0_0_32px_rgba(59,130,246,0.45)]'
          } as any;
        case 'green':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-emerald-400',
            icon: 'text-emerald-300 bg-slate-900',
            accent: 'text-emerald-300',
            glow: 'hover:shadow-[0_0_32px_rgba(16,185,129,0.45)]'
          } as any;
        case 'purple':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-violet-400',
            icon: 'text-violet-300 bg-slate-900',
            accent: 'text-violet-300',
            glow: 'hover:shadow-[0_0_32px_rgba(139,92,246,0.45)]'
          } as any;
        case 'orange':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-orange-400',
            icon: 'text-orange-300 bg-slate-900',
            accent: 'text-orange-300',
            glow: 'hover:shadow-[0_0_32px_rgba(249,115,22,0.45)]'
          } as any;
        case 'teal':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-teal-400',
            icon: 'text-teal-300 bg-slate-900',
            accent: 'text-teal-300',
            glow: 'hover:shadow-[0_0_32px_rgba(45,212,191,0.45)]'
          } as any;
        case 'indigo':
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-indigo-400',
            icon: 'text-indigo-300 bg-slate-900',
            accent: 'text-indigo-300',
            glow: 'hover:shadow-[0_0_32px_rgba(79,70,229,0.45)]'
          } as any;
        default:
          return {
            bg: 'bg-[#0F172A]',
            border: 'border border-slate-800 border-l-slate-500',
            icon: 'text-slate-200 bg-slate-900',
            accent: 'text-slate-100',
            glow: 'hover:shadow-[0_0_32px_rgba(148,163,184,0.45)]'
          } as any;
      }
    }

    switch (color) {
      case 'yellow':
        return {
          bg: 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200',
          border: 'border-l-amber-500',
          icon: 'text-amber-600 bg-white',
          accent: 'text-amber-700'
        };
      case 'red':
        return {
          bg: 'bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200',
          border: 'border-l-rose-500',
          icon: 'text-rose-600 bg-white',
          accent: 'text-rose-700'
        };
      case 'blue':
        return {
          bg: 'bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200',
          border: 'border-l-sky-500',
          icon: 'text-sky-600 bg-white',
          accent: 'text-sky-700'
        };
      case 'green':
        return {
          bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200',
          border: 'border-l-emerald-500',
          icon: 'text-emerald-600 bg-white',
          accent: 'text-emerald-700'
        };
      case 'purple':
        return {
          bg: 'bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200',
          border: 'border-l-violet-500',
          icon: 'text-violet-600 bg-white',
          accent: 'text-violet-700'
        };
      case 'orange':
        return {
          bg: 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200',
          border: 'border-l-orange-500',
          icon: 'text-orange-600 bg-white',
          accent: 'text-orange-700'
        };
      case 'teal':
        return {
          bg: 'bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200',
          border: 'border-l-teal-500',
          icon: 'text-teal-600 bg-white',
          accent: 'text-teal-700'
        };
      case 'indigo':
        return {
          bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200',
          border: 'border-l-indigo-500',
          icon: 'text-indigo-600 bg-white',
          accent: 'text-indigo-700'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200',
          border: 'border-l-slate-500',
          icon: 'text-slate-600 bg-white',
          accent: 'text-slate-800'
        };
    }
  };

  const colors: any = getColorClasses();
  const difference = actual - forecasted;
  const isPositive = difference >= 0;

  return (
    <div className={`${colors.bg} rounded-lg p-6 border-l-4 ${colors.border} shadow-[0_18px_40px_rgba(15,23,42,0.18)] ${darkMode ? (colors.glow || '') : 'hover:shadow-[0_22px_55px_rgba(15,23,42,0.28)]'} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center flex-1">
          <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-slate-950' : 'bg-white'} shadow-sm ${colors.icon}`}>
            {icon}
          </div>
          <h3 className={`text-xs font-semibold ml-2 ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className={`p-1.5 rounded-lg shadow-sm border transition-colors ${darkMode ? 'bg-slate-900/80 hover:bg-slate-900 border-slate-700' : 'bg-white/70 hover:bg-white border-slate-200'}`}
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
          <span className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Previsto</span>
          <span className={`text-sm font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
            {formatCurrency(forecasted)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Realizado</span>
          <span className={`text-lg font-bold ${colors.accent}`}>
            {formatCurrency(actual)}
          </span>
        </div>
        
        {percentage !== undefined && (
          <div className={`pt-2 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>% sobre Receita</span>
              <span className={`text-sm font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-700'}`}>
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        
        <div className={`pt-2 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex justify-between items-center">
            <span className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-gray-500'}`}>Variação</span>
            <span className={`text-sm font-semibold ${isPositive ? (darkMode ? 'text-emerald-300' : 'text-emerald-600') : (darkMode ? 'text-rose-300' : 'text-red-600')}`}>
              {isPositive ? '+' : ''}{formatCurrency(difference)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};