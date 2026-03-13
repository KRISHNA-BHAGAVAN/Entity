import { useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ChevronLeft,
  CloudUpload,
  Database,
  Search,
  Box,
  LayoutDashboard,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const Uploads = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [docs, setDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'danger'
  });

  useEffect(() => {
    if (!eventId) navigate('/');
  }, [eventId, navigate]);

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
            const docMetadata = { eventId: eventId, name: file.name };
            const finalId = await saveDoc(docMetadata, file);
            setDocs((prev) =>
              prev.map((d) =>
                d.id === tempId ? { ...d, id: String(finalId), status: 'complete' } : d
              )
            );
          } catch (err) {
            console.error(`Upload failed for ${file.name}`, err);
            setDocs((prev) => prev.filter((d) => d.id !== tempId));
          }
        })
      );
      toast.success('Asset synchronization successful.');
    } finally {
      setIsUploading(false);
      setUploadCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id) => {
    const doc = docs.find(d => d.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Decommission Asset',
      message: `You are about to permanently remove "${doc?.name}" from this environment. All associated metadata will be unlinked.`,
      type: 'danger',
      onConfirm: async () => {
        saveState();
        const previousDocs = [...docs];
        setDocs(docs.filter((d) => d.id !== id));
        try {
          await deleteDoc(id);
          toast.success('Asset decommissioned.');
        } catch (err) {
          setDocs(previousDocs);
          toast.error('Sever link failure.');
        }
      }
    });
  };

  const handleDeleteAll = () => {
    if (docs.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Purge Environment',
      message: `Warning: This action will permanently remove ALL ${docs.length} assets from this repository. This operation cannot be reversed.`,
      type: 'danger',
      onConfirm: async () => {
        saveState();
        const previousDocs = [...docs];
        setDocs([]);
        try {
          await Promise.all(previousDocs.map((doc) => deleteDoc(doc.id)));
          toast.success('Environment purged.');
        } catch (err) {
          setDocs(previousDocs);
          toast.error('Partial purge failure.');
        }
      }
    });
  };

  const filteredDocs = docs.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uploadingDocs = docs.filter((d) => d.status === 'uploading').length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing Repository</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-900 animate-fadeIn overflow-hidden">
      {/* PROFESSIONAL RIBBON HEADER */}
      <div className="sticky top-0 z-10 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6 w-full max-w-3xl">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft size={18} />
            <span className="text-sm font-bold tracking-tight">Return Hub</span>
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2 overflow-hidden">
             <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0"></div>
             <span className="text-sm font-black truncate max-w-[200px] md:max-w-md">
                {event?.name || 'Local Environment'}
             </span>
             <span className="hidden md:inline px-2 py-0.5 rounded bg-blue-50 text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-100">
                ACTIVE REPOSITORY
             </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button
               onClick={undo}
               disabled={!history.past.length}
               className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all disabled:opacity-20"
               title="Step Back"
            >
               <Undo2 size={16} />
            </button>
            <button
               onClick={redo}
               disabled={!history.future.length}
               className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all disabled:opacity-20"
               title="Step Forward"
            >
               <Redo2 size={16} />
            </button>
            {docs.length > 0 && (
               <button
                  onClick={handleDeleteAll}
                  className="ml-2 px-3 py-1.5 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded border border-rose-100 uppercase tracking-widest transition-all"
               >
                  Purge Environment
               </button>
            )}
        </div>
      </div>

      {/* CONTENT SCROLL AREA */}
      <div className="flex-1 overflow-y-auto bg-slate-50/20 custom-scrollbar p-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* INTRO HERO SECTION */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
             <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                   <CloudUpload size={12} />
                   Network Asset Ingestion
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                   Central Repository
                </h1>
                <p className="text-sm font-medium text-slate-500 max-w-sm">
                   Deploy and manage your .docx assets for this discovery environment. Supported files are verified before synchronization.
                </p>
             </div>

             <div className="flex gap-4">
                <div className="flex flex-col items-center justify-center w-24 h-24 bg-white border border-slate-200 rounded-2xl shadow-sm">
                   <span className="text-2xl font-black text-slate-900">{docs.length}</span>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assets</span>
                </div>
                <div className="flex flex-col items-center justify-center w-24 h-24 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200">
                   <Database size={24} className="mb-1" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">CLOUD LIVE</span>
                </div>
             </div>
          </div>

          {/* INGESTION ZONE (DROPZONE) */}
          <div className="group relative">
            <div
              role="button"
              className={`relative border-2 border-dashed rounded-4xl p-12 transition-all duration-500 flex flex-col items-center justify-center gap-6 overflow-hidden
                ${isUploading 
                  ? 'border-blue-300 bg-blue-50/50 cursor-wait' 
                  : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer shadow-sm active:scale-[0.99]'
                }`}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
               {/* Background Glow */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-400/10 blur-[80px] group-hover:bg-blue-400/20 transition-all duration-700"></div>

               <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-2xl
                  ${isUploading ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 text-white group-hover:bg-blue-600'}`}>
                  {isUploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
               </div>
               
               <div className="text-center z-10">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                     {isUploading ? `Synchronizing ${uploadCount} Asset${uploadCount > 1 ? 's' : ''}` : 'Begin Asset Ingestion'}
                  </h3>
                  <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest px-4">
                     Click to select or drop .docx protocols here
                  </p>
               </div>

               {uploadingDocs > 0 && (
                  <div className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-black shadow-lg animate-in zoom-in duration-300">
                    <ShieldCheck size={14} />
                    Processing Encrypted Stream...
                  </div>
               )}
            </div>
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

          {/* ASSET DIRECTORY */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
               <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                     Asset Inventory
                     <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        {docs.length} DETECTED
                     </span>
                  </h3>
               </div>
               <div className="relative group">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Filter inventory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all uppercase tracking-wider"
                  />
               </div>
            </div>

            {filteredDocs.length === 0 ? (
               <div className="py-24 flex flex-col items-center justify-center glass-card rounded-4xl border border-dashed border-slate-200 opacity-60">
                  <Box size={48} className="text-slate-200 mb-4" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Repository Vacant</p>
               </div>
            ) : (
               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`group/card relative flex flex-col bg-white border rounded-2xl p-6 transition-all duration-300
                        ${doc.status === 'uploading' 
                          ? 'border-blue-300 animate-pulse bg-blue-50/20' 
                          : 'border-slate-100 hover:border-blue-400 hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500
                           ${doc.status === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400 group-hover/card:bg-blue-600 group-hover/card:text-white group-hover/card:shadow-lg group-hover/card:shadow-blue-200'}`}>
                           {doc.status === 'uploading' ? <Loader2 size={24} className="animate-spin" /> : <FileText size={24} />}
                        </div>
                        {doc.status !== 'uploading' && (
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover/card:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                         <h4 className="text-sm font-black text-slate-900 truncate group-hover/card:text-blue-600 transition-colors" title={doc.name}>
                            {doc.name}
                         </h4>
                         <div className="flex items-center gap-2">
                           {doc.status === 'uploading' ? (
                              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                 <Loader2 size={8} className="animate-spin" /> Ingesting...
                              </span>
                           ) : doc.status === 'error' ? (
                              <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                 <AlertCircle size={8} /> Sync Failure
                              </span>
                           ) : (
                              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                 <ShieldCheck size={10} /> Verified Cloud
                              </span>
                           )}
                         </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest forced-colors:group-hover/card:text-blue-300">
                            Protocol 1.0.4
                         </span>
                         <span className="text-[10px] font-bold text-slate-400">
                            DOCX
                         </span>
                      </div>
                    </div>
                  ))}
               </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};

export default Uploads;

