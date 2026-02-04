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
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from './ConfirmModal';


const EventList = ({ events, isLoading, onSelectEvent, onRefresh }) => {
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState(''); // YYYY-MM-DD

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');

  /**
   * savingKey can be:
   * - 'create'
   * - event.id
   * - null
   */
  const [savingKey, setSavingKey] = useState(null);

  // Deletion State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);


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
        eventDate: newDate || null,
      };

      await saveEvent(newEvent);

      setNewName('');
      setNewDesc('');
      setNewDate('');
      setIsCreating(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create event:', err);
      toast.error('Failed to create event. Please try again.');
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
        eventDate: editDate || null,
      };

      await saveEvent(updatedEvent);

      setEditingId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to update event:', err);
      toast.error('Failed to update event.');
    } finally {
      setSavingKey(null);
    }
  };

  const startEditing = (e, event) => {
    e.stopPropagation();
    setEditingId(event.id);
    setEditName(event.name);
    setEditDesc(event.description);

    // Ensure the date is in YYYY-MM-DD format for the input[type="date"]
    let formattedDate = '';
    if (event.eventDate) {
      formattedDate = event.eventDate.split('T')[0];
    } else if (event.createdAt) {
      // Fallback to creation date if eventDate is not set
      formattedDate = new Date(event.createdAt).toISOString().split('T')[0];
    }

    setEditDate(formattedDate);
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  /* ---------------- DELETE ---------------- */
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
      toast.success('Event deleted successfully.');
    } catch (err) {
      console.error('Failed to delete event:', err);
      toast.error('Failed to delete event.');
    } finally {
      setEventToDelete(null);
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl shadow-lg mb-8 border w-fit">
          <h2 className="text-xl font-bold mb-6">New Event</h2>

          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                name="event_name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Event name"
                className="w-full px-4 py-3 border rounded-lg outline-none"
                autoFocus
              />
              <input
                type="date"
                name="event_date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg text-slate-600 outline-none"
              />
            </div>

            <textarea
              name='description of the event'
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="w-full px-4 py-3 border rounded-lg resize-none outline-none"
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
              className={`bg-white p-5 rounded-xl border transition group ${editingId === event.id
                ? 'ring-4 ring-indigo-50 border-indigo-400'
                : 'hover:border-blue-300 hover:shadow-md'
                }`}
            >
              {editingId === event.id ? (
                // EDIT MODE
                <div onClick={(e) => e.stopPropagation()} className="space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Event Name"
                    />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md resize-none"
                    placeholder="Description"
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
                    <div className="flex gap-2 items-center">
                      <Calendar className="text-blue-600" size={20} />
                      <span className="text-md font-semibold text-slate-500">
                        {event.eventDate ? (
                          new Date(event.eventDate).toLocaleDateString('en-GB')
                        ) : (
                          event.createdAt && new Date(event.createdAt).toLocaleDateString('en-GB')
                        )}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startEditing(e, event)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors hover:cursor-pointer"
                        title="Edit event"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, event.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors hover:cursor-pointer"
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

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action will permanently remove all associated documents and data."
        confirmText="Delete Event"
        type="danger"
      />
    </div>
  );
};


export default EventList;