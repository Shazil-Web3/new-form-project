import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthCard from "./components/AuthCard";
import InvitedUserRegistration from "./components/InvitedUserRegistration";
import { AuthProvider } from "./utils/authService";
import ProtectedRoute from "./utils/ProtectedRoute";
import Home from "./components/Home/Home";
import Editor from "./components/Editor/Editor";

// Integrated New UI Hub Pages (Tailwind Workspace & Dashboard)
import UnifiedDashboard from "./pages/new/Hub/HubPage";
import AuditTrailPage from "./pages/new/Hub/AuditTrailPage";
import TrendingPage from "./pages/new/Hub/TrendingPage";
import CreateDocumentHub from "./pages/new/Hub/CreateDocumentHub";
import CreateTemplateHub from "./pages/new/Hub/CreateTemplateHub";
import EditTemplateHub from "./pages/new/Hub/EditTemplateHub";
import EditDocumentHub from "./pages/new/Hub/EditDocumentHub";
import AccountManagementPage from "./pages/new/Workspace/AccountManagementPage";
import MyTasksPage from "./pages/new/Workspace/MyTasksPage";
import CalendarPage from "./pages/new/Workspace/CalendarPage";
import ReferencesPage from "./pages/new/Hub/ReferencesPage";
import TrainingApp from "./training/TrainingApp";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Authentication & Base Routes */}
          <Route path="/login" element={<AuthCard />} />
          <Route path="/join/:token" element={<InvitedUserRegistration />} />
          
          {/* Main Home & Dashboard Routes - NOW SET TO THE NEW UI HUB DASHBOARD */}
          <Route path="/" element={
            <ProtectedRoute>
              <UnifiedDashboard initialType="all" />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <UnifiedDashboard initialType="all" />
            </ProtectedRoute>
          } />
          <Route path="/workspace" element={
            <ProtectedRoute>
              <UnifiedDashboard initialType="all" />
            </ProtectedRoute>
          } />

          {/* Legacy fallback route for old dashboard */}
          <Route path="/old-home" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          
          {/* PROTECTED UNIFIED DOCUMENT EDITOR ROUTE */}
          <Route path="/document/:docId" element={
            <ProtectedRoute>
              <EditDocumentHub />
            </ProtectedRoute>
          } />

          {/* New UI Hub & Workspace Routes */}
          <Route path="/workspace/tasks" element={
            <ProtectedRoute>
              <MyTasksPage />
            </ProtectedRoute>
          } />
          <Route path="/tasks" element={
            <ProtectedRoute>
              <MyTasksPage />
            </ProtectedRoute>
          } />
          <Route path="/workspace/account-management" element={
            <ProtectedRoute allowedRoles={['admin', 'project_manager']}>
              <AccountManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/workspace/users" element={
            <ProtectedRoute allowedRoles={['admin', 'project_manager']}>
              <AccountManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/workspace/audit-trail" element={
            <ProtectedRoute allowedRoles={['admin', 'project_manager']}>
              <AuditTrailPage />
            </ProtectedRoute>
          } />
          <Route path="/workspace/trending" element={
            <ProtectedRoute>
              <TrendingPage />
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          } />
          <Route path="/workspace/calendar" element={<Navigate to="/calendar" replace />} />
          <Route path="/training/*" element={
            <ProtectedRoute>
              <TrainingApp />
            </ProtectedRoute>
          } />
          <Route path="/references" element={
            <ProtectedRoute>
              <ReferencesPage />
            </ProtectedRoute>
          } />
          <Route path="/accounts" element={<Navigate to="/workspace/account-management" replace />} />
          <Route path="/published-docs" element={
            <ProtectedRoute>
              <UnifiedDashboard initialType="all" initialActiveTab="Published" />
            </ProtectedRoute>
          } />
          <Route path="/repository" element={
            <ProtectedRoute>
              <UnifiedDashboard initialType="all" initialActiveTab="Archived" />
            </ProtectedRoute>
          } />
          <Route path="/document/new" element={
            <ProtectedRoute allowedRoles={['admin', 'project_manager', 'author', 'reviewer', 'approver', 'editor', 'member', 'user']}>
              <CreateDocumentHub />
            </ProtectedRoute>
          } />
          <Route path="/template/new" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CreateTemplateHub />
            </ProtectedRoute>
          } />
          <Route path="/template/:tempId" element={
            <ProtectedRoute>
              <EditTemplateHub />
            </ProtectedRoute>
          } />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
