import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg text-muted font-mono text-sm">
        Opening the reading room…
      </div>
    );
  }

  if (!token) return <Navigate to="/signin" replace />;
  return children;
}
