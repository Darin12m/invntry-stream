import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronUp, ChevronDown, X } from 'lucide-react';

const DebugConsole: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const refreshLogs = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).__debugLogs) {
      setLogs([...(window as any).__debugLogs]);
    }
  }, []);

  useEffect(() => {
    refreshLogs(); // Load initial logs
    window.addEventListener("debug-log", refreshLogs);
    return () => {
      window.removeEventListener("debug-log", refreshLogs);
    };
  }, [refreshLogs]);

  useEffect(() => {
    // Auto-scroll to bottom on new logs
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  if (window.location.hostname === "production") {
    return null; // Only show in non-production environments
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="bg-gray-900 text-white shadow-lg border-gray-700">
        <div className="flex justify-between items-center p-2 border-b border-gray-700">
          <h3 className="text-sm font-semibold">Debug Console</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              className="h-7 w-7 text-gray-400 hover:bg-gray-700 hover:text-white"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(false);
                setLogs([]);
                if (typeof window !== 'undefined') {
                  (window as any).__debugLogs = [];
                }
              }}
              className="h-7 w-7 text-gray-400 hover:bg-gray-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isOpen && (
          <div
            ref={logContainerRef}
            className="p-2 text-xs font-mono overflow-y-auto max-h-[40vh] w-80 sm:w-96"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {logs.length === 0 ? (
              <p className="text-gray-500">No debug logs yet.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1 last:mb-0 border-b border-gray-800 pb-1 last:border-b-0">
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default DebugConsole;