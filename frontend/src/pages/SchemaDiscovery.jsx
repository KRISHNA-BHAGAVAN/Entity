import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../contexts/ToastContext";
import {
  EyeOff, Eye, Loader2, Highlighter, LayoutTemplate, Table as TableIcon,
  BarChart3, CircleEllipsis, Save, Download, Wand2, ChevronLeft,
  Sparkles, FileText, Settings, X, ChevronDown, CheckSquare, Search,
  AlignLeft, Type, GripVertical
} from "lucide-react";
import MarkdownPreview from "../components/MarkdownPreview";
import OfficePreview from "../components/OfficePreview";
import FieldsTab from "../components/FieldsTab";
import TablesTab from "../components/TablesTab";
import StatsTab from "../components/StatsTab";
import JSZip from "jszip";

import { getDocs, downloadFile } from "../services/storage";
import { discoverSchema } from "../services/aiService";
import { generateFinalDoc } from "../services/docService";
import { apiCall } from "../config/api";
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
  const [previewMode, setPreviewMode] = useState("markdown");

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

  const [showChanges, setShowChanges] = useState(false);
  const [previewChangedBlob, setPreviewChangedBlob] = useState(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [modifiedMarkdown, setModifiedMarkdown] = useState("");

  const [error, setError] = useState(null);

  const [leftWidth, setLeftWidth] = useState(45);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setLeftWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.userSelect = "auto";
      document.body.style.cursor = "default";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

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

  const getCurrentReplacementsAndEdits = () => {
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
    return { replacements, processedTableEdits };
  };

  const handleToggleChanges = async () => {
    const nextShowChanges = !showChanges;
    setShowChanges(nextShowChanges);
    if (!nextShowChanges || !selectedDocId) {
      return;
    }

    await generatePreviewChanges(selectedDocId);
  };

  const generatePreviewChanges = async (docId) => {
    setIsPreviewGenerating(true);
    try {
      const { replacements, processedTableEdits } = getCurrentReplacementsAndEdits();

      const doc = docs.find((d) => d.id === docId);
      if (doc) {
        let newMarkdown = doc.markdownContent || "";
        replacements.forEach(([oldText, newText]) => {
          newMarkdown = newMarkdown.split(oldText).join(newText);
        });
        setModifiedMarkdown(newMarkdown);
      }

      const blob = await generateFinalDoc(
        docId,
        null,
        replacements,
        processedTableEdits
      );
      setPreviewChangedBlob(blob);
    } catch (err) {
      console.error("Failed to generate preview changes:", err);
      showError("Failed to generate preview with changes");
      setShowChanges(false);
    } finally {
      setIsPreviewGenerating(false);
    }
  };

  useEffect(() => {
    if (showChanges && selectedDocId) {
      generatePreviewChanges(selectedDocId);
    }
  }, [selectedDocId, referenceReplacements, tableEdits]);

  const executeGenerate = async () => {
    if (selectedDocsForGenerate.size === 0) return;

    setIsGenerating(true);
    setShowGenerateModal(false);

    try {
      const { replacements, processedTableEdits } = getCurrentReplacementsAndEdits();

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
    <div className="flex flex-col h-screen bg-white text-slate-900 font-sans overflow-hidden">
      {/* TOP NAVBAR */}
      <header className="flex-none h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <FileText size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-slate-900 leading-tight">Schema Discovery</span>
              <span className="text-[11px] text-slate-500 leading-tight truncate max-w-[200px] md:max-w-xs">{event?.name || 'Loading event...'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Document Selector Header Integration */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-sm font-medium transition-colors cursor-pointer">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="hidden sm:inline">Docs ({selectedDocs.size}/{docs.length})</span>
              <span className="sm:hidden">{selectedDocs.size} Docs</span>
              <ChevronDown size={14} className="text-slate-400 group-hover:rotate-180 transition-transform" />
            </button>
            {/* Dropdown content */}
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Docs</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedDocs(new Set(docs.map(d => d.id)))} className="text-xs font-medium text-blue-600 hover:underline">All</button>
                  <button onClick={() => setSelectedDocs(new Set())} className="text-xs font-medium text-slate-500 hover:underline">Clear</button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto p-1 cursor-default pointer-events-auto">
                {docs.map(doc => (
                  <label key={doc.id} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 rounded cursor-pointer group/item pointer-events-auto">
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(doc.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedDocs);
                        e.target.checked ? newSet.add(doc.id) : newSet.delete(doc.id);
                        setSelectedDocs(newSet);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-auto"
                    />
                    <span className="text-sm font-medium text-slate-700 truncate group-hover/item:text-blue-700">{doc.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden md:block h-4 w-px bg-slate-200 mx-1"></div>

          <label className="hidden sm:flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={useCustomInstructions} onChange={e => setUseCustomInstructions(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300" />
            Custom Prompt
          </label>

          <button
            onClick={handleDiscoverSchema}
            disabled={isDiscovering || selectedDocs.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
          >
            {isDiscovering ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span className="hidden md:inline">{schemaData ? "Re-discover" : "Discover Schema"}</span>
            <span className="md:hidden">Run</span>
          </button>
        </div>
      </header>

      {/* ERROR STRIP */}
      {error && (
        <div className="flex-none bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-sm shrink-0">
          <div className="flex items-center gap-2 text-red-700">
            <circle cx="12" cy="12" r="10" className="w-4 h-4" />
            <span className="font-medium">{typeof error === 'string' ? error : error.message}</span>
          </div>
          <div className="flex gap-2">
            {error.action === 'add_key' && <button onClick={() => navigate("/settings/byok")} className="px-3 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition">Add Key</button>}
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded text-red-600 transition"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* MAIN Split View */}
      <div className="flex-1 flex overflow-hidden lg:flex-row flex-col">
        {/* MOBILE TABS (Hidden on LG) */}
        <div className="flex lg:hidden bg-slate-50 border-b border-slate-200 shrink-0">
          <button onClick={() => setMobileMainTab("preview")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${mobileMainTab === "preview" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}>Document View</button>
          <button onClick={() => setMobileMainTab("ops")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${mobileMainTab === "ops" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}>Editor Tools</button>
        </div>

        {/* LEFT PANE - PREVIEW */}
        <div style={{ width: window.innerWidth >= 1024 ? `${leftWidth}%` : '100%' }} className={`${mobileMainTab === "ops" ? "hidden lg:flex" : "flex"} flex-col h-full overflow-hidden bg-slate-50 group`}>
          <div className="flex-none h-12 border-b border-slate-200 bg-white flex items-center justify-between px-3 shrink-0 auto-cols-auto">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                <button onClick={() => setPreviewMode("markdown")} className={`px-2 md:px-3 py-1 text-xs font-semibold rounded-sm transition-all focus:outline-none ${previewMode === "markdown" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}>MD</button>
                <button onClick={() => setPreviewMode("office")} className={`px-2 md:px-3 py-1 text-xs font-semibold rounded-sm transition-all focus:outline-none ${previewMode === "office" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}>DOCX</button>
              </div>
              <button onClick={handleToggleChanges} className={`p-1.5 rounded transition-colors flex items-center justify-center border outline-none ${showChanges ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 border-transparent hover:bg-slate-100 hover:border-slate-200'}`} title="Toggle Changes">
                {showChanges ? <EyeOff strokeWidth={2.5} size={15} /> : <Eye strokeWidth={2.5} size={15} />}
              </button>
              <button onClick={() => setHighlightAll(!highlightAll)} className={`p-1.5 rounded transition-colors border outline-none ${highlightAll ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'text-slate-500 border-transparent hover:bg-slate-100 hover:border-slate-200'}`} title="Highlight All">
                <Highlighter strokeWidth={2.5} size={15} />
              </button>
              {isPreviewGenerating && <Loader2 size={14} className="animate-spin text-blue-600" />}
            </div>

            <div className="relative border border-slate-200 rounded text-sm bg-white overflow-hidden flex-shrink mx-2 md:max-w-[200px]">
              <select
                value={selectedDocId || ""}
                onChange={(e) => { setSelectedDocId(e.target.value); setIsLoadingMarkdown(true); setTimeout(() => setIsLoadingMarkdown(false), 10); }}
                className="w-full pl-3 pr-8 py-1.5 text-xs font-medium text-slate-700 appearance-none bg-transparent outline-none cursor-pointer"
              >
                <option value="">Select view...</option>
                {docs.map(d => <option key={d.id} value={d.id}>{d.name.length > 25 ? d.name.substring(0, 25) + '...' : d.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-100/50 relative">
            {selectedDocId ? (
              previewMode === "markdown" ? (
                <div className="max-w-4xl mx-auto bg-white my-4 md:my-6 rounded-lg shadow-sm border border-slate-200 min-h-full">
                  <MarkdownPreview content={showChanges ? modifiedMarkdown : docs.find(d => d.id === selectedDocId)?.markdownContent || ""} highlightLocations={showChanges ? [] : getHighlightLocations()} onTextSelect={handleTextSelect} isLoading={isLoadingMarkdown || isPreviewGenerating} />
                </div>
              ) : (
                <div className="h-full bg-white">
                  <OfficePreview docId={selectedDocId} docBlob={showChanges ? previewChangedBlob : null} isLoadingOuter={isPreviewGenerating} />
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Search size={32} className="opacity-20 stroke-1" />
                <p className="text-sm font-medium">Select a document from the toolbar</p>
              </div>
            )}
          </div>
        </div>

        {/* RESIZER DRAG HANDLE (Only on Desktop) */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className="hidden lg:flex w-1 cursor-col-resize hover:bg-blue-500 hover:w-1.5 active:bg-blue-600 active:w-1.5 bg-slate-200 transition-all z-20 items-center justify-center flex-col gap-1 group relative -mx-[0.5px]"
        >
        </div>

        {/* RIGHT PANE - EDITING */}
        <div style={{ width: window.innerWidth >= 1024 ? `${100 - leftWidth}%` : '100%' }} className={`${mobileMainTab === "preview" ? "hidden lg:flex" : "flex"} flex-col h-full overflow-hidden bg-white`}>
          <div className="flex-none h-12 border-b border-slate-200 bg-white flex items-center justify-between pl-2 pr-3 shrink-0">
            <div className="flex space-x-1 p-1 overflow-x-auto no-scrollbar">
              {[
                ["fields", "Fields", AlignLeft],
                ["tables", "Tables", TableIcon],
                ["stats", "Stats", BarChart3]
              ].map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => setActiveTab(k)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all outline-none ${activeTab === k ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
                >
                  <Icon size={14} className={activeTab === k ? "text-blue-600" : ""} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={saveSchema} disabled={isSaving || !schemaData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors disabled:opacity-50" title="Save Schema">
                <Save size={14} /> <span className="hidden xl:inline">Save</span>
              </button>
              <button onClick={handleGenerate} disabled={isGenerating || docs.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50" title="Download">
                <Download size={14} /> <span className="hidden xl:inline">Export</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white p-4 lg:p-6 custom-scrollbar">
            {activeTab === "fields" && (
              isLoadingMarkdown ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10"><Loader2 className="animate-spin mb-4" size={24} /><p className="text-sm font-medium">Parsing definitions...</p></div>
              ) : schemaData ? (
                <div className="max-w-[40rem] mx-auto origin-top animate-in fade-in slide-in-from-bottom-2 duration-300"><FieldsTab {...fieldProps} /></div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10 animate-in fade-in">
                  <AlignLeft size={32} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">Empty field list. Run discovery to populate.</p>
                </div>
              )
            )}
            {activeTab === "tables" && (
              isLoadingMarkdown ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10"><Loader2 className="animate-spin mb-4" size={24} /><p className="text-sm">Mapping tables...</p></div>
              ) : editableTables.length > 0 ? (
                <div className="max-w-5xl mx-auto origin-top animate-in fade-in slide-in-from-bottom-2 duration-300"><TablesTab {...tableProps} /></div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10 animate-in fade-in">
                  <TableIcon size={32} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium">No structured tables extracted.</p>
                </div>
              )
            )}
            {activeTab === "stats" && schemaData && (
              <div className="max-w-[40rem] mx-auto origin-top animate-in fade-in slide-in-from-bottom-2 duration-300"><StatsTab schemaData={schemaData} /></div>
            )}
          </div>
        </div>
      </div>

      {/* MODALS OVERLAYS */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Custom Extraction Query</h3>
              <button onClick={() => setShowInstructionsModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 bg-slate-50/30">
              <p className="text-sm text-slate-600 mb-4 font-medium">
                Direct the AI on exactly what to extract from these documents.
              </p>
              <textarea
                autoFocus
                value={userInstructions}
                onChange={e => setUserInstructions(e.target.value)}
                placeholder="e.g. Extract the final settlement amount and payment schedule dates..."
                className="w-full h-32 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm resize-none shadow-sm transition-all"
              />
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setShowInstructionsModal(false)} className="px-4 py-2 font-semibold text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={executeDiscoverSchema} disabled={!userInstructions.trim()} className="px-5 py-2 bg-blue-600 font-semibold text-sm text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm shadow-blue-200 flex items-center gap-2">
                <Sparkles size={16} /> Run Discovery
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Download size={16} /></div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Export Documents</h3>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4 bg-slate-50/30">
              <p className="text-sm font-medium text-slate-600">Select which files should be re-generated with the modified schemas.</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm max-h-48 overflow-y-auto">
                {docs.map(doc => (
                  <label key={doc.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer group transition-colors">
                    <input type="checkbox" checked={selectedDocsForGenerate.has(doc.id)} onChange={e => {
                      const n = new Set(selectedDocsForGenerate);
                      e.target.checked ? n.add(doc.id) : n.delete(doc.id);
                      setSelectedDocsForGenerate(n);
                    }} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                    <span className="text-sm text-slate-700 font-medium truncate group-hover:text-slate-900">{doc.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-between items-center text-xs px-1">
                <button onClick={() => setSelectedDocsForGenerate(new Set(docs.map(d => d.id)))} className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-all">Select All</button>
                <button onClick={() => setSelectedDocsForGenerate(new Set())} className="font-bold text-slate-500 hover:text-slate-700 hover:underline transition-all">Clear Selection</button>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2 font-semibold text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={executeGenerate} disabled={selectedDocsForGenerate.size === 0} className="px-5 py-2 font-semibold text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-200 flex items-center gap-2">
                Download ({selectedDocsForGenerate.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaDiscovery;
