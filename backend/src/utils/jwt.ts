// ============================================================
// backend/src/utils/jwt.ts
//
// FIX 2: La variable en .env era JWT_EXPIRY pero el código
// leía JWT_EXPIRES → siempre usaba el default de 8h.
// Ahora acepta AMBOS nombres para compatibilidad hacia atrás.
// El default sube a 24h para uso normal de restaurante.
// ============================================================

import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'change-this-secret-in-production';

// FIX: acepta JWT_EXPIRES (correcto) O JWT_EXPIRY (el que estaba en .env)
const EXPIRES = process.env.JWT_EXPIRES ?? process.env.JWT_EXPIRY ?? '24h';

export function generateToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);
}

export function verifyToken(token: string): jwt.JwtPayload | string {
  return jwt.verify(token, SECRET);
}