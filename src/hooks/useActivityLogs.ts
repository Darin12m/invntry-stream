import { useState, useEffect, useCallback, useContext } from 'react';
import { ActivityLog } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';

export const useActivityLogs = () => {
  const { activityLogs, setActivityLogs, setLoading, setError } = useContext(AppContext);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(true);
  const [errorActivityLogs, setErrorActivityLogs] = useState<string | null>(null);

  const fetchActivityLogs = useCallback(async () => {
    setLoadingActivityLogs(true);
    setErrorActivityLogs(null);
    try {
      const logsList = await activityLogService.listActions();
      setActivityLogs(logsList);
    } catch (error: any) {
      console.error('Error loading activity logs:', error);
      setErrorActivityLogs('Failed to load activity logs');
      setError('Failed to load activity logs');
      toast.error('Failed to load activity logs');
    } finally {
      setLoadingActivityLogs(false);
    }
  }, [setActivityLogs, setError]);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  return {
    activityLogs,
    loadingActivityLogs,
    errorActivityLogs,
    fetchActivityLogs,
  };
};