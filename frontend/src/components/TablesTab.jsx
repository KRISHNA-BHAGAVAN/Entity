import { Table, Eye, EyeOff } from 'lucide-react';
import EditableTable from './EditableTable';

const TablesTab = ({ editableTables, tableEdits, onTableUpdate, onTableToggle, tableViewModes }) => {
  return (
    <div className="space-y-4">
      {editableTables.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Table size={32} className="mx-auto mb-2" />
          <p>No tables found in documents</p>
        </div>
      ) : (
        editableTables.map((table, index) => {
          const isOriginalView = tableViewModes[table.index] !== 'edited';
          const hasEdits = tableEdits.some(edit => edit.table_index === table.index);
          
          return (
            <div key={table.index} className="bg-white rounded-xl border p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-slate-500">
                  From: {table.filename}
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
              <EditableTable
                tableData={table}
                onTableUpdate={(tableIndex, newData) => onTableUpdate(table.index, newData)}
                viewMode={isOriginalView ? 'original' : 'edited'}
                tableEdits={tableEdits.filter(edit => edit.table_index === table.index)}
              />
            </div>
          );
        })
      )}
    </div>
  );
};

export default TablesTab;