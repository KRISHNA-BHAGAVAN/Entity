import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Undo2, Redo2, X, Plus, Edit2, Check, Trash2 } from "lucide-react";

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
      className={`group rounded-xl border transition-all duration-300 animate-fadeIn shadow-sm ${
        selectedFieldKeys.has(fieldKey)
          ? "border-purple-500 bg-purple-50/30 ring-1 ring-purple-500"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {/* Header Section */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex justify-between">
          <div className="flex items-center gap-2 min-w-0">
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
                className="text-md font-bold bg-white border-b border-purple-400 py-0.5 outline-none min-w-0 flex-1"
              />
            ) : (
              <>
                <button
                  onClick={() => onFieldSelect(fieldKey)}
                  className={`text-md font-bold truncate transition-colors ${
                    selectedFieldKeys.has(fieldKey)
                      ? "text-purple-700"
                      : "text-slate-700 hover:text-purple-600"
                  }`}
                >
                  {label}
                </button>
                <button
                  onClick={() => {
                    setFieldNameValue(label);
                    setEditingFieldName(true);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-500 hover:cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 size={12} />
                </button>
              </>
            )}
            <div className="flex items-center gap-1">
              {field.location_count > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                  {field.location_count} locs
                </span>
              )}
              {field.doc_frequency > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                  {field.doc_frequency} docs
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <button
              onClick={onPrev}
              className="p-1 rounded hover:bg-slate-200 hover:cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="tabular-nums">
              {currentIndex + 1} / {totalFields}
            </span>

            <button
              onClick={onNext}
              className="p-1 rounded hover:bg-slate-200 hover:cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between sm:justify-end gap-1 border-t sm:border-t-0 pt-2 sm:pt-0">
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => onUndoField(fieldKey)}
              disabled={!fieldHistory[fieldKey]?.past.length}
              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:cursor-pointer rounded-md disabled:opacity-30"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => onRedoField(fieldKey)}
              disabled={!fieldHistory[fieldKey]?.future.length}
              className="p-1.5 text-slate-500 hover:bg-slate-100 hover:cursor-pointer rounded-md disabled:opacity-30"
            >
              <Redo2 size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onDeleteField(fieldKey)}
            className="p-2 md:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-3 gap-2 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            References ({refs.length})
            {selectedReferences?.size > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-medium">
                {
                  Array.from(selectedReferences).filter((ref) =>
                    ref.startsWith(`${fieldKey}:`)
                  ).length
                }{" "}
                selected
              </span>
            )}
          </span>
          <div className="flex gap-2 sm:min-w-[300px]">
            <input
              type="text"
              name="newref"
              value={newRefInputs[fieldKey] || ""}
              onChange={(e) => onNewRefInputChange(fieldKey, e.target.value)}
              placeholder="New ref..."
              className="flex-1 bg-slate-50 border-slate-200 rounded-lg px-2 py-1 text-md focus:bg-white focus:ring-1 focus:ring-black outline-none transition-all"
              onKeyDown={(e) =>
                e.key === "Enter" &&
                onAddReference(fieldKey, newRefInputs[fieldKey] || "")
              }
            />
            <button
              type="button"
              onClick={() =>
                onAddReference(fieldKey, newRefInputs[fieldKey] || "")
              }
              disabled={!(newRefInputs[fieldKey] || "").trim()}
              className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:grayscale"
            >
              <Plus className="min-w-5 min-h-5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-[530px] overflow-y-auto">
          {refs.map((ref, idx) => {
            const refKey = `${fieldKey}:${ref}`;
            const isSelected = selectedReferences?.has(refKey);
            return (
              <div
                key={idx}
                className={`group/item relative border rounded-lg p-2 transition-colors ${
                  isSelected
                    ? "bg-yellow-50 border-yellow-300 ring-1 ring-yellow-400"
                    : "bg-white border-slate-200 hover:border-purple-200"
                }`}
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  {editingRef === `${fieldKey}:${idx}` ? (
                    <input
                      autoFocus
                      className="flex-1 bg-white border-b border-purple-400 text-md py-0.5 outline-none"
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
                      onClick={() => {
                        console.log("Reference clicked:", fieldKey, ref);
                        onReferenceSelect?.(fieldKey, ref);
                      }}
                      className={`flex-1 text-left font-mono text-md px-1.5 py-0.5 rounded truncate transition-colors cursor-pointer ${
                        isSelected
                          ? "text-yellow-800 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300"
                          : "text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200"
                      }`}
                      title={`Click to ${
                        isSelected ? "deselect" : "select"
                      } for highlighting (${ref})`}
                    >
                      {ref}
                    </button>
                  )}

                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover/item:opacity-100 transition-opacity">
                    {editingRef === `${fieldKey}:${idx}` ? (
                      <button
                        type="button"
                        onClick={() => onSaveEditedReference(fieldKey, idx)}
                        className="p-1 text-green-600"
                      >
                        <Check size={12} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditReference(fieldKey, idx, ref)}
                          className="p-1 text-slate-400 hover:text-blue-500 hover:cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveReference(fieldKey, idx)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <textarea
  value={referenceReplacements[`${fieldKey}:${ref}`] || ""}
  onChange={(e) =>
    onUpdateReferenceReplacement(fieldKey, ref, e.target.value)
  }
  rows={getRowCount(
    referenceReplacements[`${fieldKey}:${ref}`],
    1,
    12
  )}
  placeholder="Type replacement..."
  className="w-full bg-slate-50 border-none rounded-md px-2 py-1.5 text-md
             text-slate-700 placeholder:text-slate-400 focus:ring-1
             focus:ring-purple-200 resize-none overflow-hidden"
/>



              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FieldCard;
