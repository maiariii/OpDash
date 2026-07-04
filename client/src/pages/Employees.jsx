import React, { useEffect, useState, useMemo } from 'react';
import { getEmployees, createEmployee, updateEmployee, getDivisions, deleteEmployee } from '../api';
import { User, Plus, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const POSITIONS = [
    "Administrative Aide I", "Administrative Aide II", "Administrative Aide III", "Administrative Aide IV", "Administrative Aide V", "Administrative Aide VI",
    "Administrative Assistant I", "Administrative Assistant II", "Administrative Assistant III", "Administrative Assistant V", "Administrative Assistant VI",
    "Administrative Officer I", "Administrative Officer II", "Administrative Officer III", "Administrative Officer IV", "Administrative Officer V",
    "Administrative Support I", "Administrative Support II",
    "Chief Administrative Officer",
    "Chief Health Program Officer",
    "Director II", "Director III", "Director IV",
    "Draftsman II",
    "Electronics and Communications",
    "Engineer II", "Engineer III", "Engineer IV", "Engineer V",
    "Executive Assistant I", "Executive Assistant II", "Executive Assistant III", "Executive Assistant IV", "Executive Assistant V",
    "Messenger/Ground Maintenance/Utility Workers",
    "Project Development Officer I", "Project Development Officer II", "Project Development Officer III", "Project Development Officer IV", "Project Development Officer V",
    "Senior Administrative Assistant I", "Senior Administrative Assistant II", "Senior Administrative Assistant III", "Senior Administrative Assistant V",
    "Skilled Worker/Driver",
    "Statistician I", "Statistician II", "Statistician III",
    "Supervising Administrative Officer",
    "Technical Assistant I", "Technical Assistant II", "Technical Assistant III",
    "Technical Assistant III (Attorney III)", "Technical Assistant III (Engineer II)",
    "Technical Assistant IV",
    "Technical Assistant IV (Architect III)", "Technical Assistant IV (Attorney IV)", "Technical Assistant IV (Engineer III)", "Technical Assistant IV (Medical Officer III)"
].sort();

const getDivisionStyles = (divisionName) => {
    const name = (divisionName || '').toLowerCase();
    if (name.includes('personnel')) return 'division-badge division-personnel';
    if (name.includes('employee welfare')) return 'division-badge division-welfare';
    if (name.includes('human resource') || name.includes('hrod')) return 'division-badge division-hrod';
    if (name.includes('school effectiveness')) return 'division-badge division-school-eff';
    if (name.includes('organization effectiveness')) return 'division-badge division-org-eff';
    if (name.includes('education')) return 'division-badge division-education';
    return 'division-badge division-default';
};

const Employees = () => {
    const { showToast } = useToast();
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Sort & Filter State
    const [sortConfig, setSortConfig] = useState({ key: 'fullName', direction: 'ascending' });
    const [filters, setFilters] = useState({ fullName: '', position: '', divisionName: '' });

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Forms
    const [newEmp, setNewEmp] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        division_id: '',
        position: ''
    });

    // Edit State for Employee
    const [editingEmp, setEditingEmp] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editEmpForm, setEditEmpForm] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        division_id: '',
        position: ''
    });

    const refresh = () => {
        Promise.all([getDivisions(), getEmployees()]).then(([d, e]) => {
            setDivisions(d);
            setEmployees(e);
        });
    };

    useEffect(() => {
        refresh();
    }, []);

    // Derived Data
    const processedEmployees = useMemo(() => {
        let data = employees.map(emp => {
            const divName = divisions.find(d => d.id === emp.division_id)?.name || 'Unknown';
            const fullName = (emp.name || `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`).trim();
            return { ...emp, fullName, divisionName: divName };
        });

        // Filter
        if (filters.fullName) {
            data = data.filter(item => item.fullName.toLowerCase().includes(filters.fullName.toLowerCase()));
        }
        if (filters.position) {
            data = data.filter(item => item.position.toLowerCase().includes(filters.position.toLowerCase()));
        }
        if (filters.divisionName) {
            data = data.filter(item => item.divisionName.toLowerCase().includes(filters.divisionName.toLowerCase()));
        }

        // Sort
        if (sortConfig.key) {
            data.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }

        return data;
    }, [employees, divisions, filters, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-400" />;
        if (sortConfig.direction === 'ascending') return <ArrowUp size={14} className="text-blue-600" />;
        return <ArrowDown size={14} className="text-blue-600" />;
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        try {
            await createEmployee(newEmp);
            showToast("Personnel added successfully!", "success");
            setNewEmp({ first_name: '', middle_name: '', last_name: '', division_id: '', position: '' });
            setShowAddForm(false);
            refresh();
        } catch (err) {
            console.error(err);
            showToast("Failed to add personnel", "error");
        }
    };

    const handleDeleteClick = (emp) => {
        setEmployeeToDelete(emp);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!employeeToDelete) return;
        setIsDeleting(true);
        try {
            await deleteEmployee(employeeToDelete.id);
            showToast("Personnel deleted successfully!", "success");
            setDeleteModalOpen(false);
            setEmployeeToDelete(null);
            refresh();
        } catch (err) {
            console.error("Failed to delete staff member", err);
            showToast("Failed to delete staff member", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const startEditEmployee = (emp) => {
        setEditingEmp(emp.id);
        setEditEmpForm({
            first_name: emp.first_name || '',
            middle_name: emp.middle_name || '',
            last_name: emp.last_name || '',
            division_id: emp.division_id || '',
            position: emp.position || ''
        });
    };

    const handleUpdateEmployee = async (e) => {
        e.preventDefault();
        try {
            await updateEmployee(editingEmp, editEmpForm);
            showToast("Personnel details updated successfully!", "success");
            setEditingEmp(null);
            refresh();
        } catch (err) {
            console.error("Failed to update staff member", err);
            showToast("Failed to update staff member", "error");
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Employees Section */}
            <div className="card-outlined p-6 relative">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <User size={20} className="text-[#075985]" /> List of Authorized Personnel
                    </h2>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="bg-[#075985] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0284C7] transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Personnel
                    </button>
                </div>

                {showAddForm && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="w-full max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-2xl animate-in zoom-in duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Plus size={20} className="text-[#075985]" /> Add New Staff
                                </h3>
                                <button 
                                    onClick={() => setShowAddForm(false)} 
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleAddEmployee} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">First Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            placeholder="First Name"
                                            value={newEmp.first_name}
                                            onChange={e => setNewEmp({ ...newEmp, first_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Middle Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            placeholder="Middle Name"
                                            value={newEmp.middle_name}
                                            onChange={e => setNewEmp({ ...newEmp, middle_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Last Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            placeholder="Last Name"
                                            value={newEmp.last_name}
                                            onChange={e => setNewEmp({ ...newEmp, last_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Division</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            value={newEmp.division_id}
                                            onChange={e => setNewEmp({ ...newEmp, division_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Division</option>
                                            {divisions.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Position</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            value={newEmp.position}
                                            onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Position</option>
                                            {POSITIONS.map(pos => (
                                                <option key={pos} value={pos}>{pos}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-[#075985] text-white py-2.5 rounded-lg hover:bg-[#0284C7] font-medium transition-colors">Add Personnel</button>
                                    <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 font-medium transition-colors">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto rounded-xl border-2 border-sky-100">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('fullName')}>
                                    <div className="flex items-center gap-2">
                                        Name {getSortIcon('fullName')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('position')}>
                                    <div className="flex items-center gap-2">
                                        Position {getSortIcon('position')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('divisionName')}>
                                    <div className="flex items-center gap-2">
                                        Division {getSortIcon('divisionName')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-right">Actions</th>
                            </tr>
                            <tr className="bg-slate-50/50 border-b border-slate-200">
                                <th className="px-4 py-2">
                                    <div className="relative flex items-center">
                                        <Search size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="search"
                                            placeholder="Filter name..."
                                            value={filters.fullName}
                                            onChange={(e) => setFilters(prev => ({ ...prev, fullName: e.target.value }))}
                                            className="column-filter w-full text-xs font-normal py-1"
                                            style={{ paddingLeft: '26px' }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-4 py-2">
                                    <div className="relative flex items-center">
                                        <Search size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="search"
                                            placeholder="Filter position..."
                                            value={filters.position}
                                            onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
                                            className="column-filter w-full text-xs font-normal py-1"
                                            style={{ paddingLeft: '26px' }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-4 py-2">
                                    <div className="relative flex items-center">
                                        <Search size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="search"
                                            placeholder="Filter division..."
                                            value={filters.divisionName}
                                            onChange={(e) => setFilters(prev => ({ ...prev, divisionName: e.target.value }))}
                                            className="column-filter w-full text-xs font-normal py-1"
                                            style={{ paddingLeft: '26px' }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {processedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                                        No staff members found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                processedEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold ring-2 ring-white">
                                                    {emp.first_name ? emp.first_name.charAt(0) : '?'}
                                                </div>
                                                <span className="font-medium text-slate-900">{emp.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 text-sm">{emp.position}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getDivisionStyles(emp.divisionName)}`}>
                                                {emp.divisionName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => startEditEmployee(emp)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(emp)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Edit Modal (Fixed Center Overlay) */}
                {editingEmp && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Edit2 size={20} className="text-blue-600" /> Edit Staff Information
                                </h3>
                                <button 
                                    onClick={() => setEditingEmp(null)} 
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleUpdateEmployee} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">First Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.first_name}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, first_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Middle Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.middle_name}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, middle_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Last Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.last_name}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, last_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Division</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.division_id}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, division_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Division</option>
                                            {divisions.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Position</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.position}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, position: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Position</option>
                                            {POSITIONS.map(pos => (
                                                <option key={pos} value={pos}>{pos}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors">Save Changes</button>
                                    <button type="button" onClick={() => setEditingEmp(null)} className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 font-medium transition-colors">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Staff Member"
                itemName={employeeToDelete?.fullName}
                message="Are you sure you want to delete this staff member? This action cannot be undone."
                isDeleting={isDeleting}
                waitDuration={5}
            />
        </div>
    );
};

export default Employees;
