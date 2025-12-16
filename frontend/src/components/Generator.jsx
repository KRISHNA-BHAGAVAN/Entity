import { useState, useEffect } from 'react';
import { getDocs, downloadFile } from '../services/storage';
import { generateFinalDoc } from '../services/docService';
import JSZip from 'jszip';
import {
  Download,
  Check,
  FileCheck,
  Loader2,
  Sparkles,
  AlertCircle,
  Search,
  X,
  Info,
} from 'lucide-react';

const Generator = ({ event }) => {
  const [docs, setDocs] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [formValues, setFormValues] = useState({});
  const [uniqueVars, setUniqueVars] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDocs = async () => {
      setIsLoadingDocs(true);
      try {
        const loadedDocs = await getDocs(event.id);
        setDocs(loadedDocs);
      } catch (err) {
        console.error('Failed to load docs', err);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [event.id]);

  useEffect(() => {
    // Calculate unique variables from selected docs
    const vars = new Set();
    docs
      .filter((d) => selectedIds.has(d.id))
      .forEach((d) => {
        d.variables.forEach((v) => vars.add(v.variableName));
      });
    setUniqueVars(Array.from(vars));
  }, [selectedIds, docs]);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleInputChange = (variable, value) => {
    setFormValues((prev) => ({ ...prev, [variable]: value }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const selectedDocs = docs.filter((d) => selectedIds.has(d.id));

      if (selectedDocs.length === 1) {
        // Single file download
        const doc = selectedDocs[0];
        const finalBlob = await generateFinalDoc(doc.id, formValues, doc.variables);
        downloadFile(finalBlob, `EDITED_${doc.name}`);
      } else {
        // Zip download
        const zip = new JSZip();
        for (const doc of selectedDocs) {
          const finalBlob = await generateFinalDoc(doc.id, formValues, doc.variables);
          zip.file(`EDITED_${doc.name}`, finalBlob);
        }
        const zipContent = await zip.generateAsync({ type: 'blob' });
        downloadFile(zipContent, `${event.name.replace(/\s+/g, '_')}_Docs.zip`);
      }
    } catch (err) {
      console.error(err);
      alert('Error generating documents.');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectAll = () => {
    if (selectedIds.size === docs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docs.map((d) => d.id)));
    }
  };

  const getOriginalValues = (variableName) => {
    const values = new Set();
    docs
      .filter((d) => selectedIds.has(d.id))
      .forEach((d) => {
        d.variables.forEach((v) => {
          if (v.variableName === variableName) {
            values.add(v.originalText);
          }
        });
      });
    return Array.from(values);
  };

  // Filter variables based on search
  const filteredVars = uniqueVars.filter((v) =>
    v.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingDocs) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
        <p className="text-slate-500">Loading templates...</p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <p className="text-lg font-medium text-slate-700">No templates available</p>
        <p className="text-sm">Go to "Templates" tab to upload documents first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Selection Column */}
      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-center mb-2 px-1">
          <h3 className="text-lg font-bold text-slate-800">1. Select Documents</h3>
          <button
            onClick={selectAll}
            className="text-sm text-blue-600 font-semibold hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          >
            {selectedIds.size === docs.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-350px)] lg:h-[600px] overflow-y-auto">
          {docs.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`p-4 border-b border-slate-100 last:border-0 cursor-pointer flex items-center justify-between transition-all ${
                  isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm scale-110'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </div>
                  <div>
                    <span
                      className={`block font-semibold ${
                        isSelected ? 'text-blue-900' : 'text-slate-700'
                      }`}
                    >
                      {doc.name}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Updated {new Date(doc.uploadDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {doc.variables.length} vars
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input Column */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 mb-6 px-1">2. Enter Values</h3>

        {selectedIds.size === 0 ? (
          <div className="flex-1 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-sm italic p-8 text-center">
            <span className="bg-white p-3 rounded-full mb-3 shadow-sm">
              <Check className="text-slate-300" />
            </span>
            Select documents on the left to see which variables need values.
          </div>
        ) : uniqueVars.length === 0 ? (
          <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <FileCheck size={32} />
            </div>
            <h4 className="text-xl font-bold text-green-800 mb-2">No Variables Required</h4>
            <p className="text-green-700 mb-8 max-w-xs mx-auto">
              The selected documents do not have any mapped variables to replace.
            </p>
            <button
              onClick={handleGenerate}
              className="px-8 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md flex items-center gap-3 transition-transform active:scale-95 text-lg"
            >
              <Download size={24} /> Download Originals
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-350px)] lg:h-[600px] bg-white rounded-xl border border-slate-200 shadow-lg flex-1 overflow-hidden">
            {/* Search Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search variables..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="text-xs text-slate-500 italic mb-2">
                Leave fields empty to keep the original document text.
              </div>

              {filteredVars.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p>No variables found matching "{searchTerm}"</p>
                </div>
              ) : (
                filteredVars.map((variable) => {
                  const originalValues = getOriginalValues(variable);
                  return (
                    <div
                      key={variable}
                      className="group relative bg-slate-50/50 p-5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all shadow-sm hover:shadow-md"
                    >
                      {/* Tooltip for original value */}
                      <div className="absolute left-4 bottom-full mb-2 w-max max-w-[280px] bg-slate-800 text-white text-xs rounded-lg py-3 px-4 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 pointer-events-none translate-y-2 group-hover:translate-y-0 duration-200">
                        <div className="font-semibold mb-1.5 text-slate-300 border-b border-slate-700 pb-1 flex items-center gap-1.5">
                          <Info size={12} className="text-blue-400" /> Original Text in Document(s):
                        </div>
                        <ul className="space-y-1">
                          {originalValues.slice(0, 3).map((val, i) => (
                            <li
                              key={i}
                              className="truncate text-slate-100 font-mono bg-slate-700/50 px-1.5 py-0.5 rounded"
                            >
                              "{val}"
                            </li>
                          ))}
                          {originalValues.length > 3 && (
                            <li className="text-slate-400 italic text-[10px] pl-1">
                              + {originalValues.length - 3} more variation(s)
                            </li>
                          )}
                        </ul>
                        {/* Arrow */}
                        <div className="absolute left-8 -bottom-1.5 w-3 h-3 bg-slate-800 rotate-45 transform"></div>
                      </div>

                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-bold text-slate-700 cursor-help border-b border-dotted border-slate-300 hover:border-slate-500 transition-colors">
                          {variable
                            .split('_')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ')}
                        </label>
                        <span className="bg-white text-indigo-600 px-2 py-1 rounded text-xs font-mono border border-indigo-100 shadow-sm select-none">
                          {`{{${variable}}}`}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formValues[variable] || ''}
                        onChange={(e) => handleInputChange(variable, e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-base font-medium placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder={`Value for ${variable}...`}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl z-20">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed text-lg active:scale-[0.99]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={24} /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={24} /> Generate & Download ({selectedIds.size})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;