import React, { ReactNode } from 'react';

type StickyScrollSectionProps = {
  children: ReactNode;
  height: string;
  className?: string;
};

export const StickyScrollSection = ({ children, height, className = '' }: StickyScrollSectionProps) => {
  return (
    <div 
      className={`relative ${className}`} 
      style={{ height }}
    >
      {children}
    </div>
  );
};
