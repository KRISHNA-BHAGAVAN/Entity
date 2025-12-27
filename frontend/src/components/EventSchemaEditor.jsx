import { useState, useMemo } from "react";

/**
 * Generic input for a single field coming from schema.document_fields.fields[fieldKey]
 */
function FieldInput({ fieldKey, field, value, onChange }) {
  const label = field.label || fieldKey.replace(/_/g, " ");
  const type = field.type || "string";

  let inputType = "text";
  if (type === "date") inputType = "date";
  if (type === "email") inputType = "email";
  if (type === "phone") inputType = "tel";
  // date_range, string, address → keep as text input for now

  const placeholder =
    field.references && field.references.length > 0
      ? field.references[0]
      : "";

  const frequency = field.frequency;
  const confidence = field.confidence;

  return (
    <div className="mb-4 border border-slate-200 rounded-lg bg-white p-3">
      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <label className="text-sm font-semibold text-slate-800">
            {label}
          </label>
          <div className="text-[11px] text-slate-400 break-all">
            <code>{fieldKey}</code>
          </div>
        </div>
        <div className="text-[11px] text-right text-slate-400 space-y-0.5">
          {typeof frequency === "number" && (
            <div>freq: {frequency}</div>
          )}
          {typeof confidence === "number" && (
            <div>conf: {(confidence * 100).toFixed(0)}%</div>
          )}
        </div>
      </div>

      {/* Input */}
      <input
        type={inputType}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />

      {/* References */}
      {field.references && field.references.length > 0 && (
        <div className="mt-2 text-[11px] text-slate-500">
          <div className="font-semibold mb-1">
            Detected references ({field.references.length}):
          </div>
          <div className="flex flex-wrap gap-1">
            {field.references.map((ref, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(ref)}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-[11px] border border-slate-200 max-w-full truncate"
                title={ref}
              >
                {ref}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source files */}
      {field.source_files && field.source_files.length > 0 && (
        <div className="mt-2 text-[11px] text-slate-400">
          <span className="font-semibold">Source files: </span>
          {field.source_files.join(", ")}
        </div>
      )}
    </div>
  );
}

/**
 * Generic tables view. Renders any tables array from the API.
 */
function TablesView({ tables }) {
  if (!tables || !tables.length) return null;

  return (
    <div className="space-y-4">
      {tables.map((fileEntry, idx) => (
        <div
          key={idx}
          className="border border-slate-200 rounded-lg bg-white p-3"
        >
          <div className="text-xs font-semibold text-slate-600 mb-2 break-all">
            {fileEntry.filename}
          </div>
          {fileEntry.tables && fileEntry.tables.length ? (
            fileEntry.tables.map((tbl) => (
              <div key={tbl.index} className="mb-3">
                <div className="text-xs text-slate-500 mb-1">
                  Table #{tbl.index} · {tbl.rows} rows × {tbl.columns} cols
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="min-w-full text-xs">
                    <tbody>
                      {tbl.preview.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={
                            rIdx === 0 ? "bg-slate-50 font-semibold" : ""
                          }
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="border border-slate-200 px-2 py-1 align-top whitespace-pre-wrap"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400">
              No tables found in this document.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Fully dynamic editor; no hard-coded field names.
 * Expects the full API response as `schemaData`.
 */
export default function EventSchemaEditor({ schemaData, onChange }) {
  const [activeTab, setActiveTab] = useState("fields");

  // Find first "section" under schema; typically "document_fields",
  // but we don't hard-code it: just pick first key.
  const sections = schemaData?.schema || {};
  const sectionEntries = Object.entries(sections);
  const firstSection = sectionEntries.length ? sectionEntries[0][1] : null;
  const fieldsObj = firstSection?.fields || {};

  const tables = schemaData?.tables || [];

  const initialValues = useMemo(() => {
    const result = {};
    Object.entries(fieldsObj).forEach(([key, field]) => {
      const refs = field.references || [];
      result[key] = refs.length ? refs[0] : "";
    });
    return result;
  }, [fieldsObj]);

  const [values, setValues] = useState(initialValues);

  const updateField = (key, newValue) => {
    const next = { ...values, [key]: newValue };
    setValues(next);
    if (onChange) onChange(next);
  };

  // Sort fields by frequency desc, then confidence desc, then name
  const sortedFieldEntries = useMemo(() => {
    const entries = Object.entries(fieldsObj);
    entries.sort((a, b) => {
      const fa = a[1].frequency || 0;
      const fb = b[1].frequency || 0;
      if (fb !== fa) return fb - fa;
      const ca = a[1].confidence || 0;
      const cb = b[1].confidence || 0;
      if (cb !== ca) return cb - ca;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [fieldsObj]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Schema Editor
          </h1>
          <p className="text-xs text-slate-500">
            Dynamically rendered from the schema API response.
          </p>
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          <div>
            fields: {Object.keys(fieldsObj || {}).length}
          </div>
          <div>tables: {tables.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2 flex gap-2 border-b border-slate-200 bg-slate-50">
        <button
          className={
            activeTab === "fields"
              ? "px-3 py-2 text-xs font-semibold rounded-t-md bg-white border border-b-0 border-slate-200 text-blue-600"
              : "px-3 py-2 text-xs font-semibold rounded-t-md text-slate-500 hover:text-slate-700"
          }
          onClick={() => setActiveTab("fields")}
        >
          Fields
        </button>
        <button
          className={
            activeTab === "tables"
              ? "px-3 py-2 text-xs font-semibold rounded-t-md bg-white border border-b-0 border-slate-200 text-blue-600"
              : "px-3 py-2 text-xs font-semibold rounded-t-md text-slate-500 hover:text-slate-700"
          }
          onClick={() => setActiveTab("tables")}
        >
          Tables
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {activeTab === "fields" && (
          <div className="max-w-3xl mx-auto">
            {sortedFieldEntries.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-8">
                No fields found in schema.
              </div>
            )}
            {sortedFieldEntries.map(([key, field]) => (
              <FieldInput
                key={key}
                fieldKey={key}
                field={field}
                value={values[key] || ""}
                onChange={(val) => updateField(key, val)}
              />
            ))}
          </div>
        )}

        {activeTab === "tables" && (
          <div className="max-w-4xl mx-auto">
            <TablesView tables={tables} />
          </div>
        )}
      </div>
    </div>
  );
}
