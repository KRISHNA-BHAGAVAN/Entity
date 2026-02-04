
import React, { useState, useEffect } from 'react';
import { Plus, X, GripVertical, Save, Edit2, Columns, Info } from 'lucide-react';
import { apiCall } from '../../config/api';
import { useToast } from '../../contexts/ToastContext';
import { FileDown, AlertTriangle, CheckCircle, Loader2, Calendar } from 'lucide-react';
import UnresolvedFallback from './UnresolvedFallback';


const ColumnConfig = () => {
    const toast = useToast();
    const [columns, setColumns] = useState([]);
    const [newColumn, setNewColumn] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draggedItemIndex, setDraggedItemIndex] = useState(null); // Track the item being dragged

    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [generating, setGenerating] = useState(false);
    const [status, setStatus] = useState(null); // null, 'success', 'error', 'unresolved'
    const [reportData, setReportData] = useState(null);
    const [unresolvedEvents, setUnresolvedEvents] = useState([]);
    const [skippedEvents, setSkippedEvents] = useState([]);
    const [showUnresolvedModal, setShowUnresolvedModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    const SYSTEM_COLUMNS = ['S.No', 'Event Name', 'Event Date'];

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}-${m}-${y}`;
    };




    const handleGenerate = async () => {
        setGenerating(true);
        setStatus(null);
        setReportData(null);
        setUnresolvedEvents([]);
        setSkippedEvents([]);

        try {
            // 1. Get columns first (includes name and description)
            const colsData = await apiCall('/report/columns');
            const columns = colsData.columns || []; // These are objects: { name, description, ... }

            if (columns.length === 0) {
                toast.error("Please define at least one column first.");
                setGenerating(false);
                return;
            }

            // 2. Generate Preview
            const result = await apiCall('/report/generate', {
                method: 'POST',
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate,
                    columns: columns
                })
            });

            const hasUnresolved = result.unresolved_events && result.unresolved_events.length > 0;
            const hasSkipped = result.skipped_events && result.skipped_events.length > 0;

            setSkippedEvents(result.skipped_events || []);
            setUnresolvedEvents(result.unresolved_events || []);

            if (hasUnresolved) {
                setStatus('unresolved');
                setReportData({
                    columns,
                    rows: result.valid_rows,
                    partial_rows: []
                });
            } else {
                setStatus('success');
                setReportData({ columns, rows: result.valid_rows });
                const columnNames = columns.map(c => c.name);
                await downloadExcel(columnNames, result.valid_rows);
            }

            // Show summary if anything happened (even if just success)
            setShowSummaryModal(true);

        } catch (error) {
            console.error("Report generation failed:", error);
            setStatus('error');
            toast.error(error.detail?.message || error.message || "Failed to generate report");
        } finally {
            setGenerating(false);
        }
    };

    const handleResolutionComplete = async (resolvedRows) => {
        const allRows = [...(reportData.rows || []), ...resolvedRows];
        setReportData(prev => ({ ...prev, rows: allRows }));
        setStatus('success');
        const columnNames = reportData.columns.map(c => c.name);
        await downloadExcel(columnNames, allRows);
        setShowUnresolvedModal(false);
    };

    const downloadExcel = async (columns, rows) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/report/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    columns,
                    rows,
                    start_date: startDate,
                    end_date: endDate
                })
            });

            if (!response.ok) throw new Error("Download failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Consolidated Report: ${formatDate(startDate)}_To_${formatDate(endDate)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);


        } catch (e) {
            console.error("Download error:", e);
            toast.error("Failed to download Excel file.");
        }
    };



    const handleAddSystemColumn = (sysCol) => {
        // Prevent duplicates
        if (columns.some(c => c.name === sysCol)) {
            toast.error(`${sysCol} is already added.`);
            return;
        }
        setColumns([...columns, {
            name: sysCol,
            description: 'System Column (Auto-filled)',
            order: columns.length,
            isSystem: true
        }]);
    };

    const handleDragStart = (e, index) => {
        setDraggedItemIndex(index);
    };

    const handleDragEnter = (e, index) => {
        if (draggedItemIndex === null) return;
        if (draggedItemIndex === index) return;

        const newColumns = [...columns];
        const draggedItem = newColumns[draggedItemIndex];

        // Remove from old position
        newColumns.splice(draggedItemIndex, 1);
        // Insert at new position
        newColumns.splice(index, 0, draggedItem);

        setColumns(newColumns);
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    useEffect(() => {
        fetchColumns();
    }, []);

    const fetchColumns = async () => {
        setLoading(true);
        try {
            const data = await apiCall('/report/columns');
            // Sort by order
            const sorted = (data.columns || []).sort((a, b) => a.order - b.order);
            setColumns(sorted);
        } catch (error) {
            console.error('Failed to fetch columns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddColumn = () => {
        if (!newColumn.trim()) return;
        setColumns([...columns, {
            name: newColumn.trim(),
            description: newDescription.trim(),
            order: columns.length
        }]);
        setNewColumn('');
        setNewDescription('');
    };

    const updateColumnDescription = (index, value) => {
        const newCols = [...columns];
        newCols[index].description = value;
        setColumns(newCols);
    };

    const updateColumnName = (index, value) => {
        const newCols = [...columns];
        newCols[index].name = value;
        setColumns(newCols);
    };

    const handleRemoveColumn = (index) => {
        const newCols = columns.filter((_, i) => i !== index);
        setColumns(newCols);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Re-index order just in case
            const payload = columns.map((col, idx) => ({ ...col, order: idx }));
            await apiCall('/report/columns', {
                method: 'POST',
                body: JSON.stringify({ columns: payload })
            });
            toast.success('Columns saved successfully!');
        } catch (error) {
            toast.error('Failed to save columns: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-slate-400 p-4 text-center">Loading columns...</div>;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-900 shadow-sm h-full flex flex-col min-w-full">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Columns size={18} className="text-indigo-600" />
                            Consolidated Report: {formatDate(startDate)}_To_{formatDate(endDate)}
                        </h3>
                    </div>


                    {/* Filters integrated into header */}
                    <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-xs font-medium text-slate-600 outline-none border-none p-0 w-[100px]"
                            />
                        </div>
                        <div className="w-px h-3 bg-slate-200" />

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-xs font-medium text-slate-600 outline-none border-none p-0 w-[100px]"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                    >
                        {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                        {generating ? 'Analyzing...' : 'Generate Report'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-100 transition-all disabled:opacity-50"
                    >
                        <Save size={14} />
                        {saving ? 'Saving...' : 'Save Config'}
                    </button>
                </div>
            </div>

            {/* In-header Status Notifications */}
            {status && (
                <div className="mb-4">
                    {status === 'success' && (
                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 animate-in fade-in slide-in-from-top-1">
                            <CheckCircle size={14} />
                            Report downloaded successfully!
                        </div>
                    )}
                    {status === 'unresolved' && (
                        <div className="flex items-center justify-between gap-2 text-amber-700 text-xs font-medium bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={14} />
                                Found {unresolvedEvents.length} items needing review.
                            </div>
                            <button
                                onClick={() => setShowUnresolvedModal(true)}
                                className="text-amber-900 font-bold hover:underline"
                            >
                                Resolve Now →
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex overflow-y-hidden">

                <div className="min-w-[600px] shrink-0 overflow-y-auto pr-1 space-y-3 mb-4 max-h-[480px] custom-scrollbar">

                    {columns.map((col, index) => (
                        <div
                            key={index}
                            draggable={editingIndex === null} // Disable drag when editing
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className={`flex flex-col gap-2 w-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group ${draggedItemIndex === index ? 'opacity-50 border-dashed border-indigo-300' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`cursor-move text-slate-400 hover:text-slate-600 p-1 ${editingIndex !== null ? 'cursor-not-allowed opacity-50' : ''}`}>
                                    <GripVertical size={16} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    {editingIndex === index && !col.isSystem && !SYSTEM_COLUMNS.includes(col.name) ? (
                                        <input
                                            id={`col-name-edit-${index}`}
                                            name={`column_name_${index}`}
                                            type="text"
                                            value={col.name}
                                            onChange={(e) => updateColumnName(index, e.target.value)}
                                            onBlur={() => setEditingIndex(null)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') setEditingIndex(null);
                                                if (e.key === 'Escape') setEditingIndex(null);
                                            }}
                                            autoFocus
                                            className="w-full px-2 py-1 text-sm font-semibold text-slate-800 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                                        />
                                    ) : (
                                        <h4 className="text-sm font-semibold text-slate-700 truncate" title={col.name}>
                                            {col.name}
                                        </h4>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setEditingIndex(index)}
                                        disabled={SYSTEM_COLUMNS.includes(col.name)}
                                        className={`p-1.5 rounded-md transition-colors ${SYSTEM_COLUMNS.includes(col.name) ? 'opacity-30 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
                                        title="Edit name"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleRemoveColumn(index)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                        title="Delete column"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="pl-8 relative">
                                <Info size={12} className="absolute left-3 top-2.5 text-slate-300" />
                                <input
                                    id={`col-desc-edit-${index}`}
                                    name={`column_desc_${index}`}
                                    type="text"
                                    value={col.description || ''}
                                    onChange={(e) => updateColumnDescription(index, e.target.value)}
                                    placeholder="Description / hint for AI..."
                                    disabled={SYSTEM_COLUMNS.includes(col.name)}
                                    className={`w-full pl-6 pr-3 py-1.5 border border-slate-100 rounded text-xs text-slate-600 placeholder:text-slate-400 focus:bg-white focus:border-indigo-200 focus:ring-1 focus:ring-indigo-100 outline-none transition-all ${SYSTEM_COLUMNS.includes(col.name) ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50'}`}
                                />
                            </div>
                        </div>
                    ))}

                    {columns.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <Columns size={32} className="mb-2 opacity-20" />
                            <p className="text-sm font-medium">No columns defined</p>
                            <p className="text-xs mt-1">Add a column below to get started</p>
                        </div>
                    )}
                </div>

                <div className="pl-4 border-l border-slate-100 flex flex-col justify-end w-full">
                    {/* System Columns Buttons */}
                    <div className="mb-4 flex flex-wrap gap-2">
                        {SYSTEM_COLUMNS.map(sysCol => (
                            <button
                                key={sysCol}
                                onClick={() => handleAddSystemColumn(sysCol)}
                                disabled={columns.some(c => c.name === sysCol)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${columns.some(c => c.name === sysCol)
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                                    }`}
                            >
                                + {sysCol}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Add Custom Column</span>
                        <input
                            id="new-col-name"
                            name="new_column_name"
                            type="text"
                            value={newColumn}
                            onChange={(e) => setNewColumn(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                            placeholder="Column Name (e.g., Speaker Name)"

                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        />
                        <div className="flex gap-2">
                            <input
                                id="new-col-desc"
                                name="new_column_desc"
                                type="text"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder="Optional hint..."
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-600 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                            />
                            <button
                                onClick={handleAddColumn}
                                disabled={!newColumn.trim()}
                                className="px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 rounded-md text-xs font-semibold uppercase flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <UnresolvedFallback
                isOpen={showUnresolvedModal}
                onClose={() => setShowUnresolvedModal(false)}
                events={unresolvedEvents}
                columns={reportData?.columns || []}
                onResolved={handleResolutionComplete}
            />

            {/* Generation Summary Modal */}
            {showSummaryModal && (
                <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <FileDown className="text-indigo-600" size={20} />
                                Generation Summary
                            </h3>
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-4">
                                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                        <CheckCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-900">Successfully Processed</p>
                                        <p className="text-xl font-black text-emerald-600">{reportData?.rows?.length || 0} Events</p>
                                    </div>
                                </div>

                                {unresolvedEvents.length > 0 && (
                                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-4">
                                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-amber-900">Attention Needed</p>
                                            <p className="text-xl font-black text-amber-600">{unresolvedEvents.length} Events</p>
                                        </div>
                                    </div>
                                )}

                                {skippedEvents.length > 0 && (
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="p-2 bg-slate-200 rounded-lg text-slate-600">
                                                <X size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">Skipped (No Documents)</p>
                                                <p className="text-xl font-black text-slate-500">{skippedEvents.length} Events</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {skippedEvents.map((name, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500 font-medium">
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                            {unresolvedEvents.length > 0 && (
                                <button
                                    onClick={() => {
                                        setShowSummaryModal(false);
                                        setShowUnresolvedModal(true);
                                    }}
                                    className="px-4 py-2 text-sm font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl transition-all"
                                >
                                    Resolve Issues Now
                                </button>
                            )}
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 transition-all"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};


export default ColumnConfig;
