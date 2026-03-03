import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import * as docx from 'docx-preview';
import { getDocBlob } from '../services/storage';

const OfficePreview = ({ docId, docBlob = null, isLoadingOuter = false }) => {
    const containerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scale, setScale] = useState(0.75); // Default zoom out slightly

    useEffect(() => {
        let isMounted = true;

        const loadAndRenderDoc = async () => {
            if (!docId || !containerRef.current) return;

            setIsLoading(true);
            setError(null);

            // Clear previous content
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }

            try {
                // Fetch the document blob if docBlob is not provided
                const blob = docBlob || await getDocBlob(docId);

                if (!isMounted) return;

                // Render the blob using docx-preview
                await docx.renderAsync(blob, containerRef.current, null, {
                    className: "docx-preview-container", // CSS class for the wrapper
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    experimental: false,
                    trimXmlDeclaration: true,
                    useBase64URL: false,
                    renderChanges: false,
                    renderHeaders: true,
                    renderFooters: true,
                    renderFootnotes: true,
                    renderEndnotes: true,
                    debug: false,
                });
            } catch (err) {
                console.error("Error rendering docx:", err);
                if (isMounted) setError("Failed to render document preview.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadAndRenderDoc();

        return () => {
            isMounted = false;
        };
    }, [docId, docBlob]);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.3));
    const handleResetZoom = () => setScale(0.85);

    return (
        <div className="relative w-full h-full bg-slate-100 flex flex-col items-center overflow-auto">
            {/* Zoom Controls Overlay */}
            <div className="sticky top-4 z-20 flex gap-2 p-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm mb-4 transition-opacity">
                <button
                    onClick={handleZoomOut}
                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Zoom Out"
                >
                    <ZoomOut size={18} />
                </button>
                <button
                    onClick={handleResetZoom}
                    className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border-x border-slate-100 flex items-center justify-center min-w-[60px]"
                    title="Reset Zoom"
                >
                    {Math.round(scale * 100)}%
                </button>
                <button
                    onClick={handleZoomIn}
                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Zoom In"
                >
                    <ZoomIn size={18} />
                </button>
            </div>

            {(isLoading || isLoadingOuter) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 transition-opacity">
                    <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                    <p className="text-sm font-medium text-slate-600">Loading Document...</p>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 text-slate-500 gap-3">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <p className="font-semibold text-slate-800">{error}</p>
                    <p className="text-sm text-center max-w-sm">The document could not be previewed natively. It might be corrupted or incompatible.</p>
                </div>
            )}

            {/* Document Container with scaling */}
            <div
                className="w-full flex justify-center pb-12 transition-transform origin-top duration-200"
                style={{ transform: `scale(${scale})` }}
            >
                <div
                    ref={containerRef}
                    className="w-full max-w-[900px] shadow-sm bg-white"
                    style={{ minHeight: '800px' }}
                />
            </div>
        </div>
    );
};

export default OfficePreview;
