import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

const FilterTreeGraph = () => {
  const [connections, setConnections] = useState({});
  const [mermaidDefinition, setMermaidDefinition] = useState('');
  const [presetName, setPresetName] = useState('');
  const mermaidRef = useRef(null);

  const initialParams = {
    "серия": ["100", "200", "300"],
    "дизайн": ["комфорт", "оптима"],
    "длина": ["1000", "1500", "2000"],
    "Вид нагрева": ["E", "A", "W"],
    "мощность": ["1 КВт", "2 КВт", "5 КВт", "10 КВт"]
  };

  const parameters = Object.keys(initialParams);

  const filterRules = {
    "мощность": {
      parentParam: "Вид нагрева",
      allowedValues: ["A", "W"]
    }
  };

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }, []);

  useEffect(() => {
    const initial = {};
    parameters.forEach((param, i) => {
      if (i < parameters.length - 1) {
        initial[param] = {};
        initialParams[param].forEach(value => {
          initial[param][value] = {};
          initialParams[parameters[i + 1]].forEach(nextValue => {
            initial[param][value][nextValue] = false;
          });
        });
      }
    });
    setConnections(initial);
  }, []);
  
  useEffect(() => {
    let definition = 'graph LR\n';
    
    // Функция для проверки наличия связей
    const hasConnectedNodes = (param, value) => {
      if (!connections[param]?.[value]) return false;
      return Object.values(connections[param][value]).some(Boolean);
    };
  
    // Функция для получения связанных значений следующего параметра
    const getConnectedValues = (param, value) => {
      if (!connections[param]?.[value]) return [];
      return Object.entries(connections[param][value])
        .filter(([_, isConnected]) => isConnected)
        .map(([nextValue]) => nextValue);
    };
  
    // Начинаем с первого параметра
    const processNode = (param, value, paramIndex) => {
      const nodeId = `${param}_${value}`.replace(/\s+/g, '_');
      definition += `    ${nodeId}["${param}: ${value}"]\n`;
  
      if (paramIndex < parameters.length - 1) {
        const nextParam = parameters[paramIndex + 1];
        const connectedValues = getConnectedValues(param, value);
        
        connectedValues.forEach(nextValue => {
          const nextNodeId = `${nextParam}_${nextValue}`.replace(/\s+/g, '_');
          definition += `    ${nodeId} --> ${nextNodeId}\n`;
          processNode(nextParam, nextValue, paramIndex + 1);
        });
      }
    };
  
    // Обрабатываем только первый параметр и его связанные узлы
    const firstParam = parameters[0];
    initialParams[firstParam].forEach(value => {
      if (hasConnectedNodes(firstParam, value)) {
        processNode(firstParam, value, 0);
      }
    });
  
    setMermaidDefinition(definition);
    if (mermaidRef.current) {
      try {
        mermaid.render('mermaid-graph', definition).then(({ svg }) => {
          mermaidRef.current.innerHTML = svg;
        });
      } catch (error) {
        console.error('Error rendering mermaid graph:', error);
      }
    }
  }, [connections]);

  const handleCheckboxChange = (param, value, nextValue) => {
    const nextParam = parameters[parameters.indexOf(param) + 1];

    if (filterRules[nextParam]) {
      const rule = filterRules[nextParam];
      if (param === rule.parentParam && !rule.allowedValues.includes(value)) {
        return;
      }
    }

    setConnections(prev => ({
      ...prev,
      [param]: {
        ...prev[param],
        [value]: {
          ...prev[param][value],
          [nextValue]: !prev[param][value][nextValue]
        }
      }
    }));
  };

  const savePreset = () => {
    if (!presetName) return;
    const presets = JSON.parse(localStorage.getItem('filterPresets') || '{}');
    presets[presetName] = connections;
    localStorage.setItem('filterPresets', JSON.stringify(presets));
    setPresetName('');
  };

  const loadPreset = (name) => {
    const presets = JSON.parse(localStorage.getItem('filterPresets') || '{}');
    if (presets[name]) {
      setConnections(presets[name]);
    }
  };

  const getPresets = () => {
    const presets = JSON.parse(localStorage.getItem('filterPresets') || '{}');
    return Object.keys(presets);
  };

  const generateCombinations = () => {
    const result = [];

    const buildCombination = (current, paramIndex) => {
      if (paramIndex === parameters.length) {
        result.push(current);
        return;
      }

      const param = parameters[paramIndex];
      const values = initialParams[param];

      values.forEach(value => {
        if (paramIndex === 0) {
          buildCombination([...current, { param, value }], paramIndex + 1);
        } else {
          const prevParam = parameters[paramIndex - 1];
          const prevValue = current[current.length - 1].value;

          if (connections[prevParam]?.[prevValue]?.[value]) {
            buildCombination([...current, { param, value }], paramIndex + 1);
          }
        }
      });
    };

    buildCombination([], 0);
    return result;
  };

  const formatCombination = (combination) => {
    return combination
      .map(({ param, value }) => `${param}=${value}`)
      .join('&');
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4 items-end mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Название пресета</label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full border rounded p-2"
              placeholder="Введите название"
            />
          </div>
          <button
            onClick={savePreset}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Сохранить
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Загрузить пресет</label>
          <div className="flex gap-2 flex-wrap">
            {getPresets().map(name => (
              <button
                key={name}
                onClick={() => loadPreset(name)}
                className="bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {parameters.map((param, i) => (
            i < parameters.length - 1 && (
              <div key={param} className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-4">
                  {param} → {parameters[i + 1]}
                </h3>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="border p-2">{param}</th>
                      {initialParams[parameters[i + 1]].map(nextValue => (
                        <th key={nextValue} className="border p-2">{nextValue}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {initialParams[param].map(value => (
                      <tr key={value}>
                        <td className="border p-2">{value}</td>
                        {initialParams[parameters[i + 1]].map(nextValue => {
                          let isDisabled = false;
                          const nextParam = parameters[i + 1];
                          if (filterRules[nextParam]) {
                            const rule = filterRules[nextParam];
                            if (param === rule.parentParam && !rule.allowedValues.includes(value)) {
                              isDisabled = true;
                            }
                          }

                          return (
                            <td key={nextValue} className="border p-2 text-center">
                              <input
                                type="checkbox"
                                checked={connections[param]?.[value]?.[nextValue] || false}
                                onChange={() => handleCheckboxChange(param, value, nextValue)}
                                disabled={isDisabled}
                                className={`w-4 h-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ))}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Визуализация связей</h3>
          <div ref={mermaidRef}></div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Возможные комбинации:</h3>
        <div className="space-y-2">
          {generateCombinations().map((combination, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded text-sm font-mono">
              {formatCombination(combination)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterTreeGraph;