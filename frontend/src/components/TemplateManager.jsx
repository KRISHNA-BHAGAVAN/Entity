import { useRef, useState, useEffect } from 'react';
import { saveDoc, getDocs, deleteDoc } from '../services/storage';
import VariableMapper from './VariableMapper';
import { Upload, FileText, Edit3, Trash2, Loader2 } from 'lucide-react';

const TemplateManager = ({ event }) => {
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const fetchedDocs = await getDocs(event.id);
      console.log("FetchedDocs: \n", fetchedDocs);
      setDocs(fetchedDocs);
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
    if (e.target.files) {
      setIsUploading(true);
      const files = Array.from(e.target.files);

      for (const file of files) {
        if (!file.name.endsWith('.docx')) continue;

        const doc = {
          id: crypto.randomUUID(),
          eventId: event.id,
          name: file.name,
          variables: [],
          uploadDate: Date.now(),
        };
        await saveDoc(doc, file);
      }
      await loadDocs();
      setIsUploading(false);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateDocs = async (updatedDocs) => {
    // Update local state immediately for responsiveness
    const newDocsMap = new Map(docs.map((d) => [d.id, d]));
    updatedDocs.forEach((d) => newDocsMap.set(d.id, d));
    setDocs(Array.from(newDocsMap.values()));

    // We assume the Mapper calls saveDoc internally for persistence, 
    // so we just reload to be safe or rely on state.
    // For safety, let's reload after a brief delay to ensure FS sync
    setTimeout(loadDocs, 500);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this template?')) {
      await deleteDoc(id);
      setDocs(docs.filter((d) => d.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 transition-colors ${
          isUploading
            ? 'opacity-50 cursor-wait'
            : 'hover:bg-blue-50 hover:border-blue-400 cursor-pointer'
        }`}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-blue-500">
          {isUploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
        </div>
        <h3 className="text-lg font-semibold text-slate-700">
          {isUploading ? 'Uploading...' : 'Upload ERD Documents'}
        </h3>
        <p className="text-slate-500 text-sm mt-1">Click to browse or drop .docx files here</p>
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

      {/* List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          Available Templates{' '}
          <span className="text-sm font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            {docs.length}
          </span>
        </h3>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" />
          </div>
        ) : docs.length === 0 ? (
          <p className="text-slate-400 text-sm italic">No templates uploaded yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-800 truncate max-w-[150px]" title={doc.name}>
                        {doc.name}
                      </h4>
                      <span className="text-xs text-slate-500">{doc.variables.length} Variables</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <button
                  onClick={() => setSelectedDocId(doc.id)}
                  className="w-full mt-2 py-2 px-3 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 hover: cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <Edit3 size={14} /> Map Variables
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
