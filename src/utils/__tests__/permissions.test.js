import { describe, it, expect } from 'vitest';
import { can, canAny } from '../permissions';

describe('can', () => {
  it('returns false when user is null', () => {
    expect(can(null, 'catalog.binding.write')).toBe(false);
  });

  it('returns false when user has no matching permission', () => {
    const user = { permissions: ['bom.spec.view'] };
    expect(can(user, 'catalog.binding.write')).toBe(false);
  });

  it('returns true when user has the permission', () => {
    const user = { permissions: ['catalog.binding.write'] };
    expect(can(user, 'catalog.binding.write')).toBe(true);
  });
});

describe('canAny', () => {
  it('returns false when user is null', () => {
    expect(canAny(null, ['bom.spec.view'])).toBe(false);
  });

  it('returns true if user has at least one of the codes', () => {
    const user = { permissions: ['bom.spec.view'] };
    expect(canAny(user, ['bom.spec.write', 'bom.spec.view'])).toBe(true);
  });

  it('returns false if user has none of the codes', () => {
    const user = { permissions: ['bom.spec.view'] };
    expect(canAny(user, ['bom.spec.write', 'plm.stage.manage'])).toBe(false);
  });
});
