import { sanitizeName, maskPhone } from '../src/utils/sanitize';
import { withTimeout } from '../src/utils/timeout-helper';

describe('Production Fixes Verification', () => {
  describe('Timeout Cleanup', () => {
    it('should cleanup timeout on success', async () => {
      const before = (process as any)._getActiveHandles().length;
      
      await withTimeout(
        Promise.resolve('success'),
        1000
      );
      
      const after = (process as any)._getActiveHandles().length;
      expect(after).toBeLessThanOrEqual(before);
    });

    it('should cleanup timeout on failure', async () => {
      const before = (process as any)._getActiveHandles().length;
      
      try {
        await withTimeout(
          new Promise((_, reject) => setTimeout(() => reject('fail'), 100)),
          1000
        );
      } catch {}
      
      const after = (process as any)._getActiveHandles().length;
      expect(after).toBeLessThanOrEqual(before);
    });
  });

  describe('Template Injection Prevention', () => {
    it('should remove ${} expressions', () => {
      const malicious = '${process.exit(1)}';
      const sanitized = sanitizeName(malicious);
      expect(sanitized).not.toContain('${');
      expect(sanitized).not.toContain('process');
    });

    it('should remove dangerous characters', () => {
      const malicious = '<script>alert("xss")</script>';
      const sanitized = sanitizeName(malicious);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should limit length', () => {
      const long = 'a'.repeat(200);
      const sanitized = sanitizeName(long);
      expect(sanitized.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Phone Masking', () => {
    it('should mask phone number', () => {
      const masked = maskPhone('+15551234567');
      expect(masked).toContain('****');
      expect(masked).toContain('4567');
      expect(masked).not.toContain('555');
    });
  });
});
