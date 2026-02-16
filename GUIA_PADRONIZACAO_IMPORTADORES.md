# 📚 Guia Completo - Padronização de Importadores

## 🎯 Objetivo
Este documento serve como guia completo para padronizar todos os importadores do sistema, usando o importador de **Contas a Pagar** como modelo de referência.

---

## 📋 ÍNDICE

1. [Resumo do que foi implementado](#1-resumo-do-que-foi-implementado)
2. [Estrutura de Validações](#2-estrutura-de-validações)
3. [Guia Passo a Passo para Replicar](#3-guia-passo-a-passo-para-replicar)
4. [Código de Referência](#4-código-de-referência)
5. [Checklist Completo](#5-checklist-completo)

---

## 1. RESUMO DO QUE FOI IMPLEMENTADO

### ✅ 1.1 Validações Implementadas

#### Validação de Colunas Obrigatórias
- Verifica se todas as colunas obrigatórias estão presentes no cabeçalho
- Se faltar qualquer coluna → **ARQUIVO REJEITADO**
- Mensagem de erro específica indicando quais colunas estão faltando

#### Validação de Business Units
- Verifica se todas as unidades de negócio existem no banco de dados
- Se houver unidades inexistentes → **ARQUIVO REJEITADO**
- Lista todas as unidades inválidas com sugestão para cadastrar

#### Validação de Campos por Linha
- **Status**: Obrigatório, não aceita palavras aleatórias
- **Unidade de Negócio**: Obrigatório
- **Valor**: Obrigatório (não pode estar vazio)
- **Data de Vencimento**: Sempre obrigatório
- **Data Pagamento**: Obrigatório apenas se status = "realizado"
- **Plano de Contas**: Opcional (vira "(não identificado)" se vazio)
- **Credor**: Opcional (vira "(não identificado)" se vazio)

#### Detecção de Cabeçalhos e Rodapés
- Detecta e ignora cabeçalhos duplicados
- Detecta e ignora rodapés (informações de impressão, usuário, etc.)
- Não causam erro, apenas são registrados nas estatísticas

#### Normalização de Status
- Converte qualquer variação para "previsto" ou "realizado"
- Termos como "pago", "paga" → "realizado"
- Termos como "pendente", "aguardando" → "previsto"

#### Formato Numérico Brasileiro
- Processa números no formato brasileiro (vírgula = decimais, ponto = milhares)
- Exemplo: "1.170,50" → 1170.50

---

### ✅ 1.2 Sistema de Notificações

#### Componentes Criados
- `NotificationContext.tsx` - Context Provider para gerenciar notificações
- `NotificationCenter.tsx` - Componente de notificações (sino + aba)
- `ToastNotification.tsx` - Toast temporário (10 segundos)

#### Funcionalidades
- Notificações aparecem como toast por 10 segundos
- Fecham automaticamente e ficam salvas no histórico
- Persistem no `localStorage`
- Podem ser visualizadas, marcadas como lidas, removidas
- Relatórios podem ser visualizados (botão olho) ou baixados (TXT)

---

### ✅ 1.3 Tratamento de Erros

#### Rejeição de Arquivo
- Se houver linhas inválidas OU business units inválidas → **ARQUIVO REJEITADO**
- Nenhum dado é inserido no banco
- Notificação de erro com relatório completo

#### Relatório de Erros
- Resumo de erros por tipo
- Detalhamento de cada linha inválida
- Opção de visualizar (modal) ou baixar (TXT)

---

### ✅ 1.4 Log de Importação

- Cria registro em `importacoes` antes de processar
- Atualiza `record_count` após inserção
- Salva `import_id` em cada registro
- Progresso em tempo real: "Lendo e validando...", "Inserindo X/Y..."

---

## 2. ESTRUTURA DE VALIDAÇÕES

### 2.1 Interface ProcessResult

```typescript
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
  stats: {
    totalRows: number;
    processed: number;
    skippedEmpty: number;
    skippedHeaderFooter: number;
    invalid: number;
  };
  skippedRows: Array<{
    lineNumber: number;
    rowContent: any[];
    reason: string;
    category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida';
  }>;
}
```

### 2.2 Funções Auxiliares Necessárias

#### normalizeStatus()
```typescript
export const normalizeStatus = (status: string): 'previsto' | 'realizado' => {
  const statusLower = String(status || '').toLowerCase().trim();
  
  const realizedTerms = [
    'realizado', 'pago', 'recebido', 'quitado', 'efetivado', 
    'liquidado', 'concluído', 'finalizado'
  ];
  
  const forecastedTerms = [
    'previsto', 'pendente', 'aguardando', 'não pago', 
    'em aberto', 'programado', 'agendado'
  ];
  
  if (realizedTerms.some(term => statusLower.includes(term))) {
    return 'realizado';
  }
  if (forecastedTerms.some(term => statusLower.includes(term))) {
    return 'previsto';
  }
  
  return 'previsto'; // Default
};
```

#### parseBrazilianNumber()
```typescript
export const parseBrazilianNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  
  const str = String(value || '').trim();
  if (!str) return 0;
  
  // Formato brasileiro: "1.170,50"
  if (str.includes(',') && str.includes('.')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  // Apenas vírgula: "170,50"
  if (str.includes(',')) {
    return parseFloat(str.replace(',', '.'));
  }
  // Apenas ponto (pode ser milhares ou decimal)
  if (str.includes('.')) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount === 1) {
      return parseFloat(str); // Decimal americano
    } else {
      return parseFloat(str.replace(/\./g, '')); // Milhares brasileiro
    }
  }
  
  return parseFloat(str);
};
```

#### parseDate()
```typescript
const parseDate = (dateValue: any): string => {
  if (!dateValue) return '';
  
  if (typeof dateValue === 'number') {
    // Excel date serial number
    const date = new Date((dateValue - 25569) * 86400 * 1000);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }
  
  if (typeof dateValue === 'string') {
    const str = String(dateValue).trim();
    // Formato DD/MM/YYYY ou DD-MM-YYYY
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
    // Tentar ISO string
    const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
  }
  
  return '';
};
```

---

## 3. GUIA PASSO A PASSO PARA REPLICAR

### 📝 PASSO 1: Definir Estrutura do Importador

#### 1.1 Identificar Colunas Obrigatórias
Liste todas as colunas que **DEVEM** estar presentes:
```typescript
const expectedColumnNames = {
  campo1: ['nome da coluna', 'variação 1', 'variação 2'],
  campo2: ['nome da coluna', 'variação 1'],
  // ... etc
};
```

#### 1.2 Identificar Campos Obrigatórios por Linha
Defina quais campos são obrigatórios em cada linha:
- **Sempre obrigatórios**: campo1, campo2, campo3
- **Condicionais**: campo4 (obrigatório apenas se condição X)
- **Opcionais**: campo5, campo6 (viram "não identificado" se vazios)

#### 1.3 Identificar Campos que Precisam Normalização
- Status → normalizar para valores padrão
- Valores numéricos → usar `parseBrazilianNumber()`
- Datas → usar `parseDate()`

---

### 📝 PASSO 2: Modificar Função de Processamento

#### 2.1 Alterar Assinatura da Função
```typescript
// ANTES:
export const processMeuImportadorFile = (file: File): Promise<MeuTipo[]> => {
  // ...
}

// DEPOIS:
export const processMeuImportadorFile = (
  file: File, 
  validBusinessUnits?: string[] // Se precisar validar business units
): Promise<ProcessResult<MeuTipo>> => {
  // ...
}
```

#### 2.2 Criar Estrutura de Retorno
```typescript
const dados: MeuTipo[] = [];
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
  category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida';
}> = [];
const stats = {
  totalRows: 0,
  processed: 0,
  skippedEmpty: 0,
  skippedHeaderFooter: 0,
  invalid: 0
};
```

---

### 📝 PASSO 3: Implementar Validação de Cabeçalho

#### 3.1 Encontrar Linha de Cabeçalho
```typescript
let headerRowIndex = -1;

for (let i = 0; i < jsonData.length; i++) {
  const row = jsonData[i] as any[];
  if (!row || row.length === 0) continue;
  
  // Ignorar rodapés
  if (isHeaderFooterRow(row)) continue;
  
  const rowHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
  
  // Verificar se todas as colunas obrigatórias estão presentes
  const foundCampo1 = rowHeaders.some(h => expectedColumnNames.campo1.some(name => h.includes(name)));
  const foundCampo2 = rowHeaders.some(h => expectedColumnNames.campo2.some(name => h.includes(name)));
  // ... etc
  
  if (foundCampo1 && foundCampo2 && /* todas as outras */) {
    headerRowIndex = i;
    break;
  }
}

if (headerRowIndex === -1) {
  // Identificar quais colunas estão faltando
  const missingCols: string[] = [];
  // ... lógica para identificar colunas faltantes
  throw new Error(`Colunas obrigatórias não encontradas: ${missingCols.join(', ')}`);
}
```

#### 3.2 Mapear Índices das Colunas
```typescript
const headerRow = jsonData[headerRowIndex] as any[];
const columnMap: { [key: string]: number } = {};

headerRow.forEach((cell, index) => {
  const cellText = String(cell || '').toLowerCase().trim();
  
  if (expectedColumnNames.campo1.some(name => cellText.includes(name)) && !columnMap.campo1) {
    columnMap.campo1 = index;
  }
  // ... repetir para cada campo
});

// Validar se todas foram mapeadas
const requiredColumns = ['campo1', 'campo2', /* ... */];
const missingMappedCols = requiredColumns.filter(col => columnMap[col] === undefined);

if (missingMappedCols.length > 0) {
  throw new Error(`Colunas obrigatórias não encontradas no cabeçalho: ${missingMappedCols.join(', ')}`);
}
```

---

### 📝 PASSO 4: Implementar Validação de Linhas

#### 4.1 Processar Cada Linha
```typescript
for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
  const row = jsonData[i] as any[];
  stats.totalRows++;

  // Ignorar cabeçalhos duplicados
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

  // Ignorar rodapés
  if (isHeaderFooterRow(row)) {
    stats.skippedHeaderFooter++;
    skippedRows.push({
      lineNumber: i + 1,
      rowContent: [...row],
      reason: 'Rodapé',
      category: 'rodapé'
    });
    continue;
  }

  // Verificar se linha está vazia
  const allFieldsEmpty = /* verificar se todos os campos estão vazios */;
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
  
  // Validar cada campo obrigatório
  const campo1 = String(row[columnMap.campo1] || '').trim();
  if (!campo1) {
    rowErrors.push('Campo1 está vazio (obrigatório)');
  }
  
  // Validar campo numérico
  const valorOriginal = row[columnMap.valor];
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
  
  // Validar campo condicional
  if (condicao && !campoCondicional) {
    rowErrors.push('Campo condicional está vazio (obrigatório quando condição é verdadeira)');
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
  const registro: MeuTipo = {
    campo1: campo1,
    valor: amount,
    // ... outros campos
  };
  
  dados.push(registro);
  stats.processed++;
}
```

---

### 📝 PASSO 5: Validar Business Units (se aplicável)

```typescript
// Coletar business units únicas da planilha
const businessUnitsInFile = new Set<string>();
// ... adicionar durante processamento

// Validar contra o banco
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
```

---

### 📝 PASSO 6: Retornar ProcessResult

```typescript
resolve({
  data: dados,
  validationErrors,
  skippedRows,
  stats
});
```

---

### 📝 PASSO 7: Integrar no App.tsx

#### 7.1 Atualizar handleDataImport
```typescript
if (type === 'meu_importador') {
  // Obter business units válidas (se necessário)
  const validBusinessUnits = companies.map(c => normalizeCode(c.company_code));
  
  // Processar arquivo
  const result = await processMeuImportadorFile(file, validBusinessUnits);
  
  // Verificar erros
  if (result.validationErrors.invalidRows.length > 0 || 
      result.validationErrors.invalidBusinessUnits.length > 0) {
    // Criar notificação de erro
    const notificationId = addNotification({
      type: 'error',
      title: 'Erros na Importação',
      message: `Foram encontrados erros na planilha "${file.name}".`,
      data: {
        invalidRows: result.validationErrors.invalidRows,
        invalidBusinessUnits: result.validationErrors.invalidBusinessUnits,
        fileName: file.name
      }
    });
    setActiveToast(notificationId);
    return; // Não inserir dados
  }
  
  // Inserir dados no banco
  // ... lógica de inserção
  
  // Notificação de sucesso
  const successNotificationId = addNotification({
    type: 'success',
    title: 'Importação Concluída',
    message: `${recordCount} registro(s) foram importados com sucesso.`
  });
  setActiveToast(successNotificationId);
  
  // Notificação de linhas ignoradas (se houver)
  if (result.skippedRows && result.skippedRows.length > 0) {
    // ... criar notificação de linhas ignoradas
  }
}
```

---

## 4. CÓDIGO DE REFERÊNCIA

### 4.1 Estrutura Completa da Função

```typescript
export const processMeuImportadorFile = (
  file: File, 
  validBusinessUnits?: string[]
): Promise<ProcessResult<MeuTipo>> => {
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

        // Estruturas de dados
        const dados: MeuTipo[] = [];
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
          category: 'cabeçalho' | 'rodapé' | 'vazia' | 'inválida';
        }> = [];
        const stats = {
          totalRows: 0,
          processed: 0,
          skippedEmpty: 0,
          skippedHeaderFooter: 0,
          invalid: 0
        };

        // Função para detectar rodapés
        const isHeaderFooterRow = (row: any[]): boolean => {
          // ... implementação
        };

        // Função para detectar cabeçalhos duplicados
        const isHeaderRow = (row: any[], rowIndex: number): boolean => {
          // ... implementação
        };

        // Encontrar linha de cabeçalho
        let headerRowIndex = -1;
        const expectedColumnNames = {
          // ... definir colunas esperadas
        };
        
        // ... lógica para encontrar cabeçalho
        
        if (headerRowIndex === -1) {
          throw new Error('Cabeçalho não encontrado');
        }

        // Mapear índices das colunas
        const headerRow = jsonData[headerRowIndex] as any[];
        const columnMap: { [key: string]: number } = {};
        // ... mapear colunas

        // Validar se todas foram mapeadas
        const requiredColumns = [/* ... */];
        const missingMappedCols = requiredColumns.filter(col => columnMap[col] === undefined);
        if (missingMappedCols.length > 0) {
          throw new Error(`Colunas obrigatórias não encontradas: ${missingMappedCols.join(', ')}`);
        }

        // Processar linhas
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          // ... validação e processamento de cada linha
        }

        // Validar business units (se aplicável)
        if (validBusinessUnits && validBusinessUnits.length > 0) {
          // ... validação
        }

        // Retornar resultado
        resolve({
          data: dados,
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
```

---

## 5. CHECKLIST COMPLETO

### ✅ Fase 1: Preparação
- [ ] Identificar colunas obrigatórias do importador
- [ ] Identificar campos obrigatórios por linha
- [ ] Identificar campos opcionais (que viram "não identificado")
- [ ] Identificar campos condicionais (obrigatórios apenas em certas condições)
- [ ] Verificar se precisa validar business units
- [ ] Verificar se precisa normalizar algum campo (status, etc.)

### ✅ Fase 2: Funções Auxiliares
- [ ] Criar/adaptar `normalizeStatus()` (se aplicável)
- [ ] Usar `parseBrazilianNumber()` para valores numéricos
- [ ] Criar/adaptar `parseDate()` para datas
- [ ] Criar `isHeaderRow()` para detectar cabeçalhos duplicados
- [ ] Criar `isHeaderFooterRow()` para detectar rodapés

### ✅ Fase 3: Modificar Função de Processamento
- [ ] Alterar assinatura para retornar `ProcessResult<T>`
- [ ] Adicionar parâmetro `validBusinessUnits` (se necessário)
- [ ] Criar estruturas de dados (validationErrors, skippedRows, stats)
- [ ] Implementar validação de cabeçalho
- [ ] Implementar mapeamento de colunas
- [ ] Implementar validação de cada linha
- [ ] Implementar detecção de cabeçalhos/rodapés
- [ ] Implementar detecção de linhas vazias
- [ ] Implementar validação de business units (se necessário)
- [ ] Retornar `ProcessResult` com todos os dados

### ✅ Fase 4: Integração no App.tsx
- [ ] Atualizar `handleDataImport` para o novo tipo
- [ ] Obter business units válidas (se necessário)
- [ ] Chamar função de processamento
- [ ] Verificar `validationErrors` antes de inserir
- [ ] Criar notificação de erro se houver problemas
- [ ] Rejeitar arquivo se houver erros críticos
- [ ] Inserir dados no banco (apenas se não houver erros)
- [ ] Criar notificação de sucesso
- [ ] Criar notificação de linhas ignoradas (se houver)
- [ ] Atualizar `record_count` na tabela `importacoes`
- [ ] Adicionar `import_id` em cada registro

### ✅ Fase 5: Notificações
- [ ] Notificação de erro (com dados para relatório)
- [ ] Notificação de sucesso
- [ ] Notificação de linhas ignoradas (com dados para relatório)

### ✅ Fase 6: Migrações (se necessário)
- [ ] Verificar se campos opcionais permitem NULL no banco
- [ ] Criar migração se necessário

### ✅ Fase 7: Testes
- [ ] Testar com arquivo válido
- [ ] Testar com colunas faltando
- [ ] Testar com business units inválidas
- [ ] Testar com linhas inválidas
- [ ] Testar com cabeçalhos/rodapés
- [ ] Testar com linhas vazias
- [ ] Verificar se notificações aparecem corretamente
- [ ] Verificar se relatórios podem ser visualizados e baixados

---

## 🔑 PONTOS-CHAVE PARA SUCESSO

1. **Sempre validar antes de inserir** - Se houver erros, rejeitar arquivo
2. **Coletar todas as informações** - Linhas inválidas, ignoradas, estatísticas
3. **Usar funções auxiliares** - `parseBrazilianNumber()`, `normalizeStatus()`, etc.
4. **Retornar ProcessResult** - Estrutura padronizada facilita tratamento
5. **Notificações completas** - Sucesso, erro, linhas ignoradas
6. **Progresso em tempo real** - Mostrar o que está acontecendo
7. **Relatórios detalhados** - Permitir visualizar e baixar

---

## 📦 ARQUIVOS DE REFERÊNCIA

### Importador de Contas a Pagar (Modelo)
- **Função:** `processAccountsPayableFile()` em `src/utils/excelProcessor.ts`
- **Linhas:** 531-1215 (aproximadamente)
- **Integração:** `src/App.tsx` linhas 1054-1340

### Componentes de Notificação
- `src/contexts/NotificationContext.tsx` - Context Provider
- `src/components/NotificationCenter.tsx` - Componente principal
- `src/components/ToastNotification.tsx` - Toast temporário

---

## 🎯 EXEMPLO PRÁTICO: Replicando para "Receitas"

### Passo 1: Identificar Colunas
```typescript
const expectedColumnNames = {
  status: ['status'],
  unidade: ['unidade'],
  planoContas: ['plano de contas', 'plano'],
  valor: ['valor'],
  credor: ['credor', 'cliente'],
  dataPagamento: ['data pagamento', 'data de pagamento', 'pagamento']
};
```

### Passo 2: Definir Campos Obrigatórios
- **Sempre obrigatórios**: status, unidade, valor, dataPagamento
- **Opcionais**: planoContas, credor (viram "não identificado")

### Passo 3: Adaptar Validação
```typescript
// Validar status
if (!statusValueStr) {
  rowErrors.push('Status está vazio (obrigatório)');
}

// Validar valor
if (isValorEmpty) {
  rowErrors.push('Valor está vazio (obrigatório)');
}

// Validar dataPagamento (sempre obrigatório para receitas)
if (!paymentDate) {
  rowErrors.push('Data Pagamento está vazia ou inválida');
}
```

### Passo 4: Integrar no App.tsx
```typescript
if (type === 'revenues') {
  const validBusinessUnits = companies.map(c => normalizeCode(c.company_code));
  const result = await processRevenuesFile(file, validBusinessUnits);
  
  if (result.validationErrors.invalidRows.length > 0) {
    // Notificação de erro
    return;
  }
  
  // Inserir dados
  // Notificação de sucesso
}
```

---

## ✅ CONCLUSÃO

Este guia fornece todos os passos necessários para padronizar qualquer importador seguindo o modelo de "Contas a Pagar". 

**Princípios fundamentais:**
- Validar antes de inserir
- Coletar todas as informações
- Notificar sobre tudo
- Progresso em tempo real
- Relatórios detalhados

**Pronto para replicar!** 🚀
