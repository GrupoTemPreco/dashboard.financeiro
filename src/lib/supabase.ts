import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas!');
  console.error('Por favor, configure as seguintes variáveis de ambiente:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- VITE_SUPABASE_ANON_KEY');
  console.error('\nNa Vercel: Settings > Environment Variables');
  throw new Error('Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
}

// Validar formato da URL
if (!supabaseUrl.startsWith('https://')) {
  console.error('❌ VITE_SUPABASE_URL deve começar com https://');
  throw new Error('Invalid Supabase URL format. Must start with https://');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
