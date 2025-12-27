import { useRef, useState, useEffect } from 'react';
import { saveDoc, getDocs, deleteDoc } from '../services/storage';
import VariableMapper from './VariableMapper';
import {
  Upload,
  FileText,
  Edit3,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const TemplateManager = ({ event }) => {
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const fileInputRef = useRef(null);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const fetchedDocs = await getDocs(event.id);
      setDocs(fetchedDocs.map((d) => ({ ...d, status: 'complete' })));
    } catch (e) {
      console.error('Error loading docs', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [event.id]);

const handleFileUpload = async (e) => {
  if (!e.target.files) return;

  // 1. Filter for .docx and REMOVE DUPLICATES already in the UI state
  const existingNames = new Set(docs.map(d => d.name));
  const newFiles = Array.from(e.target.files).filter((file) => {
    const isDocx = file.name.endsWith('.docx');
    const isDuplicate = existingNames.has(file.name);
    
    if (isDuplicate) {
      console.warn(`Skipping duplicate file: ${file.name}`);
    }
    return isDocx && !isDuplicate;
  });

  if (newFiles.length === 0) {
    if (fileInputRef.current) fileInputRef.current.value = '';
    return;
  }

  setIsUploading(true);
  setUploadCount(newFiles.length);

  const optimisticDocs = newFiles.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    variables: [],
    status: 'uploading',
    uploadDate: Date.now(),
  }));

  setDocs((prev) => [...optimisticDocs, ...prev]);

  try {
    await Promise.all(
      newFiles.map(async (file, index) => {
        const tempId = optimisticDocs[index].id;
        try {
          const docMetadata = {
            eventId: event.id,
            name: file.name,
          };

          // saveDoc will hit Supabase Storage
          const finalId = await saveDoc(docMetadata, file);

          setDocs((prev) =>
            prev.map((d) =>
              d.id === tempId
                ? { ...d, id: String(finalId), status: 'complete' } // Ensure ID is a string
                : d
            )
          );

        } catch (err) {
          // 2. Handle Supabase "Asset Already Exists" error gracefully
          if (err.message?.includes('Asset Already Exists') || err.status === 400) {
             console.log("File already exists in storage, skipping update.");
          } else {
             console.error(`Upload failed for ${file.name}`, err);
          }
          // Remove from UI if it failed or was a storage duplicate
          setDocs((prev) => prev.filter((d) => d.id !== tempId));
        }
      })
    );
  } finally {
    setIsUploading(false);
    setUploadCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
};


  const handleUpdateDocs = async (updatedDocs) => {
    const newDocsMap = new Map(docs.map((d) => [d.id, d]));
    updatedDocs.forEach((d) =>
      newDocsMap.set(d.id, { ...d, status: 'complete' })
    );
    setDocs(Array.from(newDocsMap.values()));
    setTimeout(loadDocs, 500);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this template?')) {
      const previousDocs = [...docs];
      setDocs(docs.filter((d) => d.id !== id));

      try {
        await deleteDoc(id);
      } catch (err) {
        console.error('Delete failed', err);
        setDocs(previousDocs);
        alert('Failed to delete from server.');
      }
    }
  };

  const handleDeleteAll = async () => {
    if (confirm('Delete all templates?')) {
      const previousDocs = [...docs];
      setDocs([]);

      try {
        await Promise.all(previousDocs.map((doc) => deleteDoc(doc.id)));
      } catch (err) {
        console.error('Mass delete failed', err);
        setDocs(previousDocs);
        alert('Some files could not be deleted.');
      }
    }
  };

  const uploadingDocs = docs.filter((d) => d.status === 'uploading').length;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="space-y-2">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload ERD .docx documents"
          className={`border-2 border-dashed rounded-xl px-4 py-6 sm:px-8 sm:py-8 text-center bg-slate-50 transition-all flex flex-col items-center justify-center gap-2 sm:gap-3 outline-none
            ${
              isUploading
                ? 'border-blue-300 bg-blue-50/40 cursor-wait'
                : 'hover:bg-blue-50 hover:border-blue-400 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400'
            }`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!isUploading && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500">
            {isUploading ? (
              <Loader2 className="animate-spin" size={28} />
            ) : (
              <Upload size={28} />
            )}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-700">
              {isUploading
                ? 'Uploading templates...'
                : 'Upload ERD Documents'}
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Click to browse or drop .docx files here. Multiple files
              supported.
            </p>
          </div>
          {uploadingDocs > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              {uploadingDocs} file
              {uploadingDocs > 1 ? 's' : ''} in progress...
            </p>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".docx"
            multiple
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </div>
        {uploadCount > 0 && (
          <p className="text-xs text-slate-500 text-right">
            Queued {uploadCount} new template
            {uploadCount > 1 ? 's' : ''}.
          </p>
        )}
      </div>

      {/* Header and Delete All */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
            Available Templates
            <span className="text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {docs.length}
            </span>
          </h3>
          {docs.length > 0 && (
            <button
              className="self-start sm:self-auto text-xs font-medium flex items-center gap-2 border border-red-200 rounded-md px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
              onClick={handleDeleteAll}
            >
              Delete All <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* List / Empty / Loading */}
        {isLoading && docs.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg py-6 px-4 text-center">
            <p className="text-slate-400 text-sm italic">
              No templates uploaded yet. Start by adding a .docx file
              above.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className={`bg-white border rounded-lg p-4 shadow-sm transition-all flex flex-col h-full
                  ${
                    doc.status === 'uploading'
                      ? 'border-blue-200 animate-pulse'
                      : 'border-slate-200 hover:shadow-md'
                  }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        doc.status === 'error'
                          ? 'bg-red-100 text-red-600'
                          : doc.status === 'uploading'
                          ? 'bg-blue-50 text-blue-400'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {doc.status === 'uploading' ? (
                        <Loader2 size={22} className="animate-spin" />
                      ) : (
                        <FileText size={22} />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <h4
                        className="font-medium text-slate-800 text-sm sm:text-base truncate"
                        title={doc.name}
                      >
                        {doc.name}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        {doc.status === 'uploading' ? (
                          <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">
                            Sending...
                          </span>
                        ) : doc.status === 'error' ? (
                          <span className="text-[11px] font-semibold text-red-500 flex items-center gap-1">
                            <AlertCircle size={10} />
                            Failed
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <CheckCircle2
                              size={10}
                              className="text-green-500"
                            />
                            {doc.variables?.length || 0} variables
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {doc.status !== 'uploading' && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      aria-label={`Delete template ${doc.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedDocId(doc.id)}
                  disabled={doc.status !== 'complete'}
                  className={`mt-auto w-full py-2 px-3 border rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all
                    ${
                      doc.status === 'complete'
                        ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 hover:cursor-pointer'
                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                >
                  <Edit3 size={14} />
                  Map Variables
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDocId && (
        <VariableMapper
          docs={docs}
          initialDocId={selectedDocId}
          onUpdateDocs={handleUpdateDocs}
          onClose={() => setSelectedDocId(null)}
        />
      )}
    </div>
  );
};

export default TemplateManager;
