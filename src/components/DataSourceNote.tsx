import React from 'react';

type DataSourceNoteProps = {
  tables: string[];
  darkMode?: boolean;
  suffix?: string;
  className?: string;
};

const TABLE_IMPORTER_LABELS: Record<string, string> = {
  empresas: 'Cadastro de Empresas',
  contas_a_pagar: 'Contas a Pagar',
  receitas: 'Receitas',
  transacoes_financeiras: 'Lançamentos Financeiros',
  previstos: 'Lançamentos Previstos',
  receitas_dre: 'Receita DRE',
  cmv_dre: 'CMV DRE',
  saldos_iniciais: 'Saldos Bancários',
  faturamento_dre: 'Faturamento DRE',
  orcamento_dre: 'Orçamento DRE'
};

export const DataSourceNote: React.FC<DataSourceNoteProps> = ({ tables, darkMode = false, suffix, className }) => {
  if (!tables || tables.length === 0) return null;

  return (
    <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'} ${className || ''}`}>
      Fonte:{' '}
      {tables.map((t, idx) => (
        <React.Fragment key={t}>
          {idx === 0 ? null : <span className="mx-1">·</span>}
          <span
            className={`font-mono px-1.5 py-0.5 rounded border ${
              darkMode ? 'border-slate-700 bg-slate-800/60 text-slate-300' : 'border-gray-200 bg-gray-50 text-gray-600'
            }`}
            title={`Tabela: ${t}`}
          >
            {TABLE_IMPORTER_LABELS[t] ?? t}
          </span>
        </React.Fragment>
      ))}
      {suffix ? <span className="ml-1">{suffix}</span> : null}
    </div>
  );
};

