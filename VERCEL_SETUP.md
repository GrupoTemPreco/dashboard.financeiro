# Configuração na Vercel

## ⚠️ Importante

**Não é possível simplesmente "importar" um arquivo .env na Vercel!**

Você precisa adicionar as variáveis de ambiente de uma das seguintes formas:
1. **Interface Web** (mais simples - recomendado)
2. **CLI da Vercel** (mais rápido se você já tem um arquivo .env)

## Variáveis de Ambiente Necessárias

Para que a aplicação funcione corretamente na Vercel, você precisa configurar as seguintes variáveis de ambiente:

### 1. Acesse o Painel da Vercel
1. Vá para https://vercel.com
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**

### 2. Adicione as Variáveis

Adicione as seguintes variáveis de ambiente:

| Nome da Variável | Valor | Onde encontrar |
|-----------------|-------|----------------|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase | Supabase Dashboard > Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase | Supabase Dashboard > Settings > API > anon/public key |

### 3. Como obter os valores do Supabase

1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Settings** (ícone de engrenagem) > **API**
4. Copie:
   - **Project URL** → use como `VITE_SUPABASE_URL`
   - **anon public** key → use como `VITE_SUPABASE_ANON_KEY`

### 4. Configuração na Vercel

1. No painel da Vercel, vá em **Settings** > **Environment Variables**
2. Clique em **Add New**
3. Adicione cada variável:
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: Cole a URL do Supabase
   - **Environment**: Selecione **Production**, **Preview** e **Development** (ou apenas Production se preferir)
4. Clique em **Save**
5. Repita para `VITE_SUPABASE_ANON_KEY`

### 5. Redeploy

Após adicionar as variáveis de ambiente:
1. Vá em **Deployments**
2. Clique nos três pontos (...) do deployment mais recente
3. Selecione **Redeploy**
4. Ou faça um novo commit para triggerar um novo deploy

---

## Alternativa: Usar CLI da Vercel (se você já tem um arquivo .env)

Se você já tem um arquivo `.env` local, pode usar a CLI da Vercel:

1. Instale a CLI: `npm i -g vercel`
2. Faça login: `vercel login`
3. Adicione as variáveis:
   ```bash
   vercel env add VITE_SUPABASE_URL production preview development
   # Cole o valor quando solicitado
   
   vercel env add VITE_SUPABASE_ANON_KEY production preview development
   # Cole o valor quando solicitado
   ```
4. Faça redeploy: `vercel --prod`

Veja `vercel-env-setup.md` para mais detalhes.

## Verificação

Após o redeploy, verifique se:
- O console do navegador não mostra erros de `ERR_NAME_NOT_RESOLVED`
- Os dados são carregados do Supabase corretamente
- A importação de arquivos funciona

## Troubleshooting

### Erro: `ERR_NAME_NOT_RESOLVED`
- Verifique se as variáveis de ambiente estão configuradas corretamente
- Certifique-se de que fez redeploy após adicionar as variáveis
- Verifique se a URL do Supabase está correta (deve começar com `https://`)

### Erro: `Missing Supabase environment variables`
- As variáveis não foram encontradas
- Verifique se os nomes estão exatamente como: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Certifique-se de que selecionou os ambientes corretos (Production, Preview, Development)

### Dados não aparecem
- Verifique se as tabelas existem no Supabase
- Verifique se as políticas RLS (Row Level Security) estão configuradas corretamente
- Verifique o console do navegador para erros específicos

