import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './components/SignIn.jsx';
import SignUp from './components/SignUp.jsx';
import Home from './components/Home.jsx';
import Bookmarks from './components/Bookmarks.jsx';
import Settings from './components/Settings.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home view="feed" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute>
            <Bookmarks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
