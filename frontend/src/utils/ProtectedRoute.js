import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './authService';
import { useRbac } from './rbacContext';
import { Spin, message } from 'antd';
import { hasPermission } from './permissions';

/**
 * Enhanced ProtectedRoute with Role-Based Access Control (RBAC) and Matrix Capabilities.
 * 
 * @param {React.ReactNode} children - Component to render if authorized
 * @param {string[]} [allowedRoles] - Optional array of authorized roles
 * @param {string} [requiredPermission] - Optional permission string key
 * @param {string} [requiredCapability] - Optional matrix capability ID (e.g. 'd_create', 't_create')
 */
const ProtectedRoute = ({ children, allowedRoles, requiredPermission, requiredCapability }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const { can, activeRole } = useRbac();
  const location = useLocation();
  const navigate = useNavigate();

  // Listen for temporary access expiration event
  useEffect(() => {
    const handleExpired = (e) => {
      message.warning(e.detail?.message || 'Temporary access session expired.');
      navigate('/dashboard');
    };
    window.addEventListener('temp_session_expired', handleExpired);
    return () => window.removeEventListener('temp_session_expired', handleExpired);
  }, [navigate]);

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

  // 2. Capability & Role Authorization check
  const hasCapabilityAccess = !requiredCapability || (Array.isArray(requiredCapability) ? requiredCapability.some(c => can(c)) : can(requiredCapability));
  const userRole = (user?.role || activeRole?.id || 'viewer').toLowerCase();
  const hasAllowedRole = !allowedRoles || allowedRoles.length === 0 || user?.isSuperAdmin || activeRole?.id === 'super_admin' ||
    allowedRoles.some((r) => r.toLowerCase() === userRole || r.toLowerCase() === activeRole?.id);
  const hasRequiredPermission = !requiredPermission || hasPermission(user, requiredPermission);

  if (!hasAllowedRole || !hasRequiredPermission || !hasCapabilityAccess) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant rounded-3xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[32px]">shield_lock</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">Access Restricted (403)</h2>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            Your account role (<span className="font-semibold text-rose-700 capitalize">{activeRole?.label || user?.role || 'Viewer'}</span>) does not have permission to access this area.
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

  return children;
};

export default ProtectedRoute;
