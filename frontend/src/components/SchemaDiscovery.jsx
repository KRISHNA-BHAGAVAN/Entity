import { useState, useEffect } from 'react';
import {
  Loader2,
  Sparkles,
  Download,
  Wand2,
  Eye,
  Table,
  BarChart3,
  Save,
} from 'lucide-react';

import { getDocs, downloadFile } from '../services/storage';
import { discoverSchema } from '../services/aiService';
import { generateFinalDoc } from '../services/docService';
import { apiCall } from '../config/api';
import { getMarkdownFromCache } from '../services/markdownCache';

import MarkdownPreview from './MarkdownPreview';
import FieldsTab from './FieldsTab';
import TablesTab from './TablesTab';
import StatsTab from './StatsTab';
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
  const [selectedFieldKeys, setSelectedFieldKeys] = useState(new Set());
  const [highlightAll, setHighlightAll] = useState(false);

  const [activeTab, setActiveTab] = useState('fields');
  const [editableTables, setEditableTables] = useState([]);
  const [tableEdits, setTableEdits] = useState([]);
  const [tableViewModes, setTableViewModes] = useState({});
  const [newFieldName, setNewFieldName] = useState('');
  const [newRefInputs, setNewRefInputs] = useState({});
  const [editingRef, setEditingRef] = useState(null);
  const [editRefValue, setEditRefValue] = useState('');
  const [error, setError] = useState(null);

  const handleTableToggle = (tableIndex) => {
    setTableViewModes(prev => ({
      ...prev,
      [tableIndex]: prev[tableIndex] === 'edited' ? 'original' : 'edited'
    }));
  };

  const handleTableUpdate = (tableIndex, edits) => {
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
        setSelectedDocs(new Set());

        const allTables = [];
        loaded.forEach(doc => {
          if (doc.tableData && doc.tableData.length > 0) {
            doc.tableData.forEach(table => {
              allTables.push({
                ...table,
                filename: doc.name,
              });
            });
          }
        });
        setEditableTables(allTables);

        if (loaded.length > 0) {
          setSelectedDocId(loaded[0].id);
        }
        
        if (event.event_schema) {
          try {
            const existingSchema =
              typeof event.event_schema === 'string'
                ? JSON.parse(event.event_schema)
                : event.event_schema;

            setSchemaData(existingSchema);

            const fieldsFromSchema =
              existingSchema.schema?.document_fields?.fields || {};
            const refsFromSchema = {};
            Object.entries(fieldsFromSchema).forEach(([key, field]) => {
              if (Array.isArray(field.references)) {
                refsFromSchema[key] = field.references;
              }
            });

            const mergedFieldRefs = {
              ...refsFromSchema,
              ...(existingSchema.fieldReferences || {}),
            };

            setFieldReferences(mergedFieldRefs);

            const initialReplacements = {};
            Object.entries(mergedFieldRefs).forEach(([fieldKey, refs]) => {
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

  // Field management functions
  const saveFieldState = fieldKey => {
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) =>
          key.startsWith(`${fieldKey}:`),
        ),
      ),
    };

    setFieldHistory(prev => {
      const history = prev[fieldKey] || { past: [], future: [] };
      return {
        ...prev,
        [fieldKey]: {
          past: [...history.past, currentState],
          future: [],
        },
      };
    });
  };

  const undoField = fieldKey => {
    const history = fieldHistory[fieldKey];
    if (!history?.past.length) return;

    const previousState = history.past[history.past.length - 1];
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) =>
          key.startsWith(`${fieldKey}:`),
        ),
      ),
    };

    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: previousState.references,
    }));
    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      Object.keys(prev)
        .filter(key => key.startsWith(`${fieldKey}:`))
        .forEach(key => delete newReplacements[key]);
      return { ...newReplacements, ...previousState.replacements };
    });

    setFieldHistory(prev => ({
      ...prev,
      [fieldKey]: {
        past: history.past.slice(0, -1),
        future: [currentState, ...history.future],
      },
    }));
  };

  const redoField = fieldKey => {
    const history = fieldHistory[fieldKey];
    if (!history?.future.length) return;

    const nextState = history.future[0];
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) =>
          key.startsWith(`${fieldKey}:`),
        ),
      ),
    };

    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: nextState.references,
    }));
    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      Object.keys(prev)
        .filter(key => key.startsWith(`${fieldKey}:`))
        .forEach(key => delete newReplacements[key]);
      return { ...newReplacements, ...nextState.replacements };
    });

    setFieldHistory(prev => ({
      ...prev,
      [fieldKey]: {
        past: [...history.past, currentState],
        future: history.future.slice(1),
      },
    }));
  };

  const removeReference = (fieldKey, refIndex) => {
    saveFieldState(fieldKey);
    const refToRemove = fieldReferences[fieldKey][refIndex];
    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: prev[fieldKey].filter((_, i) => i !== refIndex),
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
      [fieldKey]: [...(prev[fieldKey] || []), newRef],
    }));
    setReferenceReplacements(prev => ({
      ...prev,
      [`${fieldKey}:${newRef}`]: newRef,
    }));
    setNewRefInputs(prev => ({ ...prev, [fieldKey]: '' }));
  };

  const editReference = (fieldKey, refIndex, currentRef) => {
    setEditingRef(`${fieldKey}:${refIndex}`);
    setEditRefValue(currentRef);
  };

  const saveEditedReference = (fieldKey, refIndex) => {
    if (!editRefValue.trim()) return;
    
    const oldRef = fieldReferences[fieldKey][refIndex];
    saveFieldState(fieldKey);
    
    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: prev[fieldKey].map((ref, idx) => 
        idx === refIndex ? editRefValue.trim() : ref
      ),
    }));
    
    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      const oldKey = `${fieldKey}:${oldRef}`;
      const newKey = `${fieldKey}:${editRefValue.trim()}`;
      
      if (oldKey !== newKey) {
        newReplacements[newKey] = prev[oldKey] || editRefValue.trim();
        delete newReplacements[oldKey];
      }
      
      return newReplacements;
    });
    
    setEditingRef(null);
    setEditRefValue('');
  };

  const cancelEdit = () => {
    setEditingRef(null);
    setEditRefValue('');
  };

  const updateReferenceReplacement = (fieldKey, reference, replacement) => {
    setReferenceReplacements(prev => ({
      ...prev,
      [`${fieldKey}:${reference}`]: replacement,
    }));
  };

  const createNewField = () => {
    if (!newFieldName.trim()) return;
    const fieldKey = newFieldName.toLowerCase().replace(/\s+/g, '_');

    setFieldReferences(prev => ({
      ...prev,
      [fieldKey]: [],
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
              references: [],
            },
          },
        },
      },
    }));

    setNewFieldName('');
  };

  const handleFieldSelect = fieldKey => {
    const newSelected = new Set(selectedFieldKeys);
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey);
    } else {
      newSelected.add(fieldKey);
    }
    setSelectedFieldKeys(newSelected);
  };

  const handleNewRefInputChange = (fieldKey, value) => {
    setNewRefInputs(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleTextSelect = selectedText => {
    if (!selectedFieldKeys.size || !selectedText.trim()) return;
    const firstFieldKey = Array.from(selectedFieldKeys)[0];
    addReference(firstFieldKey, selectedText.trim());
  };

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

        const globalCharStart = lines
          .slice(0, lineIdx)
          .reduce((sum, l) => sum + l.length + 1, 0) + pos;

        locations.push({
          filename,
          type: 'paragraph',
          line_index: lineIdx,
          char_start: globalCharStart,
          char_end: globalCharStart + searchText.length,
          line_char_start: pos,
          line_char_end: pos + searchText.length,
          text: searchText,
          context_line: line.slice(0, 100),
        });

        startPos = pos + 1;
      }
    }

    return locations;
  };

  const getHighlightLocations = () => {
    const selectedDoc = docs.find(d => d.id === selectedDocId);
    if (!selectedDoc) return [];

    const content = selectedDoc.markdownContent || '';

    const allLocations = [];

    if (highlightAll) {
      Object.entries(fieldReferences).forEach(([fieldKey, references]) => {
        references.forEach(ref => {
          const locations = findTextLocations(content, ref, selectedDoc.name);
          allLocations.push(...locations);
        });
      });
    } else if (selectedFieldKeys.size > 0) {
      selectedFieldKeys.forEach(fieldKey => {
        const references = fieldReferences[fieldKey] || [];
        references.forEach(ref => {
          const locations = findTextLocations(content, ref, selectedDoc.name);
          allLocations.push(...locations);
        });
      });
    }

    return allLocations;
  };

  const deleteField = fieldKey => {
    if (selectedFieldKeys.has(fieldKey)) {
      const newSelected = new Set(selectedFieldKeys);
      newSelected.delete(fieldKey);
      setSelectedFieldKeys(newSelected);
    }
    setFieldReferences(prev => {
      const newRefs = { ...prev };
      delete newRefs[fieldKey];
      return newRefs;
    });

    setReferenceReplacements(prev => {
      const newReplacements = { ...prev };
      Object.keys(prev)
        .filter(key => key.startsWith(`${fieldKey}:`))
        .forEach(key => delete newReplacements[key]);
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
            fields: newFields,
          },
        },
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
          markdown: d.markdownContent || '',
        }))
        .filter(d => d.markdown.trim());

      const result = await discoverSchema(documents);
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

      const schemaTables = result?.tables || [];
      const allTables = [...editableTables];
      schemaTables.forEach(table => {
        allTables.push({
          ...table,
          filename: 'Schema Discovery',
        });
      });
      setEditableTables(allTables);
    } catch (err) {
      setError(`Schema discovery failed: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const saveSchema = async () => {
    if (!schemaData) return;
    setIsSaving(true);

    try {
      const tableModifications = {};
      tableEdits.forEach(edit => {
        if (!tableModifications[edit.table_index]) {
          tableModifications[edit.table_index] = {
            original_table: editableTables[edit.table_index],
            modifications: []
          };
        }
        tableModifications[edit.table_index].modifications.push({
          row: edit.row,
          col: edit.col,
          old_value: edit.old_value,
          new_value: edit.new_value
        });
      });

      await apiCall(`/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_schema: {
            schema: schemaData.schema,
            fieldReferences,
            tableModifications,
          },
        }),
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
      // Create replacements array using current fieldReferences (which includes edits)
      const replacements = [];
      Object.entries(fieldReferences).forEach(([fieldKey, refs]) => {
        refs.forEach(ref => {
          const userInput = referenceReplacements[`${fieldKey}:${ref}`];
          if (userInput && userInput.trim() && userInput.trim() !== ref.trim()) {
            replacements.push([ref, userInput.trim()]);
          }
        });
      });

      // Debug logging
      console.log('\n=== SCHEMA DISCOVERY GENERATE DEBUG ===');
      console.log('Field References:', fieldReferences);
      console.log('Reference Replacements:', referenceReplacements);
      console.log('Replacements being sent:', replacements);
      console.log('Table Edits:', tableEdits);
      console.log('======================================\n');

      if (docs.length === 1) {
        const blob = await generateFinalDoc(docs[0].id, null, replacements, tableEdits);
        downloadFile(blob, `SCHEMA_${docs[0].name}`);
      } else {
        const zip = new JSZip();
        for (const doc of docs) {
          const blob = await generateFinalDoc(doc.id, null, replacements, tableEdits);
          zip.file(`SCHEMA_${doc.name}`, blob);
        }
        downloadFile(
          await zip.generateAsync({ type: 'blob' }),
          `${event.name}_Schema.zip`,
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoadingDocs) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100 rounded-xl overflow-hidden">
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
            <div className="relative">
              <details className="relative">
                <summary className="px-3 py-2 border rounded-lg text-sm min-w-[200px] cursor-pointer bg-white">
                  Select Documents ({selectedDocs.size}/{docs.length})
                </summary>
                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[200px] max-h-48 overflow-y-auto">
                  {docs.map(doc => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocs.has(doc.id)}
                        onChange={e => {
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

      <div className="flex flex-1 overflow-hidden">
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
                    docs.find(d => d.id === selectedDocId)?.markdownContent || ''
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

        <section className="flex-1 flex flex-col">
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

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeTab === 'fields' && (
              <FieldsTab
                schemaData={schemaData}
                fieldReferences={fieldReferences}
                selectedFieldKeys={selectedFieldKeys}
                fieldHistory={fieldHistory}
                newRefInputs={newRefInputs}
                editingRef={editingRef}
                editRefValue={editRefValue}
                referenceReplacements={referenceReplacements}
                newFieldName={newFieldName}
                highlightAll={highlightAll}
                onFieldSelect={handleFieldSelect}
                onUndoField={undoField}
                onRedoField={redoField}
                onDeleteField={deleteField}
                onAddReference={addReference}
                onRemoveReference={removeReference}
                onEditReference={editReference}
                onSaveEditedReference={saveEditedReference}
                onCancelEdit={cancelEdit}
                onUpdateReferenceReplacement={updateReferenceReplacement}
                onNewRefInputChange={handleNewRefInputChange}
                onEditRefValueChange={setEditRefValue}
                onNewFieldNameChange={setNewFieldName}
                onCreateNewField={createNewField}
                onHighlightAllToggle={() => setHighlightAll(!highlightAll)}
              />
            )}

            {activeTab === 'tables' && (
              <TablesTab
                editableTables={editableTables}
                tableEdits={tableEdits}
                tableViewModes={tableViewModes}
                onTableUpdate={handleTableUpdate}
                onTableToggle={handleTableToggle}
              />
            )}

            {activeTab === 'stats' && <StatsTab />}
          </div>

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