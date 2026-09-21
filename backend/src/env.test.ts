import { describe, expect, it } from 'vitest';
import { resolve } from 'path';
import {
  resolveEnvPath,
  getPort,
  shouldTrustProxy,
  getNodeEnv,
} from './env.js';

describe('env configuration helpers', () => {
  describe('resolveEnvPath', () => {
    const cwd = '/app/backend';
    const cwdEnv = resolve(cwd, '.env');
    const parentEnv = resolve(cwd, '..', '.env');
    const grandparentEnv = resolve(cwd, '..', '..', '.env');

    it('returns .env from current working directory when present', () => {
      const existsMock = (path: string): boolean => path === cwdEnv;
      expect(resolveEnvPath(cwd, existsMock)).toBe(cwdEnv);
    });

    it('falls back to parent directory (../.env) when cwd .env is absent', () => {
      const existsMock = (path: string): boolean => path === parentEnv;
      expect(resolveEnvPath(cwd, existsMock)).toBe(parentEnv);
    });

    it('prefers cwd .env over parent .env when both exist', () => {
      const existsMock = (path: string): boolean =>
        path === cwdEnv || path === parentEnv;
      expect(resolveEnvPath(cwd, existsMock)).toBe(cwdEnv);
    });

    it('returns null and does not traverse more than one parent folder', () => {
      // grandparentEnv exists, but neither cwd nor parent exists
      const existsMock = (path: string): boolean => path === grandparentEnv;
      expect(resolveEnvPath(cwd, existsMock)).toBeNull();
    });

    it('returns null when no .env exists in cwd or parent', () => {
      const existsMock = (): boolean => false;
      expect(resolveEnvPath(cwd, existsMock)).toBeNull();
    });
  });

  describe('getPort', () => {
    it('returns the numeric port when a valid string is passed', () => {
      expect(getPort('3000')).toBe(3000);
      expect(getPort('8080')).toBe(8080);
    });

    it('defaults to 6798 when undefined, empty, or invalid', () => {
      expect(getPort(undefined)).toBe(6798);
      expect(getPort('')).toBe(6798);
      expect(getPort('not-a-number')).toBe(6798);
      expect(getPort('-1')).toBe(6798);
      expect(getPort('0')).toBe(6798);
    });
  });

  describe('shouldTrustProxy', () => {
    it('returns true when set to "true" or "1"', () => {
      expect(shouldTrustProxy('true')).toBe(true);
      expect(shouldTrustProxy('1')).toBe(true);
      expect(shouldTrustProxy('TRUE')).toBe(true);
    });

    it('returns false when undefined, empty, or set to other values', () => {
      expect(shouldTrustProxy(undefined)).toBe(false);
      expect(shouldTrustProxy('')).toBe(false);
      expect(shouldTrustProxy('false')).toBe(false);
      expect(shouldTrustProxy('0')).toBe(false);
      expect(shouldTrustProxy('no')).toBe(false);
    });
  });

  describe('getNodeEnv', () => {
    it('returns the configured NODE_ENV when present', () => {
      expect(getNodeEnv('development')).toBe('development');
      expect(getNodeEnv('test')).toBe('test');
      expect(getNodeEnv('custom')).toBe('custom');
    });

    it('defaults to "production" when undefined or empty', () => {
      expect(getNodeEnv(undefined)).toBe('production');
      expect(getNodeEnv('')).toBe('production');
    });
  });
});
