const XLSX = require('xlsx');
const path = require('path');

const templateDir = path.join(__dirname, '../public/templates');

const revenueDRETemplate = [
  ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Data de Emissão', 'Valor'],
  ['Recebida', 1, 'Receita Bruta', '01/01/2025', 10000.00],
  ['Recebida', 1, 'Receita Bruta', '02/01/2025', 15000.50],
  ['Recebida', 2, 'Receita Bruta', '03/01/2025', 20000.75]
];

const cmvDRETemplate = [
  ['Status', 'Unidade de Negócio', 'Plano de Contas', 'Data de Emissão', 'Valor'],
  ['Pago', 1, 'CMV', '01/01/2025', 5000.00],
  ['Pago', 1, 'CMV', '02/01/2025', 7500.50],
  ['Pago', 2, 'CMV', '03/01/2025', 10000.25]
];

const initialBalancesTemplate = [
  ['Unidade de Negócio', 'Banco', 'Saldo', 'Data do Saldo'],
  [1, 'Banco do Brasil', 50000.00, '01/01/2025'],
  [1, 'Itaú', 30000.00, '01/01/2025'],
  [2, 'Santander', 75000.50, '01/01/2025']
];

const wsRevenue = XLSX.utils.aoa_to_sheet(revenueDRETemplate);
const wbRevenue = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbRevenue, wsRevenue, 'Receita DRE');

const wsCMV = XLSX.utils.aoa_to_sheet(cmvDRETemplate);
const wbCMV = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbCMV, wsCMV, 'CMV DRE');

const wsInitialBalances = XLSX.utils.aoa_to_sheet(initialBalancesTemplate);
const wbInitialBalances = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbInitialBalances, wsInitialBalances, 'Saldos Bancários');

XLSX.writeFile(wbRevenue, path.join(templateDir, 'template_receita_dre.xlsx'));
XLSX.writeFile(wbCMV, path.join(templateDir, 'template_cmv_dre.xlsx'));
XLSX.writeFile(wbInitialBalances, path.join(templateDir, 'template_saldos_bancarios.xlsx'));

console.log('✅ Templates criados com sucesso!');
