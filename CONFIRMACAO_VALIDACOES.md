# ✅ Confirmação das Validações - Contas a Pagar

## 📋 Campos Obrigatórios (Devem estar preenchidos)

### ✅ Status
- **Validação:** OBRIGATÓRIO
- **Localização:** `src/utils/excelProcessor.ts` linhas 1026-1067
- **Comportamento:**
  - Se vazio → linha inválida
  - Se contém palavra aleatória (não reconhecida) → linha inválida
  - Deve conter termos conhecidos: "previsto", "realizado", "pago", "pendente", etc.
  - Normalizado para "previsto" ou "realizado"

### ✅ Unidade de Negócio (business_unit)
- **Validação:** OBRIGATÓRIO
- **Localização:** `src/utils/excelProcessor.ts` linhas 1108-1109
- **Comportamento:**
  - Se vazio → linha inválida
  - Deve existir no banco de dados (`empresas.company_code`)

### ✅ Valor (amount)
- **Validação:** OBRIGATÓRIO
- **Localização:** `src/utils/excelProcessor.ts` linhas 1073-1097
- **Comportamento:**
  - Se vazio (null, undefined, string vazia) → linha inválida
  - Deve ser número válido
  - Aceita formato brasileiro (vírgula para decimais, ponto para milhares)
  - Zero explícito (0, 0,00) é permitido (pode ser nota cancelada)

### ✅ Data de Vencimento (due_date)
- **Validação:** OBRIGATÓRIO
- **Localização:** `src/utils/excelProcessor.ts` linhas 1119-1121
- **Comportamento:**
  - Se vazio ou inválido → linha inválida
  - Sempre obrigatório, independente do status

### ✅ Data Pagamento (payment_date)
- **Validação:** CONDICIONAL
- **Localização:** `src/utils/excelProcessor.ts` linhas 1124-1127
- **Comportamento:**
  - Se `status = "realizado"` → OBRIGATÓRIO (se vazio → linha inválida)
  - Se `status = "previsto"` → OPCIONAL (pode ser NULL)
  - Se não houver `payment_date` nem `due_date` → linha inválida

---

## 📋 Campos Opcionais (Podem estar vazios)

### ⚪ Plano de Contas (chart_of_accounts)
- **Validação:** OPCIONAL
- **Localização:** `src/utils/excelProcessor.ts` linhas 1111-1114 (comentado)
- **Comportamento:**
  - Se vazio → aceito e salvo como "(não identificado)"
  - Não causa erro

### ⚪ Credor (creditor)
- **Validação:** OPCIONAL
- **Localização:** `src/utils/excelProcessor.ts` linhas 1115-1118 (comentado)
- **Comportamento:**
  - Se vazio → aceito e salvo como "(não identificado)"
  - Não causa erro

---

## ✅ Resumo das Validações

| Campo | Obrigatório? | Validação Especial | Comportamento se Vazio |
|-------|--------------|-------------------|------------------------|
| **status** | ✅ SIM | Deve conter termos conhecidos | Linha inválida |
| **business_unit** | ✅ SIM | Deve existir no banco | Linha inválida |
| **valor** | ✅ SIM | Deve ser número válido | Linha inválida |
| **due_date** | ✅ SIM | Sempre obrigatório | Linha inválida |
| **payment_date** | ⚠️ CONDICIONAL | Obrigatório se status="realizado" | Linha inválida (se realizado) ou NULL (se previsto) |
| **chart_of_accounts** | ❌ NÃO | - | Salvo como "(não identificado)" |
| **credor** | ❌ NÃO | - | Salvo como "(não identificado)" |

---

## 🔍 Validações Adicionais

### 1. Validação de Colunas no Cabeçalho
- Verifica se todas as 7 colunas obrigatórias estão presentes
- Se faltar qualquer uma → arquivo rejeitado

### 2. Validação de Business Units
- Verifica se todas as unidades da planilha existem no banco
- Se houver unidades inexistentes → arquivo rejeitado

### 3. Validação de Status
- Verifica se o status contém termos conhecidos
- Se for palavra aleatória → linha inválida

### 4. Validação de Valor
- Verifica se está realmente vazio (não apenas zero)
- Verifica se é número válido
- Verifica se não é negativo

---

## ✅ Conclusão

**Todas as validações estão implementadas e funcionando corretamente:**

- ✅ Status: OBRIGATÓRIO e validado (não aceita palavras aleatórias)
- ✅ Business Unit: OBRIGATÓRIO
- ✅ Valor: OBRIGATÓRIO
- ✅ Data de Vencimento: OBRIGATÓRIO
- ✅ Data Pagamento: CONDICIONAL (obrigatório apenas se status="realizado")
- ✅ Plano de Contas: OPCIONAL (vira "não identificado")
- ✅ Credor: OPCIONAL (vira "não identificado")

**O importador está robusto e rejeita corretamente linhas com campos obrigatórios vazios ou inválidos!** 🎉
