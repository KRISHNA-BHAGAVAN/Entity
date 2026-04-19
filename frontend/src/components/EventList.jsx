import { useState } from 'react';
import { saveEvent, deleteEvent } from '../services/storage';
import {
  Plus,
  Trash2,
  Calendar,
  ArrowRight,
  Pencil,
  Check,
  X,
  Search,
  Filter,
  FileText,
  Clock,
  ChevronRight,
  LayoutDashboard,
  Box
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from './ConfirmModal';
import { DashboardSkeleton } from './Skeletons';

const EventList = ({ events, isLoading, onSelectEvent, onRefresh }) => {
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');

  const [savingKey, setSavingKey] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSavingKey('create');
    try {
      const newEvent = {
        id: crypto.randomUUID(),
        name: newName,
        description: newDesc,
        createdAt: new Date().toISOString(),
        eventDate: newDate || null,
      };
      await saveEvent(newEvent);
      setNewName('');
      setNewDesc('');
      setNewDate('');
      setIsCreating(false);
      onRefresh();
      toast.success('Workspace initialized successfully.');
    } catch (err) {
      console.error('Failed to create event:', err);
      toast.error('Initialization failed.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleUpdate = async (id, originalCreatedAt) => {
    if (!editName.trim()) return;
    setSavingKey(id);
    try {
      const updatedEvent = {
        id,
        name: editName,
        description: editDesc,
        createdAt: new Date(originalCreatedAt).toISOString(),
        eventDate: editDate || null,
      };
      await saveEvent(updatedEvent);
      setEditingId(null);
      onRefresh();
      toast.success('Workspace configuration updated.');
    } catch (err) {
      console.error('Failed to update event:', err);
      toast.error('Update failed.');
    } finally {
      setSavingKey(null);
    }
  };

  const startEditing = (e, event) => {
    e.stopPropagation();
    setEditingId(event.id);
    setEditName(event.name);
    setEditDesc(event.description);
    let formattedDate = '';
    if (event.eventDate) {
      formattedDate = event.eventDate.split('T')[0];
    } else if (event.createdAt) {
      formattedDate = new Date(event.createdAt).toISOString().split('T')[0];
    }
    setEditDate(formattedDate);
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setEventToDelete(id);
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    try {
      await deleteEvent(eventToDelete);
      onRefresh();
      toast.success('Project detached successfully.');
    } catch (err) {
      console.error('Failed to delete event:', err);
      toast.error('Removal failed.');
    } finally {
      setEventToDelete(null);
      setShowConfirmModal(false);
    }
  };

  const filteredEvents = events.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-900 animate-fadeIn overflow-hidden">
      {/* ADVANCED STUDIO HEADER */}
      <div className="sticky top-0 z-10 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6 w-full max-w-2xl">
          <div className="flex items-center gap-2 text-slate-500">
            <LayoutDashboard size={18} className="text-blue-600" />
            <span className="text-sm font-bold text-slate-900 tracking-tight">Project Hub</span>
          </div>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text"
              placeholder="Search workspaces by title or scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-medium focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all"
            />
          </div>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold hover:bg-blue-700 shadow-sm active:scale-95 transition-all"
        >
          <Plus size={16} />
          <span>New Event</span>
        </button>
      </div>

      {/* WORKSPACE AREA */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30 p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {/* Section Breadcrumb/Title */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                <Box size={10} />
                Environment Repository
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Documentation Assets</h1>
            </div>
            
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
               <div className="flex flex-col items-end mr-3 border-r border-slate-100 pr-4">
                  <span className="text-xs font-black text-slate-900">{filteredEvents.length} Units</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</span>
               </div>
               <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <FileText size={16} />
               </div>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => {
              const isEditing = editingId === event.id;
              const isSaving = savingKey === event.id;
              const dateStr = event.eventDate 
                ? new Date(event.eventDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                : (event.createdAt ? new Date(event.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A');

              return (
                <div
                  key={event.id}
                  className={`group relative flex flex-col bg-white border rounded-xl transition-all duration-300 ${
                    isEditing 
                      ? 'border-blue-600 ring-4 ring-blue-50 shadow-2xl z-20' 
                      : 'border-slate-200 hover:border-blue-300 hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-1'
                  }`}
                >
                  {isEditing ? (
                    <div className="p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-2">
                        <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                          <Pencil size={12} />
                          Editor Console
                        </span>
                        <X size={16} className="text-slate-300 hover:text-slate-600 cursor-pointer" onClick={() => setEditingId(null)} />
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:bg-white focus:border-blue-600 outline-none transition-all"
                            placeholder="Identify this workspace..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Timeline Reference</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:bg-white focus:border-blue-600 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Scope</label>
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:bg-white focus:border-blue-600 outline-none resize-none"
                            placeholder="Define project boundaries..."
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          DISCARD
                        </button>
                        <button
                          onClick={() => handleUpdate(event.id, event.createdAt)}
                          disabled={isSaving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-100 active:scale-95 transition-all"
                        >
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          SAVE ASYNC
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-6 pb-2">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-500 shadow-sm">
                            <FileText size={20} />
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={(e) => startEditing(e, event)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(e, event.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
                          {event.name}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-500 line-clamp-2 mb-6 h-8 leading-relaxed">
                          {event.description || 'No system definition provided for this documentation unit.'}
                        </p>

                        <div className="flex gap-4 border-t border-slate-50 pt-5">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Calendar size={12} className="text-slate-300" />
                            {dateStr}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Clock size={12} className="text-slate-300" />
                            LIVE
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => onSelectEvent(event)}
                        className="mt-4 px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between cursor-pointer group/footer hover:bg-blue-600 transition-all rounded-b-xl"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover/footer:text-white transition-colors">
                          Deploy Environment
                        </span>
                        <ChevronRight size={14} className="text-slate-300 group-hover/footer:text-white group-hover/footer:translate-x-1 transition-all" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {!isCreating && filteredEvents.length === 0 && (
            <div className="col-span-full py-24 bg-white/40 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-200 mb-4">
                  <Search size={32} />
               </div>
               <h3 className="text-base font-black text-slate-800 tracking-tight">Search Limit Reached</h3>
               <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest px-6">No matching environments found in local repository.</p>
               <button 
                onClick={() => setSearchQuery('')}
                className="mt-6 text-xs font-black text-blue-600 hover:text-blue-800 transition-colors"
               >
                 CLEAR FILTER
               </button>
            </div>
          )}
        </div>
      </div>

      {/* OVERLAY: PROJECT DEFINITION */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsCreating(false)}
          ></div>
          <form 
            onSubmit={handleCreate}
            className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 slide-in-from-bottom-4 duration-400"
          >
            <div className="bg-slate-50/80 border-b border-slate-200 px-8 py-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Initialize Workspace</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                   <Box size={10} className="text-blue-600" />
                   New Asset Definition
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Identifier</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Infrastructure Audit Alpha"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Timeline</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Functional Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Provide tactical context for this workspace..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none resize-none transition-all"
                />
              </div>
            </div>

            <div className="p-8 pt-0 flex gap-4">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={savingKey === 'create'}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all"
              >
                {savingKey === 'create' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                PERSIST ASSET
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmDelete}
        title="Unlink Asset"
        message="This will detach the selected documentation unit from the local environment. Any non-synchronized cloud data will be maintained but locally inaccessible."
        confirmText="DETACH FROM WORKSPACE"
        type="danger"
      />
    </div>
  );
};

export default EventList;