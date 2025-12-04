import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

const ConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const { isIOS } = useDeviceType(); // Use the hook

  return (
    <div 
      className="bg-gradient-surface p-2 sm:p-4 lg:p-8 animate-fade-in"
      style={isIOS ? { minHeight: 'calc(var(--vh, 1vh) * 100)' } : { minHeight: '100vh' }} // Apply custom vh for iOS
    >
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6"> {/* Adjusted spacing */}
        <div className="flex items-center justify-between mb-4 sm:mb-6"> {/* Adjusted spacing */}
          <Button onClick={() => navigate('/settings')} variant="outline" size={isIOS ? "sm" : "default"}> {/* Smaller button on iOS */}
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Settings
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Console</h1> {/* Adjusted font size */}
        </div>

        <Card className="shadow-card p-4 sm:p-6 space-y-3 sm:space-y-4 text-center"> {/* Adjusted padding and spacing */}
          <CardTitle className="text-xl sm:text-2xl font-semibold flex items-center justify-center gap-1 sm:gap-2"> {/* Adjusted font size and gap */}
            <Info className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" /> Math Test Functionality Removed
          </CardTitle>
          <CardContent className="p-0">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4"> {/* Adjusted font size and spacing */}
              The invoice math stress test functionality, including its button, alerts, and console logs, has been safely removed from this page as requested.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground"> {/* Adjusted font size */}
              This page can now be repurposed or removed if no longer needed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsolePage;