import { useState } from 'react';
import { Table, Eye, EyeOff, ChevronLeft, ChevronRight, Undo2, Redo2 } from 'lucide-react';
import EditableTable from './EditableTable';

const TablesTab = ({ 
  editableTables, 
  tableEdits, 
  onTableUpdate, 
  onTableToggle, 
  tableViewModes,
  tableHistory,
  onUndoTable,
  onRedoTable
}) => {
  const [currentTableIndex, setCurrentTableIndex] = useState(0);

  const handlePrev = () => {
    setCurrentTableIndex(prev => prev > 0 ? prev - 1 : editableTables.length - 1);
  };

  const handleNext = () => {
    setCurrentTableIndex(prev => prev < editableTables.length - 1 ? prev + 1 : 0);
  };

  if (editableTables.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Table size={32} className="mx-auto mb-2" />
        <p>No tables found in documents</p>
      </div>
    );
  }

  const table = editableTables[currentTableIndex];
  const isOriginalView = tableViewModes[table.index] !== 'edited';
  const hasEdits = tableEdits.some(edit => edit.table_index === table.index);
  
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">
              From: {table.filename}
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <button
                onClick={handlePrev}
                className="p-1 rounded hover:bg-slate-200 hover:cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="tabular-nums">
                {currentTableIndex + 1} / {editableTables.length}
              </span>
              <button
                onClick={handleNext}
                className="p-1 rounded hover:bg-slate-200 hover:cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
              <button
                onClick={onUndoTable}
                disabled={!tableHistory?.past.length}
                className="p-1.5 text-slate-500 hover:bg-slate-100 hover:cursor-pointer rounded-md disabled:opacity-30"
                title="Undo table changes"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={onRedoTable}
                disabled={!tableHistory?.future.length}
                className="p-1.5 text-slate-500 hover:bg-slate-100 hover:cursor-pointer rounded-md disabled:opacity-30"
                title="Redo table changes"
              >
                <Redo2 size={14} />
              </button>
            </div>
            <button
              onClick={() => onTableToggle(table.index)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                isOriginalView
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
              title={isOriginalView ? 'Switch to edited view' : 'Switch to original view'}
            >
              {isOriginalView ? <Eye size={12} /> : <EyeOff size={12} />}
              {isOriginalView ? 'Original' : 'Edited'}
              {hasEdits && <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full"></span>}
            </button>
          </div>
        </div>
        <EditableTable
          tableData={table}
          onTableUpdate={(tableIndex, newData) => onTableUpdate(table.index, newData)}
          viewMode={isOriginalView ? 'original' : 'edited'}
          tableEdits={tableEdits.filter(edit => edit.table_index === table.index)}
        />
      </div>
    </div>
  );
};

export default TablesTab;