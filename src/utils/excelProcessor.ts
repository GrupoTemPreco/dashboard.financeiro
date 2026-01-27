import * as XLSX from 'xlsx';
import { FinancialRecord, Company, AccountsPayable, Revenue, FinancialTransaction } from '../types/financial';

export type FileType = 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'revenues_dre' | 'cmv_dre' | 'initial_balances' | 'orcamento_dre';

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export const validateFileFormat = (file: File, expectedType: FileType): Promise<ValidationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          resolve({
            isValid: false,
            errorMessage: 'O arquivo não contém planilhas válidas.'
          });
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          resolve({
            isValid: false,
            errorMessage: 'O arquivo não contém dados suficientes (necessário pelo menos cabeçalho + 1 linha de dados).'
          });
          return;
        }

        // Pegar cabeçalho (primeira linha) e algumas linhas de dados para validação
        const header = jsonData[0] as any[];
        const sampleRows = jsonData.slice(1, Math.min(6, jsonData.length)); // Primeiras 5 linhas de dados

        let validationResult: ValidationResult = { isValid: true };

        switch (expectedType) {
          case 'companies':
            // Companies: A=Código, B=Grupo, C=Nome
            // Não deve ter coluna de Status, Credor, Data, Valor
            if (header.length >= 4) {
              const hasStatus = String(header[0] || '').toLowerCase().includes('status');
              const hasCredor = header.some((col: any) => String(col || '').toLowerCase().includes('credor') || String(col || '').toLowerCase().includes('fornecedor'));
              const hasDate = header.some((col: any) => String(col || '').toLowerCase().includes('data') || String(col || '').toLowerCase().includes('date'));
              const hasValor = header.some((col: any) => String(col || '').toLowerCase().includes('valor') || String(col || '').toLowerCase().includes('amount'));
              
              if (hasStatus || hasCredor || hasDate || hasValor) {
                validationResult = {
                  isValid: false,
                  errorMessage: 'Este arquivo parece ser de Contas a Pagar, Receitas ou outro tipo, não de Cadastro de Empresas. O arquivo de empresas deve ter apenas: Código, Grupo e Nome da Empresa.'
                };
              }
            }
            break;

          case 'accounts_payable':
            // Accounts Payable: A=Status, B=Unidade, C=Plano de Contas, D=Credor, E=Data Pagamento, F=Valor
            // Deve ter Status, Credor, Data, Valor
            if (header.length < 4) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Contas a Pagar deve ter pelo menos 4 colunas: Status, Unidade de Negócio, Plano de Contas, Credor, Data de Pagamento e Valor.'
              };
            } else {
              // Verificar se tem coluna de Banco (típica de Saldos Bancários)
              const hasBank = header.some((col: any) => String(col || '').toLowerCase().includes('banco') || String(col || '').toLowerCase().includes('bank'));
              // Verificar se tem apenas 3 colunas principais (típico de Saldos)
              if (hasBank && header.length <= 4) {
                validationResult = {
                  isValid: false,
                  errorMessage: 'Este arquivo parece ser de Saldos Bancários, não de Contas a Pagar. O arquivo de Contas a Pagar deve ter: Status, Unidade de Negócio, Plano de Contas, Credor, Data de Pagamento e Valor.'
                };
              }
            }
            break;

          case 'revenues':
            // Revenues: A=Status, B=Unidade, C=Plano de Contas, D=Data Pagamento, E=Valor
            // Não deve ter Credor
            if (header.length < 3) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Receitas deve ter pelo menos 3 colunas: Status, Unidade de Negócio, Plano de Contas, Data de Pagamento e Valor.'
              };
            } else {
              const hasCredor = header.some((col: any) => String(col || '').toLowerCase().includes('credor') || String(col || '').toLowerCase().includes('fornecedor'));
              if (hasCredor && header.length >= 6) {
                validationResult = {
                  isValid: false,
                  errorMessage: 'Este arquivo parece ser de Contas a Pagar (tem coluna Credor), não de Receitas. O arquivo de Receitas não deve ter coluna de Credor.'
                };
              }
            }
            break;

          case 'financial_transactions':
            // Financial Transactions: A=Status, B=Unidade, C=Plano de Contas, D=Data, E=Valor
            // Similar a revenues mas sem data de pagamento específica
            if (header.length < 3) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Lançamentos Financeiros deve ter pelo menos 3 colunas: Status, Unidade de Negócio, Plano de Contas, Data e Valor.'
              };
            }
            break;

          case 'forecasted_entries':
            // Forecasted Entries: A=Status, B=Unidade, C=Plano de Contas, D=Credor, E=Data Vencimento, F=Valor
            if (header.length < 4) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Lançamentos Previstos deve ter pelo menos 4 colunas: Status, Unidade de Negócio, Plano de Contas, Credor, Data de Vencimento e Valor.'
              };
            }
            break;

          case 'revenues_dre':
            // Receita DRE: A=Unidade de Negócio, B=Data emissão, C=Valor
            if (header.length < 3) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Receita DRE deve ter pelo menos 3 colunas: Unidade de Negócio, Data emissão e Valor.'
              };
            } else {
              // Verificar se tem coluna de Status (típica de outras tabelas DRE antigas)
              const hasStatus = header.some((col: any) => String(col || '').toLowerCase().includes('status'));
              const hasCredor = header.some((col: any) => String(col || '').toLowerCase().includes('credor') || String(col || '').toLowerCase().includes('fornecedor'));
              const hasChartOfAccounts = header.some((col: any) => String(col || '').toLowerCase().includes('plano') || String(col || '').toLowerCase().includes('chart'));
              
              if (hasStatus || hasCredor || hasChartOfAccounts) {
                validationResult = {
                  isValid: false,
                  errorMessage: 'Este arquivo parece ter formato antigo. O arquivo de Receita DRE deve ter apenas 3 colunas: Unidade de Negócio, Data emissão e Valor (sem Status, Credor ou Plano de Contas).'
                };
              } else {
                // Verificar se tem coluna de Banco (típica de Saldos)
                const hasBank = header.some((col: any) => String(col || '').toLowerCase().includes('banco') || String(col || '').toLowerCase().includes('bank'));
                if (hasBank) {
                  validationResult = {
                    isValid: false,
                    errorMessage: 'Este arquivo parece ser de Saldos Bancários, não de Receita DRE. O arquivo de Receita DRE deve ter: Unidade de Negócio, Data emissão e Valor.'
                  };
                }
              }
            }
            break;

          case 'cmv_dre':
            // CMV DRE: A=Status (deve ser "Pago"), B=Unidade, C=Plano de Contas (deve ser "CMV"), D=Data Emissão, E=Valor
            if (header.length < 3) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de CMV DRE deve ter pelo menos 3 colunas: Status, Unidade de Negócio, Plano de Contas, Data de Emissão e Valor.'
              };
            } else {
              // Verificar nas primeiras linhas se o Status é "Pago" e Plano de Contas é "CMV"
              let foundValidRow = false;
              for (const row of sampleRows) {
                const rowArray = row as any[];
                if (rowArray && Array.isArray(rowArray) && rowArray.length >= 3) {
                  const status = String(rowArray[0] || '').toLowerCase().trim();
                  const chartOfAccounts = String(rowArray[2] || '').toUpperCase().trim();
                  if ((status === 'pago' || status === 'paga') && chartOfAccounts === 'CMV') {
                    foundValidRow = true;
                    break;
                  }
                }
              }
              
              // Verificar se tem coluna de Banco (típica de Saldos)
              const hasBank = header.some((col: any) => String(col || '').toLowerCase().includes('banco') || String(col || '').toLowerCase().includes('bank'));
              if (hasBank) {
                validationResult = {
                  isValid: false,
                  errorMessage: 'Este arquivo parece ser de Saldos Bancários, não de CMV DRE. O arquivo de CMV DRE deve ter: Status (Pago), Unidade de Negócio, Plano de Contas (CMV), Data de Emissão e Valor.'
                };
              } else if (!foundValidRow && sampleRows.length > 0) {
                // Se não encontrou uma linha válida, verificar se tem características de outro tipo
                const firstRow = sampleRows[0] as any[];
                if (firstRow && firstRow.length >= 3) {
                  const status = String(firstRow[0] || '').toLowerCase().trim();
                  const hasCredor = header.some((col: any) => String(col || '').toLowerCase().includes('credor'));
                  
                  if (hasCredor) {
                    validationResult = {
                      isValid: false,
                      errorMessage: 'Este arquivo parece ser de Contas a Pagar ou Lançamentos Previstos (tem coluna Credor), não de CMV DRE. O arquivo de CMV DRE não deve ter coluna de Credor e o Status deve ser "Pago".'
                    };
                  } else if (status === 'recebida' || status === 'recebido') {
                    validationResult = {
                      isValid: false,
                      errorMessage: 'Este arquivo parece ser de Receita DRE (Status "Recebida"), não de CMV DRE. O arquivo de CMV DRE deve ter Status "Pago" e Plano de Contas "CMV".'
                    };
                  }
                }
              }
            }
            break;

          case 'initial_balances':
            // Initial Balances: A=Unidade, B=Banco, C=Saldo, D=Data Saldo
            // Não deve ter Status, Credor, Plano de Contas
            if (header.length < 3) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Saldos Bancários deve ter pelo menos 3 colunas: Unidade de Negócio, Banco, Saldo e Data do Saldo.'
              };
            } else {
              const firstCol = String(header[0] || '').toLowerCase();
              const hasStatus = firstCol.includes('status');
              const hasCredor = header.some((col: any) => String(col || '').toLowerCase().includes('credor') || String(col || '').toLowerCase().includes('fornecedor'));
              const hasChartOfAccounts = header.some((col: any) => String(col || '').toLowerCase().includes('plano') || String(col || '').toLowerCase().includes('chart'));
              
              // Verificar nas primeiras linhas se tem Status na primeira coluna (típico de CAP)
              let hasStatusInData = false;
              for (const row of sampleRows) {
                const rowArray = row as any[];
                if (rowArray && Array.isArray(rowArray) && rowArray.length > 0) {
                  const firstCell = String(rowArray[0] || '').toLowerCase().trim();
                  if (firstCell === 'paga' || firstCell === 'pago' || firstCell === 'pendente' || firstCell === 'realizado' || firstCell === 'previsto') {
                    hasStatusInData = true;
                    break;
                  }
                }
              }
              
              if (hasStatus || hasCredor || hasChartOfAccounts || hasStatusInData) {
                let detectedType = 'Contas a Pagar';
                if (hasCredor && hasStatus) {
                  detectedType = 'Contas a Pagar ou Lançamentos Previstos';
                } else if (!hasCredor && hasStatus) {
                  detectedType = 'Receitas ou Lançamentos Financeiros';
                }
                
                validationResult = {
                  isValid: false,
                  errorMessage: `Este arquivo parece ser de ${detectedType}, não de Saldos Bancários.\n\nO arquivo de Saldos Bancários deve ter apenas:\n- Coluna A: Unidade de Negócio\n- Coluna B: Banco\n- Coluna C: Saldo\n- Coluna D: Data do Saldo\n\nSem colunas de Status, Credor ou Plano de Contas.`
                };
              } else {
                // Verificar se tem coluna de Banco
                const hasBank = header.some((col: any) => String(col || '').toLowerCase().includes('banco') || String(col || '').toLowerCase().includes('bank'));
                if (!hasBank && header.length >= 2) {
                  // Se não tem "banco" no cabeçalho, verificar se a segunda coluna parece ser um nome de banco
                  const secondColHeader = String(header[1] || '').toLowerCase();
                  if (!secondColHeader.includes('banco') && !secondColHeader.includes('bank')) {
                    validationResult = {
                      isValid: false,
                      errorMessage: 'Este arquivo não parece ser de Saldos Bancários. O arquivo de Saldos Bancários deve ter uma coluna "Banco" na segunda coluna (coluna B).'
                    };
                  }
                }
              }
            }
            break;

          case 'orcamento_dre':
            // Orçamento DRE: A=Unidade de Negócio, B=Nome da Conta, C=Período (data), D=Valor do Orçamento
            if (header.length < 3) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Orçamento DRE deve ter pelo menos 3 colunas: Unidade de Negócio, Nome da Conta, Período e Valor do Orçamento.'
              };
            } else {
              // Verificar se tem coluna de Status (típica de outras tabelas)
              const hasStatus = header.some((col: any) => String(col || '').toLowerCase().includes('status'));
              const hasCredor = header.some((col: any) => String(col || '').toLowerCase().includes('credor'));
              
              if (hasStatus || hasCredor) {
                validationResult = {
                  isValid: false,
                  errorMessage: 'Este arquivo parece ser de outro tipo (tem colunas de Status ou Credor). O arquivo de Orçamento DRE deve ter: Unidade de Negócio, Nome da Conta, Período e Valor do Orçamento.'
                };
              }
            }
            break;
        }

        resolve(validationResult);
      } catch (error) {
        resolve({
          isValid: false,
          errorMessage: `Erro ao validar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        });
      }
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        errorMessage: 'Falha ao ler o arquivo. Verifique se o arquivo está corrompido.'
      });
    };

    reader.readAsBinaryString(file);
  });
};

export const processCompaniesFile = (file: File): Promise<Company[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const companies: any[] = jsonData.map((row: any) => {
          const companyName = row['C'] || row['Nome'] || row['Name'] || row.company_name || '';
          return {
            company_code: row['A'] || row['Codigo'] || row['Código'] || row.company_code || '',
            company_name: companyName,
            group_name: row['B'] || row['Grupo'] || row['Group'] || row.group_name || '',
            name: companyName // Required field in the database
          };
        });
        
        resolve(companies);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

export const processExcelFile = (file: File): Promise<FinancialRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const records: FinancialRecord[] = jsonData.map((row: any, index) => ({
          id: `record-${index}`,
          company: row.Company || row.company || '',
          group: row.Group || row.group || '',
          date: row.Date || row.date || '',
          openingBalance: parseFloat(row.OpeningBalance || row.opening_balance || 0),
          forecastedRevenue: parseFloat(row.ForecastedRevenue || row.forecasted_revenue || 0),
          actualRevenue: parseFloat(row.ActualRevenue || row.actual_revenue || 0),
          forecastedOutflows: parseFloat(row.ForecastedOutflows || row.forecasted_outflows || 0),
          actualOutflows: parseFloat(row.ActualOutflows || row.actual_outflows || 0),
          finalBalance: parseFloat(row.FinalBalance || row.final_balance || 0),
          cogs: parseFloat(row.COGS || row.cogs || 0),
          loans: parseFloat(row.Loans || row.loans || 0),
          financing: parseFloat(row.Financing || row.financing || 0)
        }));
        
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

export const processAccountsPayableFile = (file: File): Promise<AccountsPayable[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const accountsPayable: AccountsPayable[] = [];
        let totalRows = 0;
        let skippedEmpty = 0;
        let skippedNoDate = 0;
        let processed = 0;
        const un02Total = { count: 0, sum: 0 };

        console.log('📊 CONTAS A PAGAR - Total de linhas na planilha:', jsonData.length - 1);

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          totalRows++;

          if (!row[0] && !row[1] && !row[2]) {
            skippedEmpty++;
            console.log(`⚠️ Linha ${i}: Ignorada (vazia) - Row:`, row);
            continue;
          }

          const paymentDateStr = row[4];
          let paymentDate = '';

          if (paymentDateStr) {
            if (typeof paymentDateStr === 'number') {
              const date = new Date((paymentDateStr - 25569) * 86400 * 1000);
              paymentDate = date.toISOString().split('T')[0];
            } else if (typeof paymentDateStr === 'string') {
              const parts = paymentDateStr.split('/');
              if (parts.length === 3) {
                paymentDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          // Skip records without valid date
          if (!paymentDate) {
            skippedNoDate++;
            console.warn(`⚠️ Linha ${i}: Ignorada (sem data válida) - Row:`, row);
            continue;
          }

          const statusValue = (row[0] || '').toLowerCase().trim();
          const isRealized = statusValue === 'realizado' || statusValue === 'paga' || statusValue === 'pago';
          const businessUnit = String(row[1] || '').trim();
          const amount = parseFloat(row[5]) || 0;

          const accountPayable: any = {
            status: isRealized ? 'realizado' : 'previsto',
            business_unit: businessUnit,
            chart_of_accounts: row[2] || '',
            creditor: row[3] || '',
            payment_date: paymentDate,
            amount: amount
          };

          processed++;
          accountsPayable.push(accountPayable);

          // Track UN 02
          if (businessUnit === '02' || businessUnit === '2') {
            un02Total.count++;
            un02Total.sum += amount;
            console.log(`✅ Linha ${i}: UN 02 - Valor: ${amount.toFixed(2)} | Status: ${statusValue} | Data: ${paymentDate}`);
          }
        }

        console.log('📊 RESUMO CONTAS A PAGAR:');
        console.log(`   Total de linhas: ${totalRows}`);
        console.log(`   Ignoradas (vazias): ${skippedEmpty}`);
        console.log(`   Ignoradas (sem data): ${skippedNoDate}`);
        console.log(`   Processadas: ${processed}`);
        console.log(`   UN 02 - Registros: ${un02Total.count} | Total: R$ ${un02Total.sum.toFixed(2)}`);

        resolve(accountsPayable);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

export const processRevenuesFile = (file: File): Promise<Revenue[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const revenues: Revenue[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];

          if (!row[0] && !row[1] && !row[2]) continue;

          const paymentDateStr = row[3];
          let paymentDate = '';

          if (paymentDateStr) {
            if (typeof paymentDateStr === 'number') {
              const date = new Date((paymentDateStr - 25569) * 86400 * 1000);
              paymentDate = date.toISOString().split('T')[0];
            } else if (typeof paymentDateStr === 'string') {
              const parts = paymentDateStr.split('/');
              if (parts.length === 3) {
                paymentDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          // Skip records without valid date
          if (!paymentDate) {
            console.warn('Skipping revenue record without valid date:', row);
            continue;
          }

          const statusValue = (row[0] || '').toLowerCase().trim();
          const isRealized = statusValue === 'realizado' || statusValue === 'recebida' || statusValue === 'recebido' || statusValue === 'paga' || statusValue === 'pago';

          const revenue: any = {
            status: isRealized ? 'realizado' : 'previsto',
            business_unit: row[1] || '',
            chart_of_accounts: row[2] || '',
            payment_date: paymentDate,
            amount: parseFloat(row[4]) || 0
          };

          revenues.push(revenue);
        }

        resolve(revenues);
      } catch (error) {
        console.error('Error processing revenues file:', error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

export const processForecastedEntriesFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;

        if (!data) {
          reject(new Error('Não foi possível ler o arquivo'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          reject(new Error('O arquivo Excel não contém planilhas'));
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('Processing forecasted entries file...');
        console.log('Total rows:', jsonData.length);
        console.log('First 3 rows:', jsonData.slice(0, 3));
        console.log('Last 3 rows:', jsonData.slice(-3));

        if (jsonData.length < 2) {
          reject(new Error('O arquivo deve conter pelo menos uma linha de dados além do cabeçalho'));
          return;
        }

        const entries: any[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row: any = jsonData[i];

          if (!row || row.length === 0) {
            console.log(`Row ${i} skipped: empty row`);
            continue;
          }

          // Check if all important columns are empty
          const hasData = row[1] || row[2] || row[3] || row[4] || row[5];
          if (!hasData) {
            console.log(`Row ${i} skipped: no data in any column`);
            continue;
          }

          if (!row[1] || String(row[1]).trim() === '') {
            console.log(`Row ${i} skipped: missing business unit (column B):`, row);
            continue;
          }

          let paymentDate = '';
          if (row[4]) {
            if (typeof row[4] === 'number') {
              const date = XLSX.SSF.parse_date_code(row[4]);
              paymentDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
            } else if (typeof row[4] === 'string') {
              const parts = row[4].split('/');
              if (parts.length === 3) {
                paymentDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          if (!paymentDate) {
            console.warn(`Skipping row ${i} - no valid date in column E:`, row);
            continue;
          }

          const amount = parseFloat(row[5]);
          if (isNaN(amount)) {
            console.warn(`Skipping row ${i} - invalid amount in column F:`, row);
            continue;
          }

          const statusValue = String(row[0] || 'pendente').toLowerCase().trim();
          const normalizedStatus = statusValue === 'paga' ? 'paga' : 'pendente';

          // Use default values for optional fields
          const businessUnit = String(row[1] || '').trim();
          const chartOfAccounts = String(row[2] || '').trim();
          const supplier = String(row[3] || 'N/A').trim();

          const entry: any = {
            status: normalizedStatus,
            business_unit: businessUnit,
            chart_of_accounts: chartOfAccounts,
            supplier: supplier,
            due_date: paymentDate,
            amount: amount
          };

          console.log(`Row ${i + 1} processed:`, entry);
          entries.push(entry);
        }

        console.log(`Total entries processed: ${entries.length}`);

        if (entries.length === 0) {
          reject(new Error('Nenhum lançamento válido foi encontrado no arquivo. Verifique se as colunas estão corretas: A=Status, B=Unidade, C=Plano de Contas, D=Credor, E=Data Vencimento, F=Valor'));
          return;
        }

        resolve(entries);
      } catch (error) {
        console.error('Error processing forecasted entries file:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        reject(new Error(`Erro ao processar arquivo: ${errorMessage}`));
      }
    };

    reader.onerror = () => reject(new Error('Falha ao ler o arquivo. Verifique se é um arquivo Excel válido.'));
    reader.readAsBinaryString(file);
  });
};

export const processFinancialTransactionsFile = (file: File): Promise<FinancialTransaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const transactions: FinancialTransaction[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];

          if (!row[0] && !row[1] && !row[2]) continue;

          const transactionDateStr = row[3];
          let transactionDate = '';

          if (transactionDateStr) {
            if (typeof transactionDateStr === 'number') {
              const date = new Date((transactionDateStr - 25569) * 86400 * 1000);
              transactionDate = date.toISOString().split('T')[0];
            } else if (typeof transactionDateStr === 'string') {
              const parts = transactionDateStr.split('/');
              if (parts.length === 3) {
                transactionDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          // Skip records without valid date
          if (!transactionDate) {
            console.warn('Skipping financial transaction record without valid date:', row);
            continue;
          }

          const statusValue = (row[0] || '').toLowerCase().trim();
          const isRealized = statusValue === 'realizado' || statusValue === 'paga' || statusValue === 'pago';

          const transaction: any = {
            status: isRealized ? 'realizado' : 'previsto',
            business_unit: row[1] || '',
            chart_of_accounts: row[2] || '',
            transaction_date: transactionDate,
            amount: parseFloat(row[4]) || 0
          };

          console.log('Lançamentos - Row:', row, '| BU:', row[1], '| Amount:', row[4]);
          transactions.push(transaction);
        }

        resolve(transactions);
      } catch (error) {
        console.error('Error processing financial transactions file:', error);
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

export const generateMockData = (): FinancialRecord[] => {
  const companies = ['Rede Tem Preço - Matriz', 'Rede Tem Preço - Filial 1', 'X Brother - Loja A', 'X Brother - Loja B'];
  const groups = ['Rede Tem Preço', 'X Brother'];
  const records: FinancialRecord[] = [];
  
  // Generate 90 days of mock data
  for (let i = 0; i < 90; i++) {
    const date = new Date();
    date.setDate(date.getDate() - 45 + i); // 45 days ago to 45 days in future
    
    companies.forEach((company, companyIndex) => {
      const group = groups[Math.floor(companyIndex / 2)];
      const baseRevenue = 15000 + Math.random() * 10000;
      const baseCogs = baseRevenue * (0.35 + Math.random() * 0.1);
      const baseOutflows = 8000 + Math.random() * 5000;
      const openingBalance = 25000 + Math.random() * 15000;
      
      records.push({
        id: `${company}-${date.toISOString().split('T')[0]}`,
        company,
        group,
        date: date.toISOString().split('T')[0],
        openingBalance,
        forecastedRevenue: baseRevenue,
        actualRevenue: i < 45 ? baseRevenue * (0.9 + Math.random() * 0.2) : 0,
        forecastedOutflows: baseOutflows,
        actualOutflows: i < 45 ? baseOutflows * (0.85 + Math.random() * 0.3) : 0,
        finalBalance: openingBalance + baseRevenue - baseOutflows,
        cogs: baseCogs,
        loans: 5000 + Math.random() * 3000,
        financing: 2000 + Math.random() * 1500
      });
    });
  }
  
  return records;
};

export const processRevenuesDREFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        console.log('🔄 Iniciando processamento de Receita DRE...');
        const data = e.target?.result;

        if (!data) {
          throw new Error('Arquivo vazio ou não pôde ser lido');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        console.log('📊 Planilhas disponíveis:', workbook.SheetNames);

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`📋 Total de linhas no arquivo: ${jsonData.length}`);

        if (jsonData.length < 2) {
          throw new Error('Arquivo não contém dados suficientes (necessário pelo menos 2 linhas: cabeçalho + dados)');
        }

        const revenuesDRE: any[] = [];
        let totalProcessed = 0;
        let totalIgnored = 0;

        for (let i = 1; i < jsonData.length; i++) {
          try {
            const row = jsonData[i] as any[];

            if (!row || row.length === 0) {
              totalIgnored++;
              continue;
            }

            // Formato simplificado: Unidade de Negócio | Data | Valor
            const businessUnit = row[0];
            const issueDate = row[1];
            const amount = row[2];

            if (!businessUnit || !issueDate || amount === undefined || amount === null || amount === '') {
              console.log(`⚠️ Linha ${i + 1} ignorada: dados incompletos`);
              totalIgnored++;
              continue;
            }

            const businessUnitNum = typeof businessUnit === 'number' ? businessUnit : parseInt(String(businessUnit));
            if (isNaN(businessUnitNum)) {
              console.log(`⚠️ Linha ${i + 1} ignorada: Unidade de Negócio deve ser um número, encontrado: "${businessUnit}"`);
              totalIgnored++;
              continue;
            }

            let formattedDate: string;
            if (typeof issueDate === 'number') {
              const jsDate = XLSX.SSF.parse_date_code(issueDate);
              formattedDate = `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`;
            } else if (typeof issueDate === 'string') {
              const dateParts = issueDate.split('/');
              if (dateParts.length === 3) {
                formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
              } else {
                console.log(`⚠️ Linha ${i + 1} ignorada: formato de data inválido`);
                totalIgnored++;
                continue;
              }
            } else {
              console.log(`⚠️ Linha ${i + 1} ignorada: data em formato desconhecido`);
              totalIgnored++;
              continue;
            }

            const parsedAmount = parseFloat(String(amount).replace(',', '.'));
            if (isNaN(parsedAmount)) {
              console.log(`⚠️ Linha ${i + 1} ignorada: valor inválido`);
              totalIgnored++;
              continue;
            }

            revenuesDRE.push({
              business_unit: String(businessUnitNum),
              issue_date: formattedDate,
              amount: parsedAmount
              // status e chart_of_accounts serão preenchidos com valores padrão pela tabela
            });
            totalProcessed++;
          } catch (rowError) {
            console.error(`❌ Erro ao processar linha ${i + 1}:`, rowError);
            totalIgnored++;
            continue;
          }
        }

        console.log(`\n📊 RESUMO DO PROCESSAMENTO:`);
        console.log(`✅ Registros processados: ${totalProcessed}`);
        console.log(`⚠️ Linhas ignoradas: ${totalIgnored}`);

        if (revenuesDRE.length === 0) {
          throw new Error('Nenhum registro válido foi encontrado no arquivo. Verifique se o formato está correto.');
        }

        console.log(`✅ Receita DRE - Processados ${revenuesDRE.length} registros com sucesso`);
        resolve(revenuesDRE);
      } catch (error) {
        console.error('❌ Erro ao processar Receita DRE:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo';
        reject(new Error(errorMessage));
      }
    };

    reader.onerror = (error) => {
      console.error('❌ Erro ao ler arquivo:', error);
      reject(new Error('Falha ao ler o arquivo. Verifique se o arquivo está corrompido.'));
    };

    reader.readAsBinaryString(file);
  });
};

export const processCMVDREFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        console.log('🔄 Iniciando processamento de CMV DRE...');
        const data = e.target?.result;

        if (!data) {
          throw new Error('Arquivo vazio ou não pôde ser lido');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        console.log('📊 Planilhas disponíveis:', workbook.SheetNames);

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`📋 Total de linhas no arquivo: ${jsonData.length}`);
        console.log('📋 Cabeçalho (linha 1):', jsonData[0]);
        console.log('📋 Primeira linha de dados (linha 2):', jsonData[1]);

        if (jsonData.length < 2) {
          throw new Error('Arquivo não contém dados suficientes (necessário pelo menos 2 linhas: cabeçalho + dados)');
        }

        const cmvDRE: any[] = [];
        let totalProcessed = 0;
        let totalIgnored = 0;

        for (let i = 1; i < jsonData.length; i++) {
          try {
            const row = jsonData[i] as any[];

            if (!row || row.length === 0) continue;

            const status = row[0];
            const businessUnit = row[1];
            const chartOfAccounts = row[2];
            const issueDate = row[3];
            const amount = row[4];

            console.log(`📋 Linha ${i + 1} - Raw data:`, { status, businessUnit, chartOfAccounts, issueDate, amount });

            if (!status || !businessUnit || !chartOfAccounts || !issueDate) {
              console.log(`⚠️ Linha ${i + 1} ignorada: dados incompletos`);
              totalIgnored++;
              continue;
            }

            const statusStr = String(status).toLowerCase().trim();
            console.log(`🔍 Linha ${i + 1} - Status comparação: "${statusStr}" === "pago"?`, statusStr === 'pago');
            if (statusStr !== 'pago') {
              console.log(`⚠️ Linha ${i + 1} ignorada: Status deve ser "Pago", encontrado: "${status}"`);
              totalIgnored++;
              continue;
            }

            const chartStr = String(chartOfAccounts).trim().toUpperCase();
            console.log(`🔍 Linha ${i + 1} - Plano de Contas comparação: "${chartStr}" === "CMV"?`, chartStr === 'CMV');
            if (chartStr !== 'CMV') {
              console.log(`⚠️ Linha ${i + 1} ignorada: Plano de Contas deve ser "CMV", encontrado: "${chartOfAccounts}"`);
              totalIgnored++;
              continue;
            }

            const businessUnitNum = typeof businessUnit === 'number' ? businessUnit : parseInt(String(businessUnit));
            if (isNaN(businessUnitNum)) {
              console.log(`⚠️ Linha ${i + 1} ignorada: Unidade de Negócio deve ser um número, encontrado: "${businessUnit}"`);
              totalIgnored++;
              continue;
            }

            if (amount === undefined || amount === null || amount === '') {
              console.log(`⚠️ Linha ${i + 1} ignorada: valor ausente`);
              totalIgnored++;
              continue;
            }

            let formattedDate: string;
            if (typeof issueDate === 'number') {
              const jsDate = XLSX.SSF.parse_date_code(issueDate);
              formattedDate = `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`;
            } else if (typeof issueDate === 'string') {
              const dateParts = issueDate.split('/');
              if (dateParts.length === 3) {
                formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
              } else {
                console.log(`⚠️ Linha ${i + 1} ignorada: formato de data inválido`);
                totalIgnored++;
                continue;
              }
            } else {
              console.log(`⚠️ Linha ${i + 1} ignorada: data em formato desconhecido`, typeof issueDate, issueDate);
              totalIgnored++;
              continue;
            }

            const parsedAmount = parseFloat(String(amount).replace(',', '.'));
            if (isNaN(parsedAmount)) {
              console.log(`⚠️ Linha ${i + 1} ignorada: valor inválido`);
              totalIgnored++;
              continue;
            }

            console.log(`✅ Linha ${i + 1} - Registro válido processado`);
            cmvDRE.push({
              status: 'pago',
              business_unit: String(businessUnitNum),
              chart_of_accounts: 'CMV',
              issue_date: formattedDate,
              amount: parsedAmount
            });
            totalProcessed++;
          } catch (rowError) {
            console.error(`❌ Erro ao processar linha ${i + 1}:`, rowError);
            totalIgnored++;
            continue;
          }
        }

        console.log(`\n📊 RESUMO DO PROCESSAMENTO:`);
        console.log(`✅ Registros processados: ${totalProcessed}`);
        console.log(`⚠️ Linhas ignoradas: ${totalIgnored}`);
        console.log(`📋 Total de linhas (exceto cabeçalho): ${jsonData.length - 1}`);

        if (cmvDRE.length === 0) {
          console.error('❌ ERRO: Nenhum registro válido foi encontrado!');
          console.error('Verifique os logs acima para entender por que as linhas foram ignoradas.');
          throw new Error('Nenhum registro válido foi encontrado no arquivo. Verifique se o formato está correto.');
        }

        console.log(`✅ CMV DRE - Processados ${cmvDRE.length} registros com sucesso`);
        resolve(cmvDRE);
      } catch (error) {
        console.error('❌ Erro ao processar CMV DRE:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo';
        reject(new Error(errorMessage));
      }
    };

    reader.onerror = (error) => {
      console.error('❌ Erro ao ler arquivo:', error);
      reject(new Error('Falha ao ler o arquivo. Verifique se o arquivo está corrompido.'));
    };

    reader.readAsBinaryString(file);
  });
};

export const processInitialBalancesFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('📊 Iniciando processamento de Saldos Bancários...');
        console.log(`Total de linhas no arquivo: ${jsonData.length}`);

        const initialBalances: any[] = [];
        let totalProcessed = 0;
        let totalIgnored = 0;

        for (let i = 1; i < jsonData.length; i++) {
          const row: any = jsonData[i];

          if (!row || row.length === 0 || !row[0]) {
            totalIgnored++;
            continue;
          }

          try {
            const businessUnitRaw = row[0];
            const bankName = String(row[1] || 'Banco').trim();
            const balanceRaw = row[2];
            const dateRaw = row[3];

            const businessUnitNum = parseInt(String(businessUnitRaw).replace(/\D/g, ''));
            if (isNaN(businessUnitNum)) {
              console.warn(`⚠️ Linha ${i + 1}: Unidade de Negócio inválida - ignorando`);
              totalIgnored++;
              continue;
            }

            const parsedAmount = parseFloat(String(balanceRaw).replace(/[^0-9.-]/g, ''));
            if (isNaN(parsedAmount)) {
              console.warn(`⚠️ Linha ${i + 1}: Saldo inválido - ignorando`);
              totalIgnored++;
              continue;
            }

            let formattedDate = '';
            if (typeof dateRaw === 'number') {
              const excelDate = XLSX.SSF.parse_date_code(dateRaw);
              const year = excelDate.y;
              const month = String(excelDate.m).padStart(2, '0');
              const day = String(excelDate.d).padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;
            } else if (typeof dateRaw === 'string') {
              const parts = dateRaw.split('/');
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                formattedDate = `${year}-${month}-${day}`;
              }
            }

            if (!formattedDate) {
              console.warn(`⚠️ Linha ${i + 1}: Data inválida - usando data atual`);
              formattedDate = new Date().toISOString().split('T')[0];
            }

            initialBalances.push({
              business_unit: String(businessUnitNum),
              bank_name: bankName,
              balance: parsedAmount,
              balance_date: formattedDate
            });
            totalProcessed++;
          } catch (rowError) {
            console.error(`❌ Erro ao processar linha ${i + 1}:`, rowError);
            totalIgnored++;
            continue;
          }
        }

        console.log(`\n📊 RESUMO DO PROCESSAMENTO:`);
        console.log(`✅ Registros processados: ${totalProcessed}`);
        console.log(`⚠️ Linhas ignoradas: ${totalIgnored}`);

        if (initialBalances.length === 0) {
          throw new Error('Nenhum registro válido foi encontrado no arquivo.');
        }

        console.log(`✅ Saldos Bancários - Processados ${initialBalances.length} registros com sucesso`);
        resolve(initialBalances);
      } catch (error) {
        console.error('❌ Erro ao processar Saldos Bancários:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo';
        reject(new Error(errorMessage));
      }
    };

    reader.onerror = (error) => {
      console.error('❌ Erro ao ler arquivo:', error);
      reject(new Error('Falha ao ler o arquivo. Verifique se o arquivo está corrompido.'));
    };

    reader.readAsBinaryString(file);
  });
};

export const processOrcamentoDREFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        console.log('🔄 Iniciando processamento de Orçamento DRE...');
        const data = e.target?.result;

        if (!data) {
          throw new Error('Arquivo vazio ou não pôde ser lido');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        console.log('📊 Planilhas disponíveis:', workbook.SheetNames);

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`📋 Total de linhas no arquivo: ${jsonData.length}`);

        if (jsonData.length < 2) {
          throw new Error('Arquivo não contém dados suficientes (necessário pelo menos 2 linhas: cabeçalho + dados)');
        }

        const orcamentoDRE: any[] = [];
        let totalProcessed = 0;
        let totalIgnored = 0;

        for (let i = 1; i < jsonData.length; i++) {
          try {
            const row = jsonData[i] as any[];

            if (!row || row.length === 0) {
              totalIgnored++;
              continue;
            }

            const businessUnit = row[0];
            const accountName = row[1];
            const periodDate = row[2];
            const budgetAmount = row[3];

            if (!businessUnit || !accountName || !periodDate || budgetAmount === undefined || budgetAmount === null || budgetAmount === '') {
              console.log(`⚠️ Linha ${i + 1} ignorada: dados incompletos`);
              totalIgnored++;
              continue;
            }

            const businessUnitStr = String(businessUnit).trim();
            const accountNameStr = String(accountName).trim();

            let formattedDate: string;
            if (typeof periodDate === 'number') {
              const jsDate = XLSX.SSF.parse_date_code(periodDate);
              formattedDate = `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`;
            } else if (typeof periodDate === 'string') {
              // Tentar formato DD/MM/YYYY ou YYYY-MM-DD
              const dateParts = periodDate.split('/');
              if (dateParts.length === 3) {
                formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
              } else if (periodDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                formattedDate = periodDate;
              } else {
                console.log(`⚠️ Linha ${i + 1} ignorada: formato de data inválido`);
                totalIgnored++;
                continue;
              }
            } else {
              console.log(`⚠️ Linha ${i + 1} ignorada: data em formato desconhecido`);
              totalIgnored++;
              continue;
            }

            const parsedAmount = parseFloat(String(budgetAmount).replace(',', '.'));
            if (isNaN(parsedAmount)) {
              console.log(`⚠️ Linha ${i + 1} ignorada: valor inválido`);
              totalIgnored++;
              continue;
            }

            orcamentoDRE.push({
              business_unit: businessUnitStr,
              account_name: accountNameStr,
              period_date: formattedDate,
              budget_amount: parsedAmount
            });
            totalProcessed++;
          } catch (rowError) {
            console.error(`❌ Erro ao processar linha ${i + 1}:`, rowError);
            totalIgnored++;
            continue;
          }
        }

        console.log(`\n📊 RESUMO DO PROCESSAMENTO:`);
        console.log(`✅ Registros processados: ${totalProcessed}`);
        console.log(`⚠️ Linhas ignoradas: ${totalIgnored}`);

        if (orcamentoDRE.length === 0) {
          throw new Error('Nenhum registro válido foi encontrado no arquivo. Verifique se o formato está correto.');
        }

        console.log(`✅ Orçamento DRE - Processados ${orcamentoDRE.length} registros com sucesso`);
        resolve(orcamentoDRE);
      } catch (error) {
        console.error('❌ Erro ao processar Orçamento DRE:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo';
        reject(new Error(errorMessage));
      }
    };

    reader.onerror = (error) => {
      console.error('❌ Erro ao ler arquivo:', error);
      reject(new Error('Falha ao ler o arquivo. Verifique se o arquivo está corrompido.'));
    };

    reader.readAsBinaryString(file);
  });
};