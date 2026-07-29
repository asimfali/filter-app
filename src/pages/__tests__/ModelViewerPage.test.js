import { describe, it, expect } from 'vitest';
import { getExt, downloadUrl, buildTree } from '../ModelViewerPage.jsx';

describe('getExt', () => {
    it('возвращает расширение в нижнем регистре', () => {
        expect(getExt('Model.STL')).toBe('stl');
        expect(getExt('model.gltf')).toBe('gltf');
    });

    it('берёт последний сегмент при нескольких точках', () => {
        expect(getExt('archive.tar.GZ')).toBe('gz');
    });

    it('без точки — возвращает всё имя файла (нет отдельной обработки "нет расширения")', () => {
        expect(getExt('noext')).toBe('noext');
    });

    it('пустое/отсутствующее имя — пустая строка', () => {
        expect(getExt('')).toBe('');
        expect(getExt(undefined)).toBe('');
        expect(getExt(null)).toBe('');
    });
});

describe('downloadUrl', () => {
    it('кодирует путь как query-параметр', () => {
        expect(downloadUrl('folder/model.stl'))
            .toBe('/api/v1/media/download/?path=folder%2Fmodel.stl');
    });

    it('кодирует кириллицу и пробелы', () => {
        expect(downloadUrl('папка/деталь 1.stl'))
            .toBe(`/api/v1/media/download/?path=${encodeURIComponent('папка/деталь 1.stl')}`);
    });
});

describe('buildTree', () => {
    const mesh = (overrides = {}) => ({
        uuid: 'mesh-1',
        name: '',
        type: 'Mesh',
        isMesh: true,
        visible: true,
        children: [],
        material: { opacity: 1, color: { getHexString: () => '888888' } },
        ...overrides,
    });

    const group = (overrides = {}) => ({
        uuid: 'group-1',
        name: '',
        type: 'Group',
        isMesh: false,
        visible: true,
        children: [],
        ...overrides,
    });

    it('возвращает null для неподдерживаемого типа объекта', () => {
        expect(buildTree({ type: 'Bone', children: [] })).toBeNull();
        expect(buildTree({ type: 'Line', children: [] })).toBeNull();
    });

    it('строит узел для меша без имени — имя вида "(Mesh)"', () => {
        const node = buildTree(mesh());
        expect(node).toMatchObject({
            uuid: 'mesh-1',
            name: '(Mesh)',
            type: 'Mesh',
            isMesh: true,
            visible: true,
            children: [],
            opacity: 1,
            color: '888888',
        });
    });

    it('пустая безымянная группа без детей отфильтровывается (null)', () => {
        expect(buildTree(group())).toBeNull();
    });

    it('пустая, но именованная группа не отфильтровывается', () => {
        const node = buildTree(group({ name: 'Корпус' }));
        expect(node).not.toBeNull();
        expect(node.name).toBe('Корпус');
        expect(node.opacity).toBe(1);
        expect(node.color).toBeNull();
    });

    it('безымянная группа с валидными детьми сохраняется, невалидные дети отфильтровываются', () => {
        const child1 = mesh({ uuid: 'mesh-child', name: 'Деталь' });
        const child2 = { uuid: 'bone-1', type: 'Bone', children: [] };
        const node = buildTree(group({ children: [child1, child2] }));
        expect(node).not.toBeNull();
        expect(node.children).toHaveLength(1);
        expect(node.children[0].uuid).toBe('mesh-child');
    });

    it('материал-массив — цвет/прозрачность берутся из первого элемента', () => {
        const node = buildTree(mesh({
            material: [
                { opacity: 0.5, color: { getHexString: () => 'ff0000' } },
                { opacity: 0.1, color: { getHexString: () => '00ff00' } },
            ],
        }));
        expect(node.opacity).toBe(0.5);
        expect(node.color).toBe('ff0000');
    });

    it('меш без материала — opacity по умолчанию 1, цвет undefined', () => {
        const node = buildTree(mesh({ material: undefined }));
        expect(node.opacity).toBe(1);
        expect(node.color).toBeUndefined();
    });

    it('не-меш — opacity всегда 1, color всегда null, даже если material задан', () => {
        const node = buildTree(group({ name: 'Группа', material: { opacity: 0.2 } }));
        expect(node.opacity).toBe(1);
        expect(node.color).toBeNull();
    });

    it('рекурсивно строит вложенное дерево', () => {
        const leaf = mesh({ uuid: 'leaf', name: 'Лист' });
        const inner = group({ uuid: 'inner', name: 'Внутренняя', children: [leaf] });
        const root = group({ uuid: 'root', name: 'Корень', children: [inner] });

        const tree = buildTree(root);
        expect(tree.uuid).toBe('root');
        expect(tree.children[0].uuid).toBe('inner');
        expect(tree.children[0].children[0].uuid).toBe('leaf');
    });
});
