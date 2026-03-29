/**
 * Recovery codes for Two-Factor Authentication
 * Used as backup when TOTP device is unavailable
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// Configuration
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 8;
const SALT_ROUNDS = 10;

/**
 * Generate a set of recovery codes
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // Generate random alphanumeric code
    const code = crypto.randomBytes(RECOVERY_CODE_LENGTH)
      .toString('hex')
      .toUpperCase()
      .slice(0, RECOVERY_CODE_LENGTH);
    
    // Format as XXXX-XXXX for readability
    const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;
    codes.push(formattedCode);
  }
  
  return codes;
}

/**
 * Hash recovery codes for storage
 * Each code is individually hashed so we can verify and remove used codes
 */
export async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const hashedCodes: string[] = [];
  
  for (const code of codes) {
    // Remove hyphens for hashing
    const cleanCode = code.replace(/-/g, '');
    const hash = await bcrypt.hash(cleanCode, SALT_ROUNDS);
    hashedCodes.push(hash);
  }
  
  // Store as JSON array
  return JSON.stringify(hashedCodes);
}

/**
 * Verify a recovery code against hashed codes
 * Returns the index of the matched code if valid, -1 otherwise
 */
export async function verifyRecoveryCode(
  code: string, 
  hashedCodesJson: string
): Promise<number> {
  try {
    const hashedCodes: string[] = JSON.parse(hashedCodesJson);
    
    // Remove hyphens from input code
    const cleanCode = code.replace(/-/g, '').toUpperCase();
    
    // Check each hashed code
    for (let i = 0; i < hashedCodes.length; i++) {
      const isMatch = await bcrypt.compare(cleanCode, hashedCodes[i]);
      if (isMatch) {
        return i; // Return index of matched code
      }
    }
    
    return -1; // No match found
  } catch (error) {
    console.error('[Recovery Codes] Verification error:', error);
    return -1;
  }
}

/**
 * Remove a used recovery code from the stored codes
 * Returns updated JSON string with the used code removed
 */
export function removeUsedRecoveryCode(
  hashedCodesJson: string, 
  usedIndex: number
): string {
  try {
    const hashedCodes: string[] = JSON.parse(hashedCodesJson);
    
    // Remove the used code
    hashedCodes.splice(usedIndex, 1);
    
    return JSON.stringify(hashedCodes);
  } catch (error) {
    console.error('[Recovery Codes] Remove error:', error);
    return hashedCodesJson;
  }
}

/**
 * Count remaining recovery codes
 */
export function countRemainingRecoveryCodes(hashedCodesJson: string): number {
  try {
    const hashedCodes: string[] = JSON.parse(hashedCodesJson);
    return hashedCodes.length;
  } catch (error) {
    return 0;
  }
}