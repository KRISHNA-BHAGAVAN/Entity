import { useState, useEffect } from "react";
import {
  Loader2,
  Sparkles,
  Download,
  Wand2,
  Eye,
  Table,
  BarChart3,
  Save,
  Highlighter
} from "lucide-react";

import { getDocs, downloadFile } from "../services/storage";
import { discoverSchema } from "../services/aiService";
import { generateFinalDoc } from "../services/docService";
import { apiCall } from "../config/api";
// import { getMarkdownFromCache } from "../services/markdownCache"; // not used

import MarkdownPreview from "./MarkdownPreview";
import FieldsTab from "./FieldsTab";
import TablesTab from "./TablesTab";
import StatsTab from "./StatsTab";
import JSZip from "jszip";
// import "./DocxPreview.css";

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
  const [fieldsHistory, setFieldsHistory] = useState({ past: [], future: [] });

  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState(new Set());
  const [highlightAll, setHighlightAll] = useState(false);

  const [activeTab, setActiveTab] = useState("fields");
  const [editableTables, setEditableTables] = useState([]);
  const [tableEdits, setTableEdits] = useState([]);
  const [tableViewModes, setTableViewModes] = useState({});
  const [newFieldName, setNewFieldName] = useState("");
  const [newRefInputs, setNewRefInputs] = useState({});
  const [editingRef, setEditingRef] = useState(null);
  const [editRefValue, setEditRefValue] = useState("");
  const [error, setError] = useState(null);

  const [mobileMainTab, setMobileMainTab] = useState("preview");

  const handleTableToggle = (tableIndex) => {
    setTableViewModes((prev) => ({
      ...prev,
      [tableIndex]: prev[tableIndex] === "edited" ? "original" : "edited",
    }));
  };

  const handleTableUpdate = (tableIndex, edits) => {
    setTableEdits((prev) => {
      const filtered = prev.filter((edit) => edit.table_index !== tableIndex);
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
        loaded.forEach((doc) => {
          if (doc.tableData && doc.tableData.length > 0) {
            doc.tableData.forEach((table) => {
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
              typeof event.event_schema === "string"
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
              refs.forEach((ref) => {
                initialReplacements[`${fieldKey}:${ref}`] = ref;
              });
            });
            setReferenceReplacements(initialReplacements);
          } catch (err) {
            console.error("Failed to parse event schema:", err);
          }
        }
      } catch {
        setError("Failed to load documents");
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [event.id, event.event_schema]);

  // Field management functions
  const saveFieldsState = () => {
    const currentState = {
      fieldReferences: { ...fieldReferences },
      referenceReplacements: { ...referenceReplacements },
      schemaData: JSON.parse(JSON.stringify(schemaData))
    };

    setFieldsHistory(prev => ({
      past: [...prev.past, currentState],
      future: []
    }));
  };

  const undoFields = () => {
    if (!fieldsHistory.past.length) return;

    const previousState = fieldsHistory.past[fieldsHistory.past.length - 1];
    const currentState = {
      fieldReferences: { ...fieldReferences },
      referenceReplacements: { ...referenceReplacements },
      schemaData: JSON.parse(JSON.stringify(schemaData))
    };

    setFieldReferences(previousState.fieldReferences);
    setReferenceReplacements(previousState.referenceReplacements);
    setSchemaData(previousState.schemaData);

    setFieldsHistory(prev => ({
      past: prev.past.slice(0, -1),
      future: [currentState, ...prev.future]
    }));
  };

  const redoFields = () => {
    if (!fieldsHistory.future.length) return;

    const nextState = fieldsHistory.future[0];
    const currentState = {
      fieldReferences: { ...fieldReferences },
      referenceReplacements: { ...referenceReplacements },
      schemaData: JSON.parse(JSON.stringify(schemaData))
    };

    setFieldReferences(nextState.fieldReferences);
    setReferenceReplacements(nextState.referenceReplacements);
    setSchemaData(nextState.schemaData);

    setFieldsHistory(prev => ({
      past: [...prev.past, currentState],
      future: prev.future.slice(1)
    }));
  };
  const saveFieldState = (fieldKey) => {
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) =>
          key.startsWith(`${fieldKey}:`)
        )
      ),
    };

    setFieldHistory((prev) => {
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

  const undoField = (fieldKey) => {
    const history = fieldHistory[fieldKey];
    if (!history?.past.length) return;

    const previousState = history.past[history.past.length - 1];
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) =>
          key.startsWith(`${fieldKey}:`)
        )
      ),
    };

    setFieldReferences((prev) => ({
      ...prev,
      [fieldKey]: previousState.references,
    }));
    setReferenceReplacements((prev) => {
      const newReplacements = { ...prev };
      Object.keys(prev)
        .filter((key) => key.startsWith(`${fieldKey}:`))
        .forEach((key) => delete newReplacements[key]);
      return { ...newReplacements, ...previousState.replacements };
    });

    setFieldHistory((prev) => ({
      ...prev,
      [fieldKey]: {
        past: history.past.slice(0, -1),
        future: [currentState, ...history.future],
      },
    }));
  };

  const redoField = (fieldKey) => {
    const history = fieldHistory[fieldKey];
    if (!history?.future.length) return;

    const nextState = history.future[0];
    const currentState = {
      references: fieldReferences[fieldKey] || [],
      replacements: Object.fromEntries(
        Object.entries(referenceReplacements).filter(([key]) =>
          key.startsWith(`${fieldKey}:`)
        )
      ),
    };

    setFieldReferences((prev) => ({
      ...prev,
      [fieldKey]: nextState.references,
    }));
    setReferenceReplacements((prev) => {
      const newReplacements = { ...prev };
      Object.keys(prev)
        .filter((key) => key.startsWith(`${fieldKey}:`))
        .forEach((key) => delete newReplacements[key]);
      return { ...newReplacements, ...nextState.replacements };
    });

    setFieldHistory((prev) => ({
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
    setFieldReferences((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey].filter((_, i) => i !== refIndex),
    }));
    setReferenceReplacements((prev) => {
      const newReplacements = { ...prev };
      delete newReplacements[`${fieldKey}:${refToRemove}`];
      return newReplacements;
    });
  };

  const addReference = (fieldKey, newRef) => {
    if (!newRef.trim()) return;
    
    const existingRefs = fieldReferences[fieldKey] || [];
    if (existingRefs.includes(newRef.trim())) return;
    
    saveFieldState(fieldKey);
    setFieldReferences((prev) => ({
      ...prev,
      [fieldKey]: [newRef, ...(prev[fieldKey] || [])],
    }));
    setReferenceReplacements((prev) => ({
      ...prev,
      [`${fieldKey}:${newRef}`]: newRef,
    }));
    setNewRefInputs((prev) => ({ ...prev, [fieldKey]: "" }));
  };

  const editReference = (fieldKey, refIndex, currentRef) => {
    setEditingRef(`${fieldKey}:${refIndex}`);
    setEditRefValue(currentRef);
  };

  const saveEditedReference = (fieldKey, refIndex) => {
    if (!editRefValue.trim()) return;

    const oldRef = fieldReferences[fieldKey][refIndex];
    saveFieldState(fieldKey);

    setFieldReferences((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey].map((ref, idx) =>
        idx === refIndex ? editRefValue.trim() : ref
      ),
    }));

    setReferenceReplacements((prev) => {
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
    setEditRefValue("");
  };

  const cancelEdit = () => {
    setEditingRef(null);
    setEditRefValue("");
  };

  const updateReferenceReplacement = (fieldKey, reference, replacement) => {
    setReferenceReplacements((prev) => ({
      ...prev,
      [`${fieldKey}:${reference}`]: replacement,
    }));
  };

  const createNewField = () => {
    if (!newFieldName.trim()) return;
    saveFieldsState();
    const fieldKey = newFieldName.toLowerCase().replace(/\s+/g, "_");

    setFieldReferences((prev) => ({
      ...prev,
      [fieldKey]: [],
    }));

    setSchemaData((prev) => ({
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

    setNewFieldName("");
  };

  const handleFieldSelect = (fieldKey) => {
    const newSelected = new Set(selectedFieldKeys);
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey);
    } else {
      newSelected.add(fieldKey);
    }
    setSelectedFieldKeys(newSelected);
  };

  const handleNewRefInputChange = (fieldKey, value) => {
    setNewRefInputs((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const handleTextSelect = (selectedText) => {
    if (!selectedText.trim()) return;
    
    // If no field is selected, show a message or auto-select the first field
    if (!selectedFieldKeys.size) {
      // Get the first available field
      const firstFieldKey = Object.keys(fieldReferences)[0];
      if (firstFieldKey) {
        // Auto-select the first field and add the reference
        setSelectedFieldKeys(new Set([firstFieldKey]));
        addReference(firstFieldKey, selectedText.trim());
      }
      return;
    }
    
    // Add to the first selected field
    const firstFieldKey = Array.from(selectedFieldKeys)[0];
    addReference(firstFieldKey, selectedText.trim());
  };

  const findTextLocations = (content, searchText, filename) => {
    if (!content || !searchText) return [];

    const lines = content.split("\n");
    const locations = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let startPos = 0;

      while (true) {
        const pos = line.indexOf(searchText, startPos);
        if (pos === -1) break;

        const globalCharStart =
          lines.slice(0, lineIdx).reduce((sum, l) => sum + l.length + 1, 0) +
          pos;

        locations.push({
          filename,
          type: "paragraph",
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
    const selectedDoc = docs.find((d) => d.id === selectedDocId);
    if (!selectedDoc) return [];

    const content = selectedDoc.markdownContent || "";

    const allLocations = [];

    if (highlightAll) {
      Object.entries(fieldReferences).forEach(([fieldKey, references]) => {
        references.forEach((ref) => {
          const locations = findTextLocations(content, ref, selectedDoc.name);
          allLocations.push(...locations);
        });
      });
    } else if (selectedFieldKeys.size > 0) {
      selectedFieldKeys.forEach((fieldKey) => {
        const references = fieldReferences[fieldKey] || [];
        references.forEach((ref) => {
          const locations = findTextLocations(content, ref, selectedDoc.name);
          allLocations.push(...locations);
        });
      });
    }

    return allLocations;
  };

  const deleteField = (fieldKey) => {
    saveFieldsState();
    if (selectedFieldKeys.has(fieldKey)) {
      const newSelected = new Set(selectedFieldKeys);
      newSelected.delete(fieldKey);
      setSelectedFieldKeys(newSelected);
    }
    setFieldReferences((prev) => {
      const newRefs = { ...prev };
      delete newRefs[fieldKey];
      return newRefs;
    });

    setReferenceReplacements((prev) => {
      const newReplacements = { ...prev };
      Object.keys(prev)
        .filter((key) => key.startsWith(`${fieldKey}:`))
        .forEach((key) => delete newReplacements[key]);
      return newReplacements;
    });

    setSchemaData((prev) => {
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

    setFieldHistory((prev) => {
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
        .filter((d) => selectedDocs.has(d.id))
        .map((d) => ({
          filename: d.name,
          markdown: d.markdownContent || "",
        }))
        .filter((d) => d.markdown.trim());

      const result = await discoverSchema(documents);
      setSchemaData(result);

      const fields = result?.schema?.document_fields?.fields || {};
      const refs = {};
      const reps = {};

      Object.entries(fields).forEach(([k, f]) => {
        refs[k] = f.references || [];
        f.references?.forEach((r) => (reps[`${k}:${r}`] = r));
      });

      setFieldReferences(refs);
      setReferenceReplacements(reps);

      const schemaTables = result?.tables || [];
      const allTables = [...editableTables];
      schemaTables.forEach((table) => {
        allTables.push({
          ...table,
          filename: "Schema Discovery",
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
      tableEdits.forEach((edit) => {
        if (!tableModifications[edit.table_index]) {
          tableModifications[edit.table_index] = {
            original_table: editableTables[edit.table_index],
            modifications: [],
          };
        }
        tableModifications[edit.table_index].modifications.push({
          row: edit.row,
          col: edit.col,
          old_value: edit.old_value,
          new_value: edit.new_value,
        });
      });

      await apiCall(`/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_schema: {
            schema: schemaData.schema,
            fieldReferences,
            tableModifications,
          },
        }),
      });
      alert("Schema saved");
    } catch {
      setError("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const replacements = [];
      Object.entries(fieldReferences).forEach(([fieldKey, refs]) => {
        refs.forEach((ref) => {
          const userInput = referenceReplacements[`${fieldKey}:${ref}`];
          if (
            userInput &&
            userInput.trim() &&
            userInput.trim() !== ref.trim()
          ) {
            replacements.push([ref, userInput.trim()]);
          }
        });
      });

      if (docs.length === 1) {
        const blob = await generateFinalDoc(
          docs[0].id,
          null,
          replacements,
          tableEdits
        );
        downloadFile(blob, `SCHEMA_${docs[0].name}`);
      } else {
        const zip = new JSZip();
        for (const doc of docs) {
          const blob = await generateFinalDoc(
            doc.id,
            null,
            replacements,
            tableEdits
          );
          zip.file(`SCHEMA_${doc.name}`, blob);
        }
        downloadFile(
          await zip.generateAsync({ type: "blob" }),
          `${event.name}_Schema.zip`
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const fieldProps = {
    schemaData,
    fieldReferences,
    selectedFieldKeys,
    fieldHistory,
    fieldsHistory,
    newRefInputs,
    editingRef,
    editRefValue,
    referenceReplacements,
    newFieldName,
    highlightAll,
    onFieldSelect: handleFieldSelect,
    onUndoField: undoField,
    onRedoField: redoField,
    onUndoFields: undoFields,
    onRedoFields: redoFields,
    onDeleteField: deleteField,
    onAddReference: addReference,
    onRemoveReference: removeReference,
    onEditReference: editReference,
    onSaveEditedReference: saveEditedReference,
    onCancelEdit: cancelEdit,
    onUpdateReferenceReplacement: updateReferenceReplacement,
    onNewRefInputChange: handleNewRefInputChange,
    onEditRefValueChange: setEditRefValue,
    onNewFieldNameChange: setNewFieldName,
    onCreateNewField: createNewField,
    onHighlightAllToggle: () => setHighlightAll(!highlightAll),
  };

  const tableProps = {
    editableTables,
    tableEdits,
    tableViewModes,
    onTableUpdate: handleTableUpdate,
    onTableToggle: handleTableToggle,
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
      {/* HEADER */}
      <div className="px-4 py-2 space-y-2 bg-white border-b">
        <div className="lg: flex lg:justify-between">
        <h2 className=" text-lg font-bold text-slate-800 flex items-center gap-2">
          <Wand2 size={18} className="text-indigo-600" />
          Schema Discovery
        </h2>
        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full lg:w-fit">
          {/* Document Selector */}
          <div className="relative group w-full md:w-auto">
            <details className="relative appearance-none">
              <summary className="flex items-center justify-between px-4 py-2 border border-slate-200 rounded-md text-sm font-medium cursor-pointer bg-white hover:border-indigo-400 hover:ring-2 hover:ring-indigo-50 transition-all list-none">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Select Documents ({selectedDocs.size}/{docs.length})
                </span>
                <svg
                  className="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>

              <div className="absolute top-full left-0 mt-2 w-full md:min-w-60 bg-white border border-slate-100 rounded-md shadow-xl z-20 py-1 overflow-hidden ring-1 ring-black ring-opacity-5">
                <div className="max-h-60 overflow-y-auto">
                  {docs.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 cursor-pointer transition-colors group/item"
                    >
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedDocs);
                            if (e.target.checked) newSelected.add(doc.id);
                            else newSelected.delete(doc.id);
                            setSelectedDocs(newSelected);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 group-hover/item:text-indigo-700 truncate">
                        {doc.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </details>
          </div>

          {/* Discover Button */}
          <button
            onClick={handleDiscoverSchema}
            disabled={isDiscovering || selectedDocs.size === 0}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed shadow-md shadow-indigo-200 w-full md:w-auto"
          >
            {isDiscovering ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Sparkles size={18} />
            )}
            <span>
              {schemaData ? "Re-discover" : "Discover"} Schema
              <span className="ml-1 opacity-80 text-xs font-normal">
                ({selectedDocs.size})
              </span>
            </span>
          </button>
        </div>
        </div>
      </div>

      {/* MOBILE TOP NAV */}
      <div className="flex md:hidden bg-white border-b sticky top-0 z-30">
        <button
          onClick={() => setMobileMainTab("preview")}
          className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${
            mobileMainTab === "preview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500"
          }`}
        >
          Preview Tab
        </button>
        <button
          onClick={() => setMobileMainTab("ops")}
          className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${
            mobileMainTab === "ops"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500"
          }`}
        >
          Ops Tab
        </button>
      </div>

      {/* MAIN BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* PREVIEW ASIDE */}
        <aside
          className={`${
            mobileMainTab === "ops" ? "hidden md:flex" : "flex"
          } md:w-[45%] bg-white border-r flex-col h-full`}
        >
          <div className="px-4 py-2 border-b font-semibold text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-indigo-600" />
              <span className="whitespace-nowrap">Document Preview</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setHighlightAll(!highlightAll)}
                title={highlightAll ? "Hide All Highlights" : "Highlight All Fields"}
                aria-label={highlightAll ? "Hide All Highlights" : "Highlight All Fields"}
                className={`p-2 rounded-md transition-all duration-200 border ${
                  highlightAll
                    ? 'bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm hover:cursor-pointer'
                    : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 hover:text-slate-700 hover:cursor-pointer'
                }`}
              >
                <Highlighter size={18} strokeWidth={2.5} />
              </button>

              <select
                value={selectedDocId || ""}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="
                  max-w-[200px]
                  pl-3 pr-10 py-2 
                  rounded-md
                  border border-slate-300 
                  text-sm font-medium text-slate-700
                  appearance-none
                  bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]
                  bg-size-[1.25rem]
                  bg-position-[right_0.5rem_center]
                  bg-no-repeat
                  bg-white
                  focus:ring-1 focus:ring-black
                  outline-none 
                  transition-all duration-150 ease-in-out
                  shadow-sm
                  hover:border-slate-400
                  truncate
                "
              >
                <option value="">Select a document…</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name.length > 30 ? `${d.name.substring(0, 30)}....` : d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-hidden bg-slate-50">
            <div className="bg-white max-h-screen shadow-sm overflow-auto">
              {selectedDocId ? (
                <MarkdownPreview
                  content={
                    docs.find((d) => d.id === selectedDocId)?.markdownContent ||
                    ""
                  }
                  highlightLocations={getHighlightLocations()}
                  onTextSelect={handleTextSelect}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Eye size={32} className="opacity-20" />
                  <p className="text-sm">Select a document to preview</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* OPS SECTION */}
        <section
          className={`${
            mobileMainTab === "preview" ? "hidden md:flex" : "flex"
          } flex-1 flex flex-col h-full bg-white`}
        >
          {/* Sub-tabs */}
          <div className="flex bg-slate-50 md:bg-white border-b overflow-x no-scrollbar">
            {[
              ["fields", "Fields", Sparkles],
              ["tables", "Tables", Table],
              ["stats", "Stats", BarChart3],
            ].map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`flex-1 min-w-[100px] py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  activeTab === k
                    ? "bg-white md:bg-transparent border-b-2 border-indigo-600 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {activeTab === "fields" && <FieldsTab {...fieldProps} />}
            {activeTab === "tables" && <TablesTab {...tableProps} />}
            {activeTab === "stats" && <StatsTab />}
          </div>

          {/* Footer actions */}
          <div className="border-t bg-white p-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={saveSchema}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-lg shadow-indigo-100"
            >
              <Save size={18} className="mr-2" />
              Save Schema
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-100"
            >
              <Download size={18} className="mr-2" />
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
