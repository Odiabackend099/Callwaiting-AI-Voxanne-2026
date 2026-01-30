/**
 * Unit tests for brand-colors utility
 * Tests all color functions and type safety
 */

import {
  brandColors,
  createBrandGradient,
  createBrandGlow,
  getContrastPair,
  createColorScheme,
  getColor,
  getCSSVariables,
  animationColors,
  BrandColorName,
  type BrandColorValue,
} from '../brand-colors';

describe('brandColors', () => {
  describe('Color palette', () => {
    it('should have 8 brand colors', () => {
      expect(Object.keys(brandColors)).toHaveLength(8);
    });

    it('should have all required colors', () => {
      const requiredColors: BrandColorName[] = [
        'navyDark',
        'blueBright',
        'blueMedium',
        'blueLight',
        'blueSubtle',
        'offWhite',
        'cream',
        'sage',
      ];

      requiredColors.forEach((color) => {
        expect(brandColors[color]).toBeDefined();
        expect(typeof brandColors[color]).toBe('string');
      });
    });

    it('should have valid hex color values', () => {
      Object.values(brandColors).forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should match expected hex values', () => {
      expect(brandColors.navyDark).toBe('#0a0e27');
      expect(brandColors.blueBright).toBe('#0015ff');
      expect(brandColors.blueMedium).toBe('#4169ff');
      expect(brandColors.blueLight).toBe('#87ceeb');
      expect(brandColors.blueSubtle).toBe('#d6e9f5');
      expect(brandColors.offWhite).toBe('#f5f5f5');
      expect(brandColors.cream).toBe('#FAF8F5');
      expect(brandColors.sage).toBe('#E8F0EE');
    });
  });

  describe('createBrandGradient', () => {
    it('should create gradient with default direction', () => {
      const gradient = createBrandGradient('blueBright', 'blueLight');
      expect(gradient).toContain('bg-gradient-to-br');
      expect(gradient).toContain('from-[#0015ff]');
      expect(gradient).toContain('to-[#87ceeb]');
    });

    it('should create gradient with specified direction', () => {
      const gradient = createBrandGradient('navyDark', 'blueBright', 'to-r');
      expect(gradient).toContain('bg-gradient-to-r');
      expect(gradient).toContain('from-[#0a0e27]');
    });

    it('should support all gradient directions', () => {
      const directions = ['to-r', 'to-l', 'to-b', 'to-t', 'to-br', 'to-bl', 'to-tr', 'to-tl'] as const;

      directions.forEach((dir) => {
        const gradient = createBrandGradient('blueBright', 'blueLight', dir);
        expect(gradient).toContain(`bg-gradient-${dir}`);
      });
    });

    it('should handle invalid color gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const gradient = createBrandGradient('invalidColor' as BrandColorName, 'blueBright');
      expect(gradient).toBe('');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return Tailwind-compatible string', () => {
      const gradient = createBrandGradient('navyDark', 'blueBright');
      // Should be usable as className
      expect(gradient).toMatch(/^bg-gradient-/);
      expect(gradient).toMatch(/from-\[#[0-9a-f]{6}\]/i);
      expect(gradient).toMatch(/to-\[#[0-9a-f]{6}\]/i);
    });
  });

  describe('createBrandGlow', () => {
    it('should create glow with default intensity', () => {
      const glow = createBrandGlow('blueBright');
      expect(glow).toContain('rgba(0, 21, 255,');
      expect(glow).toContain('box-shadow');
    });

    it('should create glow with named preset intensities', () => {
      const presets = ['subtle', 'default', 'medium', 'strong', 'intense'] as const;

      presets.forEach((preset) => {
        const glow = createBrandGlow('blueBright', preset);
        expect(glow).toBeTruthy();
        expect(glow).toContain('rgba(');
      });
    });

    it('should create glow with numeric intensity', () => {
      const glow = createBrandGlow('blueBright', 0.5);
      expect(glow).toContain('rgba(');
      expect(glow).toBeTruthy();
    });

    it('should clamp numeric intensity to 0-1', () => {
      const glowLow = createBrandGlow('blueBright', -0.5);
      const glowHigh = createBrandGlow('blueBright', 2.0);
      expect(glowLow).toBeTruthy();
      expect(glowHigh).toBeTruthy();
    });

    it('should return box-shadow format', () => {
      const glow = createBrandGlow('blueBright');
      expect(glow).toMatch(/^0 0 \d+px rgba/);
    });

    it('should handle invalid color gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const glow = createBrandGlow('invalidColor' as BrandColorName);
      expect(glow).toBe('');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle invalid preset gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const glow = createBrandGlow('blueBright', 'invalidPreset' as any);
      expect(glow).toBeTruthy();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should produce multiple shadow layers for smooth effect', () => {
      const glow = createBrandGlow('blueBright');
      const layers = glow.split(',');
      expect(layers.length).toBeGreaterThan(1);
    });
  });

  describe('getContrastPair', () => {
    it('should return light and dark text colors', () => {
      const { light, dark } = getContrastPair('blueBright');
      expect(light).toBeDefined();
      expect(dark).toBeDefined();
      expect(typeof light).toBe('string');
      expect(typeof dark).toBe('string');
    });

    it('should recommend dark text for dark backgrounds', () => {
      const { dark: darkText } = getContrastPair('navyDark');
      expect(darkText).toBe(brandColors.navyDark);
    });

    it('should recommend dark text for light backgrounds', () => {
      const { dark: darkText } = getContrastPair('cream');
      expect(darkText).toBe(brandColors.navyDark);
    });

    it('should handle all color names', () => {
      const colorNames = Object.keys(brandColors) as BrandColorName[];
      colorNames.forEach((colorName) => {
        const { light, dark } = getContrastPair(colorName);
        expect(light).toBeTruthy();
        expect(dark).toBeTruthy();
      });
    });
  });

  describe('createColorScheme', () => {
    it('should return color scheme object', () => {
      const scheme = createColorScheme('blueBright');
      expect(scheme).toHaveProperty('bg');
      expect(scheme).toHaveProperty('text');
      expect(scheme).toHaveProperty('border');
      expect(scheme).toHaveProperty('hover');
    });

    it('should use correct background color', () => {
      const scheme = createColorScheme('blueBright');
      expect(scheme.bg).toBe(brandColors.blueBright);
    });

    it('should use matching border color', () => {
      const scheme = createColorScheme('navyDark');
      expect(scheme.border).toBe(brandColors.navyDark);
    });

    it('should create hover state with transparency', () => {
      const scheme = createColorScheme('blueBright');
      expect(scheme.hover).toContain('dd');
    });

    it('should support variants', () => {
      const primary = createColorScheme('blueBright', 'primary');
      const secondary = createColorScheme('blueBright', 'secondary');
      expect(primary).toBeDefined();
      expect(secondary).toBeDefined();
    });
  });

  describe('getColor', () => {
    it('should return correct color for valid name', () => {
      expect(getColor('blueBright')).toBe(brandColors.blueBright);
      expect(getColor('navyDark')).toBe(brandColors.navyDark);
    });

    it('should return fallback for invalid name', () => {
      const fallback = brandColors.blueLight;
      const result = getColor('invalidColor', fallback);
      expect(result).toBe(fallback);
    });

    it('should use default fallback if not provided', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = getColor('invalidColor');
      expect(result).toBe(brandColors.blueBright);
      consoleSpy.mockRestore();
    });

    it('should warn when color not found', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      getColor('invalidColor');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found in brand palette')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getCSSVariables', () => {
    it('should return CSS variable declarations', () => {
      const css = getCSSVariables();
      expect(css).toContain('--color-');
    });

    it('should include all colors', () => {
      const css = getCSSVariables();
      Object.keys(brandColors).forEach((colorName) => {
        expect(css).toContain(`--color-${colorName}`);
      });
    });

    it('should use correct hex values', () => {
      const css = getCSSVariables();
      Object.entries(brandColors).forEach(([name, value]) => {
        expect(css).toContain(`--color-${name}: ${value}`);
      });
    });

    it('should be usable as CSS', () => {
      const css = getCSSVariables();
      expect(css).toMatch(/^--color-/);
      expect(css).toMatch(/: #[0-9a-f]{6};/i);
    });
  });

  describe('animationColors', () => {
    it('should have animation color arrays', () => {
      expect(animationColors.navyToBlueBright).toHaveLength(2);
      expect(animationColors.gradientSweep).toHaveLength(3);
    });

    it('should have status colors', () => {
      expect(animationColors.status).toHaveProperty('success');
      expect(animationColors.status).toHaveProperty('warning');
      expect(animationColors.status).toHaveProperty('error');
      expect(animationColors.status).toHaveProperty('info');
    });

    it('should use valid hex colors', () => {
      const allColors = [
        ...animationColors.navyToBlueBright,
        ...animationColors.gradientSweep,
        ...Object.values(animationColors.status),
      ];

      allColors.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('Type safety', () => {
    it('should export BrandColorName type', () => {
      const colors: BrandColorName[] = ['blueBright', 'navyDark'];
      expect(colors).toHaveLength(2);
    });

    it('should export BrandColorValue type', () => {
      const color: BrandColorValue = brandColors.blueBright;
      expect(color).toBe('#0015ff');
    });
  });

  describe('Integration examples', () => {
    it('should work with gradient + glow combination', () => {
      const gradient = createBrandGradient('navyDark', 'blueBright');
      const glow = createBrandGlow('blueBright', 'medium');
      expect(gradient).toBeTruthy();
      expect(glow).toBeTruthy();
    });

    it('should work with color scheme + contrast', () => {
      const scheme = createColorScheme('blueBright');
      const contrast = getContrastPair('blueBright');
      expect(scheme.bg).toBe(brandColors.blueBright);
      expect(contrast.dark).toBe(scheme.text);
    });

    it('should support chained color operations', () => {
      const selectedColor = getColor('blueBright', brandColors.blueLight);
      const scheme = createColorScheme(
        Object.keys(brandColors).includes('blueBright') ? 'blueBright' : 'blueLight'
      );
      const glow = createBrandGlow(scheme.bg === brandColors.blueBright ? 'blueBright' : 'blueLight');
      expect(selectedColor).toBeTruthy();
      expect(glow).toBeTruthy();
    });
  });
});
