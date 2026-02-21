import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Clock, AlertCircle, CheckCircle2, ChevronRight, Plus, Paperclip } from 'lucide-react';
import { updateTask } from '../api';
// import CreateTaskModal from './CreateTaskModal'; // Managed by parent
import { useParams } from 'react-router-dom';

const KanbanBoard = ({ tasks, members = [], onTaskUpdate, onTaskClick, onAddTask }) => {
    const { id: projectId } = useParams();
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    // Map backend status to UI columns
    const columns = {
        'Pending': { title: 'Pending', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
        'In Progress': { title: 'In Progress', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
        'Continuing': { title: 'Continuing', icon: Clock, color: 'text-sky-500', bg: 'bg-sky-50' },
        'Waitlisted': { title: 'Waitlisted', icon: Clock, color: 'text-purple-500', bg: 'bg-purple-50' },
        'Accomplished': { title: 'Accomplished', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
        'Deferred': { title: 'Deferred', icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
        'Cancelled': { title: 'Cancelled', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId !== destination.droppableId) {
            const task = tasks.find(t => t.id === draggableId);
            const updatedTask = { ...task, status: destination.droppableId };

            // Optimistic update
            onTaskUpdate(updatedTask);

            // API call
            await updateTask(task.id, { status: destination.droppableId });
        }
    };

    const handleEditClick = (task) => {
        if (onTaskClick) onTaskClick(task);
    };

    const handleAddClick = () => {
        if (onAddTask) onAddTask();
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800">Board</h2>
                <button
                    onClick={handleAddClick}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors"
                >
                    <Plus size={16} /> Add Activity
                </button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 h-full overflow-x-auto pb-4">
                    {Object.entries(columns).map(([columnId, col]) => {
                        const columnTasks = tasks.filter(t => t.status === columnId);
                        const Icon = col.icon;

                        return (
                            <Droppable key={columnId} droppableId={columnId}>
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="flex-1 min-w-[300px] bg-slate-100 rounded-xl p-4 flex flex-col h-full"
                                    >
                                        <div className={`flex items-center gap-2 mb-4 p-3 rounded-lg ${col.bg}`}>
                                            <Icon size={18} className={col.color} />
                                            <h3 className={`font-bold ${col.color}`}>{col.title}</h3>
                                            <span className="ml-auto bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 shadow-sm">
                                                {columnTasks.length}
                                            </span>
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                            {columnTasks.map((task, index) => (
                                                <Draggable key={task.id} draggableId={task.id} index={index}>
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            onClick={() => handleEditClick(task)}
                                                            className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow group cursor-pointer"
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${task.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                                                    }`}>
                                                                    {task.priority || 'Medium'}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-bold text-slate-800 mb-1">{task.title}</h4>
                                                            <p className="text-xs text-slate-500 line-clamp-2">{task.objective || "No objective defined"}</p>

                                                            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
                                                                <span>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Deadline'}</span>
                                                                {task.file_attachments && JSON.parse(task.file_attachments).length > 0 && (
                                                                    <div className="flex items-center gap-1 text-slate-400">
                                                                        <Paperclip size={12} />
                                                                        <span>{JSON.parse(task.file_attachments).length}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        );
                    })}
                </div>
            </DragDropContext>

            {/* Modal is now handled by parent ProjectDetails */}
        </div>
    );
};

export default KanbanBoard;
