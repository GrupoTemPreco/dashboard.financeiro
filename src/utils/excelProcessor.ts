import * as XLSX from 'xlsx';
import { FinancialRecord, Company, AccountsPayable, Revenue, FinancialTransaction, ReceitaCrediario, VendasPorUsuario } from '../types/financial';

export type FileType = 'companies' | 'accounts_payable' | 'revenues' | 'financial_transactions' | 'forecasted_entries' | 'revenues_dre' | 'cmv_dre' | 'initial_balances' | 'orcamento_dre' | 'receita_crediario' | 'vendas_por_usuario';

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export interface ProcessResult<T> {
  data: T[];
  validationErrors: {
    missingColumns: string[];
    invalidRows: Array<{
      lineNumber: number;
      rowContent: any[];
      errors: string[];
    }>;
    invalidBusinessUnits: string[];
  };
  skippedRows: Array<{
    lineNumber: number;
    rowContent: any[];
    reason: string;
    category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado';
  }>;
  stats: {
    totalRows: number;
    processed: number;
    skippedEmpty: number;
    skippedHeaderFooter: number;
    invalid: number;
  };
}

// Função auxiliar para processar valores numéricos no formato brasileiro
// Formato brasileiro: vírgula (,) = decimais, ponto (.) = milhares
// Exemplo: "1.170,50" = 1170.50
export const parseBrazilianNumber = (value: any): number => {
  // Se já for número, retorna direto (Excel já converteu)
  if (typeof value === 'number') {
    return value;
  }

  // Converter para string
  const str = String(value || '').trim();
  
  if (!str || str === '') {
    return 0;
  }

  // Verificar se tem vírgula (formato brasileiro)
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    // Formato brasileiro: "1.170,50"
    // Remove pontos (separadores de milhar) e substitui vírgula por ponto
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  } else if (hasComma && !hasDot) {
    // Formato brasileiro sem milhares: "170,50"
    // Substitui vírgula por ponto
    return parseFloat(str.replace(',', '.'));
  } else if (!hasComma && hasDot) {
    // Pode ser formato americano "1170.50" ou brasileiro com milhares "1.170"
    // Se tem apenas um ponto, pode ser decimal americano
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount === 1) {
      // Provavelmente formato americano: "1170.50"
      return parseFloat(str);
    } else {
      // Provavelmente formato brasileiro sem decimais: "1.170"
      // Remove pontos (separadores de milhar)
      return parseFloat(str.replace(/\./g, ''));
    }
  } else {
    // Sem vírgula nem ponto: "1170"
    return parseFloat(str);
  }
};

// Função auxiliar para normalizar status
export const normalizeStatus = (status: string): 'previsto' | 'realizado' => {
  const statusLower = String(status || '').toLowerCase().trim();
  
  // Termos que indicam "realizado" (pago, efetivado, etc)
  const realizedTerms = [
    'realizado', 'realizada', 'realizados', 'realizadas',
    'pago', 'paga', 'pagos', 'pagas',
    'recebido', 'recebida', 'recebidos', 'recebidas',
    'quitado', 'quitada', 'quitados', 'quitadas',
    'efetivado', 'efetivada', 'efetivados', 'efetivadas',
    'efetuado', 'efetuada', 'efetuados', 'efetuadas',
    'liquidado', 'liquidada', 'liquidados', 'liquidadas',
    'concluído', 'concluída', 'concluídos', 'concluídas',
    'finalizado', 'finalizada', 'finalizados', 'finalizadas'
  ];
  
  // Termos que indicam "previsto" (pendente, aguardando, etc)
  const forecastedTerms = [
    'previsto', 'prevista', 'previstos', 'previstas',
    'pendente', 'pendentes',
    'aguardando', 'aguardar',
    'não pago', 'nao pago', 'não pagos', 'nao pagos',
    'não realizado', 'nao realizado', 'não realizados', 'nao realizados',
    'não recebido', 'nao recebido', 'não recebidos', 'nao recebidos',
    'em aberto', 'aberto', 'abertos',
    'em andamento', 'andamento',
    'programado', 'programada', 'programados', 'programadas',
    'agendado', 'agendada', 'agendados', 'agendadas'
  ];
  
  // Verificar se é realizado
  if (realizedTerms.some(term => statusLower === term || statusLower.includes(term))) {
    return 'realizado';
  }
  
  // Verificar se é previsto
  if (forecastedTerms.some(term => statusLower === term || statusLower.includes(term))) {
    return 'previsto';
  }
  
  // Padrão: se não identificar, assume previsto (mais seguro)
  return 'previsto';
};

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
            // Accounts Payable: Status, Unidade, Plano de Contas, Valor, Credor, Data de Vencimento, Data Pagamento
            // Ignorar linhas de cabeçalho/rodapé com informações de usuário, impressão, etc.
            const isHeaderFooterRow = (row: any[]): boolean => {
              if (!row || row.length === 0) return false;
              const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
              return rowText.includes('usuário') || 
                     rowText.includes('impressão') || 
                     rowText.includes('unidade de negócio:') || 
                     rowText.includes('página') ||
                     rowText.includes('a7 pharma') || 
                     rowText.includes('alpha7') ||
                     rowText.includes('desenvolvimento de software');
            };
            
            let foundHeader = false;
            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i] as any[];
              if (!row || row.length === 0) continue;
              
              // Ignorar linhas de cabeçalho/rodapé
              if (isHeaderFooterRow(row)) {
                continue;
              }
              
              // Verificar se tem as colunas esperadas pelo nome
              const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
              const hasStatus = rowHeaders.some(h => h.includes('status'));
              const hasUnidade = rowHeaders.some(h => h.includes('unidade') && !h.includes('negócio:'));
              const hasValor = rowHeaders.some(h => h.includes('valor'));
              const hasDataPagamento = rowHeaders.some(h => h.includes('data pagamento') || h.includes('data de pagamento') || h.includes('pagamento'));
              
              // Verificar se tem coluna de Banco (típica de Saldos Bancários)
              const hasBank = rowHeaders.some(h => h.includes('banco') || h.includes('bank'));
              if (hasBank && rowHeaders.length <= 4) {
                validationResult = {
                  isValid: false,
                  errorMessage: 'Este arquivo parece ser de Saldos Bancários, não de Contas a Pagar. O arquivo de Contas a Pagar deve ter: Status, Unidade, Plano de Contas, Valor, Credor, Data de Vencimento e Data Pagamento.'
                };
                break;
              }
              
              // Precisa ter pelo menos as colunas obrigatórias
              if (hasStatus && hasUnidade && hasValor && hasDataPagamento) {
                foundHeader = true;
                break;
              }
            }
            
            if (!foundHeader && !validationResult.errorMessage) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Contas a Pagar deve ter as colunas: Status, Unidade, Plano de Contas, Valor, Credor, Data de Vencimento e Data Pagamento. Verifique se o arquivo não está vazio ou se as colunas estão com os nomes corretos.'
              };
            }
            break;

          case 'revenues':
            // Receitas: pode ter formato antigo (5 colunas) ou novo (10 colunas)
            // Procurar ativamente pelas colunas no cabeçalho
            // Função para identificar linhas de rodapé (não cabeçalho)
            // Rodapé geralmente tem texto descritivo, não nomes de colunas
            const isFooterRowRevenues = (row: any[]): boolean => {
              if (!row || row.length === 0) return false;
              const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
              
              // Rodapé tem características específicas que não são nomes de colunas
              // Ex: "Usuário: João", "Página 1", "Unidade de Negócio: X", etc.
              const isFooterPattern = 
                (rowText.includes('usuário:') || rowText.includes('usuario:')) ||
                (rowText.includes('impressão') && !rowText.includes('data')) ||
                (rowText.includes('impressao') && !rowText.includes('data')) ||
                (rowText.includes('print') && !rowText.includes('data')) ||
                (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
                (rowText.includes('página') || rowText.includes('pagina'));
              
              return isFooterPattern;
            };
            
            // Função para verificar se uma linha parece ser um cabeçalho (tem nomes de colunas)
            const looksLikeHeader = (row: any[]): boolean => {
              if (!row || row.length === 0) return false;
              const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
              
              // Um cabeçalho deve ter pelo menos algumas palavras-chave de colunas
              const hasColumnKeywords = rowHeaders.some(h => 
                h.includes('status') ||
                h.includes('unidade') ||
                h.includes('conta') ||
                h.includes('data') ||
                h.includes('valor') ||
                h.includes('amount')
              );
              
              // Não deve ser um rodapé
              return hasColumnKeywords && !isFooterRowRevenues(row);
            };
            
            let foundHeaderRevenues = false;
            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i] as any[];
              if (!row || row.length === 0) continue;
              
              // Primeiro verificar se parece ser um cabeçalho
              // Se não parecer, pode ser rodapé ou dados - verificar depois
              if (!looksLikeHeader(row) && isFooterRowRevenues(row)) {
                // É claramente um rodapé, ignorar
                continue;
              }
              
              // Verificar se tem as colunas esperadas pelo nome
              const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
              
              // Debug: logar as primeiras 5 linhas para entender o formato
              if (i < 5) {
                console.log(`🔍 Validação Receitas - Linha ${i + 1} (raw):`, row);
                console.log(`🔍 Validação Receitas - Linha ${i + 1} (normalized):`, rowHeaders);
              }
              
              // Detecção mais flexível de colunas
              const hasStatus = rowHeaders.some(h => h.includes('status'));
              
              // Unidade: aceita várias variações incluindo espaços e acentuação
              const hasUnidade = rowHeaders.some(h => {
                const normalized = h.replace(/\s+/g, ' ').replace(/\./g, '.');
                return (normalized.includes('unidade') || 
                       normalized.includes('un.negócio') || 
                       normalized.includes('un. negócio') || 
                       normalized.includes('un.negocio') || 
                       normalized.includes('un. negocio') ||
                       normalized.includes('unidade de negócio') ||
                       normalized.includes('unidade de negocio')) && 
                       !normalized.includes('negócio:') &&
                       !normalized.includes('negocio:');
              });
              
              // Plano de Contas / Conta Origem: várias variações
              const hasPlanoContas = rowHeaders.some(h => {
                const normalized = h.replace(/\s+/g, ' ').replace(/_/g, ' ');
                return normalized.includes('plano de contas') || 
                       normalized.includes('plano') || 
                       normalized.includes('conta origem') || 
                       normalized.includes('conta_origem') ||
                       (normalized.includes('conta') && normalized.includes('origem'));
              });
              
              // Valor: aceita valor ou amount
              const hasValor = rowHeaders.some(h => h.includes('valor') || h.includes('amount'));
              
              // Data Pagamento / Data Hora: várias variações
              const hasDataPagamento = rowHeaders.some(h => {
                const normalized = h.replace(/\s+/g, ' ').replace(/_/g, ' ');
                return normalized.includes('data pagamento') || 
                       normalized.includes('data de pagamento') || 
                       normalized.includes('pagamento') || 
                       normalized.includes('data hora') || 
                       normalized.includes('datahora') ||
                       (normalized.includes('data') && normalized.includes('hora'));
              });
              
              // Debug: logar o que foi encontrado
              if (i < 5) {
                console.log(`🔍 Validação Receitas - Linha ${i + 1} - Detecção:`, {
                  hasStatus,
                  hasUnidade,
                  hasPlanoContas,
                  hasValor,
                  hasDataPagamento,
                  todasEncontradas: hasStatus && hasUnidade && hasPlanoContas && hasValor && hasDataPagamento
                });
              }
              
              // Verificar se tem coluna de Credor (típica de Contas a Pagar)
              const hasCredor = rowHeaders.some(h => h.includes('credor') || h.includes('fornecedor'));
              if (hasCredor && rowHeaders.length >= 6) {
              validationResult = {
                isValid: false,
                  errorMessage: 'Este arquivo parece ser de Contas a Pagar (tem coluna Credor), não de Receitas. O arquivo de Receitas não deve ter coluna de Credor.'
                };
                break;
              }
              
              // Precisa ter pelo menos as colunas obrigatórias
              if (hasStatus && hasUnidade && hasPlanoContas && hasValor && hasDataPagamento) {
                foundHeaderRevenues = true;
                console.log(`✅ Cabeçalho de Receitas encontrado na linha ${i + 1}`);
                break;
              }
            }
            
            console.log(`🔍 Status da validação: foundHeaderRevenues=${foundHeaderRevenues}, errorMessage=${validationResult.errorMessage}`);
            
            if (!foundHeaderRevenues && !validationResult.errorMessage) {
              // ANTES DE REJEITAR: Tentar validar como receita_crediario
              console.log('🔍 Cabeçalho de Receitas não encontrado. Tentando validar como Receita Crediário...');
              
              // Funções auxiliares para validar receita_crediario
              const isFooterRowCrediario = (row: any[]): boolean => {
                if (!row || row.length === 0) return false;
                const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
                return rowText.includes('total') ||
                       rowText.includes('soma') ||
                       rowText.includes('média') ||
                       rowText.includes('media') ||
                       rowText.includes('usuário:') ||
                       rowText.includes('usuario:') ||
                       (rowText.includes('impressão') && !rowText.includes('data')) ||
                       (rowText.includes('impressao') && !rowText.includes('data')) ||
                       (rowText.includes('print') && !rowText.includes('data')) ||
                       (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
                       (rowText.includes('página') || rowText.includes('pagina'));
              };
              
              const looksLikeHeaderCrediario = (row: any[]): boolean => {
                if (!row || row.length === 0) return false;
                const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
                
                // Ignorar linhas que são apenas títulos (ex: "Análise de Recebimento de Crediário")
                const rowText = rowHeaders.join(' ');
                if (rowText.includes('análise de recebimento') || 
                    rowText.includes('analise de recebimento') ||
                    (rowText.includes('recebimento') && rowText.includes('crediário')) ||
                    (rowText.includes('recebimento') && rowText.includes('crediario'))) {
                  // Se a linha tem apenas o título e talvez uma data, não é cabeçalho
                  if (rowHeaders.length <= 2) {
                    return false;
                  }
                }
                
                const hasColumnKeywords = rowHeaders.some(h => {
                  const normalized = h.replace(/\./g, '').replace(/\s+/g, ' '); // Remove pontos e normaliza espaços
                  return normalized.includes('data receb') ||
                         normalized.includes('un neg') ||
                         normalized.includes('parcela') || // Aceita singular e plural
                         normalized.includes('recebimento') ||
                         normalized.includes('juros') ||
                         normalized.includes('multa') ||
                         normalized.includes('taxa') ||
                         normalized.includes('dias');
                });
                return hasColumnKeywords && !isFooterRowCrediario(row);
              };
              
              // Tentar encontrar cabeçalho de receita_crediario
              let foundHeaderCrediario = false;
              console.log('🔍 Iniciando validação de Receita Crediário...');
              for (let i = 0; i < Math.min(20, jsonData.length); i++) {
                const row = jsonData[i] as any[];
                if (!row || row.length === 0) continue;
                
                // Debug: logar primeiras linhas
                if (i < 5) {
                  console.log(`🔍 Validação Crediário - Linha ${i + 1} (raw):`, row);
                }
                
                if (!looksLikeHeaderCrediario(row) && isFooterRowCrediario(row)) {
                  if (i < 5) {
                    console.log(`🔍 Validação Crediário - Linha ${i + 1} ignorada (rodapé)`);
                  }
                  continue;
                }
                
                const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
                
                // Normalizar removendo pontos finais e normalizando espaços
                const normalizedHeaders = rowHeaders.map(h => h.replace(/\./g, '').replace(/\s+/g, ' ').trim());
                
                // Debug: logar headers normalizados
                if (i < 5) {
                  console.log(`🔍 Validação Crediário - Linha ${i + 1} (normalized):`, normalizedHeaders);
                }
                
                // Ignorar linhas que são apenas títulos
                const rowText = normalizedHeaders.join(' ');
                if (rowText.includes('análise de recebimento') || 
                    rowText.includes('analise de recebimento') ||
                    (rowText.includes('recebimento') && (rowText.includes('crediário') || rowText.includes('crediario')))) {
                  // Se a linha tem apenas o título e talvez uma data, pular
                  if (normalizedHeaders.length <= 2) {
                    if (i < 5) {
                      console.log(`🔍 Validação Crediário - Linha ${i + 1} ignorada (apenas título)`);
                    }
                    continue;
                  }
                }
                
                // Verificar se tem "Data Receb" na linha atual OU nas linhas anteriores (pode estar como linha separada)
                let hasDataReceb = normalizedHeaders.some(h => h.includes('data receb') || h.includes('data_receb'));
                
                // Se não encontrou na linha atual, verificar nas 2 linhas anteriores (pode estar como "Data Receb.: 04/01/2025")
                if (!hasDataReceb && i >= 1) {
                  for (let prevIdx = Math.max(0, i - 2); prevIdx < i; prevIdx++) {
                    const prevRow = jsonData[prevIdx] as any[];
                    if (prevRow && prevRow.length > 0) {
                      const prevRowText = prevRow.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
                      if (prevRowText.includes('data receb') || prevRowText.includes('data receb.')) {
                        hasDataReceb = true;
                        break;
                      }
                    }
                  }
                }
                
                const hasUnNegReceb = normalizedHeaders.some(h => {
                  const normalized = h.replace(/\./g, '').replace(/\s+/g, ' ');
                  return (normalized.includes('un neg receb') || 
                         normalized.includes('un neg receb') || 
                         normalized.includes('unidade negócio receb') ||
                         normalized.includes('unidade negocio receb')) && 
                         !normalized.includes('negócio:') &&
                         !normalized.includes('negocio:');
                });
                const hasRecebimento = normalizedHeaders.some(h => h.includes('recebimento') || h.includes('recebiment'));
                const hasParcela = normalizedHeaders.some(h => h.includes('parcela')); // Aceita singular e plural
                const hasDiasReceb = normalizedHeaders.some(h => {
                  const normalized = h.replace(/\./g, '').replace(/\s+/g, ' ');
                  return (normalized.includes('dias receb') || normalized.includes('dias_receb')) && !normalized.includes('atraso');
                });
                const hasDiasAtraso = normalizedHeaders.some(h => {
                  const normalized = h.replace(/\./g, '').replace(/\s+/g, ' ');
                  return normalized.includes('dias atraso') || normalized.includes('dias_atraso');
                });
                
                // Debug: logar o que foi encontrado
                if (i < 5) {
                  console.log(`🔍 Validação Crediário - Linha ${i + 1} - Detecção:`, {
                    hasDataReceb,
                    hasUnNegReceb,
                    hasRecebimento,
                    hasParcela,
                    hasDiasReceb,
                    hasDiasAtraso,
                    todasEncontradas: hasDataReceb && hasUnNegReceb && hasRecebimento && hasParcela && hasDiasReceb && hasDiasAtraso
                  });
                }
                
                // Colunas obrigatórias de receita_crediario: un neg receb, parcela, recebimento, dias receb, dias atraso
                // Data Receb pode estar em linha separada (ex: "Data Receb.: 04/01/2025"), então verificamos linhas anteriores também
                if (hasDataReceb && hasUnNegReceb && hasRecebimento && hasParcela && hasDiasReceb && hasDiasAtraso) {
                  foundHeaderCrediario = true;
                  console.log(`✅ Cabeçalho de Receita Crediário encontrado na linha ${i + 1}!`);
                  // Aceitar o arquivo como receita_crediario
                  validationResult = {
                    isValid: true
                  };
                  break;
                }
              }
              
              if (!foundHeaderCrediario) {
                console.log('❌ Cabeçalho de Receita Crediário NÃO encontrado após verificar 20 linhas');
              }
              
              // Se não encontrou receita_crediario também, então rejeitar
              if (!foundHeaderCrediario) {
                // Coletar informações detalhadas sobre o que foi encontrado
                const foundColumns: string[] = [];
                const missingColumns: string[] = [];
                const allHeaders: string[] = [];
                
                // Analisar as primeiras 10 linhas para encontrar o cabeçalho mais provável
                for (let i = 0; i < Math.min(10, jsonData.length); i++) {
                  const row = jsonData[i] as any[];
                  if (!row || row.length === 0) continue;
                  
                  // Ignorar apenas rodapés claros, não cabeçalhos
                  if (isFooterRowRevenues(row) && !looksLikeHeader(row)) continue;
                  
                  const rowHeaders = row.map(cell => String(cell || '').trim());
                  allHeaders.push(...rowHeaders.filter(h => h && h.length > 0));
                  
                  const normalizedHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
                  
                  // Verificar cada coluna obrigatória
                  const hasStatus = normalizedHeaders.some(h => h.includes('status'));
                  const hasUnidade = normalizedHeaders.some(h => {
                    const normalized = h.replace(/\s+/g, ' ').replace(/\./g, '.');
                    return (normalized.includes('unidade') || 
                           normalized.includes('un.negócio') || 
                           normalized.includes('un. negócio') || 
                           normalized.includes('un.negocio') || 
                           normalized.includes('un. negocio')) && 
                           !normalized.includes('negócio:') &&
                           !normalized.includes('negocio:');
                  });
                  const hasPlanoContas = normalizedHeaders.some(h => {
                    const normalized = h.replace(/\s+/g, ' ').replace(/_/g, ' ');
                    return normalized.includes('plano de contas') || 
                           normalized.includes('conta origem') || 
                           normalized.includes('conta_origem') ||
                           (normalized.includes('conta') && normalized.includes('origem'));
                  });
                  const hasValor = normalizedHeaders.some(h => h.includes('valor') || h.includes('amount'));
                  const hasDataPagamento = normalizedHeaders.some(h => {
                    const normalized = h.replace(/\s+/g, ' ').replace(/_/g, ' ');
                    return normalized.includes('data pagamento') || 
                           normalized.includes('data hora') || 
                           normalized.includes('datahora') ||
                           (normalized.includes('data') && normalized.includes('hora'));
                  });
                  
                  // Se encontrou pelo menos uma coluna, registrar o que foi encontrado
                  if (hasStatus || hasUnidade || hasPlanoContas || hasValor || hasDataPagamento) {
                    if (hasStatus) foundColumns.push('Status');
                    else missingColumns.push('Status');
                    
                    if (hasUnidade) foundColumns.push('Unidade de Negócio');
                    else missingColumns.push('Unidade de Negócio');
                    
                    if (hasPlanoContas) foundColumns.push('Conta Origem');
                    else missingColumns.push('Conta Origem');
                    
                    if (hasValor) foundColumns.push('Valor');
                    else missingColumns.push('Valor');
                    
                    if (hasDataPagamento) foundColumns.push('Data Hora');
                    else missingColumns.push('Data Hora');
                    
                    // Log detalhado
                    console.error('❌ Cabeçalho de Receitas não encontrado!');
                    console.error(`📋 Linha ${i + 1} analisada:`, rowHeaders);
                    console.error(`✅ Colunas encontradas:`, foundColumns);
                    console.error(`❌ Colunas faltando:`, missingColumns);
                    console.error(`📄 Todas as colunas na linha:`, rowHeaders);
                    
                    break;
                  }
                }
                
                // Criar mensagem de erro detalhada
                const uniqueMissing = [...new Set(missingColumns)];
                const uniqueFound = [...new Set(foundColumns)];
                
                let errorMessage = 'O arquivo de Receitas não foi aceito porque não foram encontradas todas as colunas obrigatórias.\n\n';
                
                if (uniqueFound.length > 0) {
                  errorMessage += `✅ Colunas encontradas: ${uniqueFound.join(', ')}\n\n`;
                }
                
                if (uniqueMissing.length > 0) {
                  errorMessage += `❌ Colunas obrigatórias faltando: ${uniqueMissing.join(', ')}\n\n`;
                }
                
                errorMessage += 'Colunas obrigatórias esperadas:\n';
                errorMessage += '• Status\n';
                errorMessage += '• Unidade de Negócio (ou "Un. Negócio")\n';
                errorMessage += '• Conta Origem (ou "Plano de Contas")\n';
                errorMessage += '• Data Hora (ou "Data Pagamento")\n';
                errorMessage += '• Valor\n\n';
                
                if (allHeaders.length > 0) {
                  const uniqueHeaders = [...new Set(allHeaders)].slice(0, 15);
                  errorMessage += `Colunas encontradas no arquivo (primeiras 15): ${uniqueHeaders.join(', ')}`;
                }
                
                validationResult = {
                  isValid: false,
                  errorMessage: errorMessage
                };
              }
            }
            break;

          case 'receita_crediario':
            // Receita Crediário: Data Receb, Un. Neg. Receb, Parcela, Recebimento, %Tot, Juros, % Juros, Multa, % Multa, Taxa Conv, % Taxa Conv, Dias Receb, Dias Atraso
            const isFooterRowCrediario = (row: any[]): boolean => {
              if (!row || row.length === 0) return false;
              const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
              return rowText.includes('total') ||
                     rowText.includes('soma') ||
                     rowText.includes('média') ||
                     rowText.includes('media') ||
                     rowText.includes('usuário:') ||
                     rowText.includes('usuario:') ||
                     (rowText.includes('impressão') && !rowText.includes('data')) ||
                     (rowText.includes('impressao') && !rowText.includes('data')) ||
                     (rowText.includes('print') && !rowText.includes('data')) ||
                     (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
                     (rowText.includes('página') || rowText.includes('pagina'));
            };
            
            const looksLikeHeaderCrediario = (row: any[]): boolean => {
              if (!row || row.length === 0) return false;
              const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
              const hasColumnKeywords = rowHeaders.some(h => 
                h.includes('data receb') ||
                h.includes('un neg') ||
                h.includes('parcela') ||
                h.includes('recebimento') ||
                h.includes('juros') ||
                h.includes('multa') ||
                h.includes('taxa') ||
                h.includes('dias')
              );
              return hasColumnKeywords && !isFooterRowCrediario(row);
            };
            
            let foundHeaderCrediario = false;
            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i] as any[];
              if (!row || row.length === 0) continue;
              
              if (!looksLikeHeaderCrediario(row) && isFooterRowCrediario(row)) {
                continue;
              }
              
              const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
              
              const hasDataReceb = rowHeaders.some(h => h.includes('data receb') || h.includes('data_receb'));
              const hasUnNegReceb = rowHeaders.some(h => h.includes('un neg receb') || h.includes('unidade negócio receb'));
              const hasRecebimento = rowHeaders.some(h => h.includes('recebimento') || h.includes('recebiment'));
              
              if (hasDataReceb && hasUnNegReceb && hasRecebimento) {
                foundHeaderCrediario = true;
                console.log(`✅ Cabeçalho de Receita Crediário encontrado na linha ${i + 1}`);
                break;
              }
            }
            
            if (!foundHeaderCrediario) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Receita Crediário deve ter as colunas: Data Receb, Un. Neg. Receb e Recebimento. Verifique se o arquivo não está vazio ou se as colunas estão com os nomes corretos.'
              };
            }
            break;

          case 'financial_transactions':
            // Financial Transactions: Colunas obrigatórias: Un. Neg., Plano de Contas, Data Hora, Valor
            // Colunas opcionais: Status, Num. Doc, Conta Corrente, Origem, Descrição, Data Hora Inclusão, Usuário
            // Procurar ativamente pelo cabeçalho (pode ter linhas de metadados antes)
            const isHeaderFooterRowFinancial = (row: any[]): boolean => {
              if (!row || row.length === 0) return false;
              const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
              // Verificar se é uma linha de metadado (tem ":" após palavras-chave)
              // Ex: "Unidade de Negócio: ESCRITÓRIO", "Usuário: 2424", "Impressão: 15/02/2026"
              const isMetadataLine = 
                (rowText.includes('usuário:') || rowText.includes('usuario:')) ||
                (rowText.includes('impressão:') || rowText.includes('impressao:')) ||
                (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
                (rowText.includes('página') || rowText.includes('pagina'));
              
              // Se tem apenas uma célula não vazia e contém ":", provavelmente é metadado
              const nonEmptyCells = row.filter(cell => String(cell || '').trim() !== '');
              if (nonEmptyCells.length <= 2 && rowText.includes(':')) {
                return true;
              }
              
              return isMetadataLine;
            };
            
            const looksLikeHeaderFinancial = (row: any[]): boolean => {
              if (!row || row.length === 0) return false;
              const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
              const hasColumnKeywords = rowHeaders.some(h => 
                h.includes('unidade') ||
                h.includes('plano') ||
                h.includes('data') ||
                h.includes('valor') ||
                h.includes('amount')
              );
              return hasColumnKeywords && !isHeaderFooterRowFinancial(row);
            };
            
            const expectedColumnNamesFinancial = {
              unidade: ['un. neg', 'unidade', 'unidade de negócio', 'unidade de negocio', 'business unit'],
              planoContas: ['plano de contas', 'plano', 'chart of accounts'],
              dataHora: ['data hora', 'datahora', 'data', 'transaction date', 'transaction_date'],
              valor: ['valor', 'amount']
            };
            
            let foundHeaderFinancial = false;
            console.log('🔍 Iniciando validação de Lançamentos Financeiros...');
            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i] as any[];
              if (!row || row.length === 0) continue;
              
              // Debug: logar as primeiras 10 linhas para entender o formato
              if (i < 10) {
                console.log(`🔍 Validação Lançamentos Financeiros - Linha ${i + 1} (raw):`, row);
                console.log(`🔍 Validação Lançamentos Financeiros - Linha ${i + 1} (normalized):`, row.map(cell => String(cell || '').toLowerCase().trim()));
              }
              
              // Ignorar linhas de metadados/rodapé
              if (!looksLikeHeaderFinancial(row) && isHeaderFooterRowFinancial(row)) {
                if (i < 10) {
                  console.log(`🔍 Validação Lançamentos Financeiros - Linha ${i + 1} ignorada (metadado/rodapé)`);
                }
                continue;
              }
              
              const rowHeadersFinancial = row.map(cell => String(cell || '').toLowerCase().trim());
              
              const foundUnidade = rowHeadersFinancial.some(h => 
                expectedColumnNamesFinancial.unidade.some(name => h.includes(name))
              );
              const foundPlanoContas = rowHeadersFinancial.some(h => 
                expectedColumnNamesFinancial.planoContas.some(name => h.includes(name))
              );
              const foundDataHora = rowHeadersFinancial.some(h => 
                expectedColumnNamesFinancial.dataHora.some(name => h.includes(name))
              );
              const foundValor = rowHeadersFinancial.some(h => 
                expectedColumnNamesFinancial.valor.some(name => h.includes(name))
              );
              
              if (i < 10) {
                console.log(`🔍 Validação Lançamentos Financeiros - Linha ${i + 1} - Detecção:`, {
                  hasUnidade: foundUnidade,
                  hasPlanoContas: foundPlanoContas,
                  hasDataHora: foundDataHora,
                  hasValor: foundValor,
                  looksLikeHeader: looksLikeHeaderFinancial(row),
                  isHeaderFooter: isHeaderFooterRowFinancial(row)
                });
              }
              
              // Plano de Contas é obrigatório no cabeçalho, mas aceita valores vazios
              if (foundUnidade && foundPlanoContas && foundDataHora && foundValor) {
                foundHeaderFinancial = true;
                console.log(`✅ Cabeçalho de Lançamentos Financeiros encontrado na linha ${i + 1}`);
                break;
              }
            }
            
            console.log(`🔍 Status da validação: foundHeaderFinancial=${foundHeaderFinancial}, errorMessage=${validationResult.errorMessage || 'undefined'}`);
            
            if (!foundHeaderFinancial) {
              console.log('❌ Cabeçalho de Lançamentos Financeiros não encontrado. Analisando linhas...');
              
              const missing: string[] = [];
              const foundColumns: string[] = [];
              
              // Analisar as primeiras 10 linhas para encontrar o cabeçalho mais provável
              for (let i = 0; i < Math.min(10, jsonData.length); i++) {
                const row = jsonData[i] as any[];
                if (!row || row.length === 0) continue;
                
                const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
                
                // Verificar cada coluna obrigatória
                const hasUnidade = rowHeaders.some(h => 
                  expectedColumnNamesFinancial.unidade.some(name => h.includes(name))
                );
                const hasPlanoContas = rowHeaders.some(h => 
                  expectedColumnNamesFinancial.planoContas.some(name => h.includes(name))
                );
                const hasDataHora = rowHeaders.some(h => 
                  expectedColumnNamesFinancial.dataHora.some(name => h.includes(name))
                );
                const hasValor = rowHeaders.some(h => 
                  expectedColumnNamesFinancial.valor.some(name => h.includes(name))
                );
                
                // Se encontrou pelo menos uma coluna, registrar o que foi encontrado
                if (hasUnidade || hasPlanoContas || hasDataHora || hasValor) {
                  if (hasUnidade) foundColumns.push('Un. Neg.');
                  else missing.push('Un. Neg.');
                  
                  if (hasPlanoContas) foundColumns.push('Plano de Contas');
                  else missing.push('Plano de Contas');
                  
                  if (hasDataHora) foundColumns.push('Data Hora');
                  else missing.push('Data Hora');
                  
                  if (hasValor) foundColumns.push('Valor');
                  else missing.push('Valor');
                  
                  // Log detalhado
                  console.error('❌ Cabeçalho de Lançamentos Financeiros não encontrado!');
                  console.error(`📋 Linha ${i + 1} analisada:`, rowHeaders);
                  console.error(`✅ Colunas encontradas:`, foundColumns);
                  console.error(`❌ Colunas faltando:`, missing);
                  console.error(`📄 Todas as colunas na linha:`, rowHeaders);
                  
                  break;
                }
              }
              
              // Criar mensagem de erro detalhada
              const uniqueMissing = [...new Set(missing)];
              const uniqueFound = [...new Set(foundColumns)];
              
              let errorMessage = 'O arquivo de Lançamentos Financeiros não foi aceito porque não foram encontradas todas as colunas obrigatórias.\n\n';
              
              if (uniqueFound.length > 0) {
                errorMessage += `✅ Colunas encontradas: ${uniqueFound.join(', ')}\n\n`;
              }
              
              if (uniqueMissing.length > 0) {
                errorMessage += `❌ Colunas obrigatórias faltando: ${uniqueMissing.join(', ')}\n\n`;
              }
              
              errorMessage += 'Colunas obrigatórias esperadas:\n';
              errorMessage += '- Un. Neg. (ou Unidade, Unidade de Negócio)\n';
              errorMessage += '- Plano de Contas (ou Plano) - coluna obrigatória, mas aceita valores vazios (será preenchido como "não identificado")\n';
              errorMessage += '- Data Hora (ou Data, DataHora)\n';
              errorMessage += '- Valor (ou Amount)';
              
              validationResult = {
                isValid: false,
                errorMessage
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

          case 'vendas_por_usuario':
            // Entrega de Resultado: planilha com Usuário, Venda, Custo, Lucro, Qtd. Vendas, Qtd. Itens (cabeçalho pode estar em qualquer linha)
            const hasVendasPorUsuarioColumns = (row: any[]): boolean => {
              if (!row || row.length < 4) return false;
              const rowHeaders = row.map((cell: any) => String(cell || '').toLowerCase().trim());
              const hasUsuario = rowHeaders.some((h: string) => h.includes('usuário') || h.includes('usuario'));
              const hasVenda = rowHeaders.some((h: string) => h.includes('venda') && !h.includes('vendas'));
              const hasCusto = rowHeaders.some((h: string) => h.includes('custo'));
              const hasLucro = rowHeaders.some((h: string) => h.includes('lucro'));
              const hasQtdVendas = rowHeaders.some((h: string) => (h.includes('qtd') || h.includes('qtd.')) && h.includes('vendas'));
              const hasQtdItens = rowHeaders.some((h: string) => (h.includes('qtd') || h.includes('qtd.')) && h.includes('itens'));
              return !!(hasUsuario && hasVenda && hasCusto && hasLucro && hasQtdVendas && hasQtdItens);
            };
            let foundVendasPorUsuarioHeader = false;
            for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
              const row = jsonData[i] as any[];
              if (hasVendasPorUsuarioColumns(row)) {
                foundVendasPorUsuarioHeader = true;
                break;
              }
            }
            if (!foundVendasPorUsuarioHeader) {
              validationResult = {
                isValid: false,
                errorMessage: 'O arquivo de Entrega de Resultado deve conter as colunas: Usuário, Venda, Custo, Lucro, Qtd. Vendas e Qtd. Itens. Nenhuma outra planilha do sistema possui todas essas colunas.'
              };
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

export const processAccountsPayableFile = (
  file: File, 
  validBusinessUnits?: string[]
): Promise<ProcessResult<AccountsPayable>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('Arquivo vazio ou não pôde ser lido');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('O arquivo não contém planilhas válidas.');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const accountsPayable: AccountsPayable[] = [];
        const validationErrors = {
          missingColumns: [] as string[],
          invalidRows: [] as Array<{
            lineNumber: number;
            rowContent: any[];
            errors: string[];
          }>,
          invalidBusinessUnits: [] as string[]
        };
        const skippedRows: Array<{
          lineNumber: number;
          rowContent: any[];
          reason: string;
          category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado';
        }> = [];

        const stats = {
          totalRows: 0,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        };

        console.log('📊 CONTAS A PAGAR - Total de linhas na planilha:', jsonData.length);
        console.log('📊 CONTAS A PAGAR - Primeiras 3 linhas:', jsonData.slice(0, 3));
        console.log('📊 CONTAS A PAGAR - Últimas 3 linhas:', jsonData.slice(-3));

        // Função para verificar se uma linha é cabeçalho/rodapé
        // IMPORTANTE: Esta função só é chamada se a linha NÃO tiver dados válidos
        // Isso evita pegar linhas válidas que contêm palavras como "alpha7" no credor
        const isHeaderFooterRow = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          
          const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
          
          // Palavras-chave que indicam rodapé (informações de impressão, usuário, etc.)
          const footerKeywords = [
            'usuário',
            'impressão',
            'unidade de negócio:',
            'página'
          ];
          
          // Verificar se contém palavras-chave de rodapé
          const hasFooterKeywords = footerKeywords.some(keyword => rowText.includes(keyword));
          
          // Se tem palavras-chave de rodapé, é rodapé
          if (hasFooterKeywords) return true;
          
          // Verificar se contém "a7 pharma", "alpha7" ou "desenvolvimento de software"
          // MAS só considerar rodapé se a linha estiver praticamente vazia (só tem o nome da empresa)
          // Se tiver outros dados (status, unidade, etc.), não é rodapé
          const hasCompanyName = rowText.includes('a7 pharma') || 
                                 rowText.includes('alpha7') ||
                                 rowText.includes('desenvolvimento de software');
          
          if (hasCompanyName) {
            // Contar quantas células não estão vazias
            const nonEmptyCells = row.filter(cell => {
              const cellStr = String(cell || '').trim();
              return cellStr !== '' && cellStr.toLowerCase() !== 'alpha7' && 
                     !cellStr.toLowerCase().includes('desenvolvimento de software') &&
                     !cellStr.toLowerCase().includes('a7 pharma');
            }).length;
            
            // Se tem menos de 2 células não vazias (além do nome da empresa), provavelmente é rodapé
            // Se tem mais células, provavelmente é um registro válido com a empresa como credor
            return nonEmptyCells < 2;
          }
          
          return false;
        };

        // Encontrar a linha de cabeçalho real
        let headerRowIndex = -1;
        const expectedColumnNames = {
          status: ['status'],
          unidade: ['unidade'],
          planoContas: ['plano de contas', 'plano'],
          valor: ['valor'],
          credor: ['credor'],
          dataVencimento: ['data de vencimento', 'vencimento'],
          dataPagamento: ['data pagamento', 'data de pagamento', 'pagamento']
        };
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          if (isHeaderFooterRow(row)) {
            continue;
          }
          
          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          
          const foundStatus = rowHeaders.some(h => expectedColumnNames.status.some(name => h.includes(name)));
          const foundUnidade = rowHeaders.some(h => expectedColumnNames.unidade.some(name => h.includes(name)) && !h.includes('negócio:'));
          const foundPlanoContas = rowHeaders.some(h => expectedColumnNames.planoContas.some(name => h.includes(name)));
          const foundValor = rowHeaders.some(h => expectedColumnNames.valor.some(name => h.includes(name)));
          const foundCredor = rowHeaders.some(h => expectedColumnNames.credor.some(name => h.includes(name)));
          const foundDataPagamento = rowHeaders.some(h => expectedColumnNames.dataPagamento.some(name => h.includes(name)));
          const foundDataVencimento = rowHeaders.some(h => expectedColumnNames.dataVencimento.some(name => h.includes(name)));
          
          // VALIDAÇÃO 1: Verificar se todas as colunas obrigatórias estão presentes
          if (foundStatus && foundUnidade && foundValor && foundDataPagamento && foundCredor && foundPlanoContas && foundDataVencimento) {
            headerRowIndex = i;
            console.log(`✅ Cabeçalho encontrado na linha ${i + 1}:`, rowHeaders);
            break;
          }
        }

        if (headerRowIndex === -1) {
          // Verificar quais colunas estão faltando
          const missingCols: string[] = [];
          // Tentar encontrar pelo menos algumas colunas para dar feedback melhor
          let testRowIndex = -1;
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0 || isHeaderFooterRow(row)) continue;
            const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
            if (rowHeaders.some(h => expectedColumnNames.status.some(n => h.includes(n))) ||
                rowHeaders.some(h => expectedColumnNames.unidade.some(n => h.includes(n)))) {
              testRowIndex = i;
              break;
            }
          }
          
          if (testRowIndex >= 0) {
            const testRow = jsonData[testRowIndex] as any[];
            const rowHeaders = testRow.map(cell => String(cell || '').toLowerCase().trim());
            if (!rowHeaders.some(h => expectedColumnNames.status.some(n => h.includes(n)))) missingCols.push('Status');
            if (!rowHeaders.some(h => expectedColumnNames.unidade.some(n => h.includes(n)) && !h.includes('negócio:'))) missingCols.push('Unidade');
            if (!rowHeaders.some(h => expectedColumnNames.planoContas.some(n => h.includes(n)))) missingCols.push('Plano de Contas');
            if (!rowHeaders.some(h => expectedColumnNames.valor.some(n => h.includes(n)))) missingCols.push('Valor');
            if (!rowHeaders.some(h => expectedColumnNames.credor.some(n => h.includes(n)))) missingCols.push('Credor');
            if (!rowHeaders.some(h => expectedColumnNames.dataVencimento.some(n => h.includes(n)))) missingCols.push('Data de Vencimento');
            if (!rowHeaders.some(h => expectedColumnNames.dataPagamento.some(n => h.includes(n)))) missingCols.push('Data Pagamento');
          }
          
          const errorMsg = missingCols.length > 0
            ? `Colunas obrigatórias não encontradas: ${missingCols.join(', ')}. O arquivo de Contas a Pagar deve ter: Status, Unidade, Plano de Contas, Valor, Credor, Data de Vencimento e Data Pagamento.`
            : 'Não foi possível encontrar a linha de cabeçalho com as colunas esperadas: Status, Unidade, Plano de Contas, Valor, Credor, Data de Vencimento e Data Pagamento.';
          
          throw new Error(errorMsg);
        }

        // Mapear índices das colunas
        const headerRow = jsonData[headerRowIndex] as any[];
        const columnMap: { [key: string]: number } = {};
        
        headerRow.forEach((cell, index) => {
          const cellText = String(cell || '').toLowerCase().trim();
          
          if (expectedColumnNames.status.some(name => cellText.includes(name)) && !columnMap.status) {
            columnMap.status = index;
          }
          if (expectedColumnNames.unidade.some(name => cellText.includes(name)) && 
              !cellText.includes('negócio:') && !columnMap.unidade) {
            columnMap.unidade = index;
          }
          if (expectedColumnNames.planoContas.some(name => cellText.includes(name)) && !columnMap.planoContas) {
            columnMap.planoContas = index;
          }
          if (expectedColumnNames.valor.some(name => cellText.includes(name)) && !columnMap.valor) {
            columnMap.valor = index;
          }
          if (expectedColumnNames.credor.some(name => cellText.includes(name)) && !columnMap.credor) {
            columnMap.credor = index;
          }
          if (expectedColumnNames.dataVencimento.some(name => cellText.includes(name)) && !columnMap.dataVencimento) {
            columnMap.dataVencimento = index;
          }
          if (expectedColumnNames.dataPagamento.some(name => cellText.includes(name)) && !columnMap.dataPagamento) {
            columnMap.dataPagamento = index;
          }
        });

        console.log('📋 Mapeamento de colunas encontrado:', columnMap);

        // VALIDAÇÃO 2: Verificar se todas as colunas obrigatórias foram mapeadas
        const requiredColumns = ['status', 'unidade', 'planoContas', 'valor', 'credor', 'dataVencimento', 'dataPagamento'];
        const missingMappedCols = requiredColumns.filter(col => columnMap[col] === undefined);
        
        if (missingMappedCols.length > 0) {
          const colNames: { [key: string]: string } = {
            status: 'Status',
            unidade: 'Unidade',
            planoContas: 'Plano de Contas',
            valor: 'Valor',
            credor: 'Credor',
            dataVencimento: 'Data de Vencimento',
            dataPagamento: 'Data Pagamento'
          };
          throw new Error(`Colunas obrigatórias não encontradas no cabeçalho: ${missingMappedCols.map(c => colNames[c]).join(', ')}`);
        }

        // Função auxiliar para converter data
        const parseDate = (dateValue: any): string => {
          if (!dateValue) return '';
          
          if (typeof dateValue === 'number') {
            // Excel date serial number
            // Excel usa 1 de janeiro de 1900 como base (serial 1)
            // JavaScript usa 1 de janeiro de 1970 como base (timestamp 0)
            // Diferença: 25569 dias
            const date = new Date((dateValue - 25569) * 86400 * 1000);
            const isoString = date.toISOString().split('T')[0];
            // Verificar se a data é válida
            if (isNaN(date.getTime())) {
              // Não logar warning para valores numéricos inválidos (pode ser índice de coluna)
              return '';
            }
            return isoString;
          } else if (typeof dateValue === 'string') {
            const str = String(dateValue).trim();
            
            // Verificar se é um nome de coluna (não logar warning)
            const columnNameKeywords = [
              'data', 'pagamento', 'vencimento', 'status', 'unidade', 
              'valor', 'credor', 'plano', 'contas'
            ];
            const isColumnName = columnNameKeywords.some(keyword => 
              str.toLowerCase().includes(keyword) && 
              !str.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/) // Não é uma data
            );
            
            // Formato DD/MM/YYYY ou DD-MM-YYYY
            const parts = str.split(/[\/\-]/);
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              // Validar se é uma data válida
              const date = new Date(`${year}-${month}-${day}`);
              if (!isNaN(date.getTime())) {
                return `${year}-${month}-${day}`;
              }
            }
            
            // Tentar parse direto como ISO string (YYYY-MM-DD)
            const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}/);
            if (isoMatch) {
              return isoMatch[0];
            }
            
            // Tentar parse como Date object
            const dateObj = new Date(str);
            if (!isNaN(dateObj.getTime())) {
              return dateObj.toISOString().split('T')[0];
            }
            
            // Só logar warning se não for claramente um nome de coluna
            if (!isColumnName) {
              // Não logar warnings excessivos - apenas retornar string vazia
              // console.warn(`⚠️ Data inválida em formato string: "${str}"`);
            }
          } else if (dateValue instanceof Date) {
            // Se já for um objeto Date
            if (!isNaN(dateValue.getTime())) {
              return dateValue.toISOString().split('T')[0];
            }
          }
          
          return '';
        };

        // Coletar business units únicas da planilha para validação
        const businessUnitsInFile = new Set<string>();

        // Função para verificar se uma linha é cabeçalho (nomes das colunas)
        // Detecta cabeçalhos duplicados em qualquer posição da planilha
        const isHeaderRow = (row: any[], rowIndex: number): boolean => {
          if (rowIndex === headerRowIndex) return true; // Linha de cabeçalho já identificada
          
          if (!row || row.length === 0) return false;
          
          // Verificar se a linha contém os nomes das colunas nas posições corretas
          // Comparar com o cabeçalho real para detectar duplicatas
          const headerRow = jsonData[headerRowIndex] as any[];
          if (!headerRow) return false;
          
          // Verificar se os valores nas colunas mapeadas correspondem aos nomes das colunas
          let matchesCount = 0;
          let totalChecks = 0;
          
          // Verificar cada coluna mapeada
          if (columnMap.status !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.status] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.status] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.unidade !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.unidade] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.unidade] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.planoContas !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.planoContas] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.planoContas] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.valor !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.valor] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.valor] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.credor !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.credor] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.credor] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.dataVencimento !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.dataVencimento] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.dataVencimento] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.dataPagamento !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.dataPagamento] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.dataPagamento] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          // Se pelo menos 4 colunas correspondem exatamente ao cabeçalho, é um cabeçalho duplicado
          if (matchesCount >= 4 && totalChecks >= 4) {
            return true;
          }
          
          // Verificação adicional: se a linha contém palavras-chave de cabeçalho mas não tem dados válidos
          const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
          const headerKeywords = [
            'status', 'unidade', 'plano de contas', 'valor', 'credor', 
            'data de vencimento', 'data pagamento', 'data de pagamento',
            'vencimento', 'pagamento', 'fornecedor'
          ];
          
          const hasMultipleHeaderKeywords = headerKeywords.filter(keyword => 
            rowText.includes(keyword)
          ).length >= 4;
          
          // Verificar se não há dados válidos (datas ou números)
          const hasValidData = row.some(cell => {
            const cellStr = String(cell || '').trim();
            // Verificar se é uma data válida
            if (cellStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) return true;
            // Verificar se é um número válido (não zero)
            if (!isNaN(parseFloat(cellStr.replace(/\./g, '').replace(',', '.')))) {
              const num = parseFloat(cellStr.replace(/\./g, '').replace(',', '.'));
              return num !== 0;
            }
            return false;
          });
          
          // Se tem palavras-chave de cabeçalho mas não tem dados válidos, provavelmente é cabeçalho
          return hasMultipleHeaderKeywords && !hasValidData;
        };

        // Processar linhas
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          stats.totalRows++;

          // Ignorar linhas de cabeçalho (nomes das colunas duplicados)
          if (isHeaderRow(row, i)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Cabeçalho duplicado (linha contém nomes de colunas)',
              category: 'cabeçalho'
            });
            if (stats.skippedHeaderFooter <= 5) {
              console.log(`⚠️ Linha ${i + 1} ignorada: identificada como cabeçalho duplicado`);
            }
            continue;
          }

          // Ignorar linhas de rodapé
          // IMPORTANTE: Verificar se tem dados válidos ANTES de verificar se é rodapé
          // Isso evita ignorar linhas válidas que contêm palavras como "alpha7" no credor
          const hasValidDataInRow = row.some((cell, cellIndex) => {
            // Ignorar colunas que não são de dados (pode ser credor com "alpha7")
            // Verificar apenas nas colunas de dados (valor, datas)
            if (cellIndex === columnMap.valor || 
                cellIndex === columnMap.dataVencimento || 
                cellIndex === columnMap.dataPagamento) {
              const cellStr = String(cell || '').trim();
              // Verificar se é uma data válida
              if (cellStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) return true;
              // Verificar se é um número válido (não zero)
              if (!isNaN(parseFloat(cellStr.replace(/\./g, '').replace(',', '.')))) {
                const num = parseFloat(cellStr.replace(/\./g, '').replace(',', '.'));
                return num !== 0;
              }
            }
            return false;
          });
          
          // Se tem dados válidos, NÃO é rodapé, mesmo que contenha palavras-chave
          if (!hasValidDataInRow && isHeaderFooterRow(row)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Rodapé (linha contém informações de impressão, usuário, etc.)',
              category: 'rodapé'
            });
            if (stats.skippedHeaderFooter <= 5) {
              console.log(`⚠️ Linha ${i + 1} ignorada: identificada como rodapé`);
            }
            continue;
          }

          // Verificar se a linha está vazia
          // Uma linha só é considerada vazia se TODOS os campos importantes estiverem vazios
          const statusValue = row[columnMap.status];
          const unidadeValue = row[columnMap.unidade];
          const planoContasValue = row[columnMap.planoContas];
          const valorValue = row[columnMap.valor];
          const credorValue = row[columnMap.credor];
          const dataVencimentoValue = row[columnMap.dataVencimento];
          const dataPagamentoValue = row[columnMap.dataPagamento];
          
          // Verificar se TODOS os campos estão vazios (linha realmente vazia)
          const allFieldsEmpty = !statusValue && !unidadeValue && !planoContasValue && 
                                 !valorValue && !credorValue && !dataVencimentoValue && !dataPagamentoValue;
          
          if (allFieldsEmpty) {
            stats.skippedEmpty++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Linha completamente vazia (todos os campos estão vazios)',
              category: 'vazia'
            });
            if (stats.skippedEmpty <= 10) {
              console.log(`⚠️ Linha ${i + 1} ignorada: linha completamente vazia`);
            }
            continue;
          }

          // VALIDAÇÃO 3: Validar cada campo obrigatório
          const rowErrors: string[] = [];
          
          // Validar status - OBRIGATÓRIO
          const statusValueStr = String(statusValue || '').trim();
          if (!statusValueStr) {
            rowErrors.push('Status está vazio (obrigatório)');
          }
          
          // Validar se o status pode ser normalizado (não é palavra aleatória)
          let normalizedStatus: 'previsto' | 'realizado' | null = null;
          if (statusValueStr) {
            const statusLower = statusValueStr.toLowerCase();
            const knownTerms = [
              'realizado', 'realizada', 'realizados', 'realizadas',
              'pago', 'paga', 'pagos', 'pagas',
              'recebido', 'recebida', 'recebidos', 'recebidas',
              'quitado', 'quitada', 'quitados', 'quitadas',
              'efetivado', 'efetivada', 'efetivados', 'efetivadas',
              'liquidado', 'liquidada', 'liquidados', 'liquidadas',
              'concluído', 'concluída', 'concluídos', 'concluídas',
              'finalizado', 'finalizada', 'finalizados', 'finalizadas',
              'previsto', 'prevista', 'previstos', 'previstas',
              'pendente', 'pendentes',
              'aguardando', 'aguardar',
              'não pago', 'nao pago', 'não pagos', 'nao pagos',
              'não realizado', 'nao realizado', 'não realizados', 'nao realizados',
              'não recebido', 'nao recebido', 'não recebidos', 'nao recebidos',
              'em aberto', 'aberto', 'abertos',
              'em andamento', 'andamento',
              'programado', 'programada', 'programados', 'programadas',
              'agendado', 'agendada', 'agendados', 'agendadas'
            ];
            
            // Verificar se contém algum termo conhecido
            const hasKnownTerm = knownTerms.some(term => statusLower.includes(term));
            
            // Se não tem nenhum termo conhecido, é inválido
            if (!hasKnownTerm) {
              rowErrors.push(`Status inválido (palavra não reconhecida): "${statusValueStr}". Status deve ser "previsto", "realizado" ou variações desses termos (ex: pago, pendente, aguardando).`);
            } else {
              // Só normaliza se passou na validação
              normalizedStatus = normalizeStatus(statusValueStr);
            }
          }
          
          const statusText = statusValueStr || 'previsto'; // Usar 'previsto' apenas para normalização se estiver vazio
          const businessUnit = String(unidadeValue || '').trim();
          const chartOfAccounts = String(planoContasValue || '').trim();
          
          // Validar valor - OBRIGATÓRIO
          const valorOriginal = row[columnMap.valor];
          
          // Verificar se valor está realmente vazio (null, undefined, string vazia)
          const isValorEmpty = valorOriginal === null || 
                               valorOriginal === undefined || 
                               valorOriginal === '' ||
                               (typeof valorOriginal === 'string' && valorOriginal.trim() === '');
          
          if (isValorEmpty) {
            rowErrors.push('Valor está vazio (obrigatório)');
          }
          
          // Processar valor no formato brasileiro (vírgula = decimais, ponto = milhares)
          const amount = parseBrazilianNumber(valorOriginal);
          
          // Validar se o valor é um número válido (apenas se não estiver vazio)
          if (!isValorEmpty) {
            if (isNaN(amount)) {
              rowErrors.push(`Valor inválido (não é um número): "${valorOriginal}"`);
            } else if (amount < 0) {
              rowErrors.push(`Valor inválido (negativo): "${valorOriginal}"`);
            }
            // Nota: amount === 0 é permitido se o valor original não estiver vazio (pode ser nota cancelada)
          }
          
          const creditor = String(row[columnMap.credor] || '').trim();
          const paymentDate = parseDate(row[columnMap.dataPagamento]);
          const dueDate = parseDate(row[columnMap.dataVencimento]);

          // Usar status normalizado (ou 'previsto' se não foi possível normalizar)
          const finalNormalizedStatus = normalizedStatus || 'previsto';
          const isRealized = finalNormalizedStatus === 'realizado';

          // Validar cada campo
          if (!businessUnit) {
            rowErrors.push('Unidade de Negócio está vazia');
          }
          // Plano de Contas vazio é aceito (será salvo como "(não identificado)")
          // if (!chartOfAccounts) {
          //   rowErrors.push('Plano de Contas está vazio');
          // }
          // Credor pode ser opcional em alguns casos, então não vamos rejeitar se estiver vazio
          // if (!creditor) {
          //   rowErrors.push('Credor está vazio');
          // }
          // Data de Vencimento é sempre obrigatória
          if (!dueDate) {
            rowErrors.push('Data de Vencimento está vazia ou inválida');
          }
          
          // Data Pagamento só é obrigatória quando status é "realizado"
          // Se status for "previsto", payment_date pode ser NULL
          if (isRealized && !paymentDate) {
            rowErrors.push('Data Pagamento está vazia ou inválida (obrigatória para status "realizado")');
          }

          // Se houver erros, adicionar ao relatório
          if (rowErrors.length > 0) {
            validationErrors.invalidRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              errors: rowErrors
            });
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: `Linha inválida: ${rowErrors.join('; ')}`,
              category: 'inválida'
            });
            stats.invalid++;
            // Log detalhado das primeiras 50 linhas inválidas para debug
            if (stats.invalid <= 50) {
              console.log(`❌ Linha ${i + 1} inválida:`, {
                erros: rowErrors,
                dados: {
                  status: statusText,
                  unidade: businessUnit,
                  planoContas: chartOfAccounts,
                  valor: row[columnMap.valor],
                  credor: creditor,
                  dataVencimento: row[columnMap.dataVencimento],
                  dataPagamento: row[columnMap.dataPagamento],
                  amountParsed: amount,
                  dueDateParsed: dueDate,
                  paymentDateParsed: paymentDate
                },
                linhaCompleta: row
              });
            }
            continue;
          }

          // Coletar business unit para validação posterior
          businessUnitsInFile.add(businessUnit);

          // Status já foi normalizado e validado acima (finalNormalizedStatus já existe)

          // Se plano de contas estiver vazio, usar "(não identificado)"
          const finalChartOfAccounts = chartOfAccounts || '(não identificado)';

          const accountPayable: any = {
            status: finalNormalizedStatus,
            business_unit: businessUnit,
            chart_of_accounts: finalChartOfAccounts,
            creditor: creditor || '(não identificado)', // Se credor estiver vazio, usar valor padrão
            due_date: dueDate,
            amount: amount
          };

          // Adicionar payment_date apenas se existir
          // Se status for "previsto" e não tiver payment_date, deixa como NULL (não inclui o campo)
          if (paymentDate) {
            accountPayable.payment_date = paymentDate;
          }
          // Se não tiver payment_date e status for "previsto", não inclui o campo (será NULL no banco)
          // Se não tiver payment_date e status for "realizado", já foi validado acima e vai dar erro

          // Log das primeiras 5 linhas para debug
          if (stats.processed < 5) {
            console.log(`📅 Linha ${i + 1} - due_date: "${dueDate}", payment_date: "${paymentDate || 'NULL'}", status: "${finalNormalizedStatus}"`);
          }

          accountsPayable.push(accountPayable);
          stats.processed++;
        }

        // VALIDAÇÃO 4: Validar business units contra o banco
        if (validBusinessUnits && validBusinessUnits.length > 0) {
          const invalidUnits = Array.from(businessUnitsInFile).filter(
            unit => {
              const normalizedUnit = String(parseInt(unit) || unit);
              return !validBusinessUnits.includes(unit) && 
                     !validBusinessUnits.includes(normalizedUnit) &&
                     !validBusinessUnits.some(vu => String(parseInt(vu) || vu) === normalizedUnit);
            }
          );
          
          if (invalidUnits.length > 0) {
            validationErrors.invalidBusinessUnits = invalidUnits;
          }
        }

        const totalLinhasAposCabecalho = jsonData.length - headerRowIndex - 1;
        const totalNaoProcessadas = stats.totalRows - stats.processed;
        
        console.log('📊 RESUMO CONTAS A PAGAR:');
        console.log(`   📋 Total de linhas na planilha: ${jsonData.length}`);
        console.log(`   📋 Linha do cabeçalho: ${headerRowIndex + 1}`);
        console.log(`   📋 Total de linhas após cabeçalho: ${totalLinhasAposCabecalho}`);
        console.log(`   📊 Total de linhas processadas (loop): ${stats.totalRows}`);
        console.log(`   ✅ Processadas com sucesso: ${stats.processed}`);
        console.log(`   ⏭️  Ignoradas (cabeçalho/rodapé): ${stats.skippedHeaderFooter}`);
        console.log(`   ⏭️  Ignoradas (vazias): ${stats.skippedEmpty}`);
        console.log(`   ❌ Inválidas (erros de validação): ${stats.invalid}`);
        console.log(`   📦 Registros válidos para inserir: ${accountsPayable.length}`);
        console.log(`   ⚠️  DIFERENÇA CRÍTICA: ${totalLinhasAposCabecalho - stats.totalRows} linhas não entraram no loop`);
        console.log(`   ⚠️  DIFERENÇA NO PROCESSAMENTO: ${totalNaoProcessadas} linhas não foram processadas`);
        
        // Verificar se há discrepância entre linhas esperadas e processadas
        if (totalLinhasAposCabecalho !== stats.totalRows) {
          console.warn(`   🚨 ATENÇÃO: Há ${Math.abs(totalLinhasAposCabecalho - stats.totalRows)} linhas que não entraram no loop de processamento!`);
          console.warn(`   🚨 Isso pode indicar que algumas linhas estão sendo puladas antes do loop.`);
        }
        
        if (validationErrors.invalidBusinessUnits.length > 0) {
          console.log(`   ⚠️ Unidades inválidas: ${validationErrors.invalidBusinessUnits.join(', ')}`);
        }
        if (validationErrors.invalidRows.length > 0) {
          console.log(`   ⚠️ Total de linhas com erros de validação: ${validationErrors.invalidRows.length}`);
          console.log(`   ⚠️ Primeiras 30 linhas com erros:`);
          validationErrors.invalidRows.slice(0, 30).forEach(invRow => {
            console.log(`      Linha ${invRow.lineNumber}: ${invRow.errors.join(', ')}`);
          });
          
          // Agrupar erros por tipo para identificar padrões
          const errorTypes: { [key: string]: number } = {};
          validationErrors.invalidRows.forEach(invRow => {
            invRow.errors.forEach(error => {
              const errorType = error.split(':')[0]; // Pegar o tipo do erro (antes dos dois pontos)
              errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
            });
          });
          
          console.log(`   📊 Tipos de erros encontrados:`);
          Object.entries(errorTypes)
            .sort((a, b) => b[1] - a[1])
            .forEach(([errorType, count]) => {
              console.log(`      ${errorType}: ${count} ocorrências`);
            });
        }

        resolve({
          data: accountsPayable,
          validationErrors,
          skippedRows,
          stats
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

// Função auxiliar para processar receita_crediario quando detectado dentro de processRevenuesFile
const processReceitaCrediarioFromRevenues = (
  jsonData: any,
  validBusinessUnits: string[] | undefined,
  resolve: (value: ProcessResult<ReceitaCrediario>) => void,
  reject: (reason?: any) => void
) => {
  console.log('🚀 processReceitaCrediarioFromRevenues chamada!');
  const dataArray = jsonData as any[][];
  console.log(`📊 Total de linhas no arquivo: ${dataArray.length}`);
  console.log(`📊 Primeiras 5 linhas:`, dataArray.slice(0, 5));
  try {
    const receitasCrediario: ReceitaCrediario[] = [];
    const validationErrors = {
      missingColumns: [] as string[],
      invalidRows: [] as Array<{
        lineNumber: number;
        rowContent: any[];
        errors: string[];
      }>,
      invalidBusinessUnits: [] as string[]
    };
    const skippedRows: Array<{
      lineNumber: number;
      rowContent: any[];
      reason: string;
      category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado';
    }> = [];
    const stats = {
      totalRows: 0,
      processed: 0,
      skippedEmpty: 0,
      skippedHeaderFooter: 0,
      invalid: 0
    };

    // Função para identificar linhas de rodapé/total
    const isFooterRow = (row: any[]): boolean => {
      if (!row || row.length === 0) return false;
      const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
      return rowText.includes('total') ||
             rowText.includes('soma') ||
             rowText.includes('média') ||
             rowText.includes('media') ||
             rowText.includes('usuário:') ||
             rowText.includes('usuario:') ||
             (rowText.includes('impressão') && !rowText.includes('data')) ||
             (rowText.includes('impressao') && !rowText.includes('data')) ||
             (rowText.includes('print') && !rowText.includes('data')) ||
             (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
             (rowText.includes('página') || rowText.includes('pagina'));
    };
    
    const looksLikeHeader = (row: any[]): boolean => {
      if (!row || row.length === 0) return false;
      const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
      
      // Ignorar linhas que são apenas títulos (ex: "Análise de Recebimento de Crediário")
      const rowText = rowHeaders.join(' ');
      if (rowText.includes('análise de recebimento') || 
          rowText.includes('analise de recebimento') ||
          (rowText.includes('recebimento') && (rowText.includes('crediário') || rowText.includes('crediario')))) {
        // Se a linha tem apenas o título e talvez uma data, não é cabeçalho
        if (rowHeaders.length <= 2) {
          return false;
        }
      }
      
      // Normalizar removendo pontos finais
      const normalizedHeaders = rowHeaders.map(h => h.replace(/\./g, '').replace(/\s+/g, ' ').trim());
      const hasColumnKeywords = normalizedHeaders.some(h => 
        h.includes('data receb') ||
        h.includes('un neg') ||
        h.includes('parcela') || // Aceita singular e plural
        h.includes('recebimento') ||
        h.includes('juros') ||
        h.includes('multa') ||
        h.includes('taxa') ||
        h.includes('dias')
      );
      return hasColumnKeywords && !isFooterRow(row);
    };

    // Encontrar cabeçalho
    // NOTA: "Data Receb" não é uma coluna no cabeçalho, mas sim uma linha separada (ex: "Data Receb.: 04/01/2025")
    // Então não vamos procurar por ela no cabeçalho
    let headerRowIndex = -1;
    const expectedColumnNames = {
      unNegReceb: ['un neg receb', 'un.neg receb', 'un. neg receb', 'unidade negócio receb', 'unidade negocio receb', 'un. neg. receb'],
      parcela: ['parcela', 'parcelas'], // Aceita singular e plural
      recebimento: ['recebimento', 'recebiment'],
      diasReceb: ['dias receb', 'dias_receb', 'dias recebimento', 'dias receb.'],
      diasAtraso: ['dias atraso', 'dias_atraso', 'dias']
    };
    
    for (let i = 0; i < dataArray.length; i++) {
      const row = dataArray[i] as any[];
      if (!row || row.length === 0) continue;
      
      if (!looksLikeHeader(row) && isFooterRow(row)) continue;
      
      // Normalizar removendo pontos finais e normalizando espaços
      const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim().replace(/\./g, '').replace(/\s+/g, ' '));
      
      // Normalizar também os nomes esperados
      const normalizedExpectedNames = {
        unNegReceb: expectedColumnNames.unNegReceb.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        parcela: expectedColumnNames.parcela.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        recebimento: expectedColumnNames.recebimento.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        diasReceb: expectedColumnNames.diasReceb.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        diasAtraso: expectedColumnNames.diasAtraso.map(n => n.replace(/\./g, '').replace(/\s+/g, ' '))
      };
      
      const foundUnNegReceb = rowHeaders.some(h => normalizedExpectedNames.unNegReceb.some(name => h.includes(name)));
      const foundRecebimento = rowHeaders.some(h => normalizedExpectedNames.recebimento.some(name => h.includes(name)));
      const foundParcela = rowHeaders.some(h => normalizedExpectedNames.parcela.some(name => h.includes(name)));
      const foundDiasReceb = rowHeaders.some(h => normalizedExpectedNames.diasReceb.some(name => h.includes(name)));
      const foundDiasAtraso = rowHeaders.some(h => normalizedExpectedNames.diasAtraso.some(name => h.includes(name)));
      
      // Colunas obrigatórias: un neg receb, parcela, recebimento, dias receb, dias atraso
      // Data Receb não está no cabeçalho, será processada de linhas separadas
      if (foundUnNegReceb && foundRecebimento && foundParcela && foundDiasReceb && foundDiasAtraso) {
        headerRowIndex = i;
        console.log(`✅ Cabeçalho Receita Crediário encontrado na linha ${i + 1}:`, rowHeaders);
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Não encontrou cabeçalho - todas as colunas obrigatórias estão faltando
      validationErrors.missingColumns = [
        'Un. Neg. Receb',
        'Parcela',
        'Recebimento',
        'Dias Receb',
        'Dias Atraso'
      ];
      
      // Retornar erro de validação em vez de throw
      resolve({
        data: [],
        validationErrors,
        skippedRows: [],
        stats: {
          totalRows: 0,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        }
      });
      return;
    }

    // Mapear colunas
    const headerRow = dataArray[headerRowIndex] as any[];
    const columnMap: { [key: string]: number } = {};
    
    headerRow.forEach((cell, index) => {
      // Normalizar removendo pontos finais e normalizando espaços
      const cellText = String(cell || '').toLowerCase().trim().replace(/\./g, '').replace(/\s+/g, ' ');
      const normalizedExpectedNames = {
        unNegReceb: expectedColumnNames.unNegReceb.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        parcela: expectedColumnNames.parcela.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        recebimento: expectedColumnNames.recebimento.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        diasReceb: expectedColumnNames.diasReceb.map(n => n.replace(/\./g, '').replace(/\s+/g, ' ')),
        diasAtraso: expectedColumnNames.diasAtraso.map(n => n.replace(/\./g, '').replace(/\s+/g, ' '))
      };
      
      if (normalizedExpectedNames.unNegReceb.some(name => cellText.includes(name)) && !columnMap.unNegReceb) {
        columnMap.unNegReceb = index;
      }
      if (normalizedExpectedNames.parcela.some(name => cellText.includes(name)) && !columnMap.parcela) {
        columnMap.parcela = index;
      }
      if (normalizedExpectedNames.recebimento.some(name => cellText.includes(name)) && !columnMap.recebimento) {
        columnMap.recebimento = index;
      }
      // IMPORTANTE: Verificar diasAtraso ANTES de diasReceb, pois "dias atraso" contém "dias"
      // e se verificar diasReceb primeiro, pode pegar o índice errado
      if (normalizedExpectedNames.diasAtraso.some(name => cellText.includes(name)) && !columnMap.diasAtraso) {
        columnMap.diasAtraso = index;
      }
      // Verificar diasReceb apenas se não contém "atraso" (para não pegar a coluna errada)
      if (normalizedExpectedNames.diasReceb.some(name => cellText.includes(name)) && 
          !cellText.includes('atraso') && 
          !columnMap.diasReceb) {
        columnMap.diasReceb = index;
      }
    });

    // Validar colunas obrigatórias (Data Receb não está no cabeçalho, será processada de linhas separadas)
    const requiredColumns = ['unNegReceb', 'parcela', 'recebimento', 'diasReceb', 'diasAtraso'];
    const missingCols = requiredColumns.filter(col => columnMap[col] === undefined);
    if (missingCols.length > 0) {
      // Mapear nomes técnicos para nomes amigáveis
      const colNames: { [key: string]: string } = {
        unNegReceb: 'Un. Neg. Receb',
        parcela: 'Parcela',
        recebimento: 'Recebimento',
        diasReceb: 'Dias Receb',
        diasAtraso: 'Dias Atraso'
      };
      
      validationErrors.missingColumns = missingCols.map(col => colNames[col] || col);
      
      // Retornar erro de validação em vez de throw
      resolve({
        data: [],
        validationErrors,
        skippedRows: [],
        stats: {
          totalRows: 0,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        }
      });
      return;
    }

    // Função parseDate
    const parseDate = (dateValue: any): string => {
      if (!dateValue) return '';
      if (typeof dateValue === 'number') {
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      } else if (typeof dateValue === 'string') {
        const str = String(dateValue).trim();
        const dateTimeMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
        if (dateTimeMatch) {
          const day = dateTimeMatch[1].padStart(2, '0');
          const month = dateTimeMatch[2].padStart(2, '0');
          const year = dateTimeMatch[3].length === 2 ? `20${dateTimeMatch[3]}` : dateTimeMatch[3];
          const date = new Date(`${year}-${month}-${day}`);
          if (!isNaN(date.getTime())) {
            return `${year}-${month}-${day}`;
          }
        }
        const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}/);
        if (isoMatch) return isoMatch[0];
        const dateObj = new Date(str);
        if (!isNaN(dateObj.getTime())) return dateObj.toISOString().split('T')[0];
      } else if (dateValue instanceof Date) {
        if (!isNaN(dateValue.getTime())) return dateValue.toISOString().split('T')[0];
      }
      return '';
    };

    const isHeaderRow = (row: any[], rowIndex: number): boolean => {
      if (rowIndex === headerRowIndex) return true;
      if (!row || row.length === 0) return false;
      const headerRow = dataArray[headerRowIndex] as any[];
      const headerCells = headerRow.map(cell => String(cell || '').toLowerCase().trim());
      const rowCells = row.map(cell => String(cell || '').toLowerCase().trim());
      const matchingCells = rowCells.filter((cell, idx) => 
        headerCells[idx] && cell && cell === headerCells[idx]
      );
      return matchingCells.length >= 3;
    };

    const businessUnitsInFile = new Set<string>();
    
    // Função para detectar e extrair data de linhas "Data Receb.: XX/XX/XXXX"
    const extractDataRecebFromRow = (row: any[]): string | null => {
      if (!row || row.length === 0) return null;
      const rowText = row.map(cell => String(cell || '').trim()).join(' ').toLowerCase();
      console.log(`🔍 extractDataRecebFromRow - linha completa: "${rowText}"`);
      // Padrão: "Data Receb.: 04/01/2025" ou "Data Receb: 04/01/2025"
      // Aceitar também "Data Receb" sem dois pontos e com diferentes espaçamentos
      // O regex precisa capturar: "data receb" (com ou sem ponto/dois pontos) seguido de data
      // Aceitar ".:" ou ":" ou apenas espaço após "receb"
      const dataRecebMatch = rowText.match(/data\s+receb(\.?\s*:?|:)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (dataRecebMatch && dataRecebMatch[2]) {
        const parsedDate = parseDate(dataRecebMatch[2]);
        console.log(`📅 Data Receb extraída da linha: "${row.map(cell => String(cell || '').trim()).join(' ')}" -> "${parsedDate}"`);
        return parsedDate;
      }
      console.log(`❌ Não encontrou Data Receb na linha: "${row.map(cell => String(cell || '').trim()).join(' ')}"`);
      return null;
    };

    // Processar linhas
    // IMPORTANTE: Data Receb está sempre uma linha ANTES dos dados (não no cabeçalho)
    // Estrutura: Linha com "Data Receb.: XX/XX/XXXX" -> Linha de dados -> Linha de dados -> ...
    let currentDataReceb: string | null = null; // Data atual sendo processada
    
    // Verificar se há uma linha "Data Receb" ANTES do cabeçalho
    // Verificar até 3 linhas antes do cabeçalho (pode ter título, data, cabeçalho)
    console.log(`🔍 Procurando Data Receb antes do cabeçalho (linha ${headerRowIndex + 1})...`);
    for (let checkIdx = Math.max(0, headerRowIndex - 3); checkIdx < headerRowIndex; checkIdx++) {
      const checkRow = dataArray[checkIdx] as any[];
      console.log(`🔍 Verificando linha ${checkIdx + 1}:`, checkRow);
      const extractedDataReceb = extractDataRecebFromRow(checkRow);
      if (extractedDataReceb) {
        currentDataReceb = extractedDataReceb;
        console.log(`📅 Data Receb inicial encontrada antes do cabeçalho (linha ${checkIdx + 1}): ${currentDataReceb}`);
        break; // Usar a data mais próxima do cabeçalho
      }
    }
    
    console.log(`📊 Iniciando processamento a partir da linha ${headerRowIndex + 2} (após cabeçalho na linha ${headerRowIndex + 1})`);
    console.log(`📊 Data Receb inicial: ${currentDataReceb || 'não encontrada'}`);
    console.log(`📊 ColumnMap:`, columnMap);
    console.log(`📊 Cabeçalho (linha ${headerRowIndex + 1}):`, dataArray[headerRowIndex]);
    for (let i = headerRowIndex + 1; i < dataArray.length; i++) {
      const row = dataArray[i] as any[];
      stats.totalRows++;
      
      if (i <= headerRowIndex + 10) {
        console.log(`🔍 Processando linha ${i + 1}:`, row);
      }

      if (isHeaderRow(row, i)) {
        stats.skippedHeaderFooter++;
        skippedRows.push({
          lineNumber: i + 1,
          rowContent: [...row],
          reason: 'Cabeçalho duplicado',
          category: 'cabeçalho'
        });
        continue;
      }

      if (isFooterRow(row)) {
        stats.skippedHeaderFooter++;
        skippedRows.push({
          lineNumber: i + 1,
          rowContent: [...row],
          reason: 'Rodapé/Total',
          category: 'rodapé'
        });
        continue;
      }

      // Verificar se esta linha é "Data Receb.: XX/XX/XXXX"
      // Quando encontrar, atualizar currentDataReceb e todas as linhas seguintes usarão essa data
      // até encontrar outra linha "Data Receb"
      const extractedDataReceb = extractDataRecebFromRow(row);
      if (extractedDataReceb) {
        currentDataReceb = extractedDataReceb;
        console.log(`📅 Data Receb atualizada para: ${currentDataReceb} (linha ${i + 1}) - todas as linhas seguintes usarão esta data`);
        // Esta linha é apenas a data, pular para a próxima
        stats.skippedHeaderFooter++;
        skippedRows.push({
          lineNumber: i + 1,
          rowContent: [...row],
          reason: 'Linha de data (Data Receb)',
          category: 'metadado'
        });
        continue;
      }
      
      // Não precisa verificar linhas anteriores - a data já foi atualizada quando encontramos
      // a linha "Data Receb" acima. Todas as linhas seguintes usam essa data até encontrar outra.

      const rowErrors: string[] = [];
      const unNegRecebValue = row[columnMap.unNegReceb];
      const parcelaValue = row[columnMap.parcela];
      const recebimentoValue = row[columnMap.recebimento];
      const diasRecebValue = row[columnMap.diasReceb];
      const diasAtrasoValue = row[columnMap.diasAtraso];
      
      if (i <= headerRowIndex + 10) {
        console.log(`🔍 Valores extraídos da linha ${i + 1}:`, {
          unNegReceb: unNegRecebValue,
          parcela: parcelaValue,
          recebimento: recebimentoValue,
          diasReceb: diasRecebValue,
          diasAtraso: diasAtrasoValue,
          currentDataReceb
        });
      }

      const isRowEmpty = (!unNegRecebValue || String(unNegRecebValue).trim() === '') &&
                        (!recebimentoValue || String(recebimentoValue).trim() === '');
      
      if (isRowEmpty) {
        stats.skippedEmpty++;
        skippedRows.push({
          lineNumber: i + 1,
          rowContent: [...row],
          reason: 'Linha vazia',
          category: 'vazia'
        });
        continue;
      }

      // Validar campos obrigatórios
      // Data Receb vem de linhas separadas, usar a data atual
      const dataReceb = currentDataReceb;
      if (!dataReceb) {
        rowErrors.push('Data Receb não foi encontrada (obrigatório). Verifique se há uma linha "Data Receb.: XX/XX/XXXX" antes dos dados.');
      }
      
      const unNegReceb = String(unNegRecebValue || '').trim();
      if (!unNegReceb) {
        rowErrors.push('Un. Neg. Receb está vazia (obrigatório)');
      } else {
        businessUnitsInFile.add(unNegReceb);
      }
      
      const parcela = String(parcelaValue || '').trim();
      if (!parcela) {
        rowErrors.push('Parcela está vazia (obrigatório)');
      }
      
      const recebimento = parseBrazilianNumber(recebimentoValue);
      if (recebimentoValue === null || recebimentoValue === undefined || recebimentoValue === '' ||
          (typeof recebimentoValue === 'string' && recebimentoValue.trim() === '')) {
        rowErrors.push('Recebimento está vazio (obrigatório)');
      } else if (isNaN(recebimento)) {
        rowErrors.push(`Recebimento inválido: "${recebimentoValue}"`);
      }
      
      const diasReceb = parseBrazilianNumber(diasRecebValue);
      if (diasRecebValue === null || diasRecebValue === undefined || diasRecebValue === '' ||
          (typeof diasRecebValue === 'string' && diasRecebValue.trim() === '')) {
        rowErrors.push('Dias Receb está vazio (obrigatório)');
      } else if (isNaN(diasReceb)) {
        rowErrors.push(`Dias Receb inválido: "${diasRecebValue}"`);
      }
      
      const diasAtraso = parseBrazilianNumber(diasAtrasoValue);
      if (diasAtrasoValue === null || diasAtrasoValue === undefined || diasAtrasoValue === '' ||
          (typeof diasAtrasoValue === 'string' && diasAtrasoValue.trim() === '')) {
        rowErrors.push('Dias Atraso está vazio (obrigatório)');
      } else if (isNaN(diasAtraso)) {
        rowErrors.push(`Dias Atraso inválido: "${diasAtrasoValue}"`);
      }

      if (rowErrors.length > 0) {
        stats.invalid++;
        validationErrors.invalidRows.push({
          lineNumber: i + 1,
          rowContent: [...row],
          errors: rowErrors
        });
        continue;
      }

      const receitaCrediario: any = {
        data_receb: dataReceb,
        business_unit: unNegReceb,
        parcela: parcela,
        recebimento: recebimento,
        dias_receb: diasReceb,
        dias_atraso: diasAtraso
      };

      if (receitasCrediario.length < 3) {
        console.log(`✅ Registro ${receitasCrediario.length + 1} processado (linha ${i + 1}):`, receitaCrediario);
      }

      receitasCrediario.push(receitaCrediario);
      stats.processed++;
    }

    // Validar business units
    if (validBusinessUnits && validBusinessUnits.length > 0) {
      const invalidUnits = Array.from(businessUnitsInFile).filter(
        unit => {
          const normalizedUnit = String(parseInt(unit) || unit);
          return !validBusinessUnits.includes(unit) && 
                 !validBusinessUnits.includes(normalizedUnit) &&
                 !validBusinessUnits.some(vu => String(parseInt(vu) || vu) === normalizedUnit);
        }
      );
      if (invalidUnits.length > 0) {
        validationErrors.invalidBusinessUnits = invalidUnits;
      }
    }

    console.log('📊 RESUMO RECEITA CREDIÁRIO:');
    console.log(`   ✅ Processadas: ${stats.processed}`);
    console.log(`   ⏭️  Ignoradas: ${stats.skippedHeaderFooter + stats.skippedEmpty}`);
    console.log(`   ❌ Inválidas: ${stats.invalid}`);
    console.log(`   📦 Total de registros para inserir: ${receitasCrediario.length}`);
    if (receitasCrediario.length > 0) {
      console.log(`   📋 Primeiro registro:`, receitasCrediario[0]);
    } else {
      console.log(`   ⚠️ NENHUM REGISTRO FOI PROCESSADO! Verifique os logs acima.`);
    }

    resolve({
      data: receitasCrediario,
      validationErrors,
      skippedRows,
      stats
    } as any);
  } catch (error: any) {
    console.error('❌ Erro em processReceitaCrediarioFromRevenues:', error);
    reject(error);
  }
};

export const processRevenuesFile = (
  file: File, 
  validBusinessUnits?: string[]
): Promise<ProcessResult<Revenue | ReceitaCrediario>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('Arquivo vazio ou não pôde ser lido');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('O arquivo não contém planilhas válidas.');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const revenues: Revenue[] = [];
        const validationErrors = {
          missingColumns: [] as string[],
          invalidRows: [] as Array<{
            lineNumber: number;
            rowContent: any[];
            errors: string[];
          }>,
          invalidBusinessUnits: [] as string[]
        };
        const skippedRows: Array<{
          lineNumber: number;
          rowContent: any[];
          reason: string;
          category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado';
        }> = [];
        const stats = {
          totalRows: 0,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        };

        // Coletar linhas com status não identificado para notificação
        const rowsWithUnidentifiedStatus: Array<{
          lineNumber: number;
          rowContent: any[];
        }> = [];

        console.log('📊 RECEITAS - Total de linhas na planilha:', jsonData.length);
        console.log('📊 RECEITAS - Primeiras 3 linhas:', jsonData.slice(0, 3));
        console.log('📊 RECEITAS - Últimas 3 linhas:', jsonData.slice(-3));

        // DETECÇÃO AUTOMÁTICA: Verificar se é Receita Crediário ou Receita Normal
        let isReceitaCrediario = false;
        console.log('🔍 Iniciando detecção automática de tipo de receita...');
        const allText = (jsonData as any[]).slice(0, 20).map((row: any) => 
          Array.isArray(row) ? row.map((cell: any) => String(cell || '').toLowerCase().trim()).join(' ') : ''
        ).join(' ');
        
        // Verificar indicadores de Receita Crediário:
        // 1. Título "análise de recebimento de crediário"
        // 2. Coluna de juros
        // 3. Coluna de multa
        const hasCrediarioTitle = allText.includes('análise de recebimento de crediário') || 
                                  allText.includes('analise de recebimento de crediario') ||
                                  allText.includes('recebimento de crediário') ||
                                  allText.includes('recebimento de crediario');
        
        console.log(`🔍 Verificação de título: hasCrediarioTitle=${hasCrediarioTitle}`);
        
        // Verificar nas primeiras linhas se tem colunas de juros e multa
        for (let i = 0; i < Math.min(10, (jsonData as any[]).length); i++) {
          const row = (jsonData as any[])[i] as any[];
          if (!row || row.length === 0) continue;
          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          const hasJuros = rowHeaders.some(h => h.includes('juros') || h.includes('juro'));
          const hasMulta = rowHeaders.some(h => h.includes('multa') || h.includes('mult'));
          
          if (i < 5) {
            console.log(`🔍 Linha ${i + 1}: hasJuros=${hasJuros}, hasMulta=${hasMulta}, headers:`, rowHeaders);
          }
          
          if (hasJuros && hasMulta) {
            isReceitaCrediario = true;
            console.log(`🔍 Detectado: Receita Crediário (encontradas colunas de juros e multa na linha ${i + 1})`);
            break;
          }
        }
        
        if (hasCrediarioTitle) {
          isReceitaCrediario = true;
          console.log('🔍 Detectado: Receita Crediário (encontrado título "Análise de Recebimento de Crediário")');
        }

        console.log(`🔍 Resultado da detecção: isReceitaCrediario=${isReceitaCrediario}`);

        // Se for Receita Crediário, processar como tal
        if (isReceitaCrediario) {
          console.log('✅ Processando como Receita Crediário...');
          // Processar como receita_crediario
          return processReceitaCrediarioFromRevenues(jsonData, validBusinessUnits, resolve, reject);
        }
        
        console.log('✅ Processando como Receita Normal...');

        // Função para identificar linhas de rodapé (não cabeçalho)
        const isFooterRow = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
          
          // Rodapé tem características específicas que não são nomes de colunas
          const isFooterPattern = 
            (rowText.includes('usuário:') || rowText.includes('usuario:')) ||
            (rowText.includes('impressão') && !rowText.includes('data')) ||
            (rowText.includes('impressao') && !rowText.includes('data')) ||
            (rowText.includes('print') && !rowText.includes('data')) ||
            (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
            (rowText.includes('página') || rowText.includes('pagina'));
          
          return isFooterPattern;
        };
        
        // Função para verificar se uma linha parece ser um cabeçalho (tem nomes de colunas)
        const looksLikeHeader = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          
          // Um cabeçalho deve ter pelo menos algumas palavras-chave de colunas
          const hasColumnKeywords = rowHeaders.some(h => 
            h.includes('status') ||
            h.includes('unidade') ||
            h.includes('conta') ||
            h.includes('data') ||
            h.includes('valor') ||
            h.includes('amount')
          );
          
          // Não deve ser um rodapé
          return hasColumnKeywords && !isFooterRow(row);
        };

        // Encontrar a linha de cabeçalho real
        let headerRowIndex = -1;
        const expectedColumnNames = {
          status: ['status'],
          unidade: ['unidade', 'un.negócio', 'un. negócio', 'un.negocio', 'un. negocio', 'unidade de negócio'],
          planoContas: ['plano de contas', 'plano', 'conta origem', 'conta_origem'],
          dataPagamento: ['data pagamento', 'data de pagamento', 'pagamento', 'data hora', 'datahora'],
          valor: ['valor', 'amount'],
          tipo: ['tipo'],
          usuario: ['usuário', 'usuario', 'user'],
          contaDestino: ['conta destino', 'conta_destino'],
          conciliacaoOrigem: ['conciliação origem', 'conciliacao origem', 'conciliação_origem', 'conciliacao_origem'],
          conciliacaoDestino: ['conciliação destino', 'conciliacao destino', 'conciliação_destino', 'conciliacao_destino']
        };
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          // Primeiro verificar se parece ser um cabeçalho
          // Se não parecer, pode ser rodapé ou dados - verificar depois
          if (!looksLikeHeader(row) && isFooterRow(row)) {
            // É claramente um rodapé, ignorar
            continue;
          }
          
          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          
          const foundStatus = rowHeaders.some(h => expectedColumnNames.status.some(name => h.includes(name)));
          const foundUnidade = rowHeaders.some(h => expectedColumnNames.unidade.some(name => h.includes(name)) && !h.includes('negócio:'));
          const foundPlanoContas = rowHeaders.some(h => expectedColumnNames.planoContas.some(name => h.includes(name)));
          const foundValor = rowHeaders.some(h => expectedColumnNames.valor.some(name => h.includes(name)));
          const foundDataPagamento = rowHeaders.some(h => expectedColumnNames.dataPagamento.some(name => h.includes(name)));
          
          // VALIDAÇÃO 1: Verificar se todas as colunas obrigatórias estão presentes
          if (foundStatus && foundUnidade && foundValor && foundDataPagamento && foundPlanoContas) {
            headerRowIndex = i;
            console.log(`✅ Cabeçalho encontrado na linha ${i + 1}:`, rowHeaders);
            break;
          }
        }

        if (headerRowIndex === -1) {
          // Verificar quais colunas estão faltando
          const missingCols: string[] = [];
          let testRowIndex = -1;
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;
            
            // Ignorar apenas rodapés claros, não cabeçalhos
            if (isFooterRow(row) && !looksLikeHeader(row)) continue;
            const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
            if (rowHeaders.some(h => expectedColumnNames.status.some(n => h.includes(n))) ||
                rowHeaders.some(h => expectedColumnNames.unidade.some(n => h.includes(n)))) {
              testRowIndex = i;
              break;
            }
          }
          
          if (testRowIndex >= 0) {
            const testRow = jsonData[testRowIndex] as any[];
            const rowHeaders = testRow.map(cell => String(cell || '').toLowerCase().trim());
            const rawHeaders = testRow.map(cell => String(cell || '').trim());
            
            const foundCols: string[] = [];
            if (!rowHeaders.some(h => expectedColumnNames.status.some(n => h.includes(n)))) {
              missingCols.push('Status');
            } else {
              foundCols.push('Status');
            }
            if (!rowHeaders.some(h => expectedColumnNames.unidade.some(n => h.includes(n)) && !h.includes('negócio:'))) {
              missingCols.push('Unidade de Negócio');
            } else {
              foundCols.push('Unidade de Negócio');
            }
            if (!rowHeaders.some(h => expectedColumnNames.planoContas.some(n => h.includes(n)))) {
              missingCols.push('Conta Origem (Plano de Contas)');
            } else {
              foundCols.push('Conta Origem');
            }
            if (!rowHeaders.some(h => expectedColumnNames.dataPagamento.some(n => h.includes(n)))) {
              missingCols.push('Data Hora (Data de Pagamento)');
            } else {
              foundCols.push('Data Hora');
            }
            if (!rowHeaders.some(h => expectedColumnNames.valor.some(n => h.includes(n)))) {
              missingCols.push('Valor');
            } else {
              foundCols.push('Valor');
            }
            
            // Log detalhado
            console.error('❌ Erro ao processar arquivo de Receitas');
            console.error(`📋 Linha ${testRowIndex + 1} analisada (raw):`, rawHeaders);
            console.error(`📋 Linha ${testRowIndex + 1} analisada (normalized):`, rowHeaders);
            console.error(`✅ Colunas encontradas:`, foundCols);
            console.error(`❌ Colunas faltando:`, missingCols);
          }
          
          // Criar mensagem de erro detalhada
          let errorMsg = 'O arquivo de Receitas não foi aceito porque não foram encontradas todas as colunas obrigatórias.\n\n';
          
          if (testRowIndex >= 0 && missingCols.length > 0) {
            errorMsg += `❌ Colunas obrigatórias faltando: ${missingCols.join(', ')}\n\n`;
            errorMsg += 'Colunas obrigatórias esperadas:\n';
            errorMsg += '• Status\n';
            errorMsg += '• Unidade de Negócio (ou "Un. Negócio")\n';
            errorMsg += '• Conta Origem (ou "Plano de Contas")\n';
            errorMsg += '• Data Hora (ou "Data Pagamento")\n';
            errorMsg += '• Valor\n\n';
            
            const testRow = jsonData[testRowIndex] as any[];
            const rawHeaders = testRow.map(cell => String(cell || '').trim()).filter(h => h && h.length > 0);
            if (rawHeaders.length > 0) {
              errorMsg += `Colunas encontradas no arquivo: ${rawHeaders.join(', ')}`;
            }
          } else {
            errorMsg += 'Não foi possível encontrar a linha de cabeçalho com as colunas esperadas.\n\n';
            errorMsg += 'Colunas obrigatórias esperadas:\n';
            errorMsg += '• Status\n';
            errorMsg += '• Unidade de Negócio (ou "Un. Negócio")\n';
            errorMsg += '• Conta Origem (ou "Plano de Contas")\n';
            errorMsg += '• Data Hora (ou "Data Pagamento")\n';
            errorMsg += '• Valor';
          }
          
          throw new Error(errorMsg);
        }

        // Mapear índices das colunas
        const headerRow = jsonData[headerRowIndex] as any[];
        const columnMap: { [key: string]: number } = {};
        
        headerRow.forEach((cell, index) => {
          const cellText = String(cell || '').toLowerCase().trim();
          
          if (expectedColumnNames.status.some(name => cellText.includes(name)) && !columnMap.status) {
            columnMap.status = index;
          }
          if (expectedColumnNames.unidade.some(name => cellText.includes(name)) && 
              !cellText.includes('negócio:') && !columnMap.unidade) {
            columnMap.unidade = index;
          }
          if (expectedColumnNames.planoContas.some(name => cellText.includes(name)) && !columnMap.planoContas) {
            columnMap.planoContas = index;
          }
          if (expectedColumnNames.dataPagamento.some(name => cellText.includes(name)) && !columnMap.dataPagamento) {
            columnMap.dataPagamento = index;
          }
          if (expectedColumnNames.valor.some(name => cellText.includes(name)) && !columnMap.valor) {
            columnMap.valor = index;
          }
          if (expectedColumnNames.tipo.some(name => cellText.includes(name)) && !columnMap.tipo) {
            columnMap.tipo = index;
          }
          if (expectedColumnNames.usuario.some(name => cellText.includes(name)) && !columnMap.usuario) {
            columnMap.usuario = index;
          }
          if (expectedColumnNames.contaDestino.some(name => cellText.includes(name)) && !columnMap.contaDestino) {
            columnMap.contaDestino = index;
          }
          if (expectedColumnNames.conciliacaoOrigem.some(name => cellText.includes(name)) && !columnMap.conciliacaoOrigem) {
            columnMap.conciliacaoOrigem = index;
          }
          if (expectedColumnNames.conciliacaoDestino.some(name => cellText.includes(name)) && !columnMap.conciliacaoDestino) {
            columnMap.conciliacaoDestino = index;
          }
        });

        console.log('📋 Mapeamento de colunas encontrado:', columnMap);

        // VALIDAÇÃO 2: Verificar se todas as colunas obrigatórias foram mapeadas
        const requiredColumns = ['status', 'unidade', 'planoContas', 'dataPagamento', 'valor'];
        const missingMappedCols = requiredColumns.filter(col => columnMap[col] === undefined);
        
        if (missingMappedCols.length > 0) {
          const colNames: { [key: string]: string } = {
            status: 'Status',
            unidade: 'Unidade de Negócio',
            planoContas: 'Conta Origem (Plano de Contas)',
            dataPagamento: 'Data Hora (Data de Pagamento)',
            valor: 'Valor'
          };
          throw new Error(`Colunas obrigatórias não encontradas no cabeçalho: ${missingMappedCols.map(c => colNames[c]).join(', ')}`);
        }

        // Função auxiliar para converter data
        const parseDate = (dateValue: any): string => {
          if (!dateValue) return '';
          
          if (typeof dateValue === 'number') {
            const date = new Date((dateValue - 25569) * 86400 * 1000);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
          } else if (typeof dateValue === 'string') {
            const str = String(dateValue).trim();
            
            // Formato DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY
            const dateTimeMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
            if (dateTimeMatch) {
              const day = dateTimeMatch[1].padStart(2, '0');
              const month = dateTimeMatch[2].padStart(2, '0');
              const year = dateTimeMatch[3].length === 2 ? `20${dateTimeMatch[3]}` : dateTimeMatch[3];
              const date = new Date(`${year}-${month}-${day}`);
              if (!isNaN(date.getTime())) {
                return `${year}-${month}-${day}`;
              }
            }
            
            // Tentar parse direto como ISO string
            const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}/);
            if (isoMatch) {
              return isoMatch[0];
            }
            
            const dateObj = new Date(str);
            if (!isNaN(dateObj.getTime())) {
              return dateObj.toISOString().split('T')[0];
            }
          } else if (dateValue instanceof Date) {
            if (!isNaN(dateValue.getTime())) {
              return dateValue.toISOString().split('T')[0];
            }
          }
          
          return '';
        };

        // Coletar business units únicas da planilha para validação
        const businessUnitsInFile = new Set<string>();

        // Função para verificar se uma linha é cabeçalho (nomes das colunas)
        const isHeaderRow = (row: any[], rowIndex: number): boolean => {
          if (rowIndex === headerRowIndex) return true;
          
          if (!row || row.length === 0) return false;
          
          const headerRow = jsonData[headerRowIndex] as any[];
          if (!headerRow) return false;
          
          let matchesCount = 0;
          let totalChecks = 0;
          
          if (columnMap.status !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.status] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.status] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.unidade !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.unidade] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.unidade] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.planoContas !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.planoContas] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.planoContas] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (columnMap.valor !== undefined) {
            totalChecks++;
            const headerValue = String(headerRow[columnMap.valor] || '').toLowerCase().trim();
            const rowValue = String(row[columnMap.valor] || '').toLowerCase().trim();
            if (headerValue && rowValue && headerValue === rowValue) {
              matchesCount++;
            }
          }
          
          if (matchesCount >= 4 && totalChecks >= 4) {
            return true;
          }
          
          const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
          const headerKeywords = [
            'status', 'unidade', 'plano de contas', 'valor', 
            'data pagamento', 'data de pagamento', 'data hora'
          ];
          
          const hasMultipleHeaderKeywords = headerKeywords.filter(keyword => 
            rowText.includes(keyword)
          ).length >= 4;
          
          const hasValidData = row.some(cell => {
            const cellStr = String(cell || '').trim();
            if (cellStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/)) return true;
            if (!isNaN(parseFloat(cellStr.replace(/\./g, '').replace(',', '.')))) {
              const num = parseFloat(cellStr.replace(/\./g, '').replace(',', '.'));
              return num !== 0;
            }
            return false;
          });
          
          return hasMultipleHeaderKeywords && !hasValidData;
        };

        // Processar linhas
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          stats.totalRows++;

          // Ignorar linhas de cabeçalho (nomes das colunas duplicados)
          if (isHeaderRow(row, i)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Cabeçalho duplicado (linha contém nomes de colunas)',
              category: 'cabeçalho'
            });
            continue;
          }

          // Ignorar linhas de rodapé
          if (isFooterRow(row)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Rodapé (linha contém informações de impressão, usuário, etc.)',
              category: 'rodapé'
            });
            continue;
          }

          // Verificar se a linha está vazia
          const statusValue = row[columnMap.status];
          const unidadeValue = row[columnMap.unidade];
          const planoContasValue = row[columnMap.planoContas];
          const valorValue = row[columnMap.valor];
          const dataPagamentoValue = row[columnMap.dataPagamento];
          
          const allFieldsEmpty = !statusValue && !unidadeValue && !planoContasValue && 
                                 !valorValue && !dataPagamentoValue;
          
          if (allFieldsEmpty) {
            stats.skippedEmpty++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Linha completamente vazia',
              category: 'vazia'
            });
            continue;
          }

          // VALIDAÇÃO DE CAMPOS
          const rowErrors: string[] = [];
          
          // Validar Status (pode estar vazio, será normalizado)
          const statusValueStr = (statusValue || '').toString().trim();
          let normalizedStatus: 'realizado' | 'previsto' | 'não identificado';
          
          if (!statusValueStr) {
            normalizedStatus = 'não identificado';
            rowsWithUnidentifiedStatus.push({
              lineNumber: i + 1,
              rowContent: [...row]
            });
          } else {
            normalizedStatus = normalizeStatus(statusValueStr);
          }
          
          // Validar Unidade de Negócio (obrigatório)
          const unidadeStr = (unidadeValue || '').toString().trim();
          if (!unidadeStr) {
            rowErrors.push('Unidade de Negócio está vazia (obrigatório)');
          } else {
            businessUnitsInFile.add(unidadeStr);
          }
          
          // Validar Conta Origem (obrigatório)
          const planoContasStr = (planoContasValue || '').toString().trim();
          if (!planoContasStr) {
            rowErrors.push('Conta Origem (Plano de Contas) está vazia (obrigatório)');
          }
          
          // Validar Data Hora (obrigatório)
          const paymentDate = parseDate(dataPagamentoValue);
          if (!paymentDate) {
            rowErrors.push('Data Hora está vazia ou inválida (obrigatório)');
          }
          
          // Validar Valor (obrigatório)
          const valorOriginal = valorValue;
          const isValorEmpty = valorOriginal === null || 
                               valorOriginal === undefined || 
                               valorOriginal === '' ||
                               (typeof valorOriginal === 'string' && valorOriginal.trim() === '');
          if (isValorEmpty) {
            rowErrors.push('Valor está vazio (obrigatório)');
          }
          const amount = parseBrazilianNumber(valorOriginal);
          if (!isValorEmpty && isNaN(amount)) {
            rowErrors.push(`Valor inválido: "${valorOriginal}"`);
          }
          
          // Se houver erros, adicionar ao relatório
          if (rowErrors.length > 0) {
            validationErrors.invalidRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              errors: rowErrors
            });
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: `Linha inválida: ${rowErrors.join('; ')}`,
              category: 'inválida'
            });
            stats.invalid++;
            continue;
          }

          // Se passou todas as validações, processar
          const revenue: any = {
            status: normalizedStatus,
            business_unit: unidadeStr,
            chart_of_accounts: planoContasStr,
            payment_date: paymentDate,
            amount: amount
          };

          // Adicionar campos opcionais se existirem no mapeamento
          if (columnMap.tipo !== undefined) {
            revenue.tipo = (row[columnMap.tipo] || '').toString().trim() || undefined;
          }
          if (columnMap.usuario !== undefined) {
            revenue.usuario = (row[columnMap.usuario] || '').toString().trim() || undefined;
          }
          if (columnMap.contaDestino !== undefined) {
            revenue.conta_destino = (row[columnMap.contaDestino] || '').toString().trim() || undefined;
          }
          if (columnMap.conciliacaoOrigem !== undefined) {
            const concOrigem = (row[columnMap.conciliacaoOrigem] || '').toString().trim();
            revenue.conciliacao_origem = concOrigem || undefined;
          }
          if (columnMap.conciliacaoDestino !== undefined) {
            const concDestino = (row[columnMap.conciliacaoDestino] || '').toString().trim();
            revenue.conciliacao_destino = concDestino || undefined;
          }

          revenues.push(revenue);
          stats.processed++;
        }

        // VALIDAÇÃO 4: Validar business units contra o banco
        if (validBusinessUnits && validBusinessUnits.length > 0) {
          const invalidUnits = Array.from(businessUnitsInFile).filter(
            unit => {
              const normalizedUnit = String(parseInt(unit) || unit);
              return !validBusinessUnits.includes(unit) && 
                     !validBusinessUnits.includes(normalizedUnit) &&
                     !validBusinessUnits.some(vu => String(parseInt(vu) || vu) === normalizedUnit);
            }
          );
          
          if (invalidUnits.length > 0) {
            validationErrors.invalidBusinessUnits = invalidUnits;
          }
        }

        console.log('📊 RESUMO RECEITAS:');
        console.log(`   📋 Total de linhas na planilha: ${jsonData.length}`);
        console.log(`   📋 Linha do cabeçalho: ${headerRowIndex + 1}`);
        console.log(`   📊 Total de linhas processadas: ${stats.totalRows}`);
        console.log(`   ✅ Processadas com sucesso: ${stats.processed}`);
        console.log(`   ⏭️  Ignoradas (cabeçalho/rodapé): ${stats.skippedHeaderFooter}`);
        console.log(`   ⏭️  Ignoradas (vazias): ${stats.skippedEmpty}`);
        console.log(`   ❌ Inválidas (erros de validação): ${stats.invalid}`);
        console.log(`   📦 Registros válidos para inserir: ${revenues.length}`);
        if (validationErrors.invalidBusinessUnits.length > 0) {
          console.log(`   ⚠️ Unidades inválidas: ${validationErrors.invalidBusinessUnits.join(', ')}`);
        }
        if (validationErrors.invalidRows.length > 0) {
          console.log(`   ⚠️ Total de linhas com erros de validação: ${validationErrors.invalidRows.length}`);
        }
        if (rowsWithUnidentifiedStatus.length > 0) {
          console.log(`   ℹ️  Linhas com status não identificado: ${rowsWithUnidentifiedStatus.length}`);
        }

        resolve({
          data: revenues,
          validationErrors,
          skippedRows,
          stats,
          // Adicionar dados para notificação de status não identificado
          rowsWithUnidentifiedStatus
        } as ProcessResult<Revenue> & { rowsWithUnidentifiedStatus?: Array<{ lineNumber: number; rowContent: any[] }> });
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

          const amount = parseBrazilianNumber(row[5]);
          if (isNaN(amount) || amount === 0) {
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

export const processFinancialTransactionsFile = (file: File, validBusinessUnits?: string[]): Promise<ProcessResult<FinancialTransaction>> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const transactions: FinancialTransaction[] = [];
        const validationErrors = {
          missingColumns: [] as string[],
          invalidRows: [] as Array<{
            lineNumber: number;
            rowContent: any[];
            errors: string[];
          }>,
          invalidBusinessUnits: [] as string[]
        };
        const skippedRows: Array<{
          lineNumber: number;
          rowContent: any[];
          reason: string;
          category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado';
        }> = [];

        const stats = {
          totalRows: jsonData.length,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        };

        console.log('📊 LANÇAMENTOS FINANCEIROS - Total de linhas na planilha:', jsonData.length);
        console.log('📊 LANÇAMENTOS FINANCEIROS - Primeiras 3 linhas:', jsonData.slice(0, 3));
        console.log('📊 LANÇAMENTOS FINANCEIROS - Últimas 3 linhas:', jsonData.slice(-3));

        // Função para verificar se uma linha é cabeçalho/rodapé (mesma lógica da validação)
        const isHeaderFooterRowFinancial = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
          // Verificar se é uma linha de metadado (tem ":" após palavras-chave)
          // Ex: "Unidade de Negócio: ESCRITÓRIO", "Usuário: 2424", "Impressão: 15/02/2026"
          const isMetadataLine = 
            (rowText.includes('usuário:') || rowText.includes('usuario:')) ||
            (rowText.includes('impressão:') || rowText.includes('impressao:')) ||
            (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
            (rowText.includes('página') || rowText.includes('pagina'));
          
          // Se tem apenas uma célula não vazia e contém ":", provavelmente é metadado
          const nonEmptyCells = row.filter(cell => String(cell || '').trim() !== '');
          if (nonEmptyCells.length <= 2 && rowText.includes(':')) {
            return true;
          }
          
          return isMetadataLine;
        };

        const looksLikeHeaderFinancial = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          const hasColumnKeywords = rowHeaders.some(h => 
            h.includes('unidade') ||
            h.includes('plano') ||
            h.includes('data') ||
            h.includes('valor') ||
            h.includes('amount')
          );
          return hasColumnKeywords && !isHeaderFooterRowFinancial(row);
        };

        // Encontrar a linha de cabeçalho
        let headerRowIndex = -1;
        const expectedColumnNames = {
          status: ['status'],
          unidade: ['un. neg', 'unidade', 'unidade de negócio', 'unidade de negocio', 'business unit'],
          planoContas: ['plano de contas', 'plano', 'chart of accounts'],
          dataHora: ['data hora', 'datahora', 'data', 'transaction date', 'transaction_date'],
          valor: ['valor', 'amount'],
          numDoc: ['num. doc', 'num doc', 'numero doc', 'número doc', 'documento'],
          contaCorrente: ['conta corrente', 'conta'],
          origem: ['origem'],
          descricao: ['descrição', 'descricao', 'description'],
          dataHoraInclusao: ['data hora inclusão', 'data hora inclusao', 'data inclusão', 'data inclusao'],
          usuario: ['usuário', 'usuario', 'user']
        };

        console.log('🔍 PROCESSAMENTO - Procurando cabeçalho de Lançamentos Financeiros...');
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          // Ignorar linhas de metadados/rodapé (mas não se parecer com cabeçalho)
          if (!looksLikeHeaderFinancial(row) && isHeaderFooterRowFinancial(row)) {
            if (i < 10) {
              console.log(`🔍 PROCESSAMENTO - Linha ${i + 1} ignorada (metadado/rodapé)`);
            }
            continue;
          }

          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          const hasUnidade = expectedColumnNames.unidade.some(name => rowHeaders.some(h => h.includes(name)));
          const hasPlanoContas = expectedColumnNames.planoContas.some(name => rowHeaders.some(h => h.includes(name)));
          const hasDataHora = expectedColumnNames.dataHora.some(name => rowHeaders.some(h => h.includes(name)));
          const hasValor = expectedColumnNames.valor.some(name => rowHeaders.some(h => h.includes(name)));

          if (i < 10) {
            console.log(`🔍 PROCESSAMENTO - Linha ${i + 1} - Detecção:`, {
              hasUnidade,
              hasPlanoContas,
              hasDataHora,
              hasValor,
              looksLikeHeader: looksLikeHeaderFinancial(row),
              isHeaderFooter: isHeaderFooterRowFinancial(row),
              rowHeaders: rowHeaders.slice(0, 5) // Primeiras 5 colunas para debug
            });
          }

          // Plano de Contas é obrigatório no cabeçalho, mas aceita valores vazios
          if (hasUnidade && hasPlanoContas && hasDataHora && hasValor) {
            headerRowIndex = i;
            console.log(`✅ PROCESSAMENTO - Cabeçalho de Lançamentos Financeiros encontrado na linha ${i + 1}`);
            console.log(`📋 PROCESSAMENTO - Cabeçalho completo:`, rowHeaders);
            break;
          }
        }

        if (headerRowIndex === -1) {
          console.error('❌ PROCESSAMENTO - Cabeçalho não encontrado!');
          console.error('📋 PROCESSAMENTO - Analisando primeiras 10 linhas para debug:');
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;
            const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
            console.error(`   Linha ${i + 1}:`, rowHeaders.slice(0, 10));
          }
          
          validationErrors.missingColumns = ['Un. Neg.', 'Plano de Contas', 'Data Hora', 'Valor'];
          resolve({
            data: [],
            validationErrors,
            skippedRows: [],
            stats
          });
          return;
        }

        // Mapear colunas
        const headerRow = jsonData[headerRowIndex] as any[];
        const columnMap: { [key: string]: number } = {};
        
        headerRow.forEach((cell, index) => {
          const cellText = String(cell || '').toLowerCase().trim();
          if (expectedColumnNames.status.some(name => cellText.includes(name)) && !columnMap.status) {
            columnMap.status = index;
          }
          if (expectedColumnNames.unidade.some(name => cellText.includes(name)) && !columnMap.unidade) {
            columnMap.unidade = index;
          }
          if (expectedColumnNames.planoContas.some(name => cellText.includes(name)) && !columnMap.planoContas) {
            columnMap.planoContas = index;
          }
          if (expectedColumnNames.dataHora.some(name => cellText.includes(name)) && !columnMap.dataHora) {
            columnMap.dataHora = index;
          }
          if (expectedColumnNames.valor.some(name => cellText.includes(name)) && !columnMap.valor) {
            columnMap.valor = index;
          }
          if (expectedColumnNames.numDoc.some(name => cellText.includes(name)) && !columnMap.numDoc) {
            columnMap.numDoc = index;
          }
          if (expectedColumnNames.contaCorrente.some(name => cellText.includes(name)) && !columnMap.contaCorrente) {
            columnMap.contaCorrente = index;
          }
          if (expectedColumnNames.origem.some(name => cellText.includes(name)) && !columnMap.origem) {
            columnMap.origem = index;
          }
          if (expectedColumnNames.descricao.some(name => cellText.includes(name)) && !columnMap.descricao) {
            columnMap.descricao = index;
          }
          if (expectedColumnNames.dataHoraInclusao.some(name => cellText.includes(name)) && !columnMap.dataHoraInclusao) {
            columnMap.dataHoraInclusao = index;
          }
          if (expectedColumnNames.usuario.some(name => cellText.includes(name)) && !columnMap.usuario) {
            columnMap.usuario = index;
          }
        });

        // Validar colunas obrigatórias
        console.log('🔍 PROCESSAMENTO - Mapeamento de colunas encontrado:', columnMap);
        // planoContas é obrigatório no cabeçalho, mas aceita valores vazios (será preenchido como "não identificado")
        const requiredColumns = ['unidade', 'planoContas', 'dataHora', 'valor'];
        const missingCols = requiredColumns.filter(col => columnMap[col] === undefined);
        if (missingCols.length > 0) {
          console.error('❌ PROCESSAMENTO - Colunas obrigatórias faltando após mapeamento!');
          console.error('   Colunas encontradas:', Object.keys(columnMap));
          console.error('   Colunas faltando:', missingCols);
          console.error('   Cabeçalho completo:', headerRow.map(cell => String(cell || '').toLowerCase().trim()));
          
          const colNames: { [key: string]: string } = {
            unidade: 'Un. Neg.',
            planoContas: 'Plano de Contas',
            dataHora: 'Data Hora',
            valor: 'Valor'
          };
          validationErrors.missingColumns = missingCols.map(col => colNames[col] || col);
          resolve({
            data: [],
            validationErrors,
            skippedRows: [],
            stats
          });
          return;
        }

        const businessUnitsInFile = new Set<string>();

        // Função auxiliar para parse de data/hora
        const parseDateTime = (value: any): string | null => {
          if (!value) return null;
          if (typeof value === 'number') {
            const date = new Date((value - 25569) * 86400 * 1000);
            return date.toISOString();
          }
          if (typeof value === 'string') {
            // Tentar formato DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY
            const parts = value.split(' ');
            if (parts.length >= 1) {
              const datePart = parts[0];
              const dateParts = datePart.split('/');
              if (dateParts.length === 3) {
                const dateStr = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                if (parts.length > 1) {
                  return `${dateStr}T${parts[1]}:00`;
                }
                return dateStr;
              }
            }
          }
          return null;
        };

        // Processar linhas
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) {
            stats.skippedEmpty++;
            continue;
          }

          // Verificar se é cabeçalho duplicado (comparando com o cabeçalho real)
          const isHeaderRow = (r: any[], idx: number): boolean => {
            if (idx <= headerRowIndex) return false;
            if (!r || r.length === 0) return false;
            
            // Comparar com o cabeçalho real encontrado
            const headerRow = jsonData[headerRowIndex] as any[];
            if (!headerRow) return false;
            
            const headerCells = headerRow.map(cell => String(cell || '').toLowerCase().trim());
            const rowCells = r.map(cell => String(cell || '').toLowerCase().trim());
            
            // Verificar se pelo menos 3 células correspondem exatamente ao cabeçalho
            // Isso evita pegar linhas de dados que apenas contêm palavras-chave
            let matchesCount = 0;
            const minMatches = Math.min(3, headerCells.filter(c => c !== '').length);
            
            for (let i = 0; i < Math.min(headerCells.length, rowCells.length); i++) {
              if (headerCells[i] && rowCells[i] && headerCells[i] === rowCells[i]) {
                matchesCount++;
              }
            }
            
            return matchesCount >= minMatches;
          };

          if (isHeaderRow(row, i)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Cabeçalho duplicado',
              category: 'cabeçalho'
            });
            continue;
          }

          if (isHeaderFooterRowFinancial(row)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Rodapé/Total',
              category: 'rodapé'
            });
            continue;
          }

          // Validar campos obrigatórios
          const rowErrors: string[] = [];
          const businessUnit = String(row[columnMap.unidade] || '').trim();
          const chartOfAccountsOriginal = columnMap.planoContas !== undefined ? String(row[columnMap.planoContas] || '').trim() : '';
          // Se plano de contas estiver vazio, usar "não identificado"
          const chartOfAccounts = chartOfAccountsOriginal || 'não identificado';
          const transactionDate = parseDateTime(row[columnMap.dataHora]);
          const valorOriginal = row[columnMap.valor];
          const isValorEmpty = valorOriginal === null || valorOriginal === undefined || valorOriginal === '' || (typeof valorOriginal === 'string' && valorOriginal.trim() === '');
          const amount = parseBrazilianNumber(valorOriginal);

          if (!businessUnit) {
            rowErrors.push('Un. Neg. está vazia (obrigatório)');
          } else {
            businessUnitsInFile.add(businessUnit);
          }

          if (!transactionDate) {
            rowErrors.push('Data Hora está vazia ou inválida (obrigatório)');
          }

          if (isValorEmpty) {
            rowErrors.push('Valor está vazio (obrigatório)');
          } else if (isNaN(amount)) {
            rowErrors.push(`Valor inválido (não é um número): "${valorOriginal}"`);
          }

          // Verificar se linha está vazia
          const isRowEmpty = !businessUnit && !chartOfAccountsOriginal && !transactionDate && isValorEmpty;
          if (isRowEmpty) {
            stats.skippedEmpty++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Linha vazia',
              category: 'vazia'
            });
            continue;
          }

          // Se houver erros, rejeitar a planilha inteira (não apenas ignorar a linha)
          if (rowErrors.length > 0) {
            validationErrors.invalidRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              errors: rowErrors
            });
            // Não continuar processando - a planilha será rejeitada
            // Continuamos coletando todos os erros para mostrar ao usuário
          }

          // Processar status (pode ser vazio = null)
          const statusValue = String(row[columnMap.status] || '').trim();
          let status: 'realizado' | 'previsto' | null = null;
          if (statusValue) {
            status = normalizeStatus(statusValue);
          }

          // Processar campos opcionais
          const transaction: any = {
            status,
            business_unit: businessUnit,
            chart_of_accounts: chartOfAccounts,
            transaction_date: transactionDate!.split('T')[0], // Apenas a data
            amount
          };

          if (columnMap.numDoc !== undefined) {
            const numDoc = String(row[columnMap.numDoc] || '').trim();
            if (numDoc) transaction.num_doc = numDoc;
          }

          if (columnMap.contaCorrente !== undefined) {
            const contaCorrente = String(row[columnMap.contaCorrente] || '').trim();
            if (contaCorrente) transaction.conta_corrente = contaCorrente;
          }

          if (columnMap.origem !== undefined) {
            const origem = String(row[columnMap.origem] || '').trim();
            if (origem) transaction.origem = origem;
          }

          if (columnMap.descricao !== undefined) {
            const descricao = String(row[columnMap.descricao] || '').trim();
            if (descricao) transaction.descricao = descricao;
          }

          if (columnMap.dataHoraInclusao !== undefined) {
            const dataHoraInclusao = parseDateTime(row[columnMap.dataHoraInclusao]);
            if (dataHoraInclusao) transaction.data_hora_inclusao = dataHoraInclusao;
          }

          if (columnMap.usuario !== undefined) {
            const usuario = String(row[columnMap.usuario] || '').trim();
            if (usuario) transaction.usuario = usuario;
          }

          transactions.push(transaction);
          stats.processed++;
        }

        // Se houver linhas inválidas, rejeitar a planilha inteira
        if (validationErrors.invalidRows.length > 0) {
          console.error('❌ PLANILHA REJEITADA - Linhas inválidas encontradas:');
          validationErrors.invalidRows.forEach(invRow => {
            console.error(`   Linha ${invRow.lineNumber}: ${invRow.errors.join('; ')}`);
          });
          resolve({
            data: [],
            validationErrors,
            skippedRows,
            stats
          });
          return;
        }

        // Validar business units
        if (validBusinessUnits && validBusinessUnits.length > 0) {
          const invalidUnits = Array.from(businessUnitsInFile).filter(
            unit => {
              const normalizedUnit = String(parseInt(unit) || unit);
              return !validBusinessUnits.includes(unit) && 
                     !validBusinessUnits.includes(normalizedUnit) &&
                     !validBusinessUnits.some(vu => String(parseInt(vu) || vu) === normalizedUnit);
            }
          );
          
          if (invalidUnits.length > 0) {
            validationErrors.invalidBusinessUnits = invalidUnits;
          }
        }

        console.log('📊 RESUMO LANÇAMENTOS FINANCEIROS:');
        console.log(`   ✅ Processadas: ${stats.processed}`);
        console.log(`   ⏭️  Ignoradas (cabeçalho/rodapé): ${stats.skippedHeaderFooter}`);
        console.log(`   ⏭️  Ignoradas (vazias): ${stats.skippedEmpty}`);
        console.log(`   📦 Total de registros para inserir: ${transactions.length}`);

        resolve({
          data: transactions,
          validationErrors,
          skippedRows,
          stats
        });
      } catch (error) {
        console.error('Error processing financial transactions file:', error);
        resolve({
          data: [],
          validationErrors: {
            missingColumns: [],
            invalidRows: [],
            invalidBusinessUnits: []
          },
          skippedRows: [],
          stats: {
            totalRows: 0,
            processed: 0,
            skippedEmpty: 0,
            skippedHeaderFooter: 0,
            invalid: 0
          }
        });
      }
    };

    reader.onerror = () => {
      resolve({
        data: [],
        validationErrors: {
          missingColumns: [],
          invalidRows: [],
          invalidBusinessUnits: []
        },
        skippedRows: [],
        stats: {
          totalRows: 0,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        }
      });
    };
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

            const parsedAmount = parseBrazilianNumber(amount);
            if (isNaN(parsedAmount) || parsedAmount === 0) {
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

            const parsedAmount = parseBrazilianNumber(amount);
            if (isNaN(parsedAmount) || parsedAmount === 0) {
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

            const parsedAmount = parseBrazilianNumber(balanceRaw);
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

            const parsedAmount = parseBrazilianNumber(budgetAmount);
            if (isNaN(parsedAmount) || parsedAmount === 0) {
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

export const processReceitaCrediarioFile = (
  file: File,
  validBusinessUnits?: string[]
): Promise<ProcessResult<ReceitaCrediario>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('Arquivo vazio ou não pôde ser lido');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('O arquivo não contém planilhas válidas.');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const receitasCrediario: ReceitaCrediario[] = [];
        const validationErrors = {
          missingColumns: [] as string[],
          invalidRows: [] as Array<{
            lineNumber: number;
            rowContent: any[];
            errors: string[];
          }>,
          invalidBusinessUnits: [] as string[]
        };
        const skippedRows: Array<{
          lineNumber: number;
          rowContent: any[];
          reason: string;
          category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado';
        }> = [];
        const stats = {
          totalRows: 0,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        };

        console.log('📊 RECEITA CREDIÁRIO - Total de linhas na planilha:', jsonData.length);
        console.log('📊 RECEITA CREDIÁRIO - Primeiras 3 linhas:', jsonData.slice(0, 3));

        // Função para identificar linhas de rodapé/total (não cabeçalho)
        const isFooterRow = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const rowText = row.map(cell => String(cell || '').toLowerCase().trim()).join(' ');
          
          // Rodapé tem características específicas: Total, Soma, Média, etc.
          const isFooterPattern = 
            rowText.includes('total') ||
            rowText.includes('soma') ||
            rowText.includes('média') ||
            rowText.includes('media') ||
            rowText.includes('usuário:') ||
            rowText.includes('usuario:') ||
            (rowText.includes('impressão') && !rowText.includes('data')) ||
            (rowText.includes('impressao') && !rowText.includes('data')) ||
            (rowText.includes('print') && !rowText.includes('data')) ||
            (rowText.includes('unidade de negócio:') || rowText.includes('unidade de negocio:')) ||
            (rowText.includes('página') || rowText.includes('pagina'));
          
          return isFooterPattern;
        };
        
        // Função para verificar se uma linha parece ser um cabeçalho (tem nomes de colunas)
        const looksLikeHeader = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          
          // Um cabeçalho deve ter pelo menos algumas palavras-chave de colunas
          const hasColumnKeywords = rowHeaders.some(h => 
            h.includes('data receb') ||
            h.includes('un neg') ||
            h.includes('parcela') ||
            h.includes('recebimento') ||
            h.includes('juros') ||
            h.includes('multa') ||
            h.includes('taxa') ||
            h.includes('dias')
          );
          
          // Não deve ser um rodapé
          return hasColumnKeywords && !isFooterRow(row);
        };

        // Encontrar a linha de cabeçalho real
        let headerRowIndex = -1;
        const expectedColumnNames = {
          dataReceb: ['data receb', 'data_receb', 'data recebimento'],
          unNegReceb: ['un neg receb', 'un.neg receb', 'un. neg receb', 'unidade negócio receb', 'unidade negocio receb'],
          parcela: ['parcela'],
          recebimento: ['recebimento', 'recebiment'],
          percentualTotal: ['%tot', '% tot', 'percentual total', 'percentual_total'],
          juros: ['juros', 'juro'],
          percentualJuros: ['% juros', '%juros', 'percentual juros', 'percentual_juros'],
          multa: ['multa', 'mult'],
          percentualMulta: ['% multa', '%multa', 'percentual multa', 'percentual_multa'],
          taxaConv: ['taxa conv', 'taxa_conv', 'taxa conversão', 'taxa conversao'],
          percentualTaxaConv: ['% taxa conv', '%taxa conv', '% taxa_conv', 'percentual taxa conv', 'percentual_taxa_conv'],
          diasReceb: ['dias receb', 'dias_receb', 'dias recebimento'],
          diasAtraso: ['dias atraso', 'dias_atraso', 'dias']
        };
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          // Primeiro verificar se parece ser um cabeçalho
          if (!looksLikeHeader(row) && isFooterRow(row)) {
            continue;
          }
          
          const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
          
          const foundDataReceb = rowHeaders.some(h => expectedColumnNames.dataReceb.some(name => h.includes(name)));
          const foundUnNegReceb = rowHeaders.some(h => expectedColumnNames.unNegReceb.some(name => h.includes(name)));
          const foundRecebimento = rowHeaders.some(h => expectedColumnNames.recebimento.some(name => h.includes(name)));
          
          // VALIDAÇÃO 1: Verificar se todas as colunas obrigatórias estão presentes
          if (foundDataReceb && foundUnNegReceb && foundRecebimento) {
            headerRowIndex = i;
            console.log(`✅ Cabeçalho encontrado na linha ${i + 1}:`, rowHeaders);
            break;
          }
        }

        if (headerRowIndex === -1) {
          const missingCols: string[] = [];
          let testRowIndex = -1;
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;
            
            if (isFooterRow(row) && !looksLikeHeader(row)) continue;
            const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
            if (rowHeaders.some(h => expectedColumnNames.dataReceb.some(n => h.includes(n))) ||
                rowHeaders.some(h => expectedColumnNames.unNegReceb.some(n => h.includes(n)))) {
              testRowIndex = i;
              break;
            }
          }
          
          if (testRowIndex >= 0) {
            const testRow = jsonData[testRowIndex] as any[];
            const rowHeaders = testRow.map(cell => String(cell || '').toLowerCase().trim());
            const rawHeaders = testRow.map(cell => String(cell || '').trim());
            
            if (!rowHeaders.some(h => expectedColumnNames.dataReceb.some(n => h.includes(n)))) {
              missingCols.push('Data Receb');
            }
            if (!rowHeaders.some(h => expectedColumnNames.unNegReceb.some(n => h.includes(n)))) {
              missingCols.push('Un. Neg. Receb');
            }
            if (!rowHeaders.some(h => expectedColumnNames.recebimento.some(n => h.includes(n)))) {
              missingCols.push('Recebimento');
            }
            
            console.error('❌ Erro ao processar arquivo de Receita Crediário');
            console.error(`📋 Linha ${testRowIndex + 1} analisada (raw):`, rawHeaders);
            console.error(`❌ Colunas faltando:`, missingCols);
          }
          
          let errorMsg = 'O arquivo de Receita Crediário não foi aceito porque não foram encontradas todas as colunas obrigatórias.\n\n';
          
          if (testRowIndex >= 0 && missingCols.length > 0) {
            errorMsg += `❌ Colunas obrigatórias faltando: ${missingCols.join(', ')}\n\n`;
            errorMsg += 'Colunas obrigatórias esperadas:\n';
            errorMsg += '• Data Receb\n';
            errorMsg += '• Un. Neg. Receb\n';
            errorMsg += '• Recebimento\n\n';
            
            const testRow = jsonData[testRowIndex] as any[];
            const rawHeaders = testRow.map(cell => String(cell || '').trim()).filter(h => h && h.length > 0);
            if (rawHeaders.length > 0) {
              errorMsg += `Colunas encontradas no arquivo: ${rawHeaders.join(', ')}`;
            }
          } else {
            errorMsg += 'Não foi possível encontrar a linha de cabeçalho com as colunas esperadas.\n\n';
            errorMsg += 'Colunas obrigatórias esperadas:\n';
            errorMsg += '• Data Receb\n';
            errorMsg += '• Un. Neg. Receb\n';
            errorMsg += '• Recebimento';
          }
          
          throw new Error(errorMsg);
        }

        // Mapear índices das colunas
        const headerRow = jsonData[headerRowIndex] as any[];
        const columnMap: { [key: string]: number } = {};
        
        headerRow.forEach((cell, index) => {
          const cellText = String(cell || '').toLowerCase().trim();
          
          if (expectedColumnNames.dataReceb.some(name => cellText.includes(name)) && !columnMap.dataReceb) {
            columnMap.dataReceb = index;
          }
          if (expectedColumnNames.unNegReceb.some(name => cellText.includes(name)) && !columnMap.unNegReceb) {
            columnMap.unNegReceb = index;
          }
          if (expectedColumnNames.parcela.some(name => cellText.includes(name)) && !columnMap.parcela) {
            columnMap.parcela = index;
          }
          if (expectedColumnNames.recebimento.some(name => cellText.includes(name)) && !columnMap.recebimento) {
            columnMap.recebimento = index;
          }
          if (expectedColumnNames.percentualTotal.some(name => cellText.includes(name)) && !columnMap.percentualTotal) {
            columnMap.percentualTotal = index;
          }
          if (expectedColumnNames.juros.some(name => cellText.includes(name)) && !columnMap.juros) {
            columnMap.juros = index;
          }
          if (expectedColumnNames.percentualJuros.some(name => cellText.includes(name)) && !columnMap.percentualJuros) {
            columnMap.percentualJuros = index;
          }
          if (expectedColumnNames.multa.some(name => cellText.includes(name)) && !columnMap.multa) {
            columnMap.multa = index;
          }
          if (expectedColumnNames.percentualMulta.some(name => cellText.includes(name)) && !columnMap.percentualMulta) {
            columnMap.percentualMulta = index;
          }
          if (expectedColumnNames.taxaConv.some(name => cellText.includes(name)) && !columnMap.taxaConv) {
            columnMap.taxaConv = index;
          }
          if (expectedColumnNames.percentualTaxaConv.some(name => cellText.includes(name)) && !columnMap.percentualTaxaConv) {
            columnMap.percentualTaxaConv = index;
          }
          if (expectedColumnNames.diasReceb.some(name => cellText.includes(name)) && !columnMap.diasReceb) {
            columnMap.diasReceb = index;
          }
          if (expectedColumnNames.diasAtraso.some(name => cellText.includes(name)) && !columnMap.diasAtraso) {
            columnMap.diasAtraso = index;
          }
        });

        console.log('📋 Mapeamento de colunas encontrado:', columnMap);

        // VALIDAÇÃO 2: Verificar se todas as colunas obrigatórias foram mapeadas
        const requiredColumns = ['dataReceb', 'unNegReceb', 'recebimento'];
        const missingMappedCols = requiredColumns.filter(col => columnMap[col] === undefined);
        
        if (missingMappedCols.length > 0) {
          const colNames: { [key: string]: string } = {
            dataReceb: 'Data Receb',
            unNegReceb: 'Un. Neg. Receb',
            recebimento: 'Recebimento'
          };
          throw new Error(`Colunas obrigatórias não encontradas no cabeçalho: ${missingMappedCols.map(c => colNames[c]).join(', ')}`);
        }

        // Função auxiliar para converter data
        const parseDate = (dateValue: any): string => {
          if (!dateValue) return '';
          
          if (typeof dateValue === 'number') {
            const date = new Date((dateValue - 25569) * 86400 * 1000);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
          } else if (typeof dateValue === 'string') {
            const str = String(dateValue).trim();
            
            // Formato DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY
            const dateTimeMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
            if (dateTimeMatch) {
              const day = dateTimeMatch[1].padStart(2, '0');
              const month = dateTimeMatch[2].padStart(2, '0');
              const year = dateTimeMatch[3].length === 2 ? `20${dateTimeMatch[3]}` : dateTimeMatch[3];
              const date = new Date(`${year}-${month}-${day}`);
              if (!isNaN(date.getTime())) {
                return `${year}-${month}-${day}`;
              }
            }
            
            // Tentar parse direto como ISO string
            const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}/);
            if (isoMatch) {
              return isoMatch[0];
            }
            
            const dateObj = new Date(str);
            if (!isNaN(dateObj.getTime())) {
              return dateObj.toISOString().split('T')[0];
            }
          } else if (dateValue instanceof Date) {
            if (!isNaN(dateValue.getTime())) {
              return dateValue.toISOString().split('T')[0];
            }
          }
          
          return '';
        };

        // Função para verificar se uma linha é cabeçalho (nomes das colunas)
        const isHeaderRow = (row: any[], rowIndex: number): boolean => {
          if (rowIndex === headerRowIndex) return true;
          
          if (!row || row.length === 0) return false;
          
          const headerRow = jsonData[headerRowIndex] as any[];
          const headerCells = headerRow.map(cell => String(cell || '').toLowerCase().trim());
          const rowCells = row.map(cell => String(cell || '').toLowerCase().trim());
          
          // Verificar se a linha tem muitos valores similares ao cabeçalho
          const matchingCells = rowCells.filter((cell, idx) => 
            headerCells[idx] && cell && cell === headerCells[idx]
          );
          
          return matchingCells.length >= 3; // Se 3 ou mais células coincidem, provavelmente é cabeçalho
        };

        // Coletar business units únicas da planilha para validação
        const businessUnitsInFile = new Set<string>();

        // Processar linhas
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          stats.totalRows++;

          // Ignorar linhas de cabeçalho (nomes das colunas duplicados)
          if (isHeaderRow(row, i)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Cabeçalho duplicado (linha contém nomes de colunas)',
              category: 'cabeçalho'
            });
            continue;
          }

          // Ignorar linhas de rodapé/total
          if (isFooterRow(row)) {
            stats.skippedHeaderFooter++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Rodapé/Total (linha contém Total, Soma, Média, etc.)',
              category: 'rodapé'
            });
            continue;
          }

          // Verificar se a linha está vazia
          const dataRecebValue = row[columnMap.dataReceb];
          const unNegRecebValue = row[columnMap.unNegReceb];
          const recebimentoValue = row[columnMap.recebimento];
          
          const isRowEmpty = (!dataRecebValue || String(dataRecebValue).trim() === '') &&
                            (!unNegRecebValue || String(unNegRecebValue).trim() === '') &&
                            (!recebimentoValue || String(recebimentoValue).trim() === '');
          
          if (isRowEmpty) {
            stats.skippedEmpty++;
            skippedRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              reason: 'Linha vazia',
              category: 'vazia'
            });
            continue;
          }

          // Validar campos obrigatórios
          const rowErrors: string[] = [];
          
          // Validar Data Receb (obrigatório)
          const dataReceb = parseDate(dataRecebValue);
          if (!dataReceb) {
            rowErrors.push('Data Receb está vazia ou inválida (obrigatório)');
          }
          
          // Validar Un. Neg. Receb (obrigatório)
          const unNegReceb = String(unNegRecebValue || '').trim();
          if (!unNegReceb) {
            rowErrors.push('Un. Neg. Receb está vazia (obrigatório)');
          } else {
            businessUnitsInFile.add(unNegReceb);
          }
          
          // Validar Recebimento (obrigatório)
          const recebimento = parseBrazilianNumber(recebimentoValue);
          if (recebimentoValue === null || recebimentoValue === undefined || recebimentoValue === '' ||
              (typeof recebimentoValue === 'string' && recebimentoValue.trim() === '')) {
            rowErrors.push('Recebimento está vazio (obrigatório)');
          } else if (isNaN(recebimento)) {
            rowErrors.push(`Recebimento inválido (não é um número): "${recebimentoValue}"`);
          }

          // Se houver erros, adicionar à lista de linhas inválidas
          if (rowErrors.length > 0) {
            stats.invalid++;
            validationErrors.invalidRows.push({
              lineNumber: i + 1,
              rowContent: [...row],
              errors: rowErrors
            });
            continue;
          }

          // Processar campos opcionais
          const parcela = columnMap.parcela !== undefined ? String(row[columnMap.parcela] || '').trim() : undefined;
          const percentualTotal = columnMap.percentualTotal !== undefined ? parseBrazilianNumber(row[columnMap.percentualTotal]) : undefined;
          const juros = columnMap.juros !== undefined ? parseBrazilianNumber(row[columnMap.juros]) : undefined;
          const percentualJuros = columnMap.percentualJuros !== undefined ? parseBrazilianNumber(row[columnMap.percentualJuros]) : undefined;
          const multa = columnMap.multa !== undefined ? parseBrazilianNumber(row[columnMap.multa]) : undefined;
          const percentualMulta = columnMap.percentualMulta !== undefined ? parseBrazilianNumber(row[columnMap.percentualMulta]) : undefined;
          const taxaConv = columnMap.taxaConv !== undefined ? parseBrazilianNumber(row[columnMap.taxaConv]) : undefined;
          const percentualTaxaConv = columnMap.percentualTaxaConv !== undefined ? parseBrazilianNumber(row[columnMap.percentualTaxaConv]) : undefined;
          const diasReceb = columnMap.diasReceb !== undefined ? parseBrazilianNumber(row[columnMap.diasReceb]) : undefined;
          const diasAtraso = columnMap.diasAtraso !== undefined ? parseBrazilianNumber(row[columnMap.diasAtraso]) : undefined;

          const receitaCrediario: any = {
            data_receb: dataReceb,
            business_unit: unNegReceb,
            recebimento: recebimento
          };

          // Adicionar campos opcionais apenas se existirem
          if (parcela) receitaCrediario.parcela = parcela;
          if (percentualTotal !== undefined && !isNaN(percentualTotal)) receitaCrediario.percentual_total = percentualTotal;
          if (juros !== undefined && !isNaN(juros)) receitaCrediario.juros = juros;
          if (percentualJuros !== undefined && !isNaN(percentualJuros)) receitaCrediario.percentual_juros = percentualJuros;
          if (multa !== undefined && !isNaN(multa)) receitaCrediario.multa = multa;
          if (percentualMulta !== undefined && !isNaN(percentualMulta)) receitaCrediario.percentual_multa = percentualMulta;
          if (taxaConv !== undefined && !isNaN(taxaConv)) receitaCrediario.taxa_conv = taxaConv;
          if (percentualTaxaConv !== undefined && !isNaN(percentualTaxaConv)) receitaCrediario.percentual_taxa_conv = percentualTaxaConv;
          if (diasReceb !== undefined && !isNaN(diasReceb)) receitaCrediario.dias_receb = diasReceb;
          if (diasAtraso !== undefined && !isNaN(diasAtraso)) receitaCrediario.dias_atraso = diasAtraso;

          receitasCrediario.push(receitaCrediario);
          stats.processed++;
        }

        // VALIDAÇÃO 3: Validar business units contra o banco
        if (validBusinessUnits && validBusinessUnits.length > 0) {
          const invalidUnits = Array.from(businessUnitsInFile).filter(
            unit => {
              const normalizedUnit = String(parseInt(unit) || unit);
              return !validBusinessUnits.includes(unit) && 
                     !validBusinessUnits.includes(normalizedUnit) &&
                     !validBusinessUnits.some(vu => String(parseInt(vu) || vu) === normalizedUnit);
            }
          );
          
          if (invalidUnits.length > 0) {
            validationErrors.invalidBusinessUnits = invalidUnits;
          }
        }

        console.log('📊 RESUMO RECEITA CREDIÁRIO:');
        console.log(`   ✅ Processadas com sucesso: ${stats.processed}`);
        console.log(`   ⏭️  Ignoradas (cabeçalho/rodapé): ${stats.skippedHeaderFooter}`);
        console.log(`   ⏭️  Ignoradas (vazias): ${stats.skippedEmpty}`);
        console.log(`   ❌ Inválidas (erros de validação): ${stats.invalid}`);
        console.log(`   📦 Registros válidos para inserir: ${receitasCrediario.length}`);

        resolve({
          data: receitasCrediario,
          validationErrors,
          skippedRows,
          stats
        });
      } catch (error: any) {
        console.error('❌ Erro ao processar arquivo de Receita Crediário:', error);
        reject(error);
      }
    };

    reader.onerror = (error) => {
      console.error('❌ Erro ao ler arquivo:', error);
      reject(new Error('Falha ao ler o arquivo. Verifique se o arquivo está corrompido.'));
    };

    reader.readAsBinaryString(file);
  });
};

// Tipo para registro de vendas por usuário (insert, sem id/created_at/updated_at)
export type VendasPorUsuarioInsert = Omit<VendasPorUsuario, 'id' | 'created_at' | 'updated_at'> & {
  business_unit: string;
  data: string;
  usuario: string;
  amount: number;
  custo?: number;
  lucro?: number;
  qtd_vendas?: number;
  qtd_itens?: number;
  percentual_total?: number;
  desconto?: number;
  percentual_desconto?: number;
  percentual_custo?: number;
  percentual_lucro?: number;
  ticket_medio?: number;
  valor_medio?: number;
};

export const processVendasPorUsuarioFile = (
  file: File,
  validBusinessUnits?: string[]
): Promise<ProcessResult<VendasPorUsuarioInsert>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Arquivo vazio ou não pôde ser lido');

        const workbook = XLSX.read(data, { type: 'binary' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('O arquivo não contém planilhas válidas.');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const records: VendasPorUsuarioInsert[] = [];
        const validationErrors = {
          missingColumns: [] as string[],
          invalidRows: [] as Array<{ lineNumber: number; rowContent: any[]; errors: string[] }>,
          invalidBusinessUnits: [] as string[]
        };
        const skippedRows: Array<{ lineNumber: number; rowContent: any[]; reason: string; category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida' | 'metadado' }> = [];
        const stats = { totalRows: 0, processed: 0, skippedEmpty: 0, skippedHeaderFooter: 0, invalid: 0 };

        const parseDate = (dateValue: any): string => {
          if (!dateValue) return '';
          if (typeof dateValue === 'number') {
            const date = new Date((dateValue - 25569) * 86400 * 1000);
            return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
          }
          const str = String(dateValue).trim();
          const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
          if (m) {
            const d = m[1].padStart(2, '0');
            const mo = m[2].padStart(2, '0');
            const y = m[3].length === 2 ? `20${m[3]}` : m[3];
            return `${y}-${mo}-${d}`;
          }
          if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
          const d = new Date(str);
          return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
        };

        const isTitleRow = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const text = row.map(c => String(c || '').toLowerCase().trim()).join(' ');
          return text.includes('análise de venda') || text.includes('analise de venda');
        };

        const extractCodUnNeg = (row: any[]): string | null => {
          if (!row || row.length === 0) return null;
          const first = String(row[0] || '').trim();
          const match = first.match(/cód\.\s*un\.\s*neg\.?\s*:?\s*(\d+)/i) || first.match(/cod\.\s*un\.\s*neg\.?\s*:?\s*(\d+)/i);
          if (match) return match[1].trim();
          const full = row.map(c => String(c || '').trim()).join(' ');
          const m2 = full.match(/cód\.\s*un\.\s*neg\.?\s*:?\s*(\d+)/i) || full.match(/cod\.\s*un\.\s*neg\.?\s*:?\s*(\d+)/i);
          return m2 ? m2[1].trim() : null;
        };

        const extractDataFromRow = (row: any[]): string | null => {
          if (!row || row.length === 0) return null;
          const full = row.map(c => String(c || '').trim()).join(' ');
          const m = full.match(/data\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
          return m ? parseDate(m[1]) || null : null;
        };

        const isTotalOrSomaRow = (row: any[]): boolean => {
          if (!row || row.length === 0) return false;
          const full = row.map(c => String(c || '').toLowerCase().trim()).join(' ');
          const first = String(row[0] || '').toLowerCase().trim();
          const second = row.length > 1 ? String(row[1] || '').toLowerCase().trim() : '';
          const third = row.length > 2 ? String(row[2] || '').toLowerCase().trim() : '';
          const fourth = row.length > 3 ? String(row[3] || '').toLowerCase().trim() : '';
          const fifth = row.length > 4 ? String(row[4] || '').toLowerCase().trim() : '';

          // Qualquer célula entre a 1ª e a 5ª contendo "total" ou "soma" caracteriza linha de total
          if ([first, second, third, fourth, fifth].some(c => c.includes('total'))) return true;
          if ([first, second, third, fourth, fifth].some(c => c.includes('soma'))) return true;

          // Padrões mais específicos em toda a linha
          if (full.includes('total cód') || full.includes('total cod') || full.includes('total un')) return true;
          if (full.includes('(soma)')) return true;

          if (first === 'total' || second === 'total') return true;
          return false;
        };

        const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim().toLowerCase();
        const expectedCols = {
          usuario: ['usuário', 'usuario'],
          venda: ['venda'],
          percentualTotal: ['% tot', '%tot', 'percentual total'],
          desconto: ['desconto'],
          percentualDesconto: ['% desc', '%desconto'],
          custo: ['custo'],
          percentualCusto: ['% custo', '%custo'],
          lucro: ['lucro'],
          percentualLucro: ['% lucro', '%lucro'],
          qtdVendas: ['qtd. vendas', 'qtd vendas', 'qtd de vendas', 'quantidade vendas', 'quantidade de vendas'],
          ticketMedio: ['ticket médio', 'ticket medio'],
          qtdItens: ['qtd. itens', 'qtd itens', 'qtd de itens', 'quantidade itens', 'quantidade de itens'],
          valorMedio: ['valor médio', 'valor medio']
        };

        const hasVendasPorUsuarioHeader = (row: any[]): boolean => {
          if (!row || row.length < 4) return false;
          const h = row.map((c: any) => norm(String(c || '')));
          const ok = (keys: string[]) => (name: string) => keys.some(k => name.includes(k));
          const hasUsuario = h.some(ok(expectedCols.usuario));
          const hasVenda = h.some(ok(expectedCols.venda));
          const hasCusto = h.some(ok(expectedCols.custo));
          const hasLucro = h.some(ok(expectedCols.lucro));
          const hasQtdVendas = h.some(x => (x.includes('qtd') || x.includes('quantidade')) && x.includes('vendas'));
          const hasQtdItens = h.some(x => (x.includes('qtd') || x.includes('quantidade')) && x.includes('itens'));
          return !!(hasUsuario && hasVenda && hasCusto && hasLucro && hasQtdVendas && hasQtdItens);
        };

        let currentBusinessUnit = '';
        let currentData = '';
        let headerRowIndex = -1;
        let columnMap: Record<string, number> = {};

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          if (isTitleRow(row)) {
            skippedRows.push({ lineNumber: i + 1, rowContent: [...row], reason: 'Cabeçalho (Análise de venda)', category: 'cabeçalho' });
            stats.skippedHeaderFooter++;
            continue;
          }

          const cod = extractCodUnNeg(row);
          if (cod !== null) {
            currentBusinessUnit = cod;
            skippedRows.push({ lineNumber: i + 1, rowContent: [...row], reason: 'Seção Cód. Un. Neg.', category: 'metadado' });
            stats.skippedHeaderFooter++;
            continue;
          }

          const dataStr = extractDataFromRow(row);
          if (dataStr !== null) {
            currentData = dataStr;
            skippedRows.push({ lineNumber: i + 1, rowContent: [...row], reason: 'Linha de Data', category: 'metadado' });
            stats.skippedHeaderFooter++;
            continue;
          }

          if (isTotalOrSomaRow(row)) {
            skippedRows.push({ lineNumber: i + 1, rowContent: [...row], reason: 'Total / Soma (ignorar)', category: 'rodapé' });
            stats.skippedHeaderFooter++;
            continue;
          }

          if (hasVendasPorUsuarioHeader(row)) {
            headerRowIndex = i;
            columnMap = {};
            const headerRow = row.map((c: any) => norm(String(c || '')));
            headerRow.forEach((cell, idx) => {
              const c = cell;
              if (expectedCols.usuario.some(k => c.includes(k))) columnMap.usuario = idx;
              else if ((c.includes('qtd') || c.includes('quantidade')) && c.includes('vendas')) columnMap.qtdVendas = idx;
              else if ((c.includes('qtd') || c.includes('quantidade')) && c.includes('itens')) columnMap.qtdItens = idx;
              else if (expectedCols.venda.some(k => c.includes(k))) columnMap.venda = idx;
              else if (expectedCols.percentualTotal.some(k => c.includes(k))) columnMap.percentualTotal = idx;
              else if (expectedCols.desconto.some(k => c.includes(k))) columnMap.desconto = idx;
              else if ((c.includes('%') && c.includes('desc')) || (c === '%' && columnMap.desconto !== undefined && idx === columnMap.desconto + 1)) columnMap.percentualDesconto = idx;
              else if (expectedCols.custo.some(k => c.includes(k))) columnMap.custo = idx;
              else if ((c.includes('%') && c.includes('custo')) || (c === '%' && columnMap.custo !== undefined && idx === columnMap.custo + 1)) columnMap.percentualCusto = idx;
              else if (expectedCols.lucro.some(k => c.includes(k))) columnMap.lucro = idx;
              else if ((c.includes('%') && c.includes('lucro')) || (c === '%' && columnMap.lucro !== undefined && idx === columnMap.lucro + 1)) columnMap.percentualLucro = idx;
              else if (expectedCols.ticketMedio.some(k => c.includes(k))) columnMap.ticketMedio = idx;
              else if (expectedCols.valorMedio.some(k => c.includes(k))) columnMap.valorMedio = idx;
            });
            if (columnMap.percentualCusto === undefined && columnMap.custo !== undefined) {
              const nextIdx = columnMap.custo + 1;
              if (nextIdx < row.length && String(row[nextIdx] || '').trim() === '%') columnMap.percentualCusto = nextIdx;
            }
            if (columnMap.percentualLucro === undefined && columnMap.lucro !== undefined) {
              const nextIdx = columnMap.lucro + 1;
              if (nextIdx < row.length && String(row[nextIdx] || '').trim() === '%') columnMap.percentualLucro = nextIdx;
            }
            skippedRows.push({ lineNumber: i + 1, rowContent: [...row], reason: 'Cabeçalho de colunas', category: 'cabeçalho' });
            stats.skippedHeaderFooter++;
            continue;
          }

          if (headerRowIndex === -1) continue;

          stats.totalRows++;
          const usuarioVal = columnMap.usuario !== undefined ? row[columnMap.usuario] : undefined;
          const vendaVal = columnMap.venda !== undefined ? row[columnMap.venda] : undefined;
          const custoVal = columnMap.custo !== undefined ? row[columnMap.custo] : undefined;
          const lucroVal = columnMap.lucro !== undefined ? row[columnMap.lucro] : undefined;
          const qtdVendasVal = columnMap.qtdVendas !== undefined ? row[columnMap.qtdVendas] : undefined;
          const qtdItensVal = columnMap.qtdItens !== undefined ? row[columnMap.qtdItens] : undefined;

          const usuario = usuarioVal != null ? String(usuarioVal).trim() : '';
          const isEmpty = (!usuarioVal || usuario === '') && (vendaVal === undefined || vendaVal === null || vendaVal === '') && (custoVal === undefined || custoVal === null || custoVal === '') && (lucroVal === undefined || lucroVal === null || lucroVal === '');
          if (isEmpty) {
            stats.skippedEmpty++;
            skippedRows.push({ lineNumber: i + 1, rowContent: [...row], reason: 'Linha vazia', category: 'vazia' });
            continue;
          }

          const rowErrors: string[] = [];
          if (!currentBusinessUnit) rowErrors.push('Unidade de negócio (Cód. Un. Neg.) é obrigatória');
          if (!currentData) rowErrors.push('Data é obrigatória');
          if (!usuario) rowErrors.push('Usuário é obrigatório');
          const amount = parseBrazilianNumber(vendaVal);
          if (vendaVal === undefined || vendaVal === null || (typeof vendaVal === 'string' && String(vendaVal).trim() === '')) rowErrors.push('Venda é obrigatória');
          else if (isNaN(amount)) rowErrors.push(`Venda inválida (não é número): "${vendaVal}"`);
          const custo = custoVal !== undefined && custoVal !== null && String(custoVal).trim() !== '' ? parseBrazilianNumber(custoVal) : undefined;
          if (custoVal === undefined || custoVal === null || (typeof custoVal === 'string' && String(custoVal).trim() === '')) rowErrors.push('Custo é obrigatório');
          else if (custo !== undefined && isNaN(custo)) rowErrors.push(`Custo inválido: "${custoVal}"`);
          const lucro = lucroVal !== undefined && lucroVal !== null && String(lucroVal).trim() !== '' ? parseBrazilianNumber(lucroVal) : undefined;
          if (lucroVal === undefined || lucroVal === null || (typeof lucroVal === 'string' && String(lucroVal).trim() === '')) rowErrors.push('Lucro é obrigatório');
          else if (lucro !== undefined && isNaN(lucro)) rowErrors.push(`Lucro inválido: "${lucroVal}"`);
          const qtdVendas = qtdVendasVal !== undefined && qtdVendasVal !== null && String(qtdVendasVal).trim() !== '' ? parseBrazilianNumber(qtdVendasVal) : undefined;
          if (qtdVendasVal === undefined || qtdVendasVal === null || (typeof qtdVendasVal === 'string' && String(qtdVendasVal).trim() === '')) rowErrors.push('Qtd. Vendas é obrigatória');
          else if (qtdVendas !== undefined && (isNaN(qtdVendas) || qtdVendas < 0)) rowErrors.push(`Qtd. Vendas inválida: "${qtdVendasVal}"`);
          const qtdItens = qtdItensVal !== undefined && qtdItensVal !== null && String(qtdItensVal).trim() !== '' ? parseBrazilianNumber(qtdItensVal) : undefined;
          if (qtdItensVal === undefined || qtdItensVal === null || (typeof qtdItensVal === 'string' && String(qtdItensVal).trim() === '')) rowErrors.push('Qtd. Itens é obrigatória');
          else if (qtdItens !== undefined && (isNaN(qtdItens) || qtdItens < 0)) rowErrors.push(`Qtd. Itens inválida: "${qtdItensVal}"`);

          if (rowErrors.length > 0) {
            stats.invalid++;
            validationErrors.invalidRows.push({ lineNumber: i + 1, rowContent: [...row], errors: rowErrors });
            continue;
          }

          const rec: VendasPorUsuarioInsert = {
            business_unit: currentBusinessUnit,
            usuario,
            data: currentData,
            amount: Number(amount),
            custo: custo !== undefined && !isNaN(custo) ? custo : 0,
            lucro: lucro !== undefined && !isNaN(lucro) ? lucro : 0,
            qtd_vendas: qtdVendas !== undefined && !isNaN(qtdVendas) ? Math.round(qtdVendas) : 0,
            qtd_itens: qtdItens !== undefined && !isNaN(qtdItens) ? Math.round(qtdItens) : 0
          };
          if (columnMap.percentualTotal !== undefined) { const v = parseBrazilianNumber(row[columnMap.percentualTotal]); if (!isNaN(v)) rec.percentual_total = v; }
          if (columnMap.desconto !== undefined) { const v = parseBrazilianNumber(row[columnMap.desconto]); if (!isNaN(v)) rec.desconto = v; }
          if (columnMap.percentualDesconto !== undefined) { const v = parseBrazilianNumber(row[columnMap.percentualDesconto]); if (!isNaN(v)) rec.percentual_desconto = v; }
          if (columnMap.percentualCusto !== undefined) { const v = parseBrazilianNumber(row[columnMap.percentualCusto]); if (!isNaN(v)) rec.percentual_custo = v; }
          if (columnMap.percentualLucro !== undefined) { const v = parseBrazilianNumber(row[columnMap.percentualLucro]); if (!isNaN(v)) rec.percentual_lucro = v; }
          if (columnMap.ticketMedio !== undefined) { const v = parseBrazilianNumber(row[columnMap.ticketMedio]); if (!isNaN(v)) rec.ticket_medio = v; }
          if (columnMap.valorMedio !== undefined) { const v = parseBrazilianNumber(row[columnMap.valorMedio]); if (!isNaN(v)) rec.valor_medio = v; }

          records.push(rec);
          stats.processed++;
        }

        if (validBusinessUnits && validBusinessUnits.length > 0) {
          const unitsInFile = new Set(records.map(r => r.business_unit));
          const invalidUnits = Array.from(unitsInFile).filter(
            u => !validBusinessUnits.includes(u) && !validBusinessUnits.some(vu => String(parseInt(vu) || vu) === String(parseInt(u) || u))
          );
          validationErrors.invalidBusinessUnits = invalidUnits;
        }

        resolve({ data: records, validationErrors, skippedRows, stats });
      } catch (err: any) {
        console.error('Erro ao processar Entrega de Resultado:', err);
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsBinaryString(file);
  });
};