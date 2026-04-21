// src/utils/passportPathParser.js

function norm(s) {
    return s.toLowerCase().replace(/[\s_\-()]/g, '');
  }
  
  /**
   * Строит парсер из осей полученных с backend.
   *
   * @param {Array} axes — массив из form-data: [{id, code, name, values: [{id, value}]}]
   * @returns {{ parsePath, parseFolder }}
   */
  export function buildPassportParser(axes) {
    // Индекс по коду оси для быстрого поиска
    const axisByCode = Object.fromEntries(axes.map(ax => [ax.code, ax]));
  
    // Нормализованные значения для матчинга по тексту пути
    const axisNorms = Object.fromEntries(
      axes.map(ax => [
        ax.code,
        ax.values.map(v => ({ id: v.id, value: v.value, norm: norm(v.value) })),
      ])
    );
  
    /**
     * Ищет значение оси в строке сегмента пути.
     * Берёт самое длинное совпадение (наиболее специфичное).
     */
    function matchAxisValue(axisCode, text) {
      const normText = norm(text);
      const candidates = (axisNorms[axisCode] || [])
        .filter(v => normText.includes(v.norm))
        .sort((a, b) => b.norm.length - a.norm.length);
      return candidates[0] || null;
    }
  
    /**
     * Парсит webkitRelativePath одного файла.
     * Возвращает { series, design, heating, externalId, matched, raw }
     * где matched — объект {axisCode: {id, value}} для найденных значений.
     */
    function parsePath(relativePath) {
      const parts = relativePath.split('/');
      const result = {
        externalId: null,
        matched: {},   // axisCode → {id, value}
        raw: relativePath,
      };
  
      // Кандидаты дизайна — берём последний (глубже = точнее)
      const designCandidates = [];
  
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
  
        // Серия: "СЕРИЯ 200"
        if (/^СЕРИЯ\s+\d+$/i.test(seg) && axisByCode['series']) {
          const m = seg.match(/^СЕРИЯ\s+(\d+)$/i);
          if (m) {
            const found = matchAxisValue('series', m[1]);
            if (found) result.matched['series'] = found;
          }
          continue;
        }
  
        // Дизайн: "Серия_200_Оптима", "Серия_100_Оптима_МИКРО"
        if (/^Серия_\d+/i.test(seg) && axisByCode['design']) {
          const withoutPrefix = seg.replace(/^Серия_\d+_?/i, '');
          if (withoutPrefix) {
            const found = matchAxisValue('design', withoutPrefix);
            if (found) designCandidates.push(found);
          }
          continue;
        }
  
        // Нагрев: "КЭВ-ПE", "КЭВ-ПW" — последний символ
        if (/^КЭВ-П/i.test(seg) && axisByCode['heating']) {
          const m = seg.match(/КЭВ-П[А-Яа-яA-Za-z]*?([EAWG])$/i);
          if (m) {
            const found = matchAxisValue('heating', m[1].toUpperCase());
            if (found) result.matched['heating'] = found;
          }
          continue;
        }
  
        // Имя файла
        if (i === parts.length - 1) {
          result.externalId = seg.replace(/\.pdf$/i, '');
        }
      }
  
      if (designCandidates.length) {
        result.matched['design'] = designCandidates[designCandidates.length - 1];
      }
  
      // Удобные алиасы для отображения
      result.series  = result.matched['series']?.value  || null;
      result.design  = result.matched['design']?.value  || null;
      result.heating = result.matched['heating']?.value || null;
  
      return result;
    }
  
    function parseFolder(fileList) {
      return Array.from(fileList)
        .filter(f => f.name.toLowerCase().endsWith('.pdf'))
        .map(f => ({ file: f, ...parsePath(f.webkitRelativePath) }));
    }
  
    return { parsePath, parseFolder };
  }