import { useState, useEffect, useContext } from 'react';
import { auth, db } from '@/firebase/config';
import { signInWithEmailAndPassword, signOut, User as FirebaseAuthUser } from 'firebase/auth';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { activityLogService } from '@/services/firestore/activityLogService';

export const useAuth = () => {
  const { currentUser, setCurrentUser, setLoading, setError } = useContext(AppContext);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
      setLoading(false); // Global loading
    });
    return () => unsubscribe();
  }, [setCurrentUser, setLoading]);

  const login = async (email: string, password: string) => {
    setLoadingAuth(true);
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Wait for auth state to propagate before navigating
      setCurrentUser(userCredential.user);
      toast.success("Login successful!");
      // Log activity asynchronously - don't await to prevent delays
      activityLogService.logAction(`User ${email} logged in`, userCredential.user.uid, email).catch(console.error);
      // Navigation will be handled by Login page's useEffect when currentUser is set
    } catch (err: any) {
      let errorMessage = "Login failed. Please try again.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errorMessage = "Invalid login credentials";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      setAuthError(errorMessage);
      toast.error(errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async () => {
    setLoadingAuth(true);
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await signOut(auth);
      toast.success("Logged out successfully");
      await activityLogService.logAction(`User ${userEmail} logged out`, userId, userEmail);
      navigate('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
      setError('Failed to log out'); // Global error
    } finally {
      setLoadingAuth(false);
    }
  };

  return {
    currentUser,
    loadingAuth,
    authError,
    login,
    logout,
  };
};