import { useState } from "react";
import { ChevronLeft, ChevronRight, Undo2, Redo2, X, Plus, Edit2, Check, Trash2 } from "lucide-react";

const FieldCard = ({
  fieldKey,
  field,
  refs,
  currentIndex,
  totalFields,
  onPrev,
  onNext,
  selectedFieldKeys,
  selectedReferences,
  fieldHistory,
  newRefInputs,
  editingRef,
  editRefValue,
  referenceReplacements,
  onFieldSelect,
  onReferenceSelect,
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
  onEditFieldName,
}) => {
  const [editingFieldName, setEditingFieldName] = useState(false);
  const [fieldNameValue, setFieldNameValue] = useState("");

  const label = field.label || fieldKey.replace(/_/g, " ");

  const getRowCount = (
    value = "",
    minRows = 1,
    maxRows = 10,
    charsPerLine = 96
  ) => {
    if (!value) return minRows;

    const explicitLines = value.split("\n");

    let rows = 0;
    for (const line of explicitLines) {
      rows += Math.max(1, Math.ceil(line.length / charsPerLine));
    }

    return Math.min(Math.max(rows, minRows), maxRows);
  };

  return (
    <div
      className={`group relative flex flex-col bg-white rounded-lg border transition-all duration-200 shadow-sm ${selectedFieldKeys.has(fieldKey)
          ? "border-blue-500 ring-1 ring-blue-500 shadow-blue-100/50 z-10"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        }`}
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-slate-100 gap-3">
        {/* Title area */}
        <div className="flex items-center gap-3 min-w-0">
          {editingFieldName ? (
            <input
              autoFocus
              value={fieldNameValue}
              onChange={(e) => setFieldNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onEditFieldName(fieldKey, fieldNameValue);
                  setEditingFieldName(false);
                } else if (e.key === "Escape") {
                  setEditingFieldName(false);
                }
              }}
              className="text-base font-semibold text-slate-900 bg-white border-b-2 border-blue-500 outline-none w-full max-w-[200px] transition-all"
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => onFieldSelect(fieldKey)}
                className={`text-base font-semibold truncate transition-colors cursor-pointer text-left ${selectedFieldKeys.has(fieldKey) ? "text-blue-700" : "text-slate-900 hover:text-blue-600"
                  }`}
              >
                {label}
              </button>
              <button
                onClick={() => {
                  setFieldNameValue(label);
                  setEditingFieldName(true);
                }}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-all rounded"
                title="Edit Field Name"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}

          {/* Badges */}
          <div className="flex shrink-0 gap-1.5">
            {field.location_count > 0 && (
              <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                {field.location_count} locs
              </span>
            )}
            {field.doc_frequency > 0 && (
              <span className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                {field.doc_frequency} docs
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 px-1 py-1 rounded-md border border-slate-200">
            <button onClick={onPrev} className="p-1 rounded hover:bg-white hover:text-slate-900 transition-colors cursor-pointer border border-transparent hover:border-slate-200 hover:shadow-sm">
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <span className="w-10 text-center select-none tabular-nums text-slate-700">
              {currentIndex + 1} / {totalFields}
            </span>
            <button onClick={onNext} className="p-1 rounded hover:bg-white hover:text-slate-900 transition-colors cursor-pointer border border-transparent hover:border-slate-200 hover:shadow-sm">
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onUndoField(fieldKey)}
              disabled={!fieldHistory[fieldKey]?.past.length}
              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
              title="Undo"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => onRedoField(fieldKey)}
              disabled={!fieldHistory[fieldKey]?.future.length}
              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
              title="Redo"
            >
              <Redo2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteField(fieldKey)}
              className="p-1.5 ml-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
              title="Delete Field"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 flex flex-col gap-4">
        {/* References Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              References ({refs.length})
            </span>
            {selectedReferences?.size > 0 && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold tracking-wide">
                {Array.from(selectedReferences).filter((ref) => ref.startsWith(`${fieldKey}:`)).length} Selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto relative">
            <input
              type="text"
              name="newref"
              value={newRefInputs[fieldKey] || ""}
              onChange={(e) => onNewRefInputChange(fieldKey, e.target.value)}
              placeholder="Add new reference..."
              className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-md pl-3 pr-10 py-1.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
              onKeyDown={(e) =>
                e.key === "Enter" &&
                onAddReference(fieldKey, newRefInputs[fieldKey] || "")
              }
            />
            <button
              type="button"
              onClick={() => onAddReference(fieldKey, newRefInputs[fieldKey] || "")}
              disabled={!(newRefInputs[fieldKey] || "").trim()}
              className="absolute right-1 top-1 bottom-1 p-1 bg-white text-blue-600 hover:bg-blue-50 border border-slate-200 rounded shrink-0 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* References List */}
        <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
          {refs.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded bg-slate-50/50">
              No references added yet.
            </div>
          ) : (
            refs.map((ref, idx) => {
              const refKey = `${fieldKey}:${ref}`;
              const isSelected = selectedReferences?.has(refKey);

              return (
                <div
                  key={idx}
                  className={`group/ref flex flex-col border rounded-md transition-all duration-200 ${isSelected
                      ? "bg-blue-50/30 border-blue-300 ring-1 ring-blue-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                >
                  {/* Ref Header */}
                  <div className={`flex items-center justify-between px-3 py-2 border-b transition-colors gap-3 ${isSelected ? 'border-blue-200/50' : 'border-slate-100'}`}>
                    {editingRef === `${fieldKey}:${idx}` ? (
                      <input
                        autoFocus
                        className="flex-1 bg-white border-b-2 border-blue-500 text-sm py-0.5 outline-none font-mono text-slate-900"
                        value={editRefValue}
                        onChange={(e) => onEditRefValueChange(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter"
                            ? onSaveEditedReference(fieldKey, idx)
                            : e.key === "Escape" && onCancelEdit()
                        }
                      />
                    ) : (
                      <button
                        onClick={() => onReferenceSelect?.(fieldKey, ref)}
                        className={`flex-1 text-left font-mono text-sm px-2 py-1 rounded truncate transition-colors cursor-pointer ${isSelected
                            ? "text-blue-800 bg-blue-100/50 hover:bg-blue-100"
                            : "text-slate-700 bg-slate-50 hover:bg-slate-100"
                          }`}
                        title={isSelected ? "Deselect reference" : "Select reference for highlighting"}
                      >
                        {ref}
                      </button>
                    )}

                    {/* Controls */}
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/ref:opacity-100 transition-opacity shrink-0">
                      {editingRef === `${fieldKey}:${idx}` ? (
                        <button
                          type="button"
                          onClick={() => onSaveEditedReference(fieldKey, idx)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        >
                          <Check size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditReference(fieldKey, idx, ref)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                            title="Edit Reference"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveReference(fieldKey, idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Remove Reference"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ref Body / Editor */}
                  <div className="bg-white rounded-b-md">
                    <textarea
                      value={referenceReplacements[`${fieldKey}:${ref}`] || ""}
                      onChange={(e) =>
                        onUpdateReferenceReplacement(fieldKey, ref, e.target.value)
                      }
                      rows={getRowCount(
                        referenceReplacements[`${fieldKey}:${ref}`],
                        1,
                        12,
                        96
                      )}
                      placeholder="Replacement text... (leave empty to keep original)"
                      className={`w-full bg-transparent border-0 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 resize-none overflow-hidden outline-none focus:ring-0 focus:bg-slate-50 transition-colors rounded-b-md`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default FieldCard;
