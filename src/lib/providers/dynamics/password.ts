// src/lib/providers/dynamics/password.ts
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt
 * Uses 12 rounds for a good balance of security and performance
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
