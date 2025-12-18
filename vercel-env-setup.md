# Configuração Rápida via CLI da Vercel

## Pré-requisitos

1. Instale a CLI da Vercel:
```bash
npm i -g vercel
```

2. Faça login na Vercel:
```bash
vercel login
```

3. Crie um arquivo `.env` na raiz do projeto com:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

## Método 1: Adicionar variáveis manualmente via CLI

```bash
# Adicionar VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_URL production preview development
# Cole o valor quando solicitado

# Adicionar VITE_SUPABASE_ANON_KEY
vercel env add VITE_SUPABASE_ANON_KEY production preview development
# Cole o valor quando solicitado
```

## Método 2: Usar o script automatizado

```bash
# Dar permissão de execução (Linux/Mac)
chmod +x vercel-env-setup.sh

# Executar o script
./vercel-env-setup.sh
```

## Após configurar

1. Faça um redeploy:
```bash
vercel --prod
```

Ou via interface web: Deployments > ... > Redeploy

## Verificar variáveis configuradas

```bash
vercel env ls
```

