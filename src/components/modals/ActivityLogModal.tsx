import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X } from 'lucide-react';
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

interface ActivityLogModalProps {
  showActivityLogModal: boolean;
  setShowActivityLogModal: (show: boolean) => void;
  activityLogs: any[]; // Replace 'any' with a proper ActivityLogItem interface if available
}

const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  showActivityLogModal,
  setShowActivityLogModal,
  activityLogs,
}) => {
  const { isIOS } = useDeviceType(); // Use the hook

  if (!showActivityLogModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"> {/* Adjusted padding */}
      <Card className="w-full max-w-3xl max-h-[95vh] flex flex-col animate-scale-in shadow-glow">
        <div className="p-4 pb-3 sm:p-6 sm:pb-4 flex justify-between items-center border-b"> {/* Adjusted padding */}
          <h3 className="text-lg sm:text-xl font-semibold">Activity Log</h3> {/* Adjusted font size */}
          <Button
            onClick={() => setShowActivityLogModal(false)}
            variant="ghost"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4"> {/* Adjusted padding and spacing */}
          {activityLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">No activity recorded yet.</div> // Adjusted padding and font size
          ) : (
            <div className="space-y-2 sm:space-y-3"> {/* Adjusted spacing */}
              {activityLogs.map((log, index) => (
                <div key={log.id || index} className="p-3 border rounded-md bg-muted/20"> {/* Adjusted padding */}
                  <p className="text-sm font-medium">{log.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.userEmail} on {new Date(log.timestamp.toDate()).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 pt-3 sm:p-6 sm:pt-4 border-t flex justify-end"> {/* Adjusted padding */}
          <Button onClick={() => setShowActivityLogModal(false)} variant="outline" size={isIOS ? "sm" : "default"}> {/* Smaller button on iOS */}
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ActivityLogModal;