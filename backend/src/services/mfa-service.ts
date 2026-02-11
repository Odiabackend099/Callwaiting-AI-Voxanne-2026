import { createClient } from '@supabase/supabase-js';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Security: bcrypt work factor for recovery code hashing
const RECOVERY_CODE_SALT_ROUNDS = 12;

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
   * Generate recovery codes and store hashed versions in database
   * SECURITY: Uses bcrypt one-way hashing (NOT reversible Base64 encoding)
   * @returns Array of plaintext recovery codes to display to user ONCE
   */
  static async generateRecoveryCodes(userId: string, count: number = 10): Promise<string[]> {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate cryptographically secure random 16-character hex code
      const code = crypto.randomBytes(8).toString('hex');
      codes.push(code);

      // Hash with bcrypt (irreversible, one-way hashing)
      const hashedCode = await bcrypt.hash(code, RECOVERY_CODE_SALT_ROUNDS);

      // Store hash in database (NOT the plaintext code)
      const { error } = await supabase.from('auth.mfa_factors').insert({
        user_id: userId,
        factor_type: 'recovery_code',
        secret: hashedCode,
        status: 'unverified',
      });

      if (error) {
        throw new Error(`Failed to store recovery code: ${error.message}`);
      }
    }

    return codes; // Return plaintext codes to user ONCE for saving
  }

  /**
   * Verify recovery code against stored bcrypt hash
   * SECURITY: Uses bcrypt.compare() for timing-safe comparison
   * @returns true if code matches and marks it as verified (single-use)
   */
  static async verifyRecoveryCode(
    userId: string,
    code: string
  ): Promise<boolean> {
    // Fetch all unverified recovery codes for this user
    const { data: factors, error } = await supabase
      .from('auth.mfa_factors')
      .select('*')
      .eq('user_id', userId)
      .eq('factor_type', 'recovery_code')
      .eq('status', 'unverified');

    if (error || !factors || factors.length === 0) {
      return false;
    }

    // Compare input code against each stored bcrypt hash
    for (const factor of factors) {
      const isMatch = await bcrypt.compare(code, factor.secret);

      if (isMatch) {
        // Mark this specific code as verified (single-use enforcement)
        const { error: updateError } = await supabase
          .from('auth.mfa_factors')
          .update({ status: 'verified' })
          .eq('id', factor.id);

        if (updateError) {
          throw new Error(`Failed to mark recovery code as used: ${updateError.message}`);
        }

        return true;
      }
    }

    return false; // No codes matched
  }

  /**
   * DEPRECATED: Use generateRecoveryCodes() instead
   * This function was vulnerable (used Base64 encoding instead of hashing)
   */
  static async hashRecoveryCodes(codes: string[]): Promise<string[]> {
    throw new Error('DEPRECATED: hashRecoveryCodes() is insecure. Use generateRecoveryCodes() with bcrypt hashing.');
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
