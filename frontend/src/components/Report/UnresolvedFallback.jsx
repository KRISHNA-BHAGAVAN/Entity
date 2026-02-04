
import React, { useState, useEffect } from 'react';
import { X, FileText, Check, Loader2, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { apiCall } from '../../config/api';
import { useToast } from '../../contexts/ToastContext';

const UnresolvedFallback = ({ isOpen, onClose, events, columns, onResolved }) => {
    const toast = useToast();
    if (!isOpen) return null;

    const [selectedDocs, setSelectedDocs] = useState({}); // { eventId: [docId1, docId2] }
    const [docOptions, setDocOptions] = useState({}); // { eventId: [{id, name}] }
    const [loadingDocs, setLoadingDocs] = useState({}); // { eventId: true/false }
    const [processing, setProcessing] = useState(false);
    const [currentEventIndex, setCurrentEventIndex] = useState(0);

    const activeEvent = events[currentEventIndex];

    useEffect(() => {
        // Determine which event needs docs loaded
        if (activeEvent && !docOptions[activeEvent.event_id]) {
            fetchDocsForEvent(activeEvent.event_id);
        }
    }, [activeEvent]);

    const fetchDocsForEvent = async (eventId) => {
        setLoadingDocs(prev => ({ ...prev, [eventId]: true }));
        try {
            const data = await apiCall(`/docs?event_id=${eventId}`);
            setDocOptions(prev => ({ ...prev, [eventId]: data.docs || [] }));
        } catch (error) {
            console.error("Failed to load docs", error);
        } finally {
            setLoadingDocs(prev => ({ ...prev, [eventId]: false }));
        }
    };

    const toggleDocSelection = (eventId, docId) => {
        setSelectedDocs(prev => {
            const current = prev[eventId] || [];
            if (current.includes(docId)) {
                return { ...prev, [eventId]: current.filter(id => id !== docId) };
            } else {
                return { ...prev, [eventId]: [...current, docId] };
            }
        });
    };

    const handleProcess = async () => {
        setProcessing(true);
        try {
            const resolvedData = [];

            // Process each event sequentially
            for (const event of events) {
                const docIds = selectedDocs[event.event_id] || [];

                let result = {};
                if (docIds.length > 0) {
                    // Call backend to resolve
                    const resp = await apiCall('/report/resolve', {
                        method: 'POST',
                        body: JSON.stringify({
                            event_id: event.event_id,
                            doc_ids: docIds,
                            missing_columns: event.unresolved_columns
                        })
                    });
                    result = resp.resolved_data;
                } else {
                    // No docs selected, mark as null/empty
                    event.unresolved_columns.forEach(col => result[col] = null);
                }

                // Merge resolved data into the event's partial data
                resolvedData.push({
                    ...event.partial_data,
                    ...result
                });
            }

            onResolved(resolvedData);
            onClose();

        } catch (error) {
            console.error("Resolution failed:", error);
            toast.error("Failed to process selected documents.");
        } finally {
            setProcessing(false);
        }
    };

    if (!activeEvent) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl border border-slate-200 shadow-xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="text-amber-500" size={20} />
                            Unresolved Data
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">
                            Event {currentEventIndex + 1} of {events.length}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-2 rounded-full"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                    <div className="mb-6 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <h4 className="text-md font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">
                            {activeEvent.event_name}
                        </h4>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                            <span className="font-bold block mb-2 text-amber-900 flex items-center gap-2">
                                <AlertTriangle size={14} /> Missing Values & Hints:
                            </span>
                            <div className="space-y-3 pl-1">
                                {activeEvent.unresolved_columns.map(colName => {
                                    const colInfo = columns.find(c => c.name === colName);
                                    return (
                                        <div key={colName} className="flex flex-col gap-0.5">
                                            <span className="font-semibold text-amber-900">• {colName}</span>
                                            {colInfo?.description && (
                                                <span className="text-amber-700 ml-3 text-xs italic">Hint: {colInfo.description}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Select Documents to Analyze:</h5>

                        {loadingDocs[activeEvent.event_id] ? (
                            <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-8 bg-white rounded-lg border border-slate-200 border-dashed">
                                <Loader2 className="animate-spin text-indigo-500" size={24} />
                                <span className="text-sm">Loading documents...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {docOptions[activeEvent.event_id]?.map(doc => {
                                    const isSelected = (selectedDocs[activeEvent.event_id] || []).includes(doc.id);
                                    return (
                                        <div
                                            key={doc.id}
                                            id={`resolve-doc-${doc.id}`}
                                            onClick={() => toggleDocSelection(activeEvent.event_id, doc.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected
                                                    ? 'bg-indigo-600 border-indigo-600'
                                                    : 'bg-white border-slate-300'
                                                }`}>
                                                {isSelected && <Check size={14} className="text-white" />}
                                            </div>
                                            <FileText size={18} className={isSelected ? "text-indigo-600" : "text-slate-400"} />
                                            <span className={`truncate text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>
                                                {doc.name}
                                            </span>
                                        </div>
                                    );
                                })}
                                {(!docOptions[activeEvent.event_id] || docOptions[activeEvent.event_id].length === 0) && (
                                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-white rounded-lg border border-slate-200 border-dashed">
                                        <FileText size={24} className="mb-2 opacity-20" />
                                        <span className="text-sm italic">No documents found for this event.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white rounded-b-xl">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentEventIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentEventIndex === 0}
                            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-slate-600 text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors"
                        >
                            <ArrowLeft size={16} /> Previous
                        </button>
                        <button
                            onClick={() => setCurrentEventIndex(prev => Math.min(events.length - 1, prev + 1))}
                            disabled={currentEventIndex === events.length - 1}
                            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-slate-600 text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors"
                        >
                            Next <ArrowRight size={16} />
                        </button>
                    </div>

                    <button
                        id="resolve-process-btn"
                        onClick={handleProcess}
                        disabled={processing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                        {processing ? 'Processing...' : 'Resolve & Generate'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default UnresolvedFallback;
