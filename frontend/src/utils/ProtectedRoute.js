import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './authService';
import { Spin, Button, Result } from 'antd';

/**
 * Enhanced ProtectedRoute with optional Role-Based Access Control (RBAC).
 * 
 * @param {React.ReactNode} children - Component to render if authorized
 * @param {string[]} [allowedRoles] - Optional array of authorized roles
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  // 1. Separate Authentication check
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role-Based Authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user?.role || 'viewer').toLowerCase();
    const hasPermission = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasPermission) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant rounded-3xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">shield_lock</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-2">Access Restricted (403)</h2>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Your account role (<span className="font-semibold text-rose-700 capitalize">{user?.role || 'Viewer'}</span>) does not have permission to access this area.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;