import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Undo2, Redo2, Table as TableIcon, Copy, Image } from "lucide-react";
import html2canvas from "html2canvas";

/* Tooltip */
const CellTooltip = ({ children, content }) => (
  <div className="relative group">
    {children}
    {content && (
      <div className="absolute bottom-full mb-2 hidden group-hover:block px-3 py-1 text-xs text-white bg-gray-800 rounded z-50 max-w-xs break-words">
        {content}
      </div>
    )}
  </div>
);

const EditableTable = ({
  tableData,
  onTableUpdate,
  viewMode = "original",
  tableEdits = [],
}) => {
  const [data, setData] = useState(tableData.preview || []);
  const [history, setHistory] = useState([tableData.preview || []]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [copyMessage, setCopyMessage] = useState(null);
  const [originalData] = useState(tableData.preview || []);

  const tableRef = useRef(null);
  const wrapperRef = useRef(null);

  /* -------- Display Data -------- */
  const displayData = useMemo(() => {
    if (viewMode === "original") return tableData.preview || [];
    const cloned = JSON.parse(JSON.stringify(tableData.preview || []));
    tableEdits.forEach(({ row, col, new_value }) => {
      if (cloned[row]?.[col] !== undefined) cloned[row][col] = new_value;
    });
    return cloned;
  }, [tableData.preview, tableEdits, viewMode]);

  useEffect(() => {
    setData(displayData);
    setHistory([displayData]);
    setHistoryIndex(0);
  }, [displayData]);

  /* -------- History -------- */
  const saveHistory = useCallback(
    (newData) => {
      const h = history.slice(0, historyIndex + 1);
      h.push(JSON.parse(JSON.stringify(newData)));
      setHistory(h);
      setHistoryIndex(h.length - 1);
    },
    [history, historyIndex]
  );

  const undo = () => {
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    setData(history[idx]);
    setHistoryIndex(idx);
    onTableUpdate?.(tableData.index, history[idx]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setData(history[idx]);
    setHistoryIndex(idx);
    onTableUpdate?.(tableData.index, history[idx]);
  };

  /* -------- Cell Copy -------- */
  const copyCellContent = (content) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        toast("Cell copied");
      })
      .catch(() => {
        toast("Copy failed");
      });
  };

  /* -------- Toast -------- */
  const toast = (msg) => {
    setCopyMessage(msg);
    setTimeout(() => setCopyMessage(null), 2500);
  };

  /* =========================================================
     COPY AS EDITABLE TABLE — FIXED FOR \n NEWLINES
  ========================================================= */
  const copyTableAsHtml = () => {
    if (!tableRef.current || !data.length) return;

    try {
      const headers = data[0];
      const rows = data.slice(1);

      let html = `
        <table style="border-collapse:collapse;border:1px solid #ccc;font-family:Calibri,Arial,sans-serif;font-size:11pt;width:100%;table-layout:auto;">
          <thead>
            <tr style="background:#f2f2f2;">
      `;

      // Headers
      headers.forEach((header) => {
        const safeHeader = String(header)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        html += `<th style="border:1px solid #ccc;padding:8px 12px;font-weight:bold;text-align:left;">${safeHeader}</th>`;
      });
      html += `</tr></thead><tbody>`;

      // Data rows
      rows.forEach((row) => {
        html += "<tr>";
        row.forEach((cell) => {
          const cellContent = String(cell || "");
          const safeContent = cellContent
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
          html += `<td style="border:1px solid #ccc;padding:8px 12px;vertical-align:top;">${safeContent}</td>`;
        });
        html += "</tr>";
      });

      html += "</tbody></table>";

      if (navigator.clipboard && navigator.clipboard.write) {
        const blobHtml = new Blob([html], { type: "text/html" });
        const blobText = new Blob([buildPlainTextTable()], {
          type: "text/plain",
        });

        navigator.clipboard
          .write([
            new ClipboardItem({
              "text/html": blobHtml,
              "text/plain": blobText,
            }),
          ])
          .then(() => {
            toast("Table copied ✅ (newlines preserved)");
          })
          .catch(() => {
            copyHtmlFallback(html);
          });
        return;
      }

      copyHtmlFallback(html);
    } catch (err) {
      console.error(err);
      toast("Copy failed");
    }
  };

  // Plain text version (tab-separated with \n preserved)
  const buildPlainTextTable = () => {
    const headers = data[0];
    const rows = data.slice(1);

    let text = headers.join("\t") + "\n";
    rows.forEach((row) => {
      text +=
        row
          .map((cell) => String(cell || "").replace(/\n/g, "\\n"))
          .join("\t") + "\n";
    });
    return text;
  };

  // Fallback for older browsers
  const copyHtmlFallback = (html) => {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.position = "fixed";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    navigator.clipboard.writeText();

    selection.removeAllRanges();
    document.body.removeChild(container);
    toast("Table copied ✅ (newlines preserved)");
  };

  /* =========================================================
     COPY AS IMAGE — BULLETPROOF VERSION (CLEAN DOM)
  ========================================================= */
  const copyTableAsImage = async () => {
    if (!data.length) return;

    try {
      toast("Generating clean image...");

      const cleanTable = document.createElement("table");
      cleanTable.style.borderCollapse = "collapse";
      cleanTable.style.border = "1px solid #ddd";
      cleanTable.style.fontFamily = "Arial, sans-serif";
      cleanTable.style.fontSize = "12px";
      cleanTable.style.width = "100%";
      cleanTable.style.maxWidth = "1200px";
      cleanTable.style.backgroundColor = "#ffffff";
      cleanTable.style.tableLayout = "auto";

      // Headers
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headerRow.style.backgroundColor = "#f8f9fa";
      data[0].forEach((header) => {
        const th = document.createElement("th");
        th.textContent = String(header);
        th.style.border = "1px solid #ddd";
        th.style.padding = "10px 12px";
        th.style.fontWeight = "bold";
        th.style.textAlign = "left";
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      cleanTable.appendChild(thead);

      // Data rows
      const tbody = document.createElement("tbody");
      data.slice(1).forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((cell) => {
          const td = document.createElement("td");
          td.innerHTML = String(cell || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
          td.style.border = "1px solid #ddd";
          td.style.padding = "8px 12px";
          td.style.verticalAlign = "top";
          td.style.maxWidth = "300px";
          td.style.wordWrap = "break-word";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      cleanTable.appendChild(tbody);

      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.background = "#ffffff";
      container.style.padding = "20px";
      container.appendChild(cleanTable);
      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: false,
        logging: false,
        width: cleanTable.scrollWidth,
        height: cleanTable.scrollHeight,
      });

      document.body.removeChild(container);

      if (navigator.clipboard?.write && ClipboardItem) {
        try {
          const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png", 1.0)
          );
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          toast("🖼️ Perfect image copied!");
          return;
        } catch (e) {
          console.warn("Clipboard failed:", e);
        }
      }

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `table-${tableData.index}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast("🖼️ Image downloaded (perfect quality)");
      });
    } catch (err) {
      console.error(err);
      toast("❌ Fallback download");
      const csvContent = data.map((row) => row.join("\t")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `table-${tableData.index}.csv`;
      a.click();
    }
  };

  if (!data.length) return null;
  const headers = data[0];
  const rows = data.slice(1);

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b bg-slate-50 flex justify-between">
        <div className="flex items-center gap-2">
          <TableIcon size={18} className="text-indigo-600" />
          <div>
            <div className="text-sm font-semibold">Table #{tableData.index}</div>
            <div className="text-xs text-slate-500">
              {rows.length} × {headers.length}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={historyIndex === 0}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={copyTableAsHtml}
            className="p-2 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 rounded"
            title="Copy as editable table (Word/PPT)"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={copyTableAsImage}
            className="p-2 text-slate-500 hover:bg-blue-100 hover:text-blue-600 rounded"
            title="Copy as PNG image"
          >
            <Image size={16} />
          </button>
        </div>
      </div>

      {copyMessage && (
        <div className="px-4 py-1 text-xs bg-emerald-50 text-emerald-700">
          {copyMessage}
        </div>
      )}

      {/* Table */}
      <div ref={wrapperRef} className="overflow-auto max-h-[600px]">
        <table
          ref={tableRef}
          className="w-full border-collapse table-fixed"
          
        >
          <colgroup>
            {headers.map((_, i) => (
              <col key={i} className="w-auto" />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="border px-3 py-2 bg-slate-100 text-xs uppercase font-medium text-slate-700"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="
                      border
                      px-3
                      py-2
                      text-sm
                      align-top
                      overflow-hidden
                    "
                  >
                    {viewMode === "original" ? (
                      <CellTooltip content={cell}>
                        <div
                          className="truncate whitespace-pre-wrap cursor-pointer hover:bg-slate-50 p-1 rounded"
                          onDoubleClick={() => copyCellContent(cell)}
                          title="Double-click to copy cell"
                        >
                          {cell}
                        </div>
                      </CellTooltip>
                    ) : (
                      <textarea
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }
                        }}
                        value={cell}
                        onChange={(e) => {
                          const oldValue = data[r + 1][c];
                          const newValue = e.target.value;
                          const newData = [...data];
                          newData[r + 1][c] = newValue;

                          console.log("🔍 CELL EDIT DEBUG:", {
                            tableIndex: tableData.index,
                            row: r + 1,
                            col: c,
                            old_value: oldValue,
                            new_value: newValue,
                            original_value: originalData[r + 1]?.[c],
                          });

                          setData(newData);
                          saveHistory(newData);

                          if (oldValue !== newValue) {
                            onTableUpdate?.(tableData.index, {
                              row: r + 1,
                              col: c,
                              old_value: originalData[r + 1]?.[c] || oldValue,
                              new_value: newValue,
                            });
                          }
                        }}
                        className="
                          w-full
                          resize-none
                          overflow-hidden
                          bg-transparent
                          border-none
                          outline-none
                          p-1
                          text-sm
                          whitespace-pre-wrap
                          wrap-break-word
                          leading-relaxed
                          focus:ring-2 focus:ring-blue-500
                          rounded
                        "
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EditableTable;
