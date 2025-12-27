import { useState, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  Sparkles,
  Download,
  Wand2,
  Eye,
  Table,
  BarChart3,
  Undo2,
  Redo2,
  X,
  Plus,
  Save,
} from 'lucide-react';

import { getDocs, downloadFile } from '../services/storage';
import { discoverSchema } from '../services/aiService';
import { generateFinalDoc } from '../services/docService';
import { apiCall } from '../config/api';
import { getMarkdownFromCache } from '../services/markdownCache';

import MarkdownPreview from './MarkdownPreview';
import EditableTable from './EditableTable';
import JSZip from 'jszip';

const SchemaDiscovery = ({ event }) => {
  /* ===================== STATE ===================== */
  const [docs, setDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [schemaData, setSchemaData] = useState(null);
  const [fieldReferences, setFieldReferences] = useState({});
  const [referenceReplacements, setReferenceReplacements] = useState({});
  const [fieldHistory, setFieldHistory] = useState({});

  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedFieldKey, setSelectedFieldKey] = useState(null);

  const [activeTab, setActiveTab] = useState('fields'); // fields | tables | stats
  const [schemaViewMode, setSchemaViewMode] = useState('rendered');
  const [jsonSchemaText, setJsonSchemaText] = useState('');

  const [editableTables, setEditableTables] = useState([]);
  const [tableEdits, setTableEdits] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newRefInputs, setNewRefInputs] = useState({});
  const [error, setError] = useState(null);

  const handleTableUpdate = (tableIndex, newData) => {
    const originalTable = editableTables[tableIndex];
    if (!originalTable) return;
    
    const edits = [];
    newData.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const originalCell = originalTable.preview?.[rowIdx]?.[colIdx] || '';
        if (cell !== originalCell) {
          edits.push({
            table_index: tableIndex,
            row: rowIdx,
            col: colIdx,
            old_value: originalCell,
            new_value: cell
          });
        }
      });
    });
    
    setTableEdits(prev => {
      const filtered = prev.filter(edit => edit.table_index !== tableIndex);
      return [...filtered, ...edits];
    });
  };

  /* ===================== EFFECTS ===================== */
  useEffect(() => {
    const fetchDocs = async () => {
      setIsLoadingDocs(true);
      try {
        const loaded = await getDocs(event.id);
        setDocs(loaded);
        // Don't auto-select all docs
        setSelectedDocs(new Set());
        
        // Initialize editable tables from stored document data
        const allTables = [];
        loaded.forEach(doc => {
          if (doc.tableData && doc.tableData.length > 0) {
            doc.tableData.forEach(table => {
              allTables.push({
                ...table,
                filename: doc.name
              });
            });
          }
        });
        setEditableTables(allTables);
        
        // Load existing schema from event
        if (event.event_schema) {
          try {
            const existingSchema = typeof event.event_schema === 'string' 
              ? JSON.parse(event.event_schema) 
              : event.event_schema;
            
            setSchemaData(existingSchema);
            setFieldReferences(existingSchema.fieldReferences || {});
            
            const initialReplacements = {};
            Object.entries(existingSchema.fieldReferences || {}).forEach(([fieldKey, refs]) => {
              refs.forEach(ref => {
                initialReplacements[`${fieldKey}:${ref}`] = ref;
              });
            });
            setReferenceReplacements(initialReplacements);
          } catch (err) {
            console.error('Failed to parse event schema:', err);
          }
        }
      } catch {
        setError('Failed to load documents');
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [event.id, event.event_schema]);

  useEffect(() => {
    if (schemaData) {
      setJsonSchemaText(JSON.stringify(schemaData, null, 2));
    }
  }, [schemaData]);

  // Field management functions
  const saveFieldState = (fieldKey) => {
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) => key.startsWith(`${fieldKey}:`))
      )
    };
    
    setFieldHistory(prev => {
      const history = prev[fieldKey] || { past: [], future: [] };
      return {
        ...prev,
        [fieldKey]: {
          past: [...history.past, currentState],
          future: []
        }
      };
    });
  };

  const undoField = (fieldKey) => {
    const history = fieldHistory[fieldKey];
    if (!history?.past.length) return;
    
    const previousState = history.past[history.past.length - 1];
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) => key.startsWith(`${fieldKey}:`))
      )
    };
    
    setFieldReferences(prev => ({ ...prev, [fieldKey]: previousState.references }));
    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      Object.keys(prev).filter(key => key.startsWith(`${fieldKey}:`)).forEach(key => delete newReplacements[key]);
      return { ...newReplacements, ...previousState.replacements };
    });
    
    setFieldHistory(prev => ({
      ...prev,
      [fieldKey]: {
        past: history.past.slice(0, -1),
        future: [currentState, ...history.future]
      }
    }));
  };

  const redoField = (fieldKey) => {
    const history = fieldHistory[fieldKey];
    if (!history?.future.length) return;
    
    const nextState = history.future[0];
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) => key.startsWith(`${fieldKey}:`))
      )
    };
    
    setFieldReferences(prev => ({ ...prev, [fieldKey]: nextState.references }));
    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      Object.keys(prev).filter(key => key.startsWith(`${fieldKey}:`)).forEach(key => delete newReplacements[key]);
      return { ...newReplacements, ...nextState.replacements };
    });
    
    setFieldHistory(prev => ({
      ...prev,
      [fieldKey]: {
        past: [...history.past, currentState],
        future: history.future.slice(1)
      }
    }));
  };

  const removeReference = (fieldKey, refIndex) => {
    saveFieldState(fieldKey);
    const refToRemove = fieldReferences[fieldKey][refIndex];
    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: prev[fieldKey].filter((_, i) => i !== refIndex)
    }));
    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      delete newReplacements[`${fieldKey}:${refToRemove}`];
      return newReplacements;
    });
  };

  const addReference = (fieldKey, newRef) => {
    if (!newRef.trim()) return;
    saveFieldState(fieldKey);
    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: [...(prev[fieldKey] || []), newRef]
    }));
    setReferenceReplacements(prev => ({
      ...prev,
      [`${fieldKey}:${newRef}`]: newRef
    }));
    setNewRefInputs(prev => ({ ...prev, [fieldKey]: '' }));
  };

  const updateReferenceReplacement = (fieldKey, reference, replacement) => {
    setReferenceReplacements(prev => ({
      ...prev,
      [`${fieldKey}:${reference}`]: replacement
    }));
  };

  const createNewField = () => {
    if (!newFieldName.trim()) return;
    const fieldKey = newFieldName.toLowerCase().replace(/\s+/g, '_');
    
    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: []
    }));
    
    setSchemaData(prev => ({
      ...prev,
      schema: {
        ...prev.schema,
        document_fields: {
          ...prev.schema.document_fields,
          fields: {
            ...prev.schema.document_fields.fields,
            [fieldKey]: {
              label: newFieldName,
              references: []
            }
          }
        }
      }
    }));
    
    setNewFieldName('');
  };

  // Handle text selection from markdown preview
  const handleTextSelect = (selectedText) => {
    if (!selectedFieldKey || !selectedText.trim()) return;
    addReference(selectedFieldKey, selectedText.trim());
  };

  // Find locations of text in markdown content
  const findTextLocations = (content, searchText, filename) => {
    if (!content || !searchText) return [];
    
    const lines = content.split('\n');
    const locations = [];
    
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let startPos = 0;
      
      while (true) {
        const pos = line.indexOf(searchText, startPos);
        if (pos === -1) break;
        
        const globalCharStart = lines.slice(0, lineIdx).reduce((sum, l) => sum + l.length + 1, 0) + pos;
        
        locations.push({
          filename,
          type: "paragraph",
          line_index: lineIdx,
          char_start: globalCharStart,
          char_end: globalCharStart + searchText.length,
          line_char_start: pos,
          line_char_end: pos + searchText.length,
          text: searchText,
          context_line: line.slice(0, 100)
        });
        
        startPos = pos + 1;
      }
    }
    
    return locations;
  };

  // Get highlight locations for selected field
  const getHighlightLocations = () => {
    if (!selectedFieldKey || !schemaData?.schema?.document_fields?.fields) return [];
    
    const selectedDoc = docs.find(d => d.id === selectedDocId);
    if (!selectedDoc) return [];

    const references = fieldReferences[selectedFieldKey] || [];
    const content = getMarkdownFromCache(selectedDocId) || selectedDoc.markdownContent || '';

    const allLocations = [];
    references.forEach(ref => {
      const locations = findTextLocations(content, ref, selectedDoc.name);
      allLocations.push(...locations);
    });

    return allLocations;
  };

  const deleteField = (fieldKey) => {
    if (selectedFieldKey === fieldKey) {
      setSelectedFieldKey(null);
    }
    setFieldReferences(prev => {
      const newRefs = { ...prev };
      delete newRefs[fieldKey];
      return newRefs;
    });
    
    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      Object.keys(prev).filter(key => key.startsWith(`${fieldKey}:`)).forEach(key => delete newReplacements[key]);
      return newReplacements;
    });
    
    setSchemaData(prev => {
      const newFields = { ...prev.schema.document_fields.fields };
      delete newFields[fieldKey];
      return {
        ...prev,
        schema: {
          ...prev.schema,
          document_fields: {
            ...prev.schema.document_fields,
            fields: newFields
          }
        }
      };
    });
    
    setFieldHistory(prev => {
      const newHistory = { ...prev };
      delete newHistory[fieldKey];
      return newHistory;
    });
  };
  const handleDiscoverSchema = async () => {
    if (!selectedDocs.size) return;
    setIsDiscovering(true);
    setError(null);

    try {
      const documents = docs
        .filter(d => selectedDocs.has(d.id))
        .map(d => ({
          filename: d.name,
          markdown: getMarkdownFromCache(d.id) || d.markdownContent || '',
        }))
        .filter(d => d.markdown.trim());

      console.log('Sending documents for schema discovery:', documents);
      const result = await discoverSchema(documents);
      console.log('Schema discovery result:', result);
      
      setSchemaData(result);

      const fields = result?.schema?.document_fields?.fields || {};
      const refs = {};
      const reps = {};

      Object.entries(fields).forEach(([k, f]) => {
        refs[k] = f.references || [];
        f.references?.forEach(r => (reps[`${k}:${r}`] = r));
      });

      setFieldReferences(refs);
      setReferenceReplacements(reps);
      
      // Initialize editable tables from schema result
      const schemaTables = result?.tables || [];
      const allTables = [...editableTables];
      schemaTables.forEach(table => {
        allTables.push({
          ...table,
          filename: 'Schema Discovery'
        });
      });
      setEditableTables(allTables);
    } catch (err) {
      console.error('Schema discovery error:', err);
      setError(`Schema discovery failed: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const saveSchema = async () => {
    if (!schemaData) return;
    setIsSaving(true);

    try {
      // Save to event_schema column
      await apiCall(`/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_schema: {
            schema: schemaData.schema,
            fieldReferences,
          }
        })
      });
      alert('Schema saved');
    } catch {
      setError('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const replacements = Object.entries(referenceReplacements)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => k.split(':')[1]);

      if (docs.length === 1) {
        const blob = await generateFinalDoc(docs[0].id, {}, [], tableEdits);
        downloadFile(blob, `SCHEMA_${docs[0].name}`);
      } else {
        const zip = new JSZip();
        for (const doc of docs) {
          const blob = await generateFinalDoc(doc.id, {}, [], tableEdits);
          zip.file(`SCHEMA_${doc.name}`, blob);
        }
        downloadFile(
          await zip.generateAsync({ type: 'blob' }),
          `${event.name}_Schema.zip`
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  /* ===================== RENDER ===================== */
  if (isLoadingDocs) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100 rounded-xl overflow-hidden">
      {/* ================= HEADER ================= */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Wand2 className="text-indigo-600" />
              Schema Discovery
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Automatically detect reusable fields across documents
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Document Selection Dropdown */}
            <div className="relative">
              <details className="relative">
                <summary className="px-3 py-2 border rounded-lg text-sm min-w-[200px] cursor-pointer bg-white">
                  Select Documents ({selectedDocs.size}/{docs.length})
                </summary>
                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[200px] max-h-48 overflow-y-auto">
                  {docs.map(doc => (
                    <label key={doc.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDocs.has(doc.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedDocs);
                          if (e.target.checked) {
                            newSelected.add(doc.id);
                          } else {
                            newSelected.delete(doc.id);
                          }
                          setSelectedDocs(newSelected);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm truncate">{doc.name}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>

            <button
              onClick={handleDiscoverSchema}
              disabled={isDiscovering || selectedDocs.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 hover:cursor-pointer disabled:opacity-50"
            >
              {isDiscovering ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              {schemaData ? 'Re-discover' : 'Discover'} Schema ({selectedDocs.size})
            </button>
          </div>
        </div>
      </div>

      {/* ================= MAIN ================= */}
      <div className="flex flex-1 overflow-hidden">
        {/* ===== LEFT PREVIEW ===== */}
        <aside className="w-[45%] bg-white border-r flex flex-col">
          <div className="px-5 py-3 border-b font-semibold text-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={16} />
              Document Preview
            </div>
            <select
              value={selectedDocId || ''}
              onChange={e => setSelectedDocId(e.target.value)}
              className="px-3 py-1 rounded border text-sm min-w-[180px]"
            >
              <option value="">Select document…</option>
              {docs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4">
            <div className="border rounded-lg h-[calc(100vh-200px)] overflow-auto">
              {selectedDocId ? (
                <MarkdownPreview
                  content={
                    getMarkdownFromCache(selectedDocId) ||
                    docs.find(d => d.id === selectedDocId)?.markdownContent ||
                    ''
                  }
                  highlightLocations={getHighlightLocations()}
                  onTextSelect={handleTextSelect}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Select a document to preview
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ===== RIGHT PANEL ===== */}
        <section className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="flex bg-white border-b">
            {[
              ['fields', 'Fields', Sparkles],
              ['tables', 'Tables', Table],
              ['stats', 'Stats', BarChart3],
            ].map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${
                  activeTab === k
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeTab === 'fields' && (
              <>
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex gap-2">
                    <input
                      value={newFieldName}
                      onChange={e => setNewFieldName(e.target.value)}
                      placeholder="Create new field…"
                      className="flex-1 px-3 py-2 border rounded-lg"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          createNewField();
                        }
                      }}
                    />
                    <button 
                      onClick={createNewField}
                      disabled={!newFieldName.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {schemaData && (
                  <div className="space-y-4">
                    {Object.entries(fieldReferences).map(([fieldKey, refs]) => {
                      const field = schemaData?.schema?.document_fields?.fields?.[fieldKey] || {};
                      const label = field.label || fieldKey.replace(/_/g, ' ');
                      
                      return (
                        <div key={fieldKey} className={`bg-white rounded-xl border p-4 transition-colors ${
                          selectedFieldKey === fieldKey 
                            ? 'border-purple-300 bg-purple-50' 
                            : 'border-slate-200'
                        }`}>
                          <div className="flex justify-between items-start mb-1">
                            <div className='flex gap-3 items-center w-full'>
                              <button
                                onClick={() => setSelectedFieldKey(selectedFieldKey === fieldKey ? null : fieldKey)}
                                className={`text-sm font-semibold transition-colors ${
                                  selectedFieldKey === fieldKey 
                                    ? 'text-purple-700' 
                                    : 'text-slate-800 hover:text-purple-600'
                                }`}
                              >
                                {label} {selectedFieldKey === fieldKey && '(highlighting)'}
                              </button>
                              {field.location_count > 0 && (
                                <div className="text-xs text-slate-500 ">
                                  ({field.location_count} locations found)
                                </div>
                              )}
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={() => undoField(fieldKey)}
                                disabled={!fieldHistory[fieldKey]?.past.length}
                                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-100 hover:cursor-pointer"
                                title="Undo"
                              >
                                <Undo2 size={15} />
                              </button>
                              <button
                                onClick={() => redoField(fieldKey)}
                                disabled={!fieldHistory[fieldKey]?.future.length}
                                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-100 hover:cursor-pointer"
                                title="Redo"
                              >
                                <Redo2 size={15} />
                              </button>
                              <button
                                onClick={() => deleteField(fieldKey)}
                                className="p-1 text-red-500 hover:text-red-700"
                                title="Delete field"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                          
                         
                          {refs.length > 0 && (
                            <div className="">
                              <div className='flex items-center justify-between px-1 py-1 border-amber-600'>
                                <div className="text-xs text-slate-500 mb-2 translate-y-2">
                                  References and Replacements ({refs.length}):
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <input
                                    type="text"
                                    value={newRefInputs[fieldKey] || ''}
                                    onChange={(e) => setNewRefInputs(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                    placeholder="Add new reference..."
                                    className=" border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addReference(fieldKey, newRefInputs[fieldKey] || '');
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => addReference(fieldKey, newRefInputs[fieldKey] || '')}
                                    disabled={!(newRefInputs[fieldKey] || '').trim()}
                                    className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 hover:cursor-pointer disabled:opacity-80"
                                  >
                                    <Plus size={15} />
                                  </button>
                                </div>

                              </div>
                              <div className="space-y-2 overflow-y-auto">
                                {refs.map((ref, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-red-500 rounded p-2">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="text-xs text-slate-600 flex-1 mr-2 whitespace-pre-wrap">
                                        {ref}
                                      </div>
                                      <button
                                        onClick={() => removeReference(fieldKey, idx)}
                                        className="text-red-500 hover:text-red-700 p-1 shrink-0"
                                        title="Remove reference"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                    <textarea
                                      value={referenceReplacements[`${fieldKey}:${ref}`] || ''}
                                      onChange={(e) => updateReferenceReplacement(fieldKey, ref, e.target.value)}
                                      placeholder={`Replacement for "${ref}"`}
                                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent resize-none"
                                      rows={Math.max(1, Math.ceil((referenceReplacements[`${fieldKey}:${ref}`] || '').length / 50))}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                         
                        </div>
                      );
                    })}
                  </div>
                )}

                {!schemaData && (
                  <div className="text-center text-slate-400 py-10">
                    No schema discovered yet
                  </div>
                )}
              </>
            )}

            {activeTab === 'tables' && (
              <div className="space-y-4">
                {editableTables.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Table size={32} className="mx-auto mb-2" />
                    <p>No tables found in documents</p>
                  </div>
                ) : (
                  editableTables.map((table, index) => (
                    <div key={index} className="bg-white rounded-xl border p-4">
                      <div className="text-xs text-slate-500 mb-2">
                        From: {table.filename}
                      </div>
                      <EditableTable
                        tableData={table}
                        onTableUpdate={(tableIndex, newData) => handleTableUpdate(index, newData)}
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="bg-white rounded-xl border p-6">
                <p className="text-sm text-slate-600">
                  Stats will appear after schema discovery
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t bg-white p-4 flex gap-3">
            <button
              onClick={saveSchema}
              disabled={isSaving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold"
            >
              <Save size={16} className="inline mr-2" />
              Save Schema
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold"
            >
              <Download size={16} className="inline mr-2" />
              Generate
            </button>
          </div>
        </section>
      </div>

      {error && (
        <div className="m-4 bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
};

export default SchemaDiscovery;
