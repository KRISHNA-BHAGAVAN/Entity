import React from 'react';
import { AlertCircle, X } from 'lucide-react';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "danger" // 'danger', 'warning', 'info'
}) => {
    if (!isOpen) return null;

    const typeConfig = {
        danger: {
            icon: <AlertCircle className="text-red-500" size={24} />,
            btnClass: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
            accentClass: "bg-red-50"
        },
        warning: {
            icon: <AlertCircle className="text-amber-500" size={24} />,
            btnClass: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
            accentClass: "bg-amber-50"
        },
        info: {
            icon: <AlertCircle className="text-blue-500" size={24} />,
            btnClass: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
            accentClass: "bg-slate-50"
        }
    };

    const config = typeConfig[type] || typeConfig.danger;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.accentClass}`}>
                            {config.icon}
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-8">
                    <p className="text-slate-600 leading-relaxed text-center">
                        {message}
                    </p>
                </div>

                <div className="px-6 py-4 bg-slate-50 flex items-center justify-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all focus:ring-2 focus:ring-slate-100 outline-none"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all focus:ring-2 outline-none ${config.btnClass}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
