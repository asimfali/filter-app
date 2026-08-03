import { useState } from 'react';
import AuthImage from './AuthImage';

// ── Слайдер изображений ───────────────────────────────────────────────────

export default function ImageSlider({ images }) {
    const [current, setCurrent] = useState(0);

    const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);
    const next = () => setCurrent(i => (i + 1) % images.length);

    if (!images || images.length === 0) return null;

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-hidden">
            {/* Основное изображение */}
            <div className="relative bg-neutral-100 dark:bg-neutral-800" style={{ height: 320 }}>
                <AuthImage
                    relPath={images[current].rel_path}
                    alt={images[current].name}
                    className="w-full h-full object-contain"
                />

                {images.length > 1 && (
                    <>
                        <button
                            onClick={prev}
                            className="absolute left-3 top-1/2 -translate-y-1/2
                                       bg-black/30 hover:bg-black/50 text-white
                                       rounded-full w-8 h-8 flex items-center justify-center
                                       transition-colors text-lg"
                        >
                            ‹
                        </button>
                        <button
                            onClick={next}
                            className="absolute right-3 top-1/2 -translate-y-1/2
                                       bg-black/30 hover:bg-black/50 text-white
                                       rounded-full w-8 h-8 flex items-center justify-center
                                       transition-colors text-lg"
                        >
                            ›
                        </button>
                        <div className="absolute bottom-3 right-3 bg-black/40 text-white
                                        text-xs px-2 py-1 rounded-full">
                            {current + 1} / {images.length}
                        </div>
                    </>
                )}
            </div>

            {/* Миниатюры */}
            {images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto">
                    {images.map((img, i) => (
                        <button
                            key={img.rel_path}
                            onClick={() => setCurrent(i)}
                            className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden
                                        border-2 transition-colors ${i === current
                                    ? 'border-blue-500'
                                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            <AuthImage
                                relPath={img.rel_path}
                                alt={img.name}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
