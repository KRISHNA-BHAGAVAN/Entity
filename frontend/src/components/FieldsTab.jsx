import { useState, useMemo } from 'react';
import { Plus, Undo2, Redo2 } from 'lucide-react';
import FieldCard from './FieldCard';

const FieldsTab = ({
  schemaData,
  fieldReferences,
  selectedFieldKeys,
  fieldHistory,
  fieldsHistory,
  newRefInputs,
  editingRef,
  editRefValue,
  referenceReplacements,
  newFieldName,
  highlightAll,
  onFieldSelect,
  onUndoField,
  onRedoField,
  onUndoFields,
  onRedoFields,
  onDeleteField,
  onAddReference,
  onRemoveReference,
  onEditReference,
  onSaveEditedReference,
  onCancelEdit,
  onUpdateReferenceReplacement,
  onNewRefInputChange,
  onEditRefValueChange,
  onNewFieldNameChange,
  onCreateNewField,
  onHighlightAllToggle,
}) => {

  const fieldEntries = useMemo(
    () => Object.entries(fieldReferences || {}),
    [fieldReferences]
  );

  const totalFields = fieldEntries.length;
  const [currentIndex, setCurrentIndex] = useState(0);

  const goPrev = () =>
    setCurrentIndex(i => i === 0 ? totalFields - 1 : i - 1);

  const goNext = () =>
    setCurrentIndex(i => i === totalFields - 1 ? 0 : i + 1);

  const currentEntry = fieldEntries[currentIndex] || [];

  // Reset currentIndex if it's out of bounds after deletion
  if (currentIndex >= totalFields && totalFields > 0) {
    setCurrentIndex(0);
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <input
            value={newFieldName}
            onChange={e => onNewFieldNameChange(e.target.value)}
            placeholder="Create new field…"
            className="px-2 py-1 border rounded-lg outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onCreateNewField();
              }
            }}
          />
          <button
            onClick={onCreateNewField}
            disabled={!newFieldName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={totalFields > 0 ? fieldEntries[currentIndex]?.[0] || '' : ''}
            onChange={e => {
              const selectedFieldKey = e.target.value;
              const newIndex = fieldEntries.findIndex(([key]) => key === selectedFieldKey);
              if (newIndex !== -1) {
                setCurrentIndex(newIndex);
              }
            }}
            className="
              max-w-[200px]
              pl-3 pr-10 py-2 
              rounded-md
              border border-slate-300 
              text-sm font-medium text-slate-700
              appearance-none
              bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]
              bg-size-[1.25rem]
              bg-position-[right_0.5rem_center]
              bg-no-repeat
              bg-white
              focus:ring-1 focus:ring-black
              outline-none 
              transition-all duration-150 ease-in-out
              shadow-sm
              hover:border-slate-400
              truncate
            "
            disabled={totalFields === 0}
          >
            {totalFields === 0 ? (
              <option value="">No fields available</option>
            ) : (
              fieldEntries.map(([fieldKey]) => {
                const field = schemaData?.schema?.document_fields?.fields?.[fieldKey] || {};
                const label = field.label || fieldKey.replace(/_/g, ' ');
                return (
                  <option key={fieldKey} value={fieldKey}>
                    {label}
                  </option>
                );
              })
            )}
          </select>

          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={onUndoFields}
              disabled={!fieldsHistory?.past.length}
              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:cursor-pointer rounded-md disabled:opacity-30"
              title="Undo all fields"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={onRedoFields}
              disabled={!fieldsHistory?.future.length}
              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:cursor-pointer rounded-md disabled:opacity-30"
              title="Redo all fields"
            >
              <Redo2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {schemaData && (
        <div className="space-y-4">
          {schemaData && totalFields > 0 && currentEntry.length === 2 && (() => {
          const [fieldKey, refs] = currentEntry;
          const field =
          schemaData?.schema?.document_fields?.fields?.[fieldKey] || {};
            return (
              <FieldCard
                key={fieldKey}
                fieldKey={fieldKey}
                field={field}
                refs={refs}
                currentIndex={currentIndex}
                totalFields={totalFields}
                onPrev={goPrev}
                onNext={goNext}
                selectedFieldKeys={selectedFieldKeys}
                fieldHistory={fieldHistory}
                newRefInputs={newRefInputs}
                editingRef={editingRef}
                editRefValue={editRefValue}
                referenceReplacements={referenceReplacements}
                onFieldSelect={onFieldSelect}
                onUndoField={onUndoField}
                onRedoField={onRedoField}
                onDeleteField={onDeleteField}
                onAddReference={onAddReference}
                onRemoveReference={onRemoveReference}
                onEditReference={onEditReference}
                onSaveEditedReference={onSaveEditedReference}
                onCancelEdit={onCancelEdit}
                onUpdateReferenceReplacement={onUpdateReferenceReplacement}
                onNewRefInputChange={onNewRefInputChange}
                onEditRefValueChange={onEditRefValueChange}
              />
              );
})()}
        </div>
      )}

      {!schemaData && (
        <div className="text-center text-slate-400 py-10">
          No schema discovered yet
        </div>
      )}
    </>
  );
};

export default FieldsTab;