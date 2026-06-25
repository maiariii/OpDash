import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

import ProjectDetails from './pages/ProjectDetails';
import BasecampTargets from './pages/BasecampTargets';

import Projects from './pages/Projects';
import Employees from './pages/Employees';
import { ToastProvider } from './components/ToastContext';
import Login from './pages/Login';
import AuthRoute from './components/AuthRoute';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename="/opdash">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AuthRoute><Layout /></AuthRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="basecamp-targets" element={<BasecampTargets />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="employees" element={<Employees />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
