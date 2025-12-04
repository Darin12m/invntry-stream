import React, { useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, FileText, BarChart3, LogOut, Settings, Menu, X, User as UserIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppContext } from '@/context/AppContext';
import { useAuth } from '@/hooks/useAuth';
import InventoryTab from '@/components/inventory/InventoryTab';
import InvoicesTab from '@/components/invoices/InvoicesTab';
import DashboardTab from '@/components/dashboard/DashboardTab';
import SettingsPage from '@/pages/SettingsPage';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useDeviceType } from '@/hooks/useDeviceType'; // Import the new hook

interface NavItem {
  key: 'inventory' | 'invoices' | 'dashboard' | 'settings';
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings }
];

const AppLayout: React.FC = () => {
  const { currentUser, products, invoices, activityLogs, settings, loading, error } = useContext(AppContext);
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'invoices' | 'dashboard' | 'settings'>('inventory');
  const { metrics, dateFilter, setDateFilter, calculateDashboardMetrics } = useDashboardMetrics(products, invoices);
  const { isIOS, screenCategory } = useDeviceType(); // Use the new hook

  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'inventory':
        return <InventoryTab />;
      case 'invoices':
        return <InvoicesTab />;
      case 'dashboard':
        return (
          <DashboardTab
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            metrics={metrics}
            calculateDashboardMetrics={calculateDashboardMetrics}
            products={products} // Pass products for local invoice cost calculation
          />
        );
      case 'settings':
        return <SettingsPage />;
      default:
        return <InventoryTab />;
    }
  }, [activeTab, dateFilter, setDateFilter, metrics, calculateDashboardMetrics, products]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading application data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-destructive/10 text-destructive p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Application Error</h1>
          <p className="mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">Reload App</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Navigation */}
      <nav 
        className="bg-card/80 backdrop-blur-sm shadow-elegant border-b sticky top-0 z-40"
        style={isIOS ? { paddingTop: 'env(safe-area-inset-top)' } : {}} // Apply safe area padding for iOS
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center flex-shrink-0"> {/* Added flex-shrink-0 to logo/title */}
              <div className="bg-gradient-primary p-2 rounded-lg">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="ml-3 text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">WeParty Inventory</span>
            </div>

            {/* Navigation items container */}
            {/* On mobile, this will be scrollable. On desktop, it will be a normal flex container. */}
            <div className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap scrolling-touch hide-scrollbar md:flex-none md:overflow-visible md:whitespace-normal">
              <div className="inline-flex space-x-4 sm:space-x-8"> {/* Use inline-flex to allow overflow within whitespace-nowrap */}
                {navItems.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex-shrink-0 inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-300 ${ // Added flex-shrink-0
                      activeTab === key
                        ? 'text-primary border-b-2 border-primary shadow-glow'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-4 px-2 sm:py-8 sm:px-4 lg:px-8"> {/* Adjusted padding for responsiveness */}
        {renderTabContent()}
      </main>
    </div>
  );
};

export default AppLayout;