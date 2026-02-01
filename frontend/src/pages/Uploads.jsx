import { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { saveDoc, getDocs, deleteDoc } from '../services/storage';
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Undo2,
  Redo2,
} from 'lucide-react';

const Uploads = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');

  const [event, setEvent] = useState(null);
  const [docs, setDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [history, setHistory] = useState({ past: [], future: [] });
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadEventAndDocs = async () => {
      if (!eventId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: eventData } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (eventData) {
          setEvent(eventData);
          const fetchedDocs = await getDocs(eventId);
          setDocs(fetchedDocs.map((d) => ({ ...d, status: 'complete' })));
        }
      } catch (e) {
        console.error('Error loading event and docs', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadEventAndDocs();
  }, [eventId]);

  const saveState = () => {
    const currentState = JSON.parse(JSON.stringify(docs));
    setHistory((prev) => ({
      past: [...prev.past, currentState],
      future: [],
    }));
  };

  const undo = () => {
    if (!history.past.length) return;

    const previousState = history.past[history.past.length - 1];
    const currentState = JSON.parse(JSON.stringify(docs));

    setDocs(previousState);
    setHistory((prev) => ({
      past: prev.past.slice(0, -1),
      future: [currentState, ...prev.future],
    }));
  };

  const redo = () => {
    if (!history.future.length) return;

    const nextState = history.future[0];
    const currentState = JSON.parse(JSON.stringify(docs));

    setDocs(nextState);
    setHistory((prev) => ({
      past: [...prev.past, currentState],
      future: prev.future.slice(1),
    }));
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || !eventId) return;

    const existingNames = new Set(docs.map((d) => d.name));
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
              eventId: eventId,
              name: file.name,
            };

            const finalId = await saveDoc(docMetadata, file);

            setDocs((prev) =>
              prev.map((d) =>
                d.id === tempId
                  ? { ...d, id: String(finalId), status: 'complete' }
                  : d
              )
            );
          } catch (err) {
            if (
              err.message?.includes('Asset Already Exists') ||
              err.status === 400
            ) {
              console.log('File already exists in storage, skipping update.');
            } else {
              console.error(`Upload failed for ${file.name}`, err);
            }
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

  const handleDelete = async (id) => {
    if (confirm('Delete this file?')) {
      saveState();
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
    if (confirm('Delete all files?')) {
      saveState();
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

  if (!eventId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-12">
          <Upload className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            No event selected
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Please select an event from the dashboard to upload documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Uploads</h1>
        {event && <p className="text-slate-600">Event: {event.name}</p>}
      </div>

      <div className="space-y-6">
        {/* Upload Area */}
        <div className="space-y-2">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload .docx documents"
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
                {isUploading ? 'Uploading files...' : 'Upload Documents'}
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
              Queued {uploadCount} new file
              {uploadCount > 1 ? 's' : ''}.
            </p>
          )}
        </div>

        {/* Header and Delete All */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
              Uploaded Files
              <span className="text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {docs.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={!history.past.length}
                className="p-2 rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={redo}
                disabled={!history.future.length}
                className="p-2 rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Redo"
              >
                <Redo2 size={16} />
              </button>
              {docs.length > 0 && (
                <button
                  className="text-xs font-medium flex items-center gap-2 border border-red-200 rounded-md px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
                  onClick={handleDeleteAll}
                >
                  Delete All <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" size={36} />
            </div>
          ) : (
            <>
              {docs.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-lg py-6 px-4 text-center">
                  <p className="text-slate-400 text-sm italic">
                    No files uploaded yet. Start by adding a .docx file above.
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
                                  Uploading...
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
                                  Uploaded
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {doc.status !== 'uploading' && (
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                            aria-label={`Delete file ${doc.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Uploads;
