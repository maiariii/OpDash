import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { updateTask } from '../api';

const EditSubtaskModal = ({ subtask, parentId, parentTask, members = [], onClose, onUpdate }) => {
    const [loading, setLoading] = useState(false);

    // Initial state from passed subtask
    const [formData, setFormData] = useState({
        title: subtask.title || '',
        description: subtask.description || '',
        status: subtask.status || 'Pending',
        due_date: subtask.due_date ? (() => {
            const d = new Date(subtask.due_date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })() : '',
        assignee_id: subtask.assignee_id || ''
    });

    const statusOptions = [
        { label: 'Pending', value: 'Pending' },
        { label: 'In Progress', value: 'In Progress' },
        { label: 'Accomplished', value: 'Accomplished' },
        { label: 'Deferred', value: 'Deferred' },
        { label: 'Continuing', value: 'Continuing' },
        { label: 'Cancelled', value: 'Cancelled' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Get current subtasks from parent
            const currentSubtasks = parentTask.subtasks || [];

            // 2. Map and update the specific subtask
            const updatedSubtasks = currentSubtasks.map(st => {
                if (st.id === subtask.id) {
                    return {
                        ...st,
                        ...formData
                    };
                }
                return st;
            });

            // 3. Update the parent task with new subtasks array
            await updateTask(parentId, { subtasks: updatedSubtasks });

            onUpdate(); // Trigger refresh in parent
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to update task');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800">Edit Task</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <div className="flex justify-between">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                            <span className="text-xs text-slate-400">{formData.title.length}/50</span>
                        </div>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={50}
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <div className="flex justify-between">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <span className="text-xs text-slate-400">{formData.description.length}/100</span>
                        </div>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows="3"
                            maxLength={100}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                        >
                            {statusOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                            value={formData.assignee_id}
                            onChange={e => setFormData({ ...formData, assignee_id: e.target.value })}
                        >
                            <option value="">Assign to...</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name || `${m.first_name} ${m.middle_name || ''} ${m.last_name}`.trim()}
                                </option>
                            ))}
                        </select>
                    </div>



                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="date"
                                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg outline-none"
                                value={formData.due_date}
                                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditSubtaskModal;
