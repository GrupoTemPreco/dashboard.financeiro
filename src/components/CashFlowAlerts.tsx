import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';

interface AlertData {
  date: string;
  type: 'shortage' | 'expenses';
  message: string;
  amount: number;
  topAccountGroups?: { group: string; amount: number }[];
}

interface CashFlowAlertsProps {
  data: AlertData[];
  darkMode?: boolean;
}

export const CashFlowAlerts: React.FC<CashFlowAlertsProps> = ({ data, darkMode = false }) => {
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
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (data.length === 0) {
    return (
      <div
        className={`rounded-lg p-3 border ${
          darkMode
            ? 'bg-emerald-900/40 border-emerald-700 text-emerald-100'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}
      >
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                darkMode ? 'bg-emerald-800' : 'bg-green-100'
              }`}
            >
              <span className={`text-xs ${darkMode ? 'text-emerald-100' : 'text-green-600'}`}>✓</span>
            </div>
          </div>
          <div className="ml-2">
            <h3 className="text-xs font-medium">
              Fluxo de Caixa Saudável
            </h3>
            <p className={`text-xs ${darkMode ? 'text-emerald-100/80' : 'text-green-700'}`}>
              Não há alertas de déficit de caixa ou despesas excessivas no período.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show only the first 2 alerts
  const displayAlerts = data.slice(0, 2);

  return (
    <div className="space-y-2">
      <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-slate-100' : 'text-gray-800'}`}>
        Alertas de Fluxo de Caixa
      </h3>
      
      {displayAlerts.map((alert, index) => (
        <div
          key={index}
          className={`border rounded-lg p-4 ${
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
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                alert.type === 'shortage' 
                    ? darkMode
                      ? 'bg-red-900'
                      : 'bg-red-100'
                    : darkMode
                      ? 'bg-amber-900'
                  : 'bg-yellow-100'
                }`}
              >
                {alert.type === 'shortage' ? (
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
                ) : (
                  <TrendingDown className="w-3 h-3 text-yellow-600" />
                )}
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
                {formatDate(alert.date)} - Saldo: {formatCurrency(alert.amount)}
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
  );
};