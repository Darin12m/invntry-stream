import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Corrected Firebase import path
import { Clock, X } from 'lucide-react'; // Added X icon for close button
import { Button } from '@/components/ui/button'; // Using shadcn Button
import { Card } from '@/components/ui/card'; // Using shadcn Card

interface ActivityLogEntry extends DocumentData {
  id: string;
  action: string;
  target: string;
  details?: string;
  user?: string;
  userEmail?: string;
  timestamp?: {
    toDate: () => Date;
  };
}

interface ActivityLogModalProps {
  onClose: () => void;
}

export default function ActivityLogModal({ onClose }: ActivityLogModalProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function loadLogs(isInitial = false) {
    setLoading(true);
    try {
      const baseQuery = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        ...(isInitial || !lastDoc ? [limit(25)] : [startAfter(lastDoc), limit(25)])
      );

      const snap = await getDocs(baseQuery);
      const newLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ActivityLogEntry[];
      setLogs((prev) => (isInitial ? newLogs : [...prev, ...newLogs]));

      const lastVisible = snap.docs[snap.docs.length - 1];
      setLastDoc(lastVisible || null);
      setHasMore(snap.docs.length === 25);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs(true);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in shadow-glow">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Activity Log
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {logs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}

          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="border-b border-border/50 pb-2 text-sm text-foreground last:border-b-0"
              >
                <span className="font-medium">{log.user || 'Unknown user'}</span>{' '}
                {log.action}{' '}
                <span className="font-semibold">{log.target}</span>
                {log.details ? <span> — {log.details}</span> : null}
                <div className="text-xs text-muted-foreground mt-1">
                  {log.timestamp?.toDate
                    ? log.timestamp.toDate().toLocaleString()
                    : ''}
                </div>
              </li>
            ))}
          </ul>

          {loading && (
            <p className="text-sm text-muted-foreground mt-3 text-center">Loading...</p>
          )}

          {!loading && hasMore && (
            <div className="flex justify-center mt-4">
              <Button
                onClick={() => loadLogs(false)}
                variant="outline"
                size="sm"
                className="text-indigo-500 hover:text-indigo-600"
              >
                Load More <Clock className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}