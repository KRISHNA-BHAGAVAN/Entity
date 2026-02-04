import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../contexts/ToastContext";
import {
  Loader2,
  Sparkles,
  LayoutTemplate,
  Download,
  Wand2,
  Eye,
  Table,
  BarChart3,
  Save,
  Highlighter,
  FileStack,
  ChevronDown,
  CircleEllipsis,
} from "lucide-react";

import { getDocs, downloadFile } from "../services/storage";
import { discoverSchema } from "../services/aiService";
import { generateFinalDoc } from "../services/docService";
import { apiCall } from "../config/api";
// import { getMarkdownFromCache } from "../services/markdownCache"; // not used

import MarkdownPreview from "../components/MarkdownPreview";
import FieldsTab from "../components/FieldsTab";
import TablesTab from "../components/TablesTab";
import StatsTab from "../components/StatsTab";
import JSZip from "jszip";
// import "./DocxPreview.css";

const SchemaDiscovery = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventId = searchParams.get('eventId');
  const [event, setEvent] = useState(null);
  const { success, error: showError } = useToast();
  /* ===================== STATE ===================== */
  const [docs, setDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
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
  const [selectedReferences, setSelectedReferences] = useState(new Set());
  const [highlightAll, setHighlightAll] = useState(false);

  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("fields");
  const [editableTables, setEditableTables] = useState([]);
  const [tableEdits, setTableEdits] = useState([]);
  const [tableHistory, setTableHistory] = useState({ past: [], future: [] });
  const [tableViewModes, setTableViewModes] = useState({});
  const [newFieldName, setNewFieldName] = useState("");
  const [newRefInputs, setNewRefInputs] = useState({});
  const [editingRef, setEditingRef] = useState(null);
  const [editRefValue, setEditRefValue] = useState("");
  const [mobileMainTab, setMobileMainTab] = useState("preview");
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [userInstructions, setUserInstructions] = useState("Identify key editable fields that users would want to customize or change.");
  const [useCustomInstructions, setUseCustomInstructions] = useState(true);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedDocsForGenerate, setSelectedDocsForGenerate] = useState(
    new Set()
  );
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    if (!eventId) {
      navigate('/');
    }
  }, [eventId]);
  const handleTableToggle = (tableIndex) => {
    setTableViewModes((prev) => ({
      ...prev,
      [tableIndex]: prev[tableIndex] === "edited" ? "original" : "edited",
    }));
  };

  const saveTableState = () => {
    const currentState = [...tableEdits];
    setTableHistory(prev => ({
      past: [...prev.past, currentState],
      future: []
    }));
  };

  const undoTable = () => {
    if (!tableHistory.past.length) return;
    
    const previousState = tableHistory.past[tableHistory.past.length - 1];
    const currentState = [...tableEdits];
    
    setTableEdits(previousState);
    setTableHistory(prev => ({
      past: prev.past.slice(0, -1),
      future: [currentState, ...prev.future]
    }));
  };

  const redoTable = () => {
    if (!tableHistory.future.length) return;
    
    const nextState = tableHistory.future[0];
    const currentState = [...tableEdits];
    
    setTableEdits(nextState);
    setTableHistory(prev => ({
      past: [...prev.past, currentState],
      future: prev.future.slice(1)
    }));
  };

  const handleTableUpdate = (tableIndex, edits) => {
    saveTableState();
    
    console.log("🔍 TABLE UPDATE DEBUG:", {
      tableIndex,
      edits,
      currentTableEdits: tableEdits,
    });

    setTableEdits((prev) => {
      const filtered = prev.filter(
        (edit) =>
          !(
            edit.table_index === tableIndex &&
            edit.row === edits.row &&
            edit.col === edits.col
          )
      );
      const newEdit = {
        table_index: tableIndex,
        ...edits,
      };
      console.log("🔍 NEW TABLE EDIT:", newEdit);
      return [...filtered, newEdit];
    });
  };

  /* ===================== EFFECTS ===================== */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsDropdown && !event.target.closest('.actions-dropdown')) {
        setShowActionsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsDropdown]);

  useEffect(() => {
    const loadEventAndDocs = async () => {
      if (!eventId) {
        setIsLoadingDocs(false);
        return;
      }

      setIsLoadingDocs(true);
      try {
        // Load event details
        const { data: eventData } = await supabase
          .from('events')
          .select('*, event_schema')
          .eq('id', eventId)
          .single();
        
        if (eventData) {
          setEvent(eventData);
          const loaded = await getDocs(eventId);
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
          setIsLoadingMarkdown(true);
        }

        if (eventData.event_schema) {
          try {
            const existingSchema =
              typeof eventData.event_schema === "string"
                ? JSON.parse(eventData.event_schema)
                : eventData.event_schema;

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
        setIsLoadingMarkdown(false);
        }
      } catch (err) {
        console.error('Error loading event and docs:', err);
        setError("Failed to load documents");
      } finally {
        setIsLoadingDocs(false);
        setIsLoadingMarkdown(false);
      }
    };
    loadEventAndDocs();
  }, [eventId]);

  // Field management functions
  const saveFieldsState = () => {
    const currentState = {
      fieldReferences: { ...fieldReferences },
      referenceReplacements: { ...referenceReplacements },
      schemaData: JSON.parse(JSON.stringify(schemaData)),
    };

    setFieldsHistory((prev) => ({
      past: [...prev.past, currentState],
      future: [],
    }));
  };

  const undoFields = () => {
    if (!fieldsHistory.past.length) return;

    const previousState = fieldsHistory.past[fieldsHistory.past.length - 1];
    const currentState = {
      fieldReferences: { ...fieldReferences },
      referenceReplacements: { ...referenceReplacements },
      schemaData: JSON.parse(JSON.stringify(schemaData)),
    };

    setFieldReferences(previousState.fieldReferences);
    setReferenceReplacements(previousState.referenceReplacements);
    setSchemaData(previousState.schemaData);

    setFieldsHistory((prev) => ({
      past: prev.past.slice(0, -1),
      future: [currentState, ...prev.future],
    }));
  };

  const redoFields = () => {
    if (!fieldsHistory.future.length) return;

    const nextState = fieldsHistory.future[0];
    const currentState = {
      fieldReferences: { ...fieldReferences },
      referenceReplacements: { ...referenceReplacements },
      schemaData: JSON.parse(JSON.stringify(schemaData)),
    };

    setFieldReferences(nextState.fieldReferences);
    setReferenceReplacements(nextState.referenceReplacements);
    setSchemaData(nextState.schemaData);

    setFieldsHistory((prev) => ({
      past: [...prev.past, currentState],
      future: prev.future.slice(1),
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
    
    // Remove from selected references if it was selected
    const refKey = `${fieldKey}:${refToRemove}`;
    if (selectedReferences.has(refKey)) {
      const newSelected = new Set(selectedReferences);
      newSelected.delete(refKey);
      setSelectedReferences(newSelected);
    }
    
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

  const editFieldName = (fieldKey, newLabel) => {
    if (!newLabel.trim()) return;
    saveFieldsState();
    
    setSchemaData((prev) => ({
      ...prev,
      schema: {
        ...prev.schema,
        document_fields: {
          ...prev.schema.document_fields,
          fields: {
            ...prev.schema.document_fields.fields,
            [fieldKey]: {
              ...prev.schema.document_fields.fields[fieldKey],
              label: newLabel.trim(),
            },
          },
        },
      },
    }));
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

  const handleReferenceSelect = (fieldKey, reference) => {
    const refKey = `${fieldKey}:${reference}`;
    const newSelected = new Set(selectedReferences);
    if (newSelected.has(refKey)) {
      newSelected.delete(refKey);
    } else {
      newSelected.add(refKey);
    }
    setSelectedReferences(newSelected);
  };

  const handleTextSelect = (selectedText) => {
    if (!selectedText.trim()) return;

    const fieldEntries = Object.entries(fieldReferences || {});
    if (fieldEntries.length === 0) return;

    // Use the currently displayed field from FieldsTab
    const currentFieldKey = fieldEntries[currentFieldIndex]?.[0];
    if (currentFieldKey) {
      addReference(currentFieldKey, selectedText.trim());
    }
  };

  const findTextLocations = (content, searchText, filename) => {
    if (!content || !searchText) return [];

    const lines = content.split("\n");
    const locations = [];
    const searchLower = searchText.toLowerCase();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineLower = line.toLowerCase();
      let startPos = 0;

      while (true) {
        const pos = lineLower.indexOf(searchLower, startPos);
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
    } else if (selectedReferences.size > 0) {
      // Highlight individual selected references
      selectedReferences.forEach((refKey) => {
        const [fieldKey, reference] = refKey.split(":");
        const locations = findTextLocations(
          content,
          reference,
          selectedDoc.name
        );
        allLocations.push(...locations);
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
    
    // Remove field from selected fields if it was selected
    if (selectedFieldKeys.has(fieldKey)) {
      const newSelected = new Set(selectedFieldKeys);
      newSelected.delete(fieldKey);
      setSelectedFieldKeys(newSelected);
    }
    
    // Remove all references of this field from selected references
    const newSelectedReferences = new Set(selectedReferences);
    selectedReferences.forEach(refKey => {
      if (refKey.startsWith(`${fieldKey}:`)) {
        newSelectedReferences.delete(refKey);
      }
    });
    setSelectedReferences(newSelectedReferences);
    
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
    if (!selectedDocs.size) {
      setError({
        type: 'no_docs_selected',
        message: 'Please select at least one document to discover schema.',
        action: 'select_docs'
      });
      return;
    }
    if (useCustomInstructions) {
      setShowInstructionsModal(true);
    } else {
      executeDiscoverSchema();
    }
  };

  const executeDiscoverSchema = async () => {
    setIsDiscovering(true);
    setError(null);
    setShowInstructionsModal(false);

    try {
      const documents = docs
        .filter((d) => selectedDocs.has(d.id))
        .map((d) => ({
          filename: d.name,
          markdown: d.markdownContent || "",
        }))
        .filter((d) => d.markdown.trim());

      const result = await discoverSchema(documents, useCustomInstructions ? userInstructions : null);
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
      
      // Show warning if using fallback keys
      if (result?.warning) {
        showError(result.warning);
      }
    } catch (err) {
      console.error('Schema discovery error:', err);
      
      // Handle BYOK-specific errors
      if (err.code === 'BYOK_REQUIRED' || err.code === 'BYOK_SETUP_REQUIRED') {
        setError({
          type: 'byok_required',
          message: err.message,
          action: err.action
        });
      } else {
        setError(`Schema discovery failed: ${err.message}`);
      }
    } finally {
      setIsDiscovering(false);
    }
  };

  const saveSchema = async () => {
    if (!schemaData || !eventId) return;
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

      // Save the complete schema data including stats, estimated_cost, etc.
      const completeSchema = {
        ...schemaData,
        fieldReferences,
        tableModifications,
      };

      await apiCall(`/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_schema: completeSchema,
        }),
      });
      success("Schema saved successfully");
    } catch {
      setError("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setShowGenerateModal(true);
    setSelectedDocsForGenerate(new Set(docs.map((d) => d.id)));
  };

  const processTableEditsForAPI = (edits) => {
    const processedEdits = [];

    edits.forEach((edit) => {
      const { old_value, new_value } = edit;

      if (old_value?.includes("\n") || new_value?.includes("\n")) {
        const oldLines = old_value?.split("\n") || [""];
        const newLines = new_value?.split("\n") || [""];
        const maxLines = Math.max(oldLines.length, newLines.length);

        for (let i = 0; i < maxLines; i++) {
          const oldLine = oldLines[i] || "";
          const newLine = newLines[i] || "";

          if (oldLine !== newLine) {
            processedEdits.push({
              ...edit,
              old_value: oldLine,
              new_value: newLine,
            });
          }
        }
      } else {
        if (old_value !== new_value) {
          processedEdits.push(edit);
        }
      }
    });

    return processedEdits;
  };

  const executeGenerate = async () => {
    if (selectedDocsForGenerate.size === 0) return;

    setIsGenerating(true);
    setShowGenerateModal(false);

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

      const processedTableEdits = processTableEditsForAPI(tableEdits);

      const selectedDocsArray = docs.filter((d) =>
        selectedDocsForGenerate.has(d.id)
      );

      console.log("🔍 GENERATE DEBUG:", {
        originalTableEdits: tableEdits,
        processedTableEdits,
        replacements,
        selectedDocsCount: selectedDocsArray.length,
      });

      if (selectedDocsArray.length === 1) {
        const blob = await generateFinalDoc(
          selectedDocsArray[0].id,
          null,
          replacements,
          processedTableEdits
        );
        downloadFile(blob, `SCHEMA_${selectedDocsArray[0].name}`);
      } else {
        const zip = new JSZip();
        for (const doc of selectedDocsArray) {
          const blob = await generateFinalDoc(
            doc.id,
            null,
            replacements,
            processedTableEdits
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
    selectedReferences,
    fieldHistory,
    fieldsHistory,
    newRefInputs,
    editingRef,
    editRefValue,
    referenceReplacements,
    newFieldName,
    highlightAll,
    onFieldSelect: handleFieldSelect,
    onReferenceSelect: handleReferenceSelect,
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
    onCurrentFieldIndexChange: setCurrentFieldIndex,
    onEditFieldName: editFieldName,
  };

  const tableProps = {
    editableTables,
    tableEdits,
    tableViewModes,
    tableHistory,
    onTableUpdate: handleTableUpdate,
    onTableToggle: handleTableToggle,
    onUndoTable: undoTable,
    onRedoTable: redoTable,
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* HEADER */}
      <div className="px-4 py-2 space-y-2 bg-white border-b">
        <div className="flex justify-between">
          <h2 className="text-xl mb-2 md:text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wand2 size={18} className="text-indigo-600" />
            Schema Discovery
          </h2>
          <div className="flex md:flex-row md:justify-end md:items-center gap-3 w-fit md:w-fit">
            {/* Document Selector */}
            <div className="relative group w-auto">
              <details className="relative appearance-none group">
                <summary className="flex items-center w-fit justify-between p-2 md:px-4 md:py-2 border border-slate-200 rounded-md text-sm font-medium cursor-pointer bg-white hover:border-indigo-400 hover:ring-2 hover:ring-indigo-50 transition-all list-none">
                  {/* Mobile Icon View */}
                  <div className="flex lg:hidden items-center justify-center relative">
                    <FileStack className="w-5 h-5 text-indigo-600" />
                    {selectedDocs.size > 0 && (
                      <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                        {selectedDocs.size}
                      </span>
                    )}
                  </div>

                  {/* Desktop Text View */}
                  <span className="hidden lg:flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Select Documents ({selectedDocs.size}/{docs.length})
                  </span>

                  <ChevronDown className="hidden lg:block ml-2 w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>

                {/* Dropdown Menu */}
                <div className="absolute top-full right-0  mt-2 w-64 bg-white border border-slate-100 rounded-md shadow-xl z-20 py-1 overflow-hidden ring-1 ring-black ring-opacity-5">
                  {isLoadingDocs ? (
                    <div className="px-4 py-8 text-center">
                      <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={20} />
                      <p className="text-xs text-slate-500">Loading documents...</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b border-slate-100 flex justify-between">
                        <button
                          onClick={() =>
                            setSelectedDocs(new Set(docs.map((d) => d.id)))
                          }
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedDocs(new Set())}
                          className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {docs.map((doc) => (
                          <label
                            key={doc.id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 cursor-pointer transition-colors group/item"
                          >
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
                            <span className="text-sm font-medium text-slate-700 group-hover/item:text-indigo-700 truncate">
                              {doc.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </details>
            </div>

            {/* Discover Button */}
            <button
              onClick={handleDiscoverSchema}
              disabled={isDiscovering || selectedDocs.size === 0}
              title={schemaData ? "Re-discover Schema" : "Discover Schema"}
              className="relative flex items-center justify-center gap-2 p-2.5 md:px-5 md:py-2 rounded-md bg-indigo-600 text-white 
              font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 
              disabled:active:scale-100 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                >
              {isDiscovering ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Sparkles size={20} />

                  {/* Mobile Badge: Only shows when text is hidden */}
                  {selectedDocs.size > 0 && (
                    <span className="lg:hidden absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                      {selectedDocs.size}
                    </span>
                  )}
                </>
              )}

              {/* Desktop Text: Hidden on mobile */}
              <span className="hidden lg:inline">
                {schemaData ? "Re-discover" : "Discover"} Schema
                <span className="opacity-80 text-xs font-normal ml-1">
                  ({selectedDocs.size})
                </span>
              </span>
            </button>

            {/* Custom Instructions Toggle */}
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomInstructions}
                onChange={(e) => setUseCustomInstructions(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="hidden md:inline">Custom Instructions</span>
              <span className="md:hidden">Custom</span>
            </label>
          </div>
        </div>
      </div>

      {/* No Documents Selected Error */}
      {error?.type === 'no_docs_selected' && (
        <div className="mx-4 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-800 mb-1">
                No Documents Selected
              </h3>
              <p className="text-sm text-blue-700 mb-3">
                {error.message}
              </p>
              <button
                onClick={() => setError(null)}
                className="px-3 py-1.5 bg-white text-blue-700 text-sm font-medium rounded-md border border-blue-300 hover:bg-blue-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BYOK Error Message */}
      {error?.type === 'byok_required' && (
        <div className="mx-4 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800 mb-1">
                API Key Required
              </h3>
              <p className="text-sm text-amber-700 mb-3">
                {error.message}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/settings/byok')}
                  className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
                >
                  Add API Key
                </button>
                <button
                  onClick={() => setError(null)}
                  className="px-3 py-1.5 bg-white text-amber-700 text-sm font-medium rounded-md border border-amber-300 hover:bg-amber-50 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Error Message */}
      {error && typeof error === 'string' && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                Error
              </h3>
              <p className="text-sm text-red-700 mb-3">
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="px-3 py-1.5 bg-white text-red-700 text-sm font-medium rounded-md border border-red-300 hover:bg-red-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE TOP NAV */}
      <div className="flex lg:hidden bg-white border-b sticky top-0 ">
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
          Editing Tab
        </button>
      </div>

      {/* MAIN BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* PREVIEW ASIDE */}
        <aside
          className={`${
            mobileMainTab === "ops" ? "hidden lg:flex" : "flex"
          } lg:w-[45%] bg-white border-r flex-col h-full`}
        >
          <div className="px-4 py-2 border-b font-semibold text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-indigo-600" />
              <span className="whitespace-nowrap">Document Preview</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setHighlightAll(!highlightAll)}
                title={
                  highlightAll ? "Hide All Highlights" : "Highlight All Fields"
                }
                aria-label={
                  highlightAll ? "Hide All Highlights" : "Highlight All Fields"
                }
                className={`p-2 rounded-md transition-all duration-200 border ${
                  highlightAll
                    ? "bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm hover:cursor-pointer"
                    : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 hover:text-slate-700 hover:cursor-pointer"
                }`}
              >
                <Highlighter size={18} strokeWidth={2.5} />
              </button>

              <select
                value={selectedDocId || ""}
                onChange={(e) => {
                  setSelectedDocId(e.target.value);
                  if (e.target.value) {
                    setIsLoadingMarkdown(true);
                    // Simulate loading time for markdown rendering
                    setTimeout(() => setIsLoadingMarkdown(false), 300);
                  }
                }}
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
                    {d.name.length > 30
                      ? `${d.name.substring(0, 30)}....`
                      : d.name}
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
                  isLoading={isLoadingMarkdown}
                />
              ) : (
                <div className="h-screen flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Eye size={32} className="opacity-20" />
                  <p className="text-sm">Select a document to preview</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Editing SECTION */}
        <section
          className={`${
            mobileMainTab === "preview" ? "hidden lg:flex" : "flex"
          } flex-1 flex flex-col h-full bg-white`}
        >
          {/* Sub-tabs */}
          <div className="flex bg-slate-50 md:bg-white border-b overflow-x no-scrollbar">
            {[
              ["fields", "Fields", LayoutTemplate],
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
            <div className="relative actions-dropdown">
              <button
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                className="p-3 text-slate-500 hover:text-slate-700 hover:bg-slate-50 hover:cursor-pointer transition-all"
              >
                <CircleEllipsis size={20} />
              </button>
              {showActionsDropdown && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => {
                      saveSchema();
                      setShowActionsDropdown(false);
                    }}
                    disabled={isSaving}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} className="text-indigo-600" />
                    Save Schema
                  </button>
                  <button
                    onClick={() => {
                      handleGenerate();
                      setShowActionsDropdown(false);
                    }}
                    disabled={isGenerating}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} className="text-emerald-600" />
                    Generate
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-hidden p-4 md:p-6 space-y-6">
            {activeTab === "fields" && (
              isLoadingMarkdown ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                    <p className="text-sm text-slate-500">Loading fields...</p>
                  </div>
                </div>
              ) : schemaData ? (
                <FieldsTab {...fieldProps} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Wand2 className="text-slate-300 mx-auto mb-2" size={32} />
                    <p className="text-sm text-slate-500">No schema discovered yet</p>
                    <p className="text-xs text-slate-400 mt-1">Select documents and click "Discover Schema" to get started</p>
                  </div>
                </div>
              )
            )}
            {activeTab === "tables" && (
              isLoadingMarkdown ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                    <p className="text-sm text-slate-500">Loading tables...</p>
                  </div>
                </div>
              ) : editableTables.length > 0 ? (
                <TablesTab {...tableProps} />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Table className="text-slate-300 mx-auto mb-2" size={32} />
                    <p className="text-sm text-slate-500">No tables found</p>
                    <p className="text-xs text-slate-400 mt-1">Tables will appear here after schema discovery</p>
                  </div>
                </div>
              )
            )}
            {activeTab === "stats" && (
              <StatsTab schemaData={schemaData} />
            )}
          </div>


        </section>
      </div>

      {/* Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Schema Discovery Instructions
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Describe what fields you want to extract from your documents. Be specific about the type of information you're looking for.
            </p>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder="e.g., Extract event details like dates, venue, contact information, and participant details that would need to be customized for different events..."
              className="w-full h-32 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDiscoverSchema}
                disabled={!userInstructions.trim()}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Discover Schema
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Select Documents to Generate
            </h3>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {docs.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocsForGenerate.has(doc.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedDocsForGenerate);
                      if (e.target.checked) {
                        newSelected.add(doc.id);
                      } else {
                        newSelected.delete(doc.id);
                      }
                      setSelectedDocsForGenerate(newSelected);
                    }}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {doc.name}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() =>
                  setSelectedDocsForGenerate(new Set(docs.map((d) => d.id)))
                }
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedDocsForGenerate(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear All
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeGenerate}
                disabled={selectedDocsForGenerate.size === 0}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate ({selectedDocsForGenerate.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaDiscovery;
