import React from 'react';
import FilterTreeGraph from './components/FilterTree';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: true });

function App() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Конфигуратор параметров
        </h1>
        <FilterTreeGraph />
      </div>
    </div>
  );
}

export default App;