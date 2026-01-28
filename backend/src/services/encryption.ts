import crypto from 'crypto';
import { config } from '../config';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';

// Initialization Vector length
const IV_LENGTH = 12;

// Auth Tag length (GCM)
const AUTH_TAG_LENGTH = 16;

/**
 * Service for handling AES-256-GCM encryption and decryption
 * Uses the master ENCRYPTION_KEY from environment variables
 */
export class EncryptionService {
    private static key: Buffer;

    /**
     * Initialize the master key buffer
     */
    private static getKey(): Buffer {
        if (!this.key) {
            const keyString = config.ENCRYPTION_KEY;

            // Ensure key is 32 bytes (256 bits)
            // If hex string provided, parse it. If plain text, hash it to 32 bytes.
            if (keyString.length === 64 && /^[0-9a-f]+$/i.test(keyString)) {
                this.key = Buffer.from(keyString, 'hex');
            } else {
                // Fallback: scrypt derivation (consistent, deterministic)
                // Note: For best security, users should generate a random 32-byte hex and set it as ENCRYPTION_KEY
                this.key = crypto.createHash('sha256').update(keyString).digest();
            }
        }
        return this.key;
    }

    /**
     * Encrypt a string value
     * Returns format: iv:authTag:encryptedContent (hex encoded)
     */
    static encrypt(text: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = this.getKey();

        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Get auth tag (GCM specific)
        const authTag = cipher.getAuthTag().toString('hex');

        // Return composed string
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    /**
     * Decrypt a stored string
     * Expects format: iv:authTag:encryptedContent (hex encoded)
     */
    static decrypt(encryptedText: string): string {
        const parts = encryptedText.split(':');

        if (parts.length !== 3) {
            throw new Error('Invalid encrypted text format');
        }

        const [ivHex, authTagHex, contentHex] = parts;

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = this.getKey();

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt
        let decrypted = decipher.update(contentHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Helper to encrypt a JSON object
     */
    static encryptObject(data: Record<string, any>): string {
        return this.encrypt(JSON.stringify(data));
    }

    /**
     * Helper to decrypt to a JSON object
     */
    static decryptObject<T = Record<string, any>>(encryptedText: string): T {
        const decrypted = this.decrypt(encryptedText);
        return JSON.parse(decrypted) as T;
    }
}
