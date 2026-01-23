import React from 'react';
import { Loader2 } from 'lucide-react';

interface ChartSkeletonProps {
  darkMode?: boolean;
  height?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ darkMode = false, height = 'h-80' }) => {
  return (
    <div className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'} rounded-lg shadow-md p-6 border ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
      <div className={`${height} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={`w-8 h-8 ${darkMode ? 'text-slate-400' : 'text-gray-400'} animate-spin`} />
          <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>Carregando...</p>
        </div>
      </div>
    </div>
  );
};
