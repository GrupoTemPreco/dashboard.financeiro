import React from 'react';
import { Loader2 } from 'lucide-react';

interface CardSkeletonProps {
  darkMode?: boolean;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ darkMode = false }) => {
  return (
    <div className={`${darkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'} rounded-lg p-6 border-l-4 border-l-gray-400 shadow-md flex items-center justify-center min-h-[140px]`}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className={`w-6 h-6 ${darkMode ? 'text-slate-400' : 'text-gray-400'} animate-spin`} />
        <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Carregando...</p>
      </div>
    </div>
  );
};
