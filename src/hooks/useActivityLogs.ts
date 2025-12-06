import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { ActivityLog } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { db } from '@/firebase/config';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';

export const useActivityLogs = () => {
  const { activityLogs, setActivityLogs, currentUser, setError } = useContext(AppContext);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(true);
  const [errorActivityLogs, setErrorActivityLogs] = useState<string | null>(null);

  // Track if we've received the first snapshot
  const hasInitialSnapshot = useRef(false);

  // Real-time listener for activity logs
  useEffect(() => {
    if (!currentUser) {
      setLoadingActivityLogs(false);
      return;
    }

    setLoadingActivityLogs(true);
    setErrorActivityLogs(null);
    hasInitialSnapshot.current = false;

    const logsRef = collection(db, 'activityLogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(100)); // Limit to last 100 logs

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logsList: ActivityLog[] = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Handle Firestore Timestamp conversion safely
          let timestamp: Date = new Date();
          if (data.timestamp) {
            if (data.timestamp instanceof Timestamp) {
              timestamp = data.timestamp.toDate();
            } else if (data.timestamp instanceof Date) {
              timestamp = data.timestamp;
            }
          }

          return {
            id: doc.id,
            message: data.message || '',
            userId: data.userId || null,
            userEmail: data.userEmail || 'Unknown',
            timestamp: timestamp,
          } as ActivityLog;
        });
        
        setActivityLogs(logsList);
        
        if (!hasInitialSnapshot.current) {
          hasInitialSnapshot.current = true;
          setLoadingActivityLogs(false);
        }
      },
      (error) => {
        console.error('Error in activity logs real-time listener:', error);
        setErrorActivityLogs('Failed to load activity logs');
        setError('Failed to load activity logs');
        toast.error('Failed to load activity logs');
        setLoadingActivityLogs(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [currentUser, setActivityLogs, setError]);

  // Manual refresh function (still available if needed)
  const fetchActivityLogs = useCallback(async () => {
    try {
      const logsList = await activityLogService.listActions();
      setActivityLogs(logsList);
    } catch (error: any) {
      console.error('Error loading activity logs:', error);
      setErrorActivityLogs('Failed to load activity logs');
      toast.error('Failed to load activity logs');
    }
  }, [setActivityLogs]);

  return {
    activityLogs,
    loadingActivityLogs,
    errorActivityLogs,
    fetchActivityLogs,
  };
};
