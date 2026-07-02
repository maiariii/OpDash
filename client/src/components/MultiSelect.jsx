
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

const MultiSelect = ({ label, options, selected, onChange, placeholder = "Select...", className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleOption = (optionValue) => {
        let newSelected;
        if (selected.includes(optionValue)) {
            newSelected = selected.filter(v => v !== optionValue);
        } else {
            newSelected = [...selected, optionValue];
        }
        onChange(newSelected);
    };

    const handleSelectAll = () => {
        if (selected.length === options.length) {
            onChange([]); // Deselect all
        } else {
            onChange(options.map(o => o.value)); // Select all
        }
    };

    const getDisplayValue = () => {
        if (selected.length === 0) return "All (Default)";
        if (selected.length === options.length) return "All Selected";
        if (selected.length === 1) {
            const found = options.find(o => o.value === selected[0]);
            return found ? found.label : selected[0];
        }
        return `${selected.length} Selected`;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {label && <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</div>}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-left bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded-md px-3 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                <span className="block truncate">{getDisplayValue()}</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-white dark:bg-slate-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 dark:ring-slate-750 overflow-auto focus:outline-none sm:text-sm">
                    {/* Select All Option */}
                    <div
                        className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center border-b border-slate-100 dark:border-slate-700"
                        onClick={handleSelectAll}
                    >
                        <div className={`flex items-center justify-center w-4 h-4 mr-2 border rounded ${selected.length === options.length ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                            {selected.length === options.length && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Select All</span>
                    </div>

                    {options.map((option) => {
                        const isSelected = selected.includes(option.value);
                        return (
                            <div
                                key={option.value}
                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center"
                                onClick={() => toggleOption(option.value)}
                            >
                                <div className={`flex items-center justify-center w-4 h-4 mr-2 border rounded ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className={`block truncate ${isSelected ? 'font-medium text-slate-900 dark:text-slate-100' : 'font-normal text-slate-600 dark:text-slate-300'}`}>
                                    {option.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
