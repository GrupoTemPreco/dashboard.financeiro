import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  darkMode?: boolean;
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ darkMode = false, message = 'Carregando...' }) => {
  return (
    <div className={`flex items-center justify-center min-h-[400px] ${darkMode ? 'bg-slate-900' : 'bg-white'} rounded-lg`}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className={`w-8 h-8 ${darkMode ? 'text-slate-400' : 'text-gray-400'} animate-spin`} />
        <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>{message}</p>
      </div>
    </div>
  );
};
