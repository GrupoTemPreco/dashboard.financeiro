import React, { useState } from 'react';
import { AlertCircle, Calendar, DollarSign, FileText, Tag, User } from 'lucide-react';

interface ExpenseItem {
  id: string;
  supplier: string;
  dueDate: string;
  paymentDate?: string;
  amount: number;
  invoice: string;
  category: string;
  status: 'pending' | 'paid' | 'overdue';
  priority: 'high' | 'medium' | 'low';
}

interface ExpenseBreakdownProps {
  expenses: ExpenseItem[];
  recommendations: string[];
}

export const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({ expenses, recommendations }) => {
  const [sortBy, setSortBy] = useState<'dueDate' | 'amount' | 'supplier'>('dueDate');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue'>('all');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'overdue':
        return 'Vencido';
      default:
        return 'Pendente';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-green-600';
    }
  };

  const filteredExpenses = expenses
    .filter(expense => filterStatus === 'all' || expense.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.amount - a.amount;
        case 'supplier':
          return a.supplier.localeCompare(b.supplier);
        default:
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
    });

  return (
    <div className="space-y-6">
      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          Recomendações para Otimização de Caixa
        </h3>
        <ul className="space-y-2">
          {recommendations.map((recommendation, index) => (
            <li key={index} className="text-sm text-blue-700 flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              {recommendation}
            </li>
          ))}
        </ul>
      </div>

      {/* Expense Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800">Detalhamento de Despesas Analíticas</h3>
          
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-marsala-500"
            >
              <option value="dueDate">Ordenar por Vencimento</option>
              <option value="amount">Ordenar por Valor</option>
              <option value="supplier">Ordenar por Fornecedor</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-marsala-500"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="overdue">Vencidos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Fornecedor
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Vencimento
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Pagamento
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Valor
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Nota Fiscal
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center">
                    <Tag className="w-4 h-4 mr-2" />
                    Categoria
                  </div>
                </th>
                <th className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-3 text-sm">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${getPriorityColor(expense.priority)}`}></div>
                      <span className="font-medium text-gray-800">{expense.supplier}</span>
                    </div>
                  </td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                    {formatDate(expense.dueDate)}
                  </td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                    {expense.paymentDate ? formatDate(expense.paymentDate) : '-'}
                  </td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                    {expense.invoice}
                  </td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                    {expense.category}
                  </td>
                  <td className="border border-gray-200 px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                      {getStatusText(expense.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-600 rounded-full mr-2"></div>
              <span>Alta Prioridade</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-yellow-600 rounded-full mr-2"></div>
              <span>Média Prioridade</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
              <span>Baixa Prioridade</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};