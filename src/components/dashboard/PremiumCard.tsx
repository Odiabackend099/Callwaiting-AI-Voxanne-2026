import React from 'react';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function PremiumCard({ children, className = '', hover = true }: PremiumCardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        rounded-xl shadow-sm dark:shadow-lg
        ${hover ? 'hover:shadow-md dark:hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700' : ''}
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
}
