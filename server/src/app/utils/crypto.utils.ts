import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of the provided string.
 * This is used for securely storing and identifying refresh tokens in Redis.
 *
 * @param {string} token - The raw token string to hash
 * @returns {string} The SHA-256 hex hash
 */
export function hashToken(token: string): string {
  if (!token) {
    throw new Error('Token to hash cannot be empty');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}
