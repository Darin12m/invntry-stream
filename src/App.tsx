import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";
import { AppProvider, AppContext } from "./context/AppContext";
import AppLayout from "./layouts/AppLayout";
import ConsolePage from "./pages/ConsolePage";
import { useEffect, useContext } from "react";
import DebugConsole from "./components/DebugConsole"; // Import DebugConsole

const queryClient = new QueryClient();

// Component to handle authentication and route persistence
const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Save current path to localStorage on every route change, but only if authenticated
    // and not on the login page or a non-existent route
    if (currentUser && !loading && location.pathname !== '/login' && location.pathname !== '/404') {
      localStorage.setItem('lastPath', location.pathname);
    }
  }, [location.pathname, currentUser, loading]);

  useEffect(() => {
    if (!loading && !currentUser) {
      // User is not authenticated, redirect to login
      navigate("/login", { replace: true });
    } else if (!loading && currentUser) {
      // User is authenticated and app data is loaded
      const lastPath = localStorage.getItem('lastPath');
      // If current path is login, or root, and there's a lastPath, navigate there
      if (location.pathname === '/login' || location.pathname === '/') {
        if (lastPath && lastPath !== '/login' && lastPath !== '/') {
          navigate(lastPath, { replace: true });
        } else {
          // If no specific last path, or it was login/root, default to the AppLayout's default tab
          navigate('/', { replace: true });
        }
      }
    }
  }, [loading, currentUser, navigate, location.pathname]);

  if (loading || !currentUser) {
    // Show loading or nothing while auth state is resolving or app data loads
    // Login page handles its own loading state
    if (location.pathname === '/login') {
      return <Login />; // Render Login directly if on login page
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading application...</div>
      </div>
    );
  }

  // User is authenticated and data loaded, render children
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AppProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={ // Root path, renders AppLayout
              <AuthWrapper>
                <AppLayout />
              </AuthWrapper>
            } />
            <Route path="/console" element={ // Console page, also protected
              <AuthWrapper>
                <ConsolePage />
              </AuthWrapper>
            } />
            {/* Catch-all for any other route, protected */}
            <Route path="*" element={
              <AuthWrapper>
                <NotFound />
              </AuthWrapper>
            } />
          </Routes>
          <DebugConsole /> {/* Inject DebugConsole here */}
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;