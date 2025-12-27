import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Minus, X, Undo, Redo } from 'lucide-react';

const EditableTable = ({ tableData, onTableUpdate, viewMode = 'original', tableEdits = [] }) => {
  const [data, setData] = useState(tableData.preview || []);
  const [history, setHistory] = useState([tableData.preview || []]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Apply edits to original data when in edited view
  const displayData = useMemo(() => {
    if (viewMode === 'original') {
      return tableData.preview || [];
    }
    
    // Apply edits to create edited view
    const editedData = JSON.parse(JSON.stringify(tableData.preview || []));
    tableEdits.forEach(edit => {
      if (editedData[edit.row] && editedData[edit.row][edit.col] !== undefined) {
        editedData[edit.row][edit.col] = edit.new_value;
      }
    });
    return editedData;
  }, [tableData.preview, tableEdits, viewMode]);

  useEffect(() => {
    setData(displayData);
    setHistory([displayData]);
    setHistoryIndex(0);
  }, [displayData]);

  const saveToHistory = useCallback((newData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newData)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevData = history[newIndex];
      setData(prevData);
      setHistoryIndex(newIndex);
      onTableUpdate?.(tableData.index, prevData);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextData = history[newIndex];
      setData(nextData);
      setHistoryIndex(newIndex);
      onTableUpdate?.(tableData.index, nextData);
    }
  };

  const [cellEdits, setCellEdits] = useState(new Map());
  const [originalParagraphs, setOriginalParagraphs] = useState({});

  useEffect(() => {
    // Store original paragraphs for comparison
    if (tableData.paragraphs) {
      const paragraphsMap = {};
      tableData.paragraphs.forEach((row, rowIdx) => {
        row.forEach((cellParas, colIdx) => {
          paragraphsMap[`${rowIdx}-${colIdx}`] = cellParas;
        });
      });
      setOriginalParagraphs(paragraphsMap);
      console.log('Original paragraphs set:', paragraphsMap); // Debug
    }
  }, [tableData.paragraphs]);

  const updateCell = (rowIndex, colIndex, value) => {
    if (viewMode === 'original') return;
    
    const newData = [...data];
    newData[rowIndex] = [...newData[rowIndex]];
    newData[rowIndex][colIndex] = value;
    setData(newData);
    saveToHistory(newData);
    
    // Track individual cell edit with paragraph-aware old/new values
    const cellKey = `${rowIndex}-${colIndex}`;
    const originalParas = originalParagraphs[cellKey] || [];
    const originalValue = originalParas.length > 0 ? originalParas.join('\n') : (tableData.preview?.[rowIndex]?.[colIndex] || '');
    
    console.log(`Cell ${cellKey}: originalParas=`, originalParas, 'originalValue=', originalValue); // Debug
    
    setCellEdits(prev => {
      const newEdits = new Map(prev);
      if (value !== originalValue) {
        newEdits.set(cellKey, {
          table_index: tableData.index,
          row: rowIndex,
          col: colIndex,
          old_value: originalValue,
          new_value: value
        });
      } else {
        newEdits.delete(cellKey);
      }
      
      onTableUpdate?.(tableData.index, Array.from(newEdits.values()));
      return newEdits;
    });
  };

  const addRow = () => {
    if (viewMode === 'original') return;
    
    const newRow = new Array(data[0]?.length || 1).fill('');
    const newData = [...data, newRow];
    setData(newData);
    saveToHistory(newData);
    onTableUpdate?.(tableData.index, newData);
  };

  const removeRow = (rowIndex) => {
    if (viewMode === 'original' || data.length <= 1) return;
    
    const newData = data.filter((_, i) => i !== rowIndex);
    setData(newData);
    saveToHistory(newData);
    onTableUpdate?.(tableData.index, newData);
  };

  const addColumn = () => {
    if (viewMode === 'original') return;
    
    const newData = data.map(row => [...row, '']);
    setData(newData);
    saveToHistory(newData);
    onTableUpdate?.(tableData.index, newData);
  };

  const removeColumn = (colIndex) => {
    if (viewMode === 'original' || data[0]?.length <= 1) return;
    
    const newData = data.map(row => row.filter((_, i) => i !== colIndex));
    setData(newData);
    saveToHistory(newData);
    onTableUpdate?.(tableData.index, newData);
  };

  if (!data.length) return null;

  return (
    <div className="border border-red-500 rounded-lg p-3 bg-white">
      <div className="flex justify-between items-center mb-3">
        <h5 className="text-sm font-medium text-slate-700">
          Table #{tableData.index} ({data.length} × {data[0]?.length || 0})
        </h5>
        <div className="flex gap-4">
          <div className='flex gap-2'>
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1 text-slate-600 hover:bg-slate-50 hover:text-black rounded disabled:opacity-100 hover:cursor-pointer "
              title="Undo"
            >
              <Undo size={18} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1 text-slate-600 hover:bg-slate-50 rounded disabled:opacity-100 hover:cursor-pointer"
              title="Redo"
            >
              <Redo size={18} />
            </button>
          </div>

          <div className='flex gap-2'>
            <button
              onClick={addRow}
              className="p-1 text-green-600 hover:bg-green-50 rounded hover:cursor-pointer"
              title="Add row"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={addColumn}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded hover:cursor-pointer"
              title="Add column"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className="border border-slate-300 p-1 relative group">
                    <textarea
                      value={cell}
                      onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                      className={`w-full min-w-[100px] px-2 py-1 text-xs border-none outline-none resize-none ${
                        viewMode === 'original' 
                          ? 'bg-slate-50 cursor-not-allowed' 
                          : 'focus:bg-blue-50'
                      }`}
                      rows={Math.max(1, (cell.match(/\n/g) || []).length + 1)}
                      style={{ minHeight: '24px' }}
                      readOnly={viewMode === 'original'}
                    />
                    {/* Column controls */}
                    {rowIndex === 0 && (
                      <button
                        onClick={() => removeColumn(colIndex)}
                        className="absolute -top-2 -right-1 opacity-0 group-hover:opacity-100 p-0.5 bg-red-500 text-white rounded-full text-xs"
                        title="Remove column"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </td>
                ))}
                {/* Row controls */}
                <td className="p-1">
                  <button
                    onClick={() => removeRow(rowIndex)}
                    className="p-0.5 text-red-500 hover:bg-red-50 rounded"
                    title="Remove row"
                  >
                    <Minus size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EditableTable;