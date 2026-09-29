import { describe, it, expect } from 'vitest';
import { nkAttrName, readinessBadge, nkStatusLabel } from '../nk';

describe('nk utils', () => {
    it('имя атрибута с запасным вариантом', () => {
        expect(nkAttrName(13933)).toBe('Код ТНВЭД');
        expect(nkAttrName(1)).toBe('attr #1');
    });
    it('бейдж готовности', () => {
        expect(readinessBadge(undefined).label).toBe('…');
        expect(readinessBadge({ has_profile: false }).label).toBe('Нет профиля');
        expect(readinessBadge({ has_profile: true, ready: true }).label).toBe('Готова');
        expect(readinessBadge({ has_profile: true, ready: false, problems: ['a', 'b'] }).label).toBe('Проблем: 2');
    });
    it('статус НК', () => {
        expect(nkStatusLabel('moderation')).toBe('На модерации');
        expect(nkStatusLabel('x')).toBe('x');
    });
});
