import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "./AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ChatProvider } from "./context/ChatContext";
import GlobalChat from "./components/GlobalChat";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ToolArea from "./pages/ToolArea";
import PlanAccessGuard from "./components/PlanAccessGuard";
import Competitions from "./pages/Competitions";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Templates from "./pages/Templates";
import InfographicMaker from "./pages/InfographicMaker";
import { useEffect } from "react";

import SharedView from "./pages/SharedView";

function PrivateRoute({ children, requireAdmin }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50">Đang tải...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requireAdmin && user.email !== "dodoan2211@gmail.com") return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
      }
      // Prevent Ctrl+Shift+I (Windows/Linux) or Cmd+Opt+I (Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
        e.preventDefault();
      }
      // Prevent Ctrl+Shift+J (Windows/Linux) or Cmd+Opt+J (Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
        e.preventDefault();
      }
      // Prevent Ctrl+U (Windows/Linux) or Cmd+U (Mac)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <AuthProvider>
      <ChatProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/templates" 
                element={
                  <PrivateRoute>
                    <Templates />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/tool/:type" 
                element={
                  <PrivateRoute>
                    <PlanAccessGuard>
                      <ToolArea />
                    </PlanAccessGuard>
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/infographic-maker" 
                element={
                  <PrivateRoute>
                    <PlanAccessGuard>
                      <InfographicMaker />
                    </PlanAccessGuard>
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/competitions" 
                element={
                  <PrivateRoute>
                    <Competitions />
                  </PrivateRoute>
                } 
              />
              <Route path="/shared/:shareCode" element={<SharedView />} />
              <Route 
                path="/admin" 
                element={
                  <PrivateRoute requireAdmin>
                    <Admin />
                  </PrivateRoute>
                } 
              />
            </Routes>
            <GlobalChat />
          </Router>
        </ToastProvider>
      </ChatProvider>
    </AuthProvider>
  );
}
