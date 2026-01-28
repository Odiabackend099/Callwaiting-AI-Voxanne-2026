import { createClient } from '@supabase/supabase-js';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class MFAService {
  /**
   * Generate MFA secret and QR code for enrollment
   */
  static async generateMFASecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({
      name: `Voxanne AI (${email})`,
      issuer: 'Voxanne AI',
      length: 32,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      otpauthUrl: secret.otpauth_url,
    };
  }

  /**
   * Verify TOTP code
   */
  static verifyTOTP(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after for clock drift
    });
  }

  /**
   * Generate recovery codes
   */
  static generateRecoveryCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash recovery codes for storage
   */
  static async hashRecoveryCodes(codes: string[]): Promise<string[]> {
    // In production, use bcrypt or similar
    // For now, simple hash (should be replaced with proper hashing)
    return codes.map(code => Buffer.from(code).toString('base64'));
  }

  /**
   * Verify recovery code
   */
  static async verifyRecoveryCode(
    userId: string,
    code: string
  ): Promise<boolean> {
    // This would check against stored hashed recovery codes
    // Implementation depends on where recovery codes are stored
    // For now, return false (to be implemented with proper storage)
    return false;
  }

  /**
   * Check if user has MFA enabled
   */
  static async isMFAEnabled(userId: string): Promise<boolean> {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !data) {
      return false;
    }

    // Check if user has any MFA factors enrolled
    const factors = data.user.factors || [];
    return factors.some((factor: any) => factor.status === 'verified');
  }

  /**
   * Get MFA factors for user
   */
  static async getMFAFactors(userId: string) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !data) {
      throw new Error('Failed to fetch user MFA factors');
    }

    return data.user.factors || [];
  }

  /**
   * Disable MFA for user (admin only)
   */
  static async disableMFA(userId: string, factorId: string) {
    const { error } = await supabase.auth.admin.deleteFactor({
      id: factorId,
      userId,
    });

    if (error) {
      throw new Error(`Failed to disable MFA: ${error.message}`);
    }
  }
}
