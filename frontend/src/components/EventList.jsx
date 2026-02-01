import { useState } from 'react';
import { saveEvent, deleteEvent } from '../services/storage';
import {
  Plus,
  Trash2,
  Calendar,
  ArrowRight,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react';

const EventList = ({ events, isLoading, onSelectEvent, onRefresh }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  /**
   * savingKey can be:
   * - 'create'
   * - event.id
   * - null
   */
  const [savingKey, setSavingKey] = useState(null);

  /* ---------------- CREATE ---------------- */
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
      };

      await saveEvent(newEvent);

      setNewName('');
      setNewDesc('');
      setIsCreating(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create event:', err);
      alert('Failed to create event. Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  /* ---------------- UPDATE ---------------- */
  const handleUpdate = async (id, originalCreatedAt) => {
    if (!editName.trim()) return;

    setSavingKey(id);

    try {
      const updatedEvent = {
        id,
        name: editName,
        description: editDesc,
        createdAt: new Date(originalCreatedAt).toISOString(),
      };

      await saveEvent(updatedEvent);

      setEditingId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to update event:', err);
      alert('Failed to update event.');
    } finally {
      setSavingKey(null);
    }
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

  /* ---------------- DELETE ---------------- */
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Are you sure? This will delete all associated documents.')) return;

    try {
      await deleteEvent(id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete event:', err);
      alert('Failed to delete event.');
    }
  };

  /* ---------------- LOADING ---------------- */
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
            Events
          </h1>
          <p className="text-slate-500">
            Manage your event documentation workflows
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm active:scale-95"
        >
          <Plus size={20} />
          Create Event
        </button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border">
          <h2 className="text-xl font-bold mb-6">New Event</h2>

          <form onSubmit={handleCreate} className="space-y-5">
            <input
              name="event_name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Event name"
              className="w-full px-4 py-3 border rounded-lg"
              autoFocus
            />

            <textarea
              name='description of the event'
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="w-full px-4 py-3 border rounded-lg resize-none"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingKey === 'create'}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-70"
              >
                {savingKey === 'create' && (
                  <Loader2 className="animate-spin" size={16} />
                )}
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const isSavingThis = savingKey === event.id;

          return (
            <div
              key={event.id}
              className={`bg-white p-5 rounded-xl border transition group ${
                editingId === event.id
                  ? 'ring-4 ring-indigo-50 border-indigo-400'
                  : 'hover:border-blue-300 hover:shadow-md'
              }`}
            >
              {editingId === event.id ? (
                // EDIT MODE
                <div onClick={(e) => e.stopPropagation()} className="space-y-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md resize-none"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                    >
                      <X size={18} />
                    </button>

                    <button
                      onClick={() => handleUpdate(event.id, event.createdAt)}
                      disabled={isSavingThis}
                      className="p-1.5 bg-indigo-600 text-white rounded"
                    >
                      {isSavingThis ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Check size={18} />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // VIEW MODE
                <>
                  <div className="flex justify-between mb-3">
                    <Calendar className="text-blue-600" size={20} />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startEditing(e, event)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Edit event"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, event.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete event"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg mb-2">{event.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                    {event.description || 'No description'}
                  </p>

                  <div 
                    onClick={() => onSelectEvent(event)}
                    className="flex items-center text-sm text-slate-600 font-medium hover:text-blue-600 cursor-pointer transition-colors"
                  >
                    Manage Documents <ArrowRight size={16} className="ml-1" />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EventList;