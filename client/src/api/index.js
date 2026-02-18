import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_URL,
});

export const getEmployees = () => api.get('/employees').then(res => res.data);
export const createEmployee = (data) => api.post('/employees', data).then(res => res.data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`).then(res => res.data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data).then(res => res.data);

export const getDivisions = () => api.get('/divisions').then(res => res.data);
export const createDivision = (data) => api.post('/divisions', data).then(res => res.data);
export const updateDivision = (id, data) => api.put(`/divisions/${id}`, data).then(res => res.data);

export const getProjects = () => api.get('/projects').then(res => res.data);
export const createProject = (data) => api.post('/projects', data).then(res => res.data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data).then(res => res.data);

// Project specific
export const getProjectTasks = (projectId) => api.get(`/projects/${projectId}/tasks`).then(res => res.data);
export const getProjectFinancials = (projectId) => api.get(`/projects/${projectId}/financials`).then(res => res.data);

export const createTask = (data) => api.post('/tasks', data).then(res => res.data);
export const createSubtask = (activityId, data) => api.post(`/activities/${activityId}/tasks`, data).then(res => res.data);
export const updateTask = (taskId, data) => api.put(`/tasks/${taskId}`, data).then(res => res.data);
export const predictRisk = (data) => api.post('/ai/predict-risk', data).then(res => res.data);

// Milestones
export const getProjectMilestones = (projectId) => api.get(`/projects/${projectId}/milestones`).then(res => res.data);
export const createMilestone = (data) => api.post('/milestones', data).then(res => res.data);
export const updateMilestone = (id, data) => api.put(`/milestones/${id}`, data).then(res => res.data);
export const deleteMilestone = (id) => api.delete(`/milestones/${id}`).then(res => res.data);
export const createCatchUp = (data) => api.post('/catchups', data).then(res => res.data);
export const updateCatchUp = (id, data) => api.put(`/catchups/${id}`, data).then(res => res.data);
export const getProjectCatchUps = (projectId) => api.get(`/projects/${projectId}/catchups`).then(res => res.data);

export default api;
