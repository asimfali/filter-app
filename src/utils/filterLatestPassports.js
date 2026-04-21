/**
 * Из набора файлов оставляет только те что лежат
 * в последней по дате папке с маркером (по умолчанию "ПАСПОРТ").
 *
 * Группировка по: всё до маркера-папки (т.е. по изделию).
 * Пример:
 *   КЭВ-ПE/ПАСПОРТ-2021-03/file.pdf  ← отброшен
 *   КЭВ-ПE/ПАСПОРТ-2023-04/file.pdf  ← оставлен (последний)
 */
export function filterLatestPassports(files, marker = 'ПАСПОРТ') {
    const markerLower = marker.toLowerCase();
    const groups = new Map();

    for (const file of files) {
        const segments = file.webkitRelativePath.split('/');
        const markerIdx = segments.findIndex(
            s => s.toLowerCase().startsWith(markerLower)
        );

        // Нет маркера — пропускаем файл
        if (markerIdx === -1) continue;

        const key = segments.slice(0, markerIdx).join('/');
        const markerFolder = segments[markerIdx];

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ file, markerFolder });
    }

    const result = [];
    for (const entries of groups.values()) {
        const latest = entries.reduce((best, cur) =>
            cur.markerFolder > best.markerFolder ? cur : best
        );
        result.push(
            ...entries
                .filter(e => e.markerFolder === latest.markerFolder)
                .map(e => e.file)
        );
    }

    return result;
}
