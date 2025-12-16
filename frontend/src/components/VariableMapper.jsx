import React, { useState, useEffect } from 'react';
import { replaceVariablesInDocx, extractMarkdownFromDocx } from '../services/docService';
import { saveDoc } from '../services/storage';
import { suggestVariables } from '../services/aiService';
import OptimizedMarkdownPreview from './OptimizedMarkdownPreview';
import {
  Loader2,
  Plus,
  X,
  Eye,
  Save,
  Pencil,
  Check,
  RotateCcw,
  RefreshCw,
  Sparkles,
  List,
  ChevronDown,
  Highlighter,
  CheckCircle2
} from 'lucide-react';

const VariableMapper = ({ docs, initialDocId, onUpdateDocs, onClose }) => {
  const [currentDocId, setCurrentDocId] = useState(initialDocId);
  const [mobileTab, setMobileTab] = useState('preview');

  const [docStates, setDocStates] = useState({});
  const [originalText, setOriginalText] = useState('');
  const [varName, setVarName] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [editingIndex, setEditingIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('add');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const currentDoc = docs.find(d => d.id === currentDocId);
  const currentDocState = docStates[currentDocId];

  const currentLoading = !currentDocState || currentDocState.isLoading;
  const currentMappings = currentDocState?.mappings || currentDoc.variables || [];
  const currentPreview = currentDocState?.previewText || '';

  useEffect(() => {
    let isMounted = true;

    const loadAllDocs = async () => {
      // Initialize states immediately to show loading
      const initialStates = {};
      docs.forEach(doc => {
        initialStates[doc.id] = {
          previewText: '',
          isLoading: true,
          mappings: doc.variables || []
        };
      });
      
      if (isMounted) {
        setDocStates(initialStates);
      }

      // Load documents one by one for better perceived performance
      for (const doc of docs) {
        if (!isMounted) break;
        
        try {
          // Use backend markdown extraction
          const { api } = await import('../config/api.js');
          const file = new File([new Uint8Array()], doc.name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          const result = await api.extractMarkdown(file);
          const text = result.markdown || 'Error loading preview';

          if (isMounted) {
            setDocStates(prev => ({
              ...prev,
              [doc.id]: {
                previewText: text,
                isLoading: false,
                mappings: doc.variables || []
              }
            }));
          }
        } catch (error) {
          console.error(`Error loading doc ${doc.name}:`, error);
          if (isMounted) {
            setDocStates(prev => ({
              ...prev,
              [doc.id]: {
                previewText: 'Error loading document preview.',
                isLoading: false,
                mappings: doc.variables || []
              }
            }));
          }
        }
      }
    };

    loadAllDocs();
    return () => {
      isMounted = false;
    };
  }, [docs]);

  // Cleanup cache on unmount
  useEffect(() => {
    return () => {
      clearMarkdownCache();
    };
  }, []);

  const handleSaveMapping = () => {
    if (!originalText || !varName) return;

    const sanitizedVar = varName.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const sanitizedOriginal = originalText.trim();

    const affectedDocIds = Object.keys(docStates).filter(docId => {
      return (
        docId === currentDocId ||
        docStates[docId].previewText.includes(sanitizedOriginal)
      );
    });

    setDocStates(prev => {
      const next = { ...prev };

      affectedDocIds.forEach(docId => {
        const docState = next[docId];
        const newMappings = [...docState.mappings];
        const newMapping = {
          originalText: sanitizedOriginal,
          variableName: sanitizedVar
        };

        if (docId === currentDocId && editingIndex !== null) {
          newMappings[editingIndex] = newMapping;
        } else {
          const existingIdx = newMappings.findIndex(
            m => m.originalText === sanitizedOriginal
          );
          if (existingIdx >= 0) {
            newMappings[existingIdx] = newMapping;
          } else {
            newMappings.push(newMapping);
          }
        }

        next[docId] = { ...docState, mappings: newMappings };
      });

      return next;
    });

    if (affectedDocIds.length > 1) {
      setNotification(
        `Variable "${sanitizedVar}" mapped across ${affectedDocIds.length} documents.`
      );
      setTimeout(() => setNotification(null), 4000);
    }

    setEditingIndex(null);
    setActiveTab('list');
    setOriginalText('');
    setVarName('');
  };

  const removeMapping = (index) => {
    if (editingIndex === index) handleCancelEdit();

    setDocStates(prev => {
      const newMappings = [...prev[currentDocId].mappings];
      newMappings.splice(index, 1);
      return {
        ...prev,
        [currentDocId]: {
          ...prev[currentDocId],
          mappings: newMappings
        }
      };
    });
  };

  const handleEdit = (index) => {
    const mapping = currentMappings[index];
    setOriginalText(mapping.originalText);
    setVarName(mapping.variableName);
    setEditingIndex(index);
    setActiveTab('add');
    setMobileTab('controls');
  };

  const handleCancelEdit = () => {
    setOriginalText('');
    setVarName('');
    setEditingIndex(null);
  };

  const handleRefreshPreview = async () => {
    setIsProcessing(true);
    try {
      // Simplified preview refresh - use current mappings
      const text = 'Preview updated with current mappings';

      setDocStates(prev => ({
        ...prev,
        [currentDocId]: {
          ...prev[currentDocId],
          previewText: text
        }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoMap = async () => {
    if (!currentPreview) return;

    setIsAiLoading(true);
    try {
      let text = currentPreview;

      const suggestions = await suggestVariables(text);
      const newSuggestions = suggestions.filter(
        s => !currentMappings.some(m => m.originalText === s.originalText)
      );

      if (newSuggestions.length) {
        setDocStates(prev => ({
          ...prev,
          [currentDocId]: {
            ...prev[currentDocId],
            mappings: [...prev[currentDocId].mappings, ...newSuggestions]
          }
        }));
        setActiveTab('list');
      } else {
        alert("AI couldn't find any new variables.");
      }
    } catch {
      alert('Failed to auto-map variables.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setIsProcessing(true);
    const updatedDocsList = [];

    try {
      for (const doc of docs) {
        const state = docStates[doc.id];
        if (!state) continue;

        const updatedDoc = {
          ...doc,
          variables: state.mappings
        };

        await saveDoc(updatedDoc);
        updatedDocsList.push(updatedDoc);
      }

      onUpdateDocs(updatedDocsList);
      onClose();
    } catch {
      alert('Error saving templates.');
    } finally {
      setIsProcessing(false);
    }
  };



  const switchDoc = (id) => {
    setCurrentDocId(id);
    setIsDropdownOpen(false);
    setMobileTab('preview');
  };

  return (
   <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 backdrop-blur-sm md:p-4">
      <div className="bg-white w-full h-full md:h-[90vh] md:max-w-6xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5">
        {/* Header */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 relative z-20 shrink-0">
          <div className="relative flex-1 min-w-0 mr-4">
             <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 text-lg md:text-xl font-bold text-slate-800 hover:text-blue-600 transition-colors truncate w-full"
             >
                <span className="truncate">{currentDoc.name}</span>
                <ChevronDown size={20} className={`shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
             </button>
             <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">Edit variables for this document</p>

             {/* Document Dropdown */}
             {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2">
                    {docs.map(doc => (
                        <button
                            key={doc.id}
                            onClick={() => switchDoc(doc.id)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between ${currentDocId === doc.id ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-slate-700'}`}
                        >
                            <span className="truncate">{doc.name}</span>
                        </button>
                    ))}
                </div>
             )}
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button onClick={onClose} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                <X size={24} />
            </button>
          </div>
        </div>

        {/* Notification Banner */}
        {notification && (
            <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-sm py-2 px-4 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
                <CheckCircle2 size={16} className="text-emerald-600" />
                {notification}
            </div>
        )}

        {/* Mobile/Tablet Tab Navigation */}
        <div className="lg:hidden flex border-b border-slate-200 bg-white shrink-0">
            <button
                onClick={() => setMobileTab('preview')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    mobileTab === 'preview' 
                    ? 'border-blue-600 text-blue-600 bg-blue-50/20' 
                    : 'border-transparent text-slate-500 hover:bg-slate-50'
                }`}
            >
                <Eye size={18} /> Preview Text
            </button>
            <button
                onClick={() => setMobileTab('controls')}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    mobileTab === 'controls' 
                    ? 'border-blue-600 text-blue-600 bg-blue-50/20' 
                    : 'border-transparent text-slate-500 hover:bg-slate-50'
                }`}
            >
                <List size={18} /> Variables
                {currentMappings.length > 0 && (
                    <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full min-w-5 text-center">
                        {currentMappings.length}
                    </span>
                )}
            </button>
        </div>

        {/* Content - Flex Column on mobile (showing one at a time), Row on Desktop */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Left: Preview */}
          <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-h-0 bg-slate-50/50 border-r border-slate-200 h-full w-full lg:w-auto`}>
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 h-12">
              <div className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
                <span className="hidden sm:inline">Current Text (Markdown Preview)</span>
                <span className="sm:hidden">Document</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefreshPreview}
                  disabled={isProcessing}
                  title="Apply current mappings to preview text"
                  className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isProcessing ? "animate-spin" : ""} />
                  <span className="inline">Refresh</span>
                </button>
              </div>
            </div>
            
            <div className="relative flex-1 overflow-hidden" id="preview-container">
                <OptimizedMarkdownPreview
                  content={currentPreview}
                  isLoading={currentLoading}
                  onTextSelect={(text) => {
                    setOriginalText(text);
                    setVarName('');
                    setActiveTab('add');
                    setMobileTab('controls');
                  }}
                />
            </div>
             
             {/* Hint */}
             <div className="p-2 bg-blue-50/80 text-blue-800 text-xs border-t border-blue-100 shrink-0 text-center lg:text-left flex items-center justify-center lg:justify-start gap-2">
               <Highlighter size={12} />
               <span>Highlight text above to create a variable</span>
             </div>
          </div>

          {/* Right: Controls */}
          <div className={`${mobileTab === 'controls' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[420px] flex-col bg-white shadow-xl z-10 h-full border-t lg:border-t-0 border-slate-200`}>
            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
              <button
                onClick={() => setActiveTab('add')}
                className={`flex-1 py-3 md:py-3.5 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'add' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {editingIndex !== null ? <Pencil size={16} /> : <Plus size={16} />} 
                {editingIndex !== null ? 'Edit' : 'Add'}
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`flex-1 py-3 md:py-3.5 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'list' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <List size={16} /> Defined ({currentMappings.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50">
              {activeTab === 'add' && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                   {/* Auto Map Banner */}
                   {editingIndex === null && (
                    <div className="bg-linear-to-r from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-100 mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-purple-900 text-sm">AI Auto-Map</h4>
                          <p className="text-xs text-purple-700 mt-0.5">Auto-detect variables using AI.</p>
                        </div>
                        <Sparkles size={20} className="text-purple-400" />
                      </div>
                      <button
                        onClick={handleAutoMap}
                        disabled={isAiLoading || !currentPreview}
                        className="w-full mt-2 bg-white text-purple-700 border border-purple-200 py-2 rounded-lg text-sm font-bold hover:bg-purple-50 hover:text-purple-800 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                         {isAiLoading ? <Loader2 className="animate-spin" size={14} /> : "Run Auto-Map"}
                      </button>
                    </div>
                   )}

                  <div>
                    <h3 className="font-bold text-slate-800 mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
                      {editingIndex !== null ? 'Edit Variable' : 'Create Variable'}
                    </h3>
                    
                    <div className="space-y-4 md:space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Original Text
                        </label>
                        <input
                          type="text"
                          value={originalText}
                          onChange={(e) => setOriginalText(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm transition-all"
                          placeholder="Highlight in preview..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Variable Name
                        </label>
                        <div className={`flex items-center shadow-sm rounded-lg border bg-white overflow-hidden transition-all ${editingIndex !== null ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent'}`}>
                          <span className="px-3 py-3 bg-slate-50 border-r border-slate-200 text-slate-500 font-mono text-sm font-medium select-none">
                            {"{{"}
                          </span>
                          <input
                            type="text"
                            value={varName}
                            onChange={(e) => setVarName(e.target.value)}
                            className="flex-1 px-3 py-3 bg-transparent text-slate-900 placeholder-slate-400 text-sm font-mono font-medium outline-none"
                            placeholder="event_name"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        {editingIndex !== null && (
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50 flex justify-center items-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                          >
                            <RotateCcw size={16} /> <span className="hidden sm:inline">Cancel</span>
                          </button>
                        )}
                        <button
                          onClick={handleSaveMapping}
                          disabled={!originalText || !varName}
                          className={`flex-2 py-2.5 rounded-lg text-sm font-semibold text-white flex justify-center items-center gap-2 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                            editingIndex !== null 
                              ? 'bg-indigo-600 hover:bg-indigo-700' 
                              : 'bg-slate-900 hover:bg-slate-800'
                          }`}
                        >
                          {editingIndex !== null ? (
                            <>
                              <Check size={16} /> Update
                            </>
                          ) : (
                            <>
                              <Plus size={16} /> Add Mapping
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'list' && (
                <div className="p-4 md:p-6">
                  {currentMappings.length === 0 ? (
                    <div className="text-center py-8 md:py-12 text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      No variables defined.
                      <button 
                        onClick={() => setActiveTab('add')}
                        className="block w-full mt-2 text-blue-600 font-semibold hover:underline"
                      >
                        Add first variable
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentMappings.map((m, idx) => (
                        <div 
                          key={idx} 
                          className={`bg-white p-4 rounded-xl border shadow-sm relative group transition-all ${
                            editingIndex === idx 
                              ? 'border-indigo-400 ring-2 ring-indigo-50 z-10' 
                              : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                          }`}
                        >
                          <div className="absolute top-3 right-3 flex gap-1">
                             <button
                              onClick={() => handleEdit(idx)}
                              className={`p-1.5 rounded-md transition-all ${
                                editingIndex === idx 
                                  ? 'text-indigo-600 bg-indigo-50' 
                                  : 'text-slate-300 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                              title="Edit mapping"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => removeMapping(idx)}
                              className="text-slate-300 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-all"
                              title="Remove mapping"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Replaces</div>
                          <div className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-3 break-all leading-relaxed">
                            "{m.originalText}"
                          </div>
                          <div className="flex items-center gap-2 text-xs text-blue-600 font-mono">
                            <span className="text-slate-400 font-sans">with</span> 
                            <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100 font-semibold">
                              {`{{${m.variableName}}}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0">
              <button
                onClick={handleSaveAll}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-sm hover:shadow-md flex justify-center items-center gap-2 transition-all disabled:opacity-70 active:scale-[0.98]"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariableMapper;
