import React from 'react';
import { Loader2 } from 'lucide-react';

const Loader = ({ text = "Loading..." }) => {
    return (
        <div className="flex flex-col items-center justify-center h-64 w-full text-slate-400">
            <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
            <p className="text-sm font-medium animate-pulse">{text}</p>
        </div>
    );
};

export default Loader;
