import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { updateTask } from '../api';

const CreateSubtaskModal = ({ activities = [], members = [], onClose, onCreate }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        parentId: '',
        title: '',
        description: '', // User requested description
        assignee_id: '',
        due_date: '',
        status: 'Todo'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.parentId) {
            alert("Please select a parent activity.");
            return;
        }

        setLoading(true);
        try {
            // 1. Find parent
            const parent = activities.find(a => a.id === formData.parentId);
            if (!parent) throw new Error("Parent activity not found");

            // 2. Create new subtask object
            const newSubtask = {
                id: Date.now().toString(),
                title: formData.title,
                description: formData.description,
                assignee_id: formData.assignee_id,
                due_date: formData.due_date,
                status: 'Todo' // Default
            };

            // 3. Append to existing subtasks
            const updatedSubtasks = [...(parent.subtasks || []), newSubtask];

            // 4. Update API
            await updateTask(parent.id, { subtasks: updatedSubtasks });

            onCreate && onCreate();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to create task");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 flex-shrink-0">
                    <h2 className="text-lg font-bold text-slate-800">Add New Task</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

                    {/* Parent Activity Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Parent Activity <span className="text-red-500">*</span></label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500"
                            value={formData.parentId}
                            onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                            required
                        >
                            <option value="">Select Activity...</option>
                            {activities.map(act => (
                                <option key={act.id} value={act.id}>{act.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* Task Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Task Title <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Draft Report"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="Details about this task..."
                            rows="3"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Assignee */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                                value={formData.assignee_id}
                                onChange={e => setFormData({ ...formData, assignee_id: e.target.value })}
                            >
                                <option value="">Select Member</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name || `${m.first_name} ${m.middle_name || ''} ${m.last_name}`.trim()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Due Date */}
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
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Task'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateSubtaskModal;
