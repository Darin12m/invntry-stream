import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Correct Firebase import path
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card"; // Import Card for styling

interface ActivityLogEntry {
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

interface ActivityLogProps {
  db: any; // Firebase Firestore instance
}

const ActivityLog: React.FC<ActivityLogProps> = ({ db }) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "activityLogs"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLogEntry)));
    });
    return () => unsub();
  }, [db]);

  return (
    <Card className="shadow-card mb-6">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Activity Log
        </h2>
      </div>

      <div className="p-6">
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent activity.</p>
        ) : (
          <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2"> {/* Added pr-2 for scrollbar spacing */}
            {logs.map((log) => (
              <li key={log.id} className="border-b border-border/50 pb-2 text-sm text-foreground last:border-b-0">
                <span className="font-medium">{log.user || "Unknown user"}</span>{" "}
                {log.action}{" "}
                <span className="font-semibold">{log.target}</span>
                {log.details ? <span> — {log.details}</span> : null}
                <div className="text-xs text-muted-foreground mt-1">
                  {log.timestamp?.toDate
                    ? log.timestamp.toDate().toLocaleString()
                    : ""}
                  {log.userEmail ? ` • ${log.userEmail}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default ActivityLog;