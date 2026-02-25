# Itens ocultos / desativados no Dashboard

> **Manutenção:** Sempre que algo for ocultado na interface, adicionar/atualizar a entrada correspondente neste arquivo.

Registro do que foi ocultado ou desativado na interface (e do que ainda será).

---

## Já ocultos

### 1. Botão de desbloqueio permanente
- **Arquivo:** `src/App.tsx` (linhas 5808–5817)
- **Descrição:** Botão que, com 5 cliques rápidos, desbloqueia a tela de Importar Dados como admin.
- **Como está:** Discreto (canto inferior direito, minúsculo, opacity baixa, sem tooltip).

### 2. Alertas de fluxo de caixa
- **Arquivo:** `src/components/CashFlowChart.tsx` (a partir da linha 161)
- **Descrição:** Dropdown de alertas de fluxo de caixa (ícone + contador + lista).
- **Como está:** Bloco desativado com `false &&` na condição de render.

### 3. Modo linhas (comparação mensal)
- **Arquivo:** `src/components/MonthlyComparison.tsx` (linha 61)
- **Descrição:** Visualização em linhas por loja/grupo na comparação mensal.
- **Como está:** `lineViewMode` fixo em `false` (comentário: desabilitado temporariamente).

### 4. Importadores na tela de Importar Dados
- **Arquivo:** `src/components/DataImport.tsx`
- **Descrição:** Quatro importadores foram ocultados na interface (cards de arrastar/selecionar arquivo e instruções no modal de formato):
  - **Receitas** (`revenues`)
  - **Lançamentos previstos** (`forecasted_entries`)
  - **Saldos bancários** (`initial_balances`)
  - **Orçamento DRE** (`orcamento_dre`)
- **Como está:** Constante `IMPORTADORES_OCULTOS` com esses tipos em `true`; os blocos de upload e as instruções correspondentes são renderizados apenas quando `!IMPORTADORES_OCULTOS[type]`. A lista "Arquivos importados" continua exibindo esses tipos se houver arquivos já importados.

### 5. Colunas "Variação" e "% Receita" na tabela Despesas Operacionais
- **Arquivo:** `src/components/DespesasOperacionaisTable.tsx`
- **Descrição:** Duas colunas à direita da tabela de Despesas Operacionais, ocultas por enquanto.
- **Como está:** Constante `SHOW_VARIATION_COLUMNS = false` no topo do arquivo; os `<th>` e `<td>` das duas colunas só são renderizados quando `SHOW_VARIATION_COLUMNS` for `true`.
- **Cálculo de cada coluna:**
  - **Variação**
    - Valor: `Previsto (período atual) − Realizado (período atual)`.
    - Percentual: `((Previsto − Realizado) / Previsto) × 100` (se Previsto ≠ 0).
    - Interpretação: quanto o realizado ficou acima ou abaixo do previsto no período filtrado (positivo = gastou menos que o previsto).
  - **% Receita**
    - Valor: `Realizado (período atual) − Previsto (período atual)` (inverso da Variação em valor).
    - Percentual: `((Realizado − Previsto) / Previsto) × 100` (se Previsto ≠ 0).
    - Interpretação: mesmo indicador em valor/percentual com sinal invertido em relação à Variação; o nome "% Receita" fica para uso futuro (ex.: peso da despesa sobre a receita).

---

## A ocultar

_(adicionar aqui sempre que for pedido para ocultar algo novo)_
