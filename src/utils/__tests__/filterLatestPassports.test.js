import { describe, it, expect } from 'vitest';
import { filterLatestPassports } from '../filterLatestPassports';

const f = (webkitRelativePath) => ({ webkitRelativePath, name: webkitRelativePath.split('/').pop() });

describe('filterLatestPassports', () => {
  it('keeps only files from the most recent marker folder per product group', () => {
    const files = [
      f('КЭВ-ПЕ/ПАСПОРТ-2021-03/a.pdf'),
      f('КЭВ-ПЕ/ПАСПОРТ-2023-04/b.pdf'),
    ];
    expect(filterLatestPassports(files)).toEqual([files[1]]);
  });

  it('keeps all files inside the latest marker folder', () => {
    const files = [
      f('КЭВ-ПЕ/ПАСПОРТ-2021-03/a.pdf'),
      f('КЭВ-ПЕ/ПАСПОРТ-2023-04/b.pdf'),
      f('КЭВ-ПЕ/ПАСПОРТ-2023-04/c.pdf'),
    ];
    expect(filterLatestPassports(files)).toEqual([files[1], files[2]]);
  });

  it('groups independently by everything before the marker folder', () => {
    const files = [
      f('КЭВ-ПЕ/ПАСПОРТ-2021-03/a.pdf'),
      f('КЭВ-ПЕ/ПАСПОРТ-2023-04/b.pdf'),
      f('КЭВ-НВ/ПАСПОРТ-2019-01/c.pdf'),
      f('КЭВ-НВ/ПАСПОРТ-2020-06/d.pdf'),
    ];
    expect(filterLatestPassports(files)).toEqual([files[1], files[3]]);
  });

  it('drops files whose path has no marker folder at all', () => {
    const files = [
      f('КЭВ-ПЕ/ЧЕРТЕЖИ/a.pdf'),
      f('КЭВ-ПЕ/ПАСПОРТ-2023-04/b.pdf'),
    ];
    expect(filterLatestPassports(files)).toEqual([files[1]]);
  });

  it('returns an empty array when no file has the marker', () => {
    const files = [f('КЭВ-ПЕ/ЧЕРТЕЖИ/a.pdf')];
    expect(filterLatestPassports(files)).toEqual([]);
  });

  it('matches the marker case-insensitively as a folder-name prefix', () => {
    const files = [f('КЭВ-ПЕ/паспорт-2023-04/b.pdf')];
    expect(filterLatestPassports(files)).toEqual([files[0]]);
  });

  it('supports a custom marker', () => {
    const files = [
      f('КЭВ-ПЕ/ГАРАНТИЯ-2022/a.pdf'),
      f('КЭВ-ПЕ/ГАРАНТИЯ-2023/b.pdf'),
      f('КЭВ-ПЕ/ПАСПОРТ-2023-04/c.pdf'),
    ];
    expect(filterLatestPassports(files, 'ГАРАНТИЯ')).toEqual([files[1]]);
  });
});
