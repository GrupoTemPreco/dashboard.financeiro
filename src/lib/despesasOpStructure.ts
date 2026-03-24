/**
 * Estrutura da seção Despesas Operacionais (DRE + tabela).
 * Fica em lib para o registry global de prefixos CAP sem import circular com componentes.
 */
export interface DespesaOperacionalStructureRow {
  id?: string;
  name: string;
  level: number;
  editable: boolean;
  bg: string;
  bold?: boolean;
  formula?: 'sum';
  parent: string | null;
  expandable?: boolean;
  chartOfAccountsPrefix?: string;
  chartOfAccountsSegmentContains?: string;
  chartOfAccountsSegmentExcludes?: string;
  /** Chave única em orçamentos quando o prefixo do plano se repete (ex.: duas linhas 04.2). */
  budgetAccountKey?: string;
}

export const DESPESAS_OP_STRUCTURE: DespesaOperacionalStructureRow[] = [
  { id: 'despesas-op', name: 'Despesas Operacionais', level: 1, editable: false, bg: 'bg-orange-50', bold: true, formula: 'sum', parent: null as string | null, expandable: true },
  {
    id: 'despesas-op-mercadorias',
    name: 'Despesas com mercadorias',
    level: 2,
    editable: false,
    bg: '',
    bold: true,
    formula: 'sum',
    parent: 'despesas-op',
    expandable: true
  },
  {
    name: 'Despesas com pagto de Mercadoria (CVM)',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '04.1',
    chartOfAccountsSegmentContains: 'Mercadoria'
  },
  {
    name: 'Taxas de cartão de crédito (R$)',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '04.2',
    chartOfAccountsSegmentContains: 'Cartão',
    chartOfAccountsSegmentExcludes: 'Automat',
    budgetAccountKey: '04.2-taxas-cartao'
  },
  {
    name: 'Taxas de cartão de crédito automática (R$)',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '04.2',
    chartOfAccountsSegmentContains: 'Automat',
    budgetAccountKey: '04.2-taxas-cartao-automatica'
  },
  {
    name: 'Taxas de Convenios Terceirizados',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '04.3',
    chartOfAccountsSegmentContains: 'Terceirizados'
  },
  {
    name: 'Perdas de Cheques/Cartões (R$)',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '04.4',
    chartOfAccountsSegmentContains: 'Perdas'
  },
  {
    name: 'Medicamentos Éticos',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '04.6',
    chartOfAccountsSegmentContains: 'Ético'
  },
  {
    name: 'Medicamentos Multiplos',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '04.8',
    chartOfAccountsSegmentContains: 'Multiplo'
  },
  {
    name: 'Medicamentos Bonificados',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '06.5',
    chartOfAccountsSegmentContains: 'Bonificados'
  },
  {
    name: 'Perfumaria',
    level: 3,
    editable: true,
    bg: '',
    parent: 'despesas-op-mercadorias',
    chartOfAccountsPrefix: '06.7',
    chartOfAccountsSegmentContains: 'Perfumaria'
  },
  { id: 'imposto-venda', name: 'Imposto sobre venda', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Simples Nacional pago no período (R$)', level: 3, editable: true, bg: '', parent: 'imposto-venda', chartOfAccountsPrefix: '03.1', chartOfAccountsSegmentContains: 'Simples Nacional' },
  { name: 'ICMS Pago No Período', level: 3, editable: true, bg: '', parent: 'imposto-venda', chartOfAccountsPrefix: '03.2', chartOfAccountsSegmentContains: 'ICMS' },
  { name: 'Parcelamento de Divida Ativa pago no período', level: 3, editable: true, bg: '', parent: 'imposto-venda', chartOfAccountsPrefix: '03.3', chartOfAccountsSegmentContains: 'Parcelamento' },
  { id: 'despesas-op-pessoal', name: 'Despesas operacionais com pessoal', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Salários Fixos + Horas Extras', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.01', chartOfAccountsSegmentContains: 'Salários' },
  { name: 'Custo com Motoboy', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.16', chartOfAccountsSegmentContains: 'Motoboy' },
  { name: 'Convênio Makebella', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.15', chartOfAccountsSegmentContains: 'Makebella' },
  { name: 'Comissões e Premiações Sobre Vendas', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.02', chartOfAccountsSegmentContains: 'Comissões' },
  { name: '13º. Salário e Férias', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.03', chartOfAccountsSegmentContains: 'Férias' },
  { name: 'Endomarketing', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.04', chartOfAccountsSegmentContains: 'Endomarketing' },
  { name: 'Vale Transporte', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.05', chartOfAccountsSegmentContains: 'Vale' },
  { name: 'Encargos - FGTS', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.06', chartOfAccountsSegmentContains: 'FGTS' },
  { name: 'Encargos - INSS / IRPF', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.07', chartOfAccountsSegmentContains: 'IRPF' },
  { name: 'FGTS Multa Recisória', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.08', chartOfAccountsSegmentContains: 'Multa' },
  { name: 'Verba Rescisória', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.09', chartOfAccountsSegmentContains: 'Verba' },
  { name: 'Uniforme', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.10', chartOfAccountsSegmentContains: 'Uniforme' },
  { name: 'Exames Médicos', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.11', chartOfAccountsSegmentContains: 'Exames' },
  { name: 'Encargo em Atraso - INSS / IRRF', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.12', chartOfAccountsSegmentContains: 'IRRF' },
  { name: 'Encargo em Atraso - FGTS', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.13', chartOfAccountsSegmentContains: 'Atraso' },
  { name: 'Indenização Trabalhista', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '05.14', chartOfAccountsSegmentContains: 'Indenização' },
  { name: 'Pró-Labore', level: 3, editable: true, bg: '', parent: 'despesas-op-pessoal', chartOfAccountsPrefix: '06.1', chartOfAccountsSegmentContains: 'Labore' },
  { id: 'despesas-op-assessorias', name: 'Despesas operacionais com assessorias', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Aluguel do POS de Cartão e Crédito', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.1', chartOfAccountsSegmentContains: 'POS' },
  { name: 'Escritório de Contabilidade', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.2', chartOfAccountsSegmentContains: 'Contabilidade' },
  { name: 'Assessoria Jurídica', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.3', chartOfAccountsSegmentContains: 'Juridica' },
  { name: 'Cursos, Treinamentos e Despesas de Viagem', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.4', chartOfAccountsSegmentContains: 'Cursos' },
  { name: 'Entidades', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.5', chartOfAccountsSegmentContains: 'Entidades' },
  { name: 'Manutenção de Software + Hardware', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.6', chartOfAccountsSegmentContains: 'Software' },
  { name: 'Outras Despesas com Assessorias', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.7', chartOfAccountsSegmentContains: 'Outras' },
  { name: 'Mensalidades', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.8', chartOfAccountsSegmentContains: 'Mensalidades' },
  { name: 'Alarmes e Segurança', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.9', chartOfAccountsSegmentContains: 'Alarmes' },
  { name: 'Sistemas e Servidores', level: 3, editable: true, bg: '', parent: 'despesas-op-assessorias', chartOfAccountsPrefix: '07.10', chartOfAccountsSegmentContains: 'Sistemas' },
  { id: 'despesas-op-admin', name: 'Despesas operacionais administrativas', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Seguro da Empresa (Imóvel e Veículos)', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.1', chartOfAccountsSegmentContains: 'Seguro' },
  { name: 'Manutenção de Veículos', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.2', chartOfAccountsSegmentContains: 'Manutenção' },
  { name: 'Prosegur', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.2', chartOfAccountsSegmentContains: 'Prosegur' },
  { name: 'Combustível Operacional', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.3', chartOfAccountsSegmentContains: 'Combustível' },
  { name: 'Prestador de Serviço Terceirizado', level: 3, editable: true, bg: '', parent: 'despesas-op-admin', chartOfAccountsPrefix: '08.4', chartOfAccountsSegmentContains: 'Terceirizado' },
  { id: 'despesas-op-func', name: 'Despesas operacionais com funcionamento', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Aluguel', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.01', chartOfAccountsSegmentContains: 'Aluguel' },
  { name: 'IPTU', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.02', chartOfAccountsSegmentContains: 'IPTU' },
  { name: 'Energia Elétrica', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.03', chartOfAccountsSegmentContains: 'Energia' },
  { name: 'Água / Esgoto', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.04', chartOfAccountsSegmentContains: 'Água' },
  { name: 'Telefone / Acesso a Internet', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.05', chartOfAccountsSegmentContains: 'Telefone' },
  { name: 'Consumo Interno', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.06', chartOfAccountsSegmentContains: 'Consumo Interno', chartOfAccountsSegmentExcludes: 'Lojas' },
  { name: 'Mat.Limpeza / Faxina', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.07', chartOfAccountsSegmentContains: 'Limpeza' },
  { name: 'Manutenção de Instalações', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.08', chartOfAccountsSegmentContains: 'Instalações' },
  { name: 'Taxas e Licenças da Farmácia', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.09', chartOfAccountsSegmentContains: 'Taxas' },
  { name: 'TFE -Tx Fiscalização Estabelecimento', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.10', chartOfAccountsSegmentContains: 'TFE' },
  { name: 'TFA - Tx de Fiscalização Anuncios', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.11', chartOfAccountsSegmentContains: 'TFA' },
  { name: 'Promoção e Propaganda', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.12', chartOfAccountsSegmentContains: 'Promoção' },
  { name: 'Outras Despesas de Funcionamento', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.13', chartOfAccountsSegmentContains: 'Outras' },
  { name: 'Consumo Interno - Lojas', level: 3, editable: true, bg: '', parent: 'despesas-op-func', chartOfAccountsPrefix: '09.14', chartOfAccountsSegmentContains: 'Lojas' },
  { id: 'despesas-financeiras', name: 'Despesas financeiras', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Juros de Cheque, Duplicatas e Demais Juros', level: 3, editable: true, bg: '', parent: 'despesas-financeiras', chartOfAccountsPrefix: '10.1', chartOfAccountsSegmentContains: 'Juros' },
  { name: 'Tarifas Bancárias', level: 3, editable: true, bg: '', parent: 'despesas-financeiras', chartOfAccountsPrefix: '10.2', chartOfAccountsSegmentContains: 'Tarifas' },
  { id: 'despesas-extras', name: 'Despesas Extras', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Produtos Vencidos', level: 3, editable: true, bg: '', parent: 'despesas-extras', chartOfAccountsPrefix: '13.01', chartOfAccountsSegmentContains: 'Produtos Vencidos' },
  { name: 'Quebra de Inventário', level: 3, editable: true, bg: '', parent: 'despesas-extras', chartOfAccountsPrefix: '13.02', chartOfAccountsSegmentContains: 'Quebra' },
  { name: 'Fundo de Troco - Lojas', level: 3, editable: true, bg: '', parent: 'despesas-extras', chartOfAccountsPrefix: '13.12', chartOfAccountsSegmentContains: 'Fundo de Troco' },
  { id: 'despesas-rateio', name: 'Despesas com rateio', level: 2, editable: false, bg: '', bold: true, formula: 'sum', parent: 'despesas-op', expandable: true },
  { name: 'Aporte Escritório', level: 3, editable: true, bg: '', parent: 'despesas-rateio', chartOfAccountsPrefix: '13.18', chartOfAccountsSegmentContains: 'Aporte' }
];
