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
        bg-white
        border border-surgical-200
        rounded-xl shadow-sm
        ${hover ? 'hover:shadow-md hover:border-surgical-300' : ''}
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
}
