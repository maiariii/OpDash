import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, itemName, isDeleting, waitDuration = 0 }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (isOpen && waitDuration > 0) {
            setTimeLeft(waitDuration);
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        } else {
            setTimeLeft(0);
        }
    }, [isOpen, waitDuration]);

    if (!isOpen) return null;

    const isButtonDisabled = isDeleting || timeLeft > 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <AlertTriangle size={24} />
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                        {title || 'Confirm Deletion'}
                    </h3>

                    <p className="text-slate-500 text-sm mb-4">
                        {message || `Are you sure you want to delete this ${itemName || 'item'}? This action cannot be undone.`}
                    </p>

                    {itemName && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6">
                            <span className="font-mono text-xs font-semibold text-slate-700 break-all">
                                {itemName}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm shadow-red-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            disabled={isButtonDisabled}
                        >
                            {isDeleting ? 'Deleting...' : (timeLeft > 0 ? `Wait ${timeLeft}s` : 'Delete')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
