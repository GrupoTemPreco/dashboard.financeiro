# Lógica de Receita (formato legado – desativada)

Documentação da lógica de receita que usava as tabelas `receitas` e `receita_crediario` no Supabase. Mantida para reativação futura.

---

## 1. Visão geral

- **Receita “principal”:** tabela `receitas` → estado `revenues` → KPI “Receita Direta” e parte de “Total de Recebimentos” e “Resultado Operacional”.
- **Receita crediário:** tabela `receita_crediario` → estado `receitaCrediario` → entra só em “Total de Recebimentos” (todos considerados realizados).

---

## 2. Tabelas e colunas

### 2.1 Tabela `receitas` (Supabase)

| Coluna           | Uso |
|------------------|-----|
| `id`             | Identificador do registro |
| `import_id`      | Vínculo com importação ativa; filtro no carregamento |
| `business_unit`  | Unidade de negócio; filtro por empresa/grupo |
| `payment_date`   | Data do pagamento/recebimento; filtro por período |
| `amount`         | Valor; usado nos totais (previsto/realizado) |
| `status`         | `'previsto'` / `'pendente'` → previsto; `'realizado'` → realizado |
| `chart_of_accounts` | Plano de contas; exibido em detalhes e busca |

### 2.2 Tabela `receita_crediario` (Supabase)

| Coluna       | Uso |
|--------------|-----|
| `id`         | Identificador |
| `import_id`  | Vínculo com importação ativa |
| `un_neg_receb` | Unidade de negócio (equivalente a business_unit) |
| `data_receb` | Data do recebimento |
| `recebimento`| Valor (todos considerados realizados) |
| `parcela`    | Exibido como “Parcela X” no plano de contas em detalhes |

---

## 3. Estado no App (`src/App.tsx`)

- `revenues` / `setRevenues` — lista de registros de `receitas` (linha ~43).
- `receitaCrediario` / `setReceitaCrediario` — lista de registros de `receita_crediario` (linha ~44).

---

## 4. Carregamento dos dados

### 4.1 Receitas (`receitas`)

- **Onde:** `loadDataFromSupabase` em `App.tsx` (trecho ~491–515).
- **Condição:** só carrega se houver import ativo (`hasActiveImports`).
- **Query:**  
  - `.from('receitas')`  
  - `.select('import_id, business_unit, payment_date, amount, status, chart_of_accounts, id')`  
  - `.in('import_id', activeImportIds)`  
  - `.gte('payment_date', startDate)` e `.lte('payment_date', endDate)`  
  - Se houver filtro de empresas: `.in('business_unit', filteredBusinessUnits)`  
  - `.order('payment_date', { ascending: false })`
- **Resultado:** `setRevenues(revenuesData)`.

### 4.2 Receita crediário (`receita_crediario`)

- **Onde:** mesmo `loadDataFromSupabase` (trecho ~517–548).
- **Query:**  
  - `.from('receita_crediario')`  
  - `.select('import_id, un_neg_receb, data_receb, recebimento, parcela, id')`  
  - Filtros por `import_id`, `data_receb` (startDate/endDate) e `un_neg_receb` (quando há filtro de empresas).
- **Resultado:** `setReceitaCrediario(receitaCrediarioData)`.

---

## 5. Filtros e totais (em memória)

### 5.1 Filtros

- **getFilteredRevenues** (App.tsx ~2752–2758): retorna `revenues` (filtro de data e business_unit já feito no banco).
- **getFilteredReceitaCrediario** (App.tsx ~2761–2763): retorna `receitaCrediario`.

### 5.2 Totais de receita principal

- **revenueTotals** (App.tsx ~3678–3692):  
  - **forecasted:** soma de `amount` onde `status` é `'previsto'` ou `'pendente'`.  
  - **actual:** soma de `amount` onde `status` é `'realizado'`.

### 5.3 Totais de receita crediário

- **receitaCrediarioTotals** (App.tsx ~3695–3698):  
  - **actual:** soma de `Number(rc.recebimento)`.  
  - **forecasted:** 0 (não há status na tabela).

---

## 6. Cards / KPIs que usam receita

| Card / KPI              | O que usa |
|-------------------------|-----------|
| **Receita Direta**      | `revenueTotals.forecasted` e `revenueTotals.actual`; detalhes = `getFilteredRevenues` com `source: 'revenues'`. Texto do card: “Carregado da planilha de receitas”. App.tsx ~5411–5419. |
| **Total de Recebimentos** | Receitas + receita crediário + transações financeiras positivas. Dados: `getFilteredTotalInflows` (receitas + crediário + transações). Totais em `kpiData`: `revenueTotals` + `receitaCrediarioTotals` + `transactionTotals.inflows`. App.tsx ~2909–2939, 3848–3849, 5372 (dataSource). |
| **Resultado Operacional** | Inclui “Receita Direta” via `getFilteredRevenues` em `getFilteredOperationalResult` (App.tsx ~3785–3811). Fórmula: Receita Direta − CMV − Total de Despesas. |

---

## 7. Modais e listagens

- **Detalhes “Receita Direta”:** `openKPIDetail('Detalhes: Receita Direta', getFilteredRevenues, 'revenues')` (App.tsx ~5418).  
- **loadKpiDetailData** (App.tsx):  
  - Para `type === 'revenues'`: busca em `receitas` no Supabase (com filtros de período, business_unit, status, searchTerm) e paginação (~3088–3128).  
  - Para `type === 'total_inflows'`: busca em paralelo em `receitas`, `receita_crediario` e `transacoes_financeiras` (positivas) (~3173–3224).  
- **KPIDetailModal:** tipos `revenues` e `receita_crediario` nas opções de fonte (ex.: KPIDetailModal.tsx ~288–289, 303–304, 463–464).

---

## 8. Comparação mensal

- **Onde:** `loadMonthlyComparisonData` em App.tsx (~4566–4605).
- **O que faz:** carrega `receitas` em lotes (batch 500) do Supabase, com mesmo `import_id` e opcionalmente `business_unit`, para alimentar o componente de comparação mensal.

---

## 9. Importação (planilha → Supabase)

### 9.1 Tipo e fluxo geral

- **Tipo de importação:** `'revenues'` ou detecção automática (receitas vs receita_crediario pelo formato do arquivo).
- **Handler:** `handleDataImport` em App.tsx (type `'revenues'` ou `'receita_crediario'`).

### 9.2 Receitas (tabela `receitas`)

- **Processador:** `processRevenuesFile` em `src/utils/excelProcessor.ts`.
- **Validação:** `validateFileFormat(file, 'revenues')` — exige colunas do formato de receitas (formato antigo 5 colunas ou novo 10 colunas).
- **Destino:** inserts na tabela `receitas` (com `import_id`, `business_unit`, `payment_date`, `amount`, `status`, `chart_of_accounts`, etc.).
- **Após importar:** `loadMonthlyComparisonData()` é chamado para recarregar comparação mensal (apenas quando não é receita_crediario).

### 9.3 Receita crediário (tabela `receita_crediario`)

- **Processador:** `processReceitaCrediarioFile` em `src/utils/excelProcessor.ts`.
- **Validação:** `validateFileFormat(file, 'receita_crediario')` — colunas como Data Receb, Un. Neg. Receb, Recebimento, etc.
- **Destino:** inserts na tabela `receita_crediario`.
- **Detecção automática:** no fluxo de “receitas”, se o arquivo tiver propriedades de receita_crediario (ex.: `data_receb` e não `payment_date`), é tratado como crediário e pode atualizar `file_type` para `'receita_crediario'` e inserir em `receita_crediario`.

### 9.4 Delete / overwrite

- Limpeza por tipo de arquivo: em `handleDataImport` ou fluxo de “deletar dados”, tabelas `receitas` e `receita_crediario` são esvaziadas por `import_id` ou por tipo (ex.: App.tsx ~859–865, 880–886, 1683–1689).

---

## 10. Mapeamento de nomes (Supabase ↔ app)

- Em tabelas de mapeamento no App: `'revenues'` ↔ `'receitas'`, `'receita_crediario'` ↔ `'receita_crediario'` (ex.: App.tsx ~772–780, 790–798).

---

## 11. Referências rápidas de arquivos e trechos

| O quê | Arquivo | Trecho (aproximado) |
|-------|---------|----------------------|
| Estado revenues / receitaCrediario | App.tsx | 43–44 |
| Carregamento receitas | App.tsx | 491–515 |
| Carregamento receita_crediario | App.tsx | 517–548 |
| getFilteredRevenues / getFilteredReceitaCrediario | App.tsx | 2752–2763 |
| getFilteredTotalInflows | App.tsx | 2909–2939 |
| revenueTotals / receitaCrediarioTotals | App.tsx | 3678–3698 |
| getFilteredOperationalResult | App.tsx | 3785–3811 |
| kpiData (Receita Direta e Total Recebimentos) | App.tsx | 3840–3849 |
| Card Receita Direta e dataSource | App.tsx | 5411–5419, 5372 |
| loadKpiDetailData (revenues e total_inflows) | App.tsx | 3088–3128, 3173–3224 |
| loadMonthlyComparisonData (receitas) | App.tsx | 4566–4605 |
| handleDataImport (revenues / receita_crediario) | App.tsx | 1084, 1401–1558, 1625–1771 |
| processRevenuesFile / processReceitaCrediarioFile | excelProcessor.ts | (exportados e usados no import) |
| validateFileFormat receitas / receita_crediario | excelProcessor.ts | Validação por tipo de arquivo |
| KPIDetailModal (revenues / receita_crediario) | KPIDetailModal.tsx | 288–289, 303–304, 463–464 |
