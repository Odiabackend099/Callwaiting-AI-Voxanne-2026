import React from 'react';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  /**
   * Card depth level (elevation hierarchy)
   * - level1: Background cards (lowest elevation)
   * - level2: Standard cards (medium elevation) - DEFAULT
   * - level3: Featured cards (high elevation)
   * - level4: Premium cards (highest elevation with gradient)
   */
  variant?: 'level1' | 'level2' | 'level3' | 'level4';
}

export function PremiumCard({
  children,
  className = '',
  hover = true,
  variant = 'level2'
}: PremiumCardProps) {

  // Level 1: Background cards - lowest elevation
  const level1Styles = `
    bg-white
    border border-[#AACCFF]/50
    rounded-xl
    shadow-sm
    ${hover ? 'hover:shadow-md hover:border-[#AACCFF] hover:-translate-y-0.5' : ''}
  `;

  // Level 2: Standard cards - medium elevation (DEFAULT)
  const level2Styles = `
    bg-white
    border border-[#AACCFF]
    rounded-xl
    shadow-md shadow-[#3366FF]/5
    ${hover ? 'hover:shadow-lg hover:shadow-[#3366FF]/10 hover:border-[#3366FF]/30 hover:-translate-y-0.5' : ''}
  `;

  // Level 3: Featured cards - high elevation
  const level3Styles = `
    bg-white
    border border-[#3366FF]/30
    rounded-xl
    shadow-lg shadow-[#0000FF]/10
    ring-2 ring-[#0000FF]/5
    ${hover ? 'hover:shadow-xl hover:shadow-[#0000FF]/15 hover:border-[#3366FF]/50 hover:-translate-y-1' : ''}
  `;

  // Level 4: Premium cards - highest elevation with gradient
  const level4Styles = `
    bg-gradient-to-br from-white to-[#AACCFF]/5
    border border-[#0000FF]/20
    rounded-xl
    shadow-xl shadow-[#0000FF]/15
    ring-2 ring-[#0000FF]/10
    ${hover ? 'hover:shadow-2xl hover:shadow-[#0000FF]/20 hover:border-[#0000FF]/30 hover:-translate-y-1 hover:scale-[1.02]' : ''}
  `;

  const variantStyles = {
    level1: level1Styles,
    level2: level2Styles,
    level3: level3Styles,
    level4: level4Styles,
  };

  return (
    <div
      className={`
        ${variantStyles[variant]}
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
}
