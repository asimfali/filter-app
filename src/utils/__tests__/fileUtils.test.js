import { describe, it, expect } from 'vitest';
import { canPreview3D, is3DModelType } from '../fileUtils';

describe('canPreview3D', () => {
  it.each(['glb', 'gltf', 'stl', 'obj'])('returns true for .%s files', (ext) => {
    expect(canPreview3D(`model.${ext}`)).toBe(true);
  });

  it('is case-insensitive on extension', () => {
    expect(canPreview3D('model.GLB')).toBe(true);
  });

  it('returns false for non-3D extensions', () => {
    expect(canPreview3D('document.pdf')).toBe(false);
  });

  it('handles filenames with multiple dots by using the last extension', () => {
    expect(canPreview3D('archive.tar.gz')).toBe(false);
    expect(canPreview3D('scan.v2.obj')).toBe(true);
  });

  it('returns false for empty/undefined/no-extension input', () => {
    expect(canPreview3D('')).toBe(false);
    expect(canPreview3D(undefined)).toBe(false);
    expect(canPreview3D('noext')).toBe(false);
  });
});

describe('is3DModelType', () => {
  it('returns true only for the "models" doc type code', () => {
    expect(is3DModelType('models')).toBe(true);
    expect(is3DModelType('passports')).toBe(false);
    expect(is3DModelType(undefined)).toBe(false);
  });
});
