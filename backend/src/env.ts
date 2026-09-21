import { existsSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

/**
 * Resolve the path to the nearest .env file.
 * Checks the current working directory first. If not found,
 * checks exactly one directory up (parent directory).
 * Does not traverse beyond one level up.
 */
export function resolveEnvPath(
  cwd: string = process.cwd(),
  exists: (path: string) => boolean = existsSync
): string | null {
  const current = resolve(cwd, '.env');
  if (exists(current)) {
    return current;
  }

  const parent = resolve(cwd, '..', '.env');
  if (exists(parent)) {
    return parent;
  }

  return null;
}

/**
 * Load environment variables into process.env from either ./.env or ../.env.
 */
export function loadEnv(
  cwd: string = process.cwd(),
  exists: (path: string) => boolean = existsSync
): string | null {
  const envPath = resolveEnvPath(cwd, exists);
  if (envPath !== null) {
    dotenv.config({ path: envPath });
    return envPath;
  }
  dotenv.config();
  return null;
}

/**
 * Parse and validate the server port.
 * Defaults to 6798 when unset or invalid.
 */
export function getPort(rawPort: string | undefined): number {
  if (!rawPort) return 6798;
  const parsed = Number(rawPort);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6798;
}

/**
 * Check whether Express should trust reverse proxy headers.
 * Enabled when TRUST_PROXY is 'true' or '1' (case-insensitive).
 */
export function shouldTrustProxy(rawTrust: string | undefined): boolean {
  if (!rawTrust) return false;
  const normalized = rawTrust.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

/**
 * Determine the runtime NODE_ENV.
 * Defaults to 'production' if unset or empty.
 */
export function getNodeEnv(rawNodeEnv: string | undefined): string {
  if (rawNodeEnv && rawNodeEnv.trim() !== '') {
    return rawNodeEnv.trim();
  }
  return 'production';
}

// Automatically load the environment file upon import
loadEnv();

// Apply default NODE_ENV if not already set
if (!process.env.NODE_ENV || process.env.NODE_ENV.trim() === '') {
  process.env.NODE_ENV = getNodeEnv(process.env.NODE_ENV);
}
