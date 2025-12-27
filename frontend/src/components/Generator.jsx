import { useState, useEffect, useMemo } from 'react';
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

  /* ---------------- Fetch Docs ---------------- */
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

  /* ---------------- Compute Unique Vars ---------------- */
  useEffect(() => {
    const vars = new Set();
    docs
      .filter(d => selectedIds.has(d.id))
      .forEach(d =>
        d.variables.forEach(v => vars.add(v.variableName))
      );
    setUniqueVars([...vars]);
  }, [selectedIds, docs]);

  /* ---------------- Helpers ---------------- */
  const toggleSelect = id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(
      selectedIds.size === docs.length
        ? new Set()
        : new Set(docs.map(d => d.id))
    );
  };

  const handleInputChange = (variable, value) => {
    setFormValues(prev => ({ ...prev, [variable]: value }));
  };

  const getOriginalValues = variableName => {
    const values = new Set();
    docs
      .filter(d => selectedIds.has(d.id))
      .forEach(d =>
        d.variables.forEach(v => {
          if (v.variableName === variableName) values.add(v.originalText);
        })
      );
    return [...values];
  };

  const filteredVars = useMemo(
    () =>
      uniqueVars.filter(v =>
        v.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [uniqueVars, searchTerm]
  );

  /* ---------------- Generate ---------------- */
  const handleGenerate = async () => {
    if (!selectedIds.size) return;
    setIsGenerating(true);

    try {
      const selectedDocs = docs.filter(d => selectedIds.has(d.id));

      if (selectedDocs.length === 1) {
        const doc = selectedDocs[0];
        const blob = await generateFinalDoc(
          doc.id,
          formValues,
          doc.variables
        );
        downloadFile(blob, `EDITED_${doc.name}`);
      } else {
        const zip = new JSZip();
        for (const doc of selectedDocs) {
          const blob = await generateFinalDoc(
            doc.id,
            formValues,
            doc.variables
          );
          zip.file(`EDITED_${doc.name}`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadFile(
          zipBlob,
          `${event.name.replace(/\s+/g, '_')}_Docs.zip`
        );
      }
    } catch (err) {
      console.error(err);
      alert('Error generating documents.');
    } finally {
      setIsGenerating(false);
    }
  };

  /* ---------------- States ---------------- */
  if (isLoadingDocs) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!docs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <AlertCircle className="mb-4 text-slate-300" size={48} />
        <p className="font-semibold text-slate-700">No templates available</p>
        <p className="text-sm text-slate-500">
          Upload documents in the Templates tab.
        </p>
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* ---------------- Left: Docs ---------------- */}
      <section className="lg:w-1/2 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800">
            1. Select Documents
          </h3>
          <button
            onClick={selectAll}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            {selectedIds.size === docs.length ? 'Clear' : 'Select All'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl border bg-white">
          {docs.map(doc => {
            const selected = selectedIds.has(doc.id);
            return (
              <button
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`w-full text-left p-4 border-b flex items-center justify-between transition
                  ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-md border flex items-center justify-center
                      ${selected ? 'bg-blue-600 text-white' : ''}`}
                  >
                    {selected && <Check size={14} />}
                  </span>
                  <div>
                    <p className="font-medium text-slate-700">
                      {doc.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {doc.variables.length} variables
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- Right: Inputs ---------------- */}
      <section className="lg:w-1/2 flex flex-col">
        <h3 className="font-bold text-slate-800 mb-3">
          2. Enter Values
        </h3>

        {!selectedIds.size ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 border border-dashed rounded-xl">
            Select documents to continue
          </div>
        ) : !uniqueVars.length ? (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-green-50 border">
            <FileCheck size={36} className="text-green-600 mb-3" />
            <p className="font-semibold text-green-700">
              No variables required
            </p>
            <button
              onClick={handleGenerate}
              className="mt-6 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:cursor-pointer"
            >
              Download Originals
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col rounded-xl border bg-white overflow-hidden">
            {/* Search */}
            <div className="p-4 border-b sticky top-0 bg-white z-10">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search variables"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {searchTerm && (
                  <X
                    size={16}
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400"
                  />
                )}
              </div>
            </div>

            {/* Variables */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {filteredVars.map(variable => {
                const originals = getOriginalValues(variable);
                return (
                  <div
                    key={variable}
                    className="p-4 rounded-xl border bg-slate-50"
                  >
                    <div className="flex justify-between mb-2">
                      <label className="font-semibold text-sm">
                        {variable.replace(/_/g, ' ')}
                      </label>
                     <span className="text-xs font-mono text-indigo-600">
                      {`{{${variable}}}`}
                    </span>

                    </div>
                    <input
                      value={formValues[variable] || ''}
                      onChange={e =>
                        handleInputChange(variable, e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border"
                      placeholder={`Value for ${variable}`}
                    />
                    {originals.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                        <Info size={12} /> Original: "{originals[0]}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action */}
            <div className="p-4 border-t bg-slate-50 sticky bottom-0">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate & Download ({selectedIds.size})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Generator;
