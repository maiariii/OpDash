import React, { useState, useEffect } from 'react';
import { X, Calendar, Paperclip, Upload, Trash2, Loader2, Download } from 'lucide-react';
import { createTask, updateTask, getProjectMilestones, uploadFile } from '../api';
import { useToast } from './ToastContext';

const CreateTaskModal = ({ projectId, task, members = [], milestones: initialMilestones = [], onClose, onCreated, initialDate = null }) => {
    const { showToast } = useToast();
    // console.log("CreateTaskModal received milestones:", initialMilestones);
    const isEditMode = !!task;

    const [milestones, setMilestones] = useState(initialMilestones);

    // Fetch milestones on mount to ensure we have them
    useEffect(() => {
        if (projectId) {
            getProjectMilestones(projectId).then(setMilestones).catch(err => console.error(err));
        }
    }, [projectId]);

    // Parse members string into array if needed, or use passed array
    const availableMembers = members;

    // Helper to extract start/end date from initialDate (which might be a range object or single date)
    const getInitialDates = () => {
        if (!initialDate) return { start: '', end: '' };

        // If it's a range object { start, end }
        if (initialDate.start && initialDate.end) {
            return {
                start: (() => {
                    const d = new Date(initialDate.start);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })(),
                end: (() => {
                    const d = new Date(initialDate.end);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })()
            };
        }

        // If it's a single date
        const d = new Date(initialDate);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { start: dateStr, end: dateStr };
    };

    const initialDates = getInitialDates();


    const [formData, setFormData] = useState({
        title: '',
        objective: '',
        status: 'Pending',
        start_date: initialDates.start,
        due_date: initialDates.end,
        obligated_amount: 0,
        allocation: 0,
        milestone_id: '', // Add milestone_id
        activity_type: '', // No preselection
        nature_of_activity: '', // No preselection
        key_result_area: '', // Select only one KRA
        output: '', // Add output
        expenses: [],
        subtasks: [], // Initialize subtasks
        file_attachments: [] // Initialize file attachments as array
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
                status: task.status || 'Pending',
                start_date: task.start_date ? (() => {
                    const d = new Date(task.start_date);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })() : '',
                due_date: task.due_date ? (() => {
                    const d = new Date(task.due_date);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })() : '',
                obligated_amount: task.obligated_amount || task.cost || 0, // Fallback to old field
                allocation: task.allocation || task.gms_allocation || task.budget || 0,   // Fallback to old field
                milestone_id: task.milestone_id || '', // Populate milestone_id
                activity_type: task.activity_type || '', // Wait, if existing task has type, use it. If not, default? Usually tasks have type. Let's assume passed task has valid type.
                nature_of_activity: task.nature_of_activity || '',
                key_result_area: task.key_result_area || '',
                output: task.output || '',
                expenses: task.expenses || [],
                subtasks: task.subtasks || [],
                file_attachments: task.file_attachments ? JSON.parse(task.file_attachments) : []
            });
        }
    }, [task]);

    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const uploadedFile = await uploadFile(file);
            setFormData(prev => ({
                ...prev,
                file_attachments: [...(prev.file_attachments || []), uploadedFile]
            }));
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload file');
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const removeFile = (index) => {
        setFormData(prev => ({
            ...prev,
            file_attachments: prev.file_attachments.filter((_, i) => i !== index)
        }));
    };


    // Mapped statuses for UI
    const statusOptions = [
        { label: 'Pending', value: 'Pending' },
        { label: 'In Progress', value: 'In Progress' },
        { label: 'Accomplished', value: 'Accomplished' },
        { label: 'Deferred', value: 'Deferred' },
        { label: 'Waitlisted', value: 'Waitlisted' },
        { label: 'Continuing', value: 'Continuing' },
        { label: 'Cancelled', value: 'Cancelled' }
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

        // Date Validation
        if (formData.start_date && formData.due_date && formData.due_date < formData.start_date) {
            showToast("End Date cannot be earlier than Start Date.", "warning");
            return;
        }

        setLoading(true);
        try {
            if (isEditMode) {
                await updateTask(task.id, {
                    ...formData,
                    file_attachments: JSON.stringify(formData.file_attachments)
                });
                showToast("Activity updated successfully!", "success");
            } else {
                await createTask({
                    ...formData,
                    project_id: projectId,
                    file_attachments: JSON.stringify(formData.file_attachments)
                });
                showToast("Activity created successfully!", "success");
            }
            onCreated();
            onClose();
        } catch (error) {
            console.error(error);
            showToast(`Failed to ${isEditMode ? 'update' : 'create'} activity`, "error");
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">Parent Milestone <span className="text-red-500">*</span></label>
                            <select
                                className={`w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 ${formData.milestone_id === "" ? "text-slate-400" : "text-slate-800"}`}
                                value={formData.milestone_id}
                                onChange={e => setFormData({ ...formData, milestone_id: e.target.value })}
                                required
                            >
                                <option value="" disabled hidden>Select a Milestone...</option>
                                {milestones.map(m => (
                                    <option key={m.id} value={m.id} className="text-slate-800">{m.title}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Key Result Area <span className="text-red-500">*</span></label>
                            <select
                                className={`w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 ${formData.key_result_area === "" ? "text-slate-400" : "text-slate-800"}`}
                                value={formData.key_result_area}
                                onChange={e => setFormData({ ...formData, key_result_area: e.target.value })}
                                required
                            >
                                <option value="" disabled hidden>Select Key Result Area...</option>
                                <option value="Management Support" className="text-slate-800">Management Support</option>
                                <option value="Policy and Direction Setting" className="text-slate-800">Policy and Direction Setting</option>
                                <option value="Strategic Leadership and Performance Management" className="text-slate-800">Strategic Leadership and Performance Management</option>
                            </select>
                        </div>

                        <div>
                            <div className="flex justify-between">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Activity Title <span className="text-red-500">*</span></label>
                                <span className="text-xs text-slate-400">{formData.title.length}/50</span>
                            </div>
                            <input
                                type="text"
                                placeholder="e.g. Data Analysis"
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors text-slate-800 placeholder-slate-400"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                maxLength={50}
                            />
                        </div>

                        {/* Activity Type Dropdown */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Activity Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors appearance-none bg-no-repeat bg-[right_1rem_center] ${formData.activity_type === "" ? "text-slate-400" : "text-slate-800"}`}
                                value={formData.activity_type}
                                onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1.25rem' }}
                                required
                            >
                                <option value="" disabled hidden>Select Activity Type</option>
                                <option value="Deskwork" className="text-slate-800">Deskwork</option>
                                <option value="Communications" className="text-slate-800">Communications</option>
                                <option value="Workshop" className="text-slate-800">Workshop</option>
                                <option value="Field Visit" className="text-slate-800">Field Visit</option>
                            </select>
                        </div>

                        {/* Nature of Activity Dropdown */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Nature of Activity <span className="text-red-500">*</span>
                            </label>
                            <select
                                className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors appearance-none bg-no-repeat bg-[right_1rem_center] ${formData.nature_of_activity === "" ? "text-slate-400" : "text-slate-800"}`}
                                value={formData.nature_of_activity}
                                onChange={(e) => setFormData({ ...formData, nature_of_activity: e.target.value })}
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1.25rem' }}
                                required
                            >
                                <option value="" disabled hidden>Select Nature of Activity</option>
                                <option value="Policy Development" className="text-slate-800">Policy Development</option>
                                <option value="Program Implementation" className="text-slate-800">Program Implementation</option>
                                <option value="Technical Assistance" className="text-slate-800">Technical Assistance</option>
                                <option value="Monitoring and Evaluation" className="text-slate-800">Monitoring and Evaluation</option>
                                <option value="Tools/System Development" className="text-slate-800">Tools/System Development</option>
                                <option value="Office Management" className="text-slate-800">Office Management</option>
                            </select>
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

                        <div>
                            <div className="flex justify-between">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Output</label>
                                <span className="text-xs text-slate-400">{(formData.output || '').length}/100</span>
                            </div>
                            <textarea
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder="Expected output..."
                                rows="2"
                                value={formData.output || ''}
                                onChange={e => e.target.value.length <= 100 && setFormData({ ...formData, output: e.target.value })}
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
                                        onChange={e => {
                                            const newStart = e.target.value;
                                            const updates = { start_date: newStart };
                                            if (formData.due_date && newStart > formData.due_date) {
                                                updates.due_date = newStart;
                                            }
                                            setFormData({ ...formData, ...updates });
                                        }}
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
                                        min={formData.start_date}
                                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Budget & Expenses - Conditionally Hidden if Deskwork or Communications */}
                        {
                            !['Deskwork', 'Communications'].includes(formData.activity_type) && (
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Allocation</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="0.00"
                                            value={formData.allocation ? Number(formData.allocation).toLocaleString() : ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/,/g, '');
                                                if (!isNaN(val)) {
                                                    setFormData({ ...formData, allocation: val });
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Obligated Amount</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono">
                                                ₱{(formData.expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
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
                            )
                        }

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

                        {/* File Attachments Section */}
                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-slate-700">Attachments</label>
                                <label className="cursor-pointer text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        disabled={uploading}
                                    />
                                    {uploading ? (
                                        <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Paperclip size={16} /> Attach File</>
                                    )}
                                </label>
                            </div>

                            {(formData.file_attachments || []).length > 0 ? (
                                <div className="space-y-2">
                                    {formData.file_attachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 group">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Paperclip size={14} className="text-slate-400 flex-shrink-0" />
                                                <span className="text-xs text-slate-600 truncate">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <a
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Download"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Download size={14} />
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No files attached yet.</p>
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
                </div >
            </div >

            {/* Expenses Sub-Modal */}
            {
                showExpenses && (
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
                                                    <span className="font-mono text-slate-800">₱{Number(exp.amount).toLocaleString()}</span>
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
                                            ₱{(formData.expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
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
                )
            }

            {/* Tasks Sub-Modal */}
            {
                showTasks && (
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
                                        <div className="flex justify-between">
                                            <input
                                                type="text"
                                                placeholder="Task Title"
                                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none"
                                                maxLength={50}
                                                value={newSubtask.title}
                                                onChange={e => setNewSubtask({ ...newSubtask, title: e.target.value })}
                                                onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                                            />
                                            <span className="text-[10px] text-slate-400 ml-2 pt-2">{(newSubtask.title || '').length}/50</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <textarea
                                                placeholder="Description (optional)"
                                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm outline-none resize-none"
                                                rows="2"
                                                maxLength={100}
                                                value={newSubtask.description}
                                                onChange={e => setNewSubtask({ ...newSubtask, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="text-[10px] text-slate-400">{(newSubtask.description || '').length}/100</span>
                                        </div>
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
                )
            }
        </>
    );
};

export default CreateTaskModal;
