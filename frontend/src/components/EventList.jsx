import { useState } from 'react';
import { saveEvent, deleteEvent } from '../services/storage';
import { Plus, Trash2, Calendar, ArrowRight, Loader2, Pencil, Check, X } from 'lucide-react';

const EventList = ({ events, isLoading, onSelectEvent, onRefresh }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSaving(true);
    const newEvent = {
      id: crypto.randomUUID(),
      name: newName,
      description: newDesc,
      createdAt: new Date().toISOString(),
    };

    await saveEvent(newEvent);
    setNewName('');
    setNewDesc('');
    setIsCreating(false);
    setIsSaving(false);
    onRefresh();
  };

  const handleUpdate = async (id, originalCreatedAt) => {
    if (!editName.trim()) return;
    setIsSaving(true);

    const updatedEvent = {
      id,
      name: editName,
      description: editDesc,
      createdAt: new Date(originalCreatedAt).toISOString(),
    };

    await saveEvent(updatedEvent);
    setEditingId(null);
    setIsSaving(false);
    onRefresh();
  };

  const startEditing = (e, event) => {
    e.stopPropagation();
    setEditingId(event.id);
    setEditName(event.name);
    setEditDesc(event.description);
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('Are you sure? This will delete all associated documents.')) {
      await deleteEvent(id);
      onRefresh();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Events</h1>
          <p className="text-slate-500 mt-1">Manage your event documentation workflows</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
        >
          <Plus size={20} />
          Create Event
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-slate-200 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold text-slate-800 mb-6">New Event</h2>
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Event Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all text-base"
                placeholder="e.g., Annual Tech Summit 2024"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all text-base resize-none"
                placeholder="Brief description of the event..."
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
              >
                {isSaving && <Loader2 className="animate-spin" size={16} />}
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} />
            </div>
            <h3 className="text-lg font-medium text-slate-700">No events yet</h3>
            <p className="text-slate-500 mt-1 mb-6">
              Create your first event to start managing documents.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="text-blue-600 font-medium hover:text-blue-800"
            >
              Create Event &rarr;
            </button>
          </div>
        )}

        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => editingId !== event.id && onSelectEvent(event)}
            className={`group bg-white p-5 rounded-xl border transition-all relative ${
              editingId === event.id
                ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-lg cursor-default'
                : 'border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer'
            }`}
          >
            {editingId === event.id ? (
              // Edit Mode
              <div onClick={(e) => e.stopPropagation()} className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Event Name"
                  autoFocus
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  rows={2}
                  placeholder="Description"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={cancelEditing}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                    title="Cancel"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={() => handleUpdate(event.id, event.createdAt)}
                    disabled={isSaving}
                    className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors.shadow-sm"
                    title="Save Changes"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Check size={18} />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <>
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Calendar size={20} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEditing(e, event)}
                      className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-colors"
                      title="Edit Event"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, event.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Event"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-1">{event.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5em]">
                  {event.description || 'No description provided.'}
                </p>
                <div className="mt-4 flex items-center text-sm text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                  Manage Documents <ArrowRight size={16} className="ml-1" />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventList;