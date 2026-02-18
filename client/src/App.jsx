import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

import ProjectDetails from './pages/ProjectDetails';
import BasecampTargets from './pages/BasecampTargets';

import Projects from './pages/Projects';
import Employees from './pages/Employees';

function App() {
  return (
    <BrowserRouter basename="/opdash">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="basecamp-targets" element={<BasecampTargets />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="employees" element={<Employees />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
