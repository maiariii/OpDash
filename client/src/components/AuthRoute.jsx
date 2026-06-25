import React from 'react';
import { Navigate } from 'react-router-dom';

const AuthRoute = ({ children }) => {
    const token = localStorage.getItem('opdash_token');
    
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    
    return children;
};

export default AuthRoute;
