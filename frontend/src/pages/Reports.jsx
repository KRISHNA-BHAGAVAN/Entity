import React from 'react';
import { FileDown } from 'lucide-react';
import ColumnConfig from '../components/Report/ColumnConfig';

const Reports = () => {
    return (
        <div className="h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <header className="mb-8">
                        <h1 className="text-2xl font-bold text-slate-800 font-mono flex items-center gap-2">
                            <FileDown className="text-indigo-600" />
                            Consolidated Reports
                        </h1>
                        <p className="text-slate-500 mt-2 text-sm">
                            Generate Excel reports using AI-powered data extraction. Configure your columns and filters below.
                        </p>
                    </header>

                    <div className="w-full">
                        <ColumnConfig />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Reports;
