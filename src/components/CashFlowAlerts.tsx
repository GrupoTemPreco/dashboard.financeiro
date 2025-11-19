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
}

export const CashFlowAlerts: React.FC<CashFlowAlertsProps> = ({ data }) => {
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
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs">✓</span>
            </div>
          </div>
          <div className="ml-2">
            <h3 className="text-xs font-medium text-green-800">
              Fluxo de Caixa Saudável
            </h3>
            <p className="text-xs text-green-700">
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
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Alertas de Fluxo de Caixa</h3>
      
      {displayAlerts.map((alert, index) => (
        <div
          key={index}
          className={`border rounded-lg p-4 ${
            alert.type === 'shortage' 
              ? 'bg-red-50 border-red-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                alert.type === 'shortage' 
                  ? 'bg-red-100' 
                  : 'bg-yellow-100'
              }`}>
                {alert.type === 'shortage' ? (
                  <AlertTriangle className={`w-3 h-3 ${
                    alert.type === 'shortage' ? 'text-red-600' : 'text-yellow-600'
                  }`} />
                ) : (
                  <TrendingDown className="w-3 h-3 text-yellow-600" />
                )}
              </div>
            </div>
            <div className="ml-2 flex-1">
              <h4 className={`text-xs font-medium mb-1 ${
                alert.type === 'shortage' ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {formatDate(alert.date)} - Saldo: {formatCurrency(alert.amount)}
              </h4>
              <p className={`text-xs ${
                alert.type === 'shortage' ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {alert.message}
              </p>
              {alert.topAccountGroups && alert.topAccountGroups.length > 0 && (
                <div className={`mt-2 pt-2 border-t ${
                  alert.type === 'shortage' ? 'border-red-200' : 'border-yellow-200'
                }`}>
                  <p className={`text-xs font-medium mb-1 ${
                    alert.type === 'shortage' ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    Principais grupos impactando:
                  </p>
                  <ul className="space-y-1">
                    {alert.topAccountGroups.map((group, idx) => (
                      <li key={idx} className={`text-xs ${
                        alert.type === 'shortage' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
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