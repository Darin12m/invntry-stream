import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Trash2 } from 'lucide-react';

const SettingsPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center">
          <Settings className="h-7 w-7 mr-3" /> Settings
        </h2>
        <p className="text-muted-foreground mt-1">Manage application settings and data.</p>
      </div>

      <Card className="p-6 shadow-card space-y-4">
        <h3 className="text-xl font-semibold">Data Management</h3>
        <div className="space-y-2">
          <Link to="/settings/deleted-invoices">
            <Button variant="outline" className="w-full justify-start">
              <Trash2 className="h-4 w-4 mr-2" />
              Deleted Invoices
            </Button>
          </Link>
          {/* Add other settings links here */}
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;