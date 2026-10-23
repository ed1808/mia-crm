import { describe, expect, it } from 'bun:test';
import { runMigrations } from './migrator';
import { withTenant } from './tenant';

describe('Database package integration', () => {
  it('exposes runMigrations and withTenant contracts', () => {
    expect(typeof runMigrations).toBe('function');
    expect(typeof withTenant).toBe('function');
  });
});
