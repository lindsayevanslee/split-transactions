import { describe, it, expect } from 'vitest';
import { getSafeRedirect } from './redirect';

describe('getSafeRedirect', () => {
  it('defaults to the groups list when no redirect is given', () => {
    expect(getSafeRedirect(null)).toBe('/groups');
    expect(getSafeRedirect(undefined)).toBe('/groups');
    expect(getSafeRedirect('')).toBe('/groups');
  });

  it('keeps an in-app invite path including its query string', () => {
    expect(getSafeRedirect('/accept-invite?token=abc123')).toBe('/accept-invite?token=abc123');
  });

  it('keeps other in-app paths', () => {
    expect(getSafeRedirect('/groups/xyz')).toBe('/groups/xyz');
  });

  it('rejects absolute URLs', () => {
    expect(getSafeRedirect('https://evil.example')).toBe('/groups');
    expect(getSafeRedirect('javascript:alert(1)')).toBe('/groups');
  });

  it('rejects protocol-relative and backslash paths', () => {
    expect(getSafeRedirect('//evil.example')).toBe('/groups');
    expect(getSafeRedirect('/\\evil.example')).toBe('/groups');
  });

  it('rejects relative paths', () => {
    expect(getSafeRedirect('groups')).toBe('/groups');
  });
});
