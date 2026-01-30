/**
 * @fileoverview Example component showcasing brand-colors utility usage
 *
 * This file demonstrates real-world usage patterns of the brand-colors utility.
 * Copy these patterns into your own components!
 *
 * @example
 * ```tsx
 * import { BrandColorShowcase } from '@/components/examples/BrandColorsExamples';
 * // Use in your application to see all colors and patterns
 * ```
 */

'use client';

import {
  brandColors,
  createBrandGradient,
  createBrandGlow,
  getContrastPair,
  createColorScheme,
  animationColors,
  type BrandColorName,
} from '@/lib/brand-colors';

/**
 * Example 1: Color Palette Display
 * Shows all brand colors in a grid
 */
export function ColorPaletteGrid() {
  const colorNames = Object.keys(brandColors) as BrandColorName[];

  return (
    <div className="p-8 bg-offWhite">
      <h2 className="text-2xl font-bold mb-6" style={{ color: brandColors.navyDark }}>
        Brand Color Palette
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {colorNames.map((colorName) => (
          <div key={colorName} className="flex flex-col items-center">
            <div
              className="w-24 h-24 rounded-lg mb-2 border border-gray-300"
              style={{
                backgroundColor: brandColors[colorName],
              }}
              title={colorName}
            />
            <p className="text-sm font-mono" style={{ color: brandColors.navyDark }}>
              {colorName}
            </p>
            <p className="text-xs text-gray-600">{brandColors[colorName]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 2: Primary CTA Button
 * Demonstrates proper button styling with glow effect
 */
export function PrimaryCTAButton() {
  return (
    <button
      style={{
        backgroundColor: brandColors.blueBright,
        color: brandColors.offWhite,
        boxShadow: createBrandGlow('blueBright', 'medium'),
        padding: '12px 24px',
        borderRadius: '8px',
        border: 'none',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = createBrandGlow('blueBright', 'strong');
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = createBrandGlow('blueBright', 'medium');
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      Get Started Now
    </button>
  );
}

/**
 * Example 3: Gradient Hero Section
 * Shows gradient background with proper text contrast
 */
export function GradientHeroSection() {
  return (
    <div
      className={`${createBrandGradient('navyDark', 'blueBright')} py-20 px-8 text-center rounded-lg`}
    >
      <h1 className="text-4xl font-bold mb-4" style={{ color: brandColors.offWhite }}>
        Welcome to Voxanne AI
      </h1>
      <p className="text-lg mb-8" style={{ color: brandColors.blueSubtle }}>
        Surgical-grade AI receptionists for your business
      </p>
      <button
        style={{
          backgroundColor: brandColors.offWhite,
          color: brandColors.navyDark,
          padding: '12px 32px',
          borderRadius: '8px',
          border: 'none',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Learn More
      </button>
    </div>
  );
}

/**
 * Example 4: Feature Card with Glow
 * Demonstrates card styling with subtle glow
 */
export function FeatureCard({ title = 'Feature Title', description = 'Feature description' }) {
  return (
    <div
      style={{
        backgroundColor: brandColors.offWhite,
        borderLeft: `4px solid ${brandColors.blueBright}`,
        boxShadow: createBrandGlow('blueLight', 'subtle'),
        padding: '20px',
        borderRadius: '8px',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = createBrandGlow('blueBright', 0.4);
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = createBrandGlow('blueLight', 'subtle');
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <h3 style={{ color: brandColors.navyDark, fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ color: brandColors.blueMedium }}>{description}</p>
    </div>
  );
}

/**
 * Example 5: Button Variants
 * Shows primary, secondary, and tertiary button styles
 */
export function ButtonVariants() {
  const primaryScheme = createColorScheme('blueBright');
  const secondaryScheme = createColorScheme('blueMedium');

  return (
    <div className="flex flex-wrap gap-4 p-8">
      {/* Primary Button */}
      <button
        style={{
          backgroundColor: primaryScheme.bg,
          color: primaryScheme.text,
          boxShadow: createBrandGlow('blueBright', 'default'),
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Primary Action
      </button>

      {/* Secondary Button */}
      <button
        style={{
          backgroundColor: secondaryScheme.bg,
          color: brandColors.offWhite,
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Secondary Action
      </button>

      {/* Tertiary Button */}
      <button
        style={{
          backgroundColor: 'transparent',
          color: brandColors.navyDark,
          border: `2px solid ${brandColors.blueSubtle}`,
          padding: '10px 22px',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Tertiary Action
      </button>
    </div>
  );
}

/**
 * Example 6: Interactive Color Switcher
 * Demonstrates dynamic color selection
 */
export function ColorSwitcher() {
  const [selectedColor, setSelectedColor] = React.useState<BrandColorName>('blueBright');

  const colorNames = Object.keys(brandColors) as BrandColorName[];

  return (
    <div className="p-8">
      <h2 style={{ color: brandColors.navyDark, marginBottom: '16px' }}>
        Select a Color:
      </h2>

      <div className="flex flex-wrap gap-3 mb-8">
        {colorNames.map((colorName) => (
          <button
            key={colorName}
            onClick={() => setSelectedColor(colorName)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: brandColors[colorName],
              border: selectedColor === colorName ? `3px solid ${brandColors.navyDark}` : '2px solid #ddd',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={colorName}
          />
        ))}
      </div>

      <div
        className={`p-6 rounded-lg ${createBrandGradient(selectedColor, selectedColor === 'navyDark' ? 'blueBright' : 'offWhite')}`}
        style={{
          boxShadow: createBrandGlow(selectedColor),
        }}
      >
        <p style={{ color: brandColors.navyDark, fontSize: '18px', fontWeight: '600' }}>
          Selected Color: {selectedColor}
        </p>
        <p style={{ color: brandColors.blueMedium }}>
          Hex: {brandColors[selectedColor]}
        </p>
      </div>
    </div>
  );
}

/**
 * Example 7: Status Indicators
 * Shows how to use animation colors for status badges
 */
export function StatusIndicators() {
  return (
    <div className="p-8 space-y-4">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: '#f0fdf4',
          borderLeft: `4px solid ${animationColors.status.success}`,
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: animationColors.status.success,
            boxShadow: `0 0 8px ${animationColors.status.success}`,
          }}
        />
        <p style={{ color: '#166534', fontWeight: '500' }}>Success: Operation completed</p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: '#fffbeb',
          borderLeft: `4px solid ${animationColors.status.warning}`,
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: animationColors.status.warning,
            boxShadow: `0 0 8px ${animationColors.status.warning}`,
          }}
        />
        <p style={{ color: '#92400e', fontWeight: '500' }}>Warning: Check your settings</p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          borderLeft: `4px solid ${animationColors.status.error}`,
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: animationColors.status.error,
            boxShadow: `0 0 8px ${animationColors.status.error}`,
          }}
        />
        <p style={{ color: '#991b1b', fontWeight: '500' }}>Error: Please try again</p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: '#eff6ff',
          borderLeft: `4px solid ${animationColors.status.info}`,
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: animationColors.status.info,
            boxShadow: `0 0 8px ${animationColors.status.info}`,
          }}
        />
        <p style={{ color: '#082f49', fontWeight: '500' }}>Info: New updates available</p>
      </div>
    </div>
  );
}

/**
 * Example 8: Complete Showcase
 * All examples in one place
 */
export function BrandColorShowcase() {
  return (
    <div className="space-y-12 p-8" style={{ backgroundColor: brandColors.offWhite }}>
      <section>
        <h1 style={{ color: brandColors.navyDark, marginBottom: '24px', fontSize: '32px' }}>
          Voxanne Brand Colors Showcase
        </h1>
        <p style={{ color: brandColors.blueMedium, marginBottom: '32px', fontSize: '16px' }}>
          Production-ready examples of all brand color utilities
        </p>
      </section>

      <section>
        <h2 style={{ color: brandColors.navyDark, marginBottom: '16px' }}>Color Palette</h2>
        <ColorPaletteGrid />
      </section>

      <section>
        <h2 style={{ color: brandColors.navyDark, marginBottom: '16px' }}>Hero Section</h2>
        <GradientHeroSection />
      </section>

      <section>
        <h2 style={{ color: brandColors.navyDark, marginBottom: '16px' }}>Button Variants</h2>
        <ButtonVariants />
      </section>

      <section>
        <h2 style={{ color: brandColors.navyDark, marginBottom: '16px' }}>Feature Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard title="Fast" description="Lightning-quick responses" />
          <FeatureCard title="Reliable" description="Enterprise-grade uptime" />
          <FeatureCard title="Secure" description="Enterprise-grade security" />
        </div>
      </section>

      <section>
        <h2 style={{ color: brandColors.navyDark, marginBottom: '16px' }}>Status Indicators</h2>
        <StatusIndicators />
      </section>

      <section>
        <h2 style={{ color: brandColors.navyDark, marginBottom: '16px' }}>Color Switcher</h2>
        <ColorSwitcher />
      </section>
    </div>
  );
}

// Re-export React for use in this file
import React from 'react';
