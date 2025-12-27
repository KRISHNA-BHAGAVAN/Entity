import { Plus } from 'lucide-react';
import FieldCard from './FieldCard';

const FieldsTab = ({
  schemaData,
  fieldReferences,
  selectedFieldKeys,
  fieldHistory,
  newRefInputs,
  editingRef,
  editRefValue,
  referenceReplacements,
  newFieldName,
  highlightAll,
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
  onNewFieldNameChange,
  onCreateNewField,
  onHighlightAllToggle,
}) => {
  return (
    <>
      <div className="flex justify-between">
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

        <button
          onClick={onHighlightAllToggle}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            highlightAll
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
              : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
          }`}
        >
          {highlightAll ? 'Hide All' : 'Highlight All'}
        </button>
      </div>

      {schemaData && (
        <div className="space-y-4">
          {Object.entries(fieldReferences).map(([fieldKey, refs]) => {
            const field = schemaData?.schema?.document_fields?.fields?.[fieldKey] || {};
            
            return (
              <FieldCard
                key={fieldKey}
                fieldKey={fieldKey}
                field={field}
                refs={refs}
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
          })}
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