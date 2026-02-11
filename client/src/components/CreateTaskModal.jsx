import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { createTask, updateTask } from '../api';

const CreateTaskModal = ({ projectId, task, members = [], onClose, onCreated }) => {
    const isEditMode = !!task;

    // Parse members string into array if needed, or use passed array
    const availableMembers = members;

    // Initial State
    const [formData, setFormData] = useState({
        title: '',
        objective: '',
        status: 'Todo',
        start_date: '',
        due_date: '',
        cost: 0,
        budget: 0,
        expenses: [],
        subtasks: [] // Initialize subtasks
    });

    const [loading, setLoading] = useState(false);
    const [showExpenses, setShowExpenses] = useState(false);
    const [showTasks, setShowTasks] = useState(false); // Subtasks Modal

    // State for new expense form
    const [newExpense, setNewExpense] = useState({
        description: '',
        date: new Date().toISOString().split('T')[0],
        amount: ''
    });

    // State for new subtask
    const [newSubtask, setNewSubtask] = useState({
        title: '',
        description: '',
        due_date: '',
        assignee_id: ''
    });

    // Populate for Edit
    useEffect(() => {
        if (task) {
            setFormData({
                title: task.title || '',
                objective: task.objective || '',
                status: task.status || 'Todo',
                start_date: task.start_date || '',
                due_date: task.due_date || '',
                cost: task.cost || 0,
                budget: task.budget || 0,
                expenses: task.expenses || [],
                subtasks: task.subtasks || []
            });
        }
    }, [task]);

    // Mapped statuses for UI
    const statusOptions = [
        { label: 'Pending', value: 'Todo' },
        { label: 'In Progress', value: 'In Progress' },
        { label: 'Accomplished', value: 'Done' }
    ];

    const handleAddExpense = () => {
        if (newExpense.description && newExpense.amount) {
            const amountValue = newExpense.amount.replace(/,/g, '');
            const newExp = {
                id: Date.now().toString(),
                description: newExpense.description,
                date: newExpense.date,
                amount: Number(amountValue)
            };
            setFormData({
                ...formData,
                expenses: [...(formData.expenses || []), newExp]
            });
            // Reset form
            setNewExpense({
                description: '',
                date: new Date().toISOString().split('T')[0],
                amount: ''
            });
        }
    };

    const handleAddSubtask = () => {
        if (newSubtask.title) {
            const newTaskItem = {
                id: Date.now().toString(),
                title: newSubtask.title,
                description: newSubtask.description,
                assignee_id: newSubtask.assignee_id || null,
                status: 'Todo',
                due_date: newSubtask.due_date || null
            };
            setFormData({
                ...formData,
                subtasks: [...(formData.subtasks || []), newTaskItem]
            });
            // Reset
            setNewSubtask({ title: '', description: '', due_date: '', assignee_id: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEditMode) {
                await updateTask(task.id, formData);
            } else {
                await createTask({
                    ...formData,
                    project_id: projectId
                });
            }
            onCreated();
            onClose();
        } catch (error) {
            console.error(error);
            alert(`Failed to ${isEditMode ? 'update' : 'create'} task`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Main Activity Modal */}
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 flex-shrink-0">
                        <h2 className="text-lg font-bold text-slate-800">{isEditMode ? 'Edit Activity' : 'Add New Activity'}</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <div className="flex justify-between">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Activity Title <span className="text-red-500">*</span></label>
                                <span className="text-xs text-slate-400">{formData.title.length}/50</span>
                            </div>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Data Analysis"
                                value={formData.title}
                                onChange={e => e.target.value.length <= 50 && setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Objective</label>
                                <span className="text-xs text-slate-400">{formData.objective.length}/100</span>
                            </div>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder="Brief objective..."
                                rows="2"
                                value={formData.objective}
                                onChange={e => e.target.value.length <= 100 && setFormData({ ...formData, objective: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
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

                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="date"
                                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg outline-none"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
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



                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Budget</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                    value={formData.budget ? Number(formData.budget).toLocaleString() : ''}
                                    onChange={e => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (!isNaN(val)) {
                                            setFormData({ ...formData, budget: val });
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Actual Expenses</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono">
                                        ${(formData.expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowExpenses(true)}
                                        className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm border border-slate-200"
                                    >
                                        Manage
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tasks / Sub-Activities Section */}
                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-slate-700">Tasks</label>
                                <button
                                    type="button"
                                    onClick={() => setShowTasks(true)}
                                    className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    + Manage Tasks ({(formData.subtasks || []).length})
                                </button>
                            </div>
                            {(formData.subtasks || []).length > 0 && (
                                <div className="space-y-1">
                                    {(formData.subtasks || []).slice(0, 3).map(st => (
                                        <div key={st.id} className="text-xs text-slate-500 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            <span className="truncate">{st.title}</span>
                                        </div>
                                    ))}
                                    {(formData.subtasks || []).length > 3 && (
                                        <p className="text-xs text-slate-400 pl-3">...and {(formData.subtasks || []).length - 3} more</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4">
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
                                {loading ? 'Saving...' : (isEditMode ? 'Update Activity' : 'Create Activity')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Expenses Sub-Modal */}
            {showExpenses && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">Manage Expenses</h3>
                            <button onClick={() => setShowExpenses(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Add Expense Form */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase">Add New Expense</p>
                                <div className="grid grid-cols-1 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Description (e.g. Catering)"
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                        value={newExpense.description}
                                        onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                            value={newExpense.date}
                                            onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Amount"
                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                            value={newExpense.amount}
                                            onChange={e => {
                                                const val = e.target.value.replace(/,/g, '');
                                                if (!isNaN(val)) {
                                                    setNewExpense({
                                                        ...newExpense,
                                                        amount: val ? Number(val).toLocaleString() : ''
                                                    });
                                                }
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddExpense}
                                        className="w-full py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700"
                                    >
                                        Add Expense
                                    </button>
                                </div>
                            </div>

                            {/* Expense List */}
                            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col max-h-60">
                                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between text-xs font-bold text-slate-500 uppercase flex-shrink-0">
                                    <span>Date - Description</span>
                                    <span>Amount</span>
                                </div>
                                <div className="overflow-y-auto">
                                    {(formData.expenses || []).length === 0 && (
                                        <p className="p-4 text-xs text-slate-400 text-center">No expenses recorded yet.</p>
                                    )}
                                    {(formData.expenses || []).map((exp, idx) => (
                                        <div key={idx} className="flex justify-between items-center px-3 py-2 border-b border-slate-100 last:border-0 text-sm">
                                            <div>
                                                <span className="text-slate-500 text-xs block">{new Date(exp.date).toLocaleDateString()}</span>
                                                <span className="text-slate-700 font-medium">{exp.description}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-slate-800">${Number(exp.amount).toLocaleString()}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newExpenses = formData.expenses.filter((_, i) => i !== idx);
                                                        setFormData({ ...formData, expenses: newExpenses });
                                                    }}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-800 flex-shrink-0">
                                    <span>Total</span>
                                    <span>
                                        ${(formData.expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setShowExpenses(false)}
                                className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tasks Sub-Modal */}
            {showTasks && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[500px]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">Manage Tasks</h3>
                            <button onClick={() => setShowTasks(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            {/* Add Task Form */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase">Add New Task</p>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Task Title"
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                        value={newSubtask.title}
                                        onChange={e => setNewSubtask({ ...newSubtask, title: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                                    />
                                    <textarea
                                        placeholder="Description (optional)"
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none resize-none"
                                        rows="2"
                                        value={newSubtask.description}
                                        onChange={e => setNewSubtask({ ...newSubtask, description: e.target.value })}
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                            value={newSubtask.due_date}
                                            onChange={e => setNewSubtask({ ...newSubtask, due_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-2">
                                        <select
                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none bg-white"
                                            value={newSubtask.assignee_id}
                                            onChange={e => setNewSubtask({ ...newSubtask, assignee_id: e.target.value })}
                                        >
                                            <option value="">Assign to...</option>
                                            {availableMembers.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name || `${m.first_name} ${m.middle_name || ''} ${m.last_name}`.trim()}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddSubtask}
                                        className="w-full py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700"
                                    >
                                        Add Task
                                    </button>
                                </div>
                            </div>

                            {/* Task List */}
                            <div className="space-y-2">
                                {(formData.subtasks || []).length === 0 && (
                                    <p className="text-center text-slate-400 text-sm py-4">No tasks added yet.</p>
                                )}
                                {(formData.subtasks || []).map((st, idx) => (
                                    <div key={st.id} className="flex justify-between items-center p-2 border border-slate-100 rounded hover:bg-slate-50">
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-slate-800 truncate">{st.title}</p>
                                            <p className="text-xs text-slate-500">
                                                {st.due_date && <span className="ml-0 text-slate-400">Due: {new Date(st.due_date).toLocaleDateString()}</span>}
                                                {st.assignee_id && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium border border-blue-100">
                                                        {availableMembers.find(m => m.id === st.assignee_id)?.name || 'Assigned'}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = (formData.subtasks || []).filter(t => t.id !== st.id);
                                                setFormData({ ...formData, subtasks: updated });
                                            }}
                                            className="text-red-400 hover:text-red-600 p-1"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setShowTasks(false)}
                                className="w-full py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CreateTaskModal;
