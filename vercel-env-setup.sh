#!/bin/bash

# Script para configurar variáveis de ambiente na Vercel
# Requer: Vercel CLI instalada (npm i -g vercel)

echo "🔧 Configurando variáveis de ambiente na Vercel..."

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "Por favor, crie um arquivo .env com as seguintes variáveis:"
    echo "VITE_SUPABASE_URL=https://seu-projeto.supabase.co"
    echo "VITE_SUPABASE_ANON_KEY=sua-chave-aqui"
    exit 1
fi

# Ler o arquivo .env e adicionar cada variável na Vercel
while IFS='=' read -r key value; do
    # Ignorar linhas vazias e comentários
    if [[ ! "$key" =~ ^#.*$ ]] && [[ -n "$key" ]]; then
        # Remover espaços em branco
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        
        echo "📝 Adicionando $key..."
        vercel env add "$key" production preview development <<< "$value"
    fi
done < .env

echo "✅ Variáveis de ambiente configuradas!"
echo "🔄 Faça um redeploy na Vercel para aplicar as mudanças."

