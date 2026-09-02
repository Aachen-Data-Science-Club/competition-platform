import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Competition from "./pages/Competition";
import UploadModel from "./pages/UploadModel";
import ChallengeInformation from "./pages/ChallengeInformation";
import Settings from "./pages/Settings";
import AdminTeams from "./pages/admin/AdminTeams";
import AdminCompetitions from "./pages/admin/AdminCompetitions";

import AdminChallengeForm from "./pages/admin/AdminChallengeForm";

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/performance" element={
          <ProtectedRoute><Competition /></ProtectedRoute>
        } />
        <Route path="/upload-model" element={
          <ProtectedRoute><UploadModel /></ProtectedRoute>
        } />
        <Route path="/challenge-information" element={
          <ProtectedRoute><ChallengeInformation /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><Settings /></ProtectedRoute>
        } />
        <Route path="/admin/teams" element={
          <ProtectedRoute adminOnly><AdminTeams /></ProtectedRoute>
        } />
        <Route path="/admin/challenges" element={
          <ProtectedRoute adminOnly><AdminCompetitions /></ProtectedRoute>
        } />
        <Route path="/admin/challenges/new" element={
          <ProtectedRoute adminOnly><AdminChallengeForm /></ProtectedRoute>
        } />
        <Route path="/admin/challenges/:id" element={
          <ProtectedRoute adminOnly><AdminChallengeForm /></ProtectedRoute>
        } />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/competition" element={<Navigate to="/performance" replace />} />
        <Route path="/admin/competitions" element={<Navigate to="/admin/challenges" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}