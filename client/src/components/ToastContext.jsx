import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success', duration = 3000) => {
        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />;
            case 'error':
                return <AlertCircle size={18} className="text-red-500 flex-shrink-0" />;
            case 'warning':
                return <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />;
            case 'info':
            default:
                return <Info size={18} className="text-blue-500 flex-shrink-0" />;
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={clsx(
                            "flex items-start justify-between gap-3 px-4 py-3 bg-white border rounded-xl shadow-lg pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 animate-slide-in-right",
                            {
                                'border-emerald-100 bg-emerald-50/30': toast.type === 'success',
                                'border-red-100 bg-red-50/30': toast.type === 'error',
                                'border-amber-100 bg-amber-50/30': toast.type === 'warning',
                                'border-blue-100 bg-blue-50/30': toast.type === 'info',
                            }
                        )}
                        role="alert"
                    >
                        <div className="flex items-center gap-2.5">
                            {getIcon(toast.type)}
                            <span className="text-sm font-semibold text-slate-800">{toast.message}</span>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
