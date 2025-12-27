import { useState } from 'react';
import { Undo2, Redo2, X, Plus, Edit2, Check } from 'lucide-react';

const FieldCard = ({
  fieldKey,
  field,
  refs,
  selectedFieldKeys,
  fieldHistory,
  newRefInputs,
  editingRef,
  editRefValue,
  referenceReplacements,
  onFieldSelect,
  onUndoField,
  onRedoField,
  onDeleteField,
  onAddReference,
  onRemoveReference,
  onEditReference,
  onSaveEditedReference,
  onCancelEdit,
  onUpdateReferenceReplacement,
  onNewRefInputChange,
  onEditRefValueChange,
}) => {
  const label = field.label || fieldKey.replace(/_/g, ' ');

  return (
    <div
      className={`bg-white rounded-xl border p-4 transition-colors ${
        selectedFieldKeys.has(fieldKey)
          ? 'border-purple-300 bg-purple-50'
          : 'border-slate-200'
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex gap-3 items-center w-full">
          <button
            onClick={() => onFieldSelect(fieldKey)}
            className={`text-sm font-semibold transition-colors ${
              selectedFieldKeys.has(fieldKey)
                ? 'text-purple-700'
                : 'text-slate-800 hover:text-purple-600'
            }`}
          >
            {label}{' '}
            {selectedFieldKeys.has(fieldKey) && '(highlighting)'}
          </button>
          {field.location_count > 0 && (
            <div className="text-xs text-slate-500">
              ({field.location_count} locations found)
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onUndoField(fieldKey)}
            disabled={!fieldHistory[fieldKey]?.past.length}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-100 hover:cursor-pointer"
            title="Undo"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={() => onRedoField(fieldKey)}
            disabled={!fieldHistory[fieldKey]?.future.length}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-100 hover:cursor-pointer"
            title="Redo"
          >
            <Redo2 size={15} />
          </button>
          <button
            onClick={() => onDeleteField(fieldKey)}
            className="p-1 text-red-500 hover:text-red-700"
            title="Delete field"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {refs.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-1 py-1 border-amber-600">
            <div className="text-xs text-slate-500 mb-2 translate-y-2">
              References and Replacements ({refs.length}):
            </div>
            <div className="flex gap-2 justify-end">
              <input
                type="text"
                value={newRefInputs[fieldKey] || ''}
                onChange={e => onNewRefInputChange(fieldKey, e.target.value)}
                placeholder="Add new reference..."
                className="border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onAddReference(fieldKey, newRefInputs[fieldKey] || '');
                  }
                }}
              />
              <button
                onClick={() => onAddReference(fieldKey, newRefInputs[fieldKey] || '')}
                disabled={!(newRefInputs[fieldKey] || '').trim()}
                className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 hover:cursor-pointer disabled:opacity-80"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto">
            {refs.map((ref, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-red-500 rounded p-2"
              >
                <div className="flex items-start justify-between mb-2">
                  {editingRef === `${fieldKey}:${idx}` ? (
                    <div className="flex-1 mr-2">
                      <input
                        value={editRefValue}
                        onChange={e => onEditRefValueChange(e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            onSaveEditedReference(fieldKey, idx);
                          } else if (e.key === 'Escape') {
                            onCancelEdit();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 flex-1 mr-2 whitespace-pre-wrap">
                      {ref}
                    </div>
                  )}
                  <div className="flex gap-1 shrink-0">
                    {editingRef === `${fieldKey}:${idx}` ? (
                      <>
                        <button
                          onClick={() => onSaveEditedReference(fieldKey, idx)}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Save edit"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="text-slate-500 hover:text-slate-700 p-1"
                          title="Cancel edit"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onEditReference(fieldKey, idx, ref)}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="Edit reference"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => onRemoveReference(fieldKey, idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove reference"
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  value={referenceReplacements[`${fieldKey}:${ref}`] || ''}
                  onChange={e => onUpdateReferenceReplacement(fieldKey, ref, e.target.value)}
                  placeholder={`Replacement for "${ref}"`}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={Math.max(1, Math.ceil((referenceReplacements[`${fieldKey}:${ref}`] || '').length / 50))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldCard;