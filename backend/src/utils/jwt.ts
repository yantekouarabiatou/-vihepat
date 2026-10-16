import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '../models/User';

export interface JwtPayload {
  userId: number;
  role: Role;
  /** Version des jetons du compte (User.tokenVersion) : absente sur les jetons émis avant son introduction */
  tv?: number;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES } as SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
