import React, { useContext, useState, useCallback } from 'react';
import { Package, FileText, BarChart3, Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { AppContext } from '@/context/AppContext';
import InventoryTab from '@/components/inventory/InventoryTab';
import InvoicesTab from '@/components/invoices/InvoicesTab';
import DashboardTab from '@/components/dashboard/DashboardTab';
import SettingsPage from '@/pages/SettingsPage';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useDeviceType } from '@/hooks/useDeviceType';

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
  const { products, invoices, loading, error } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'inventory' | 'invoices' | 'dashboard' | 'settings'>('inventory');
  const { metrics, dateFilter, setDateFilter, calculateDashboardMetrics } = useDashboardMetrics(products, invoices);
  const { isIOS, isMobile } = useDeviceType();

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
    <div className="min-h-screen bg-gradient-surface overflow-x-hidden max-w-full w-full">
      {/* Navigation */}
      <nav 
        className="bg-card/95 backdrop-blur-md shadow-sm border-b border-border/50 sticky top-0 z-40 w-full max-w-full overflow-hidden"
        style={isIOS ? { paddingTop: 'env(safe-area-inset-top)' } : {}}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo/Title */}
            <div className="flex items-center flex-shrink-0">
              <div className="bg-gradient-primary p-2 rounded-xl shadow-sm">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <span className="ml-2.5 sm:ml-3 text-base sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                WeParty Inventory
              </span>
            </div>

            {/* Navigation icons - compact on mobile, with labels on desktop */}
            <div className="flex items-center gap-px lg:gap-4"> {/* Responsive gap: 1px on mobile, 16px on lg and up */}
              {navItems.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`relative flex items-center justify-center p-2.5 sm:px-3 sm:py-2 rounded-xl transition-all duration-200 ${
                    activeTab === key
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  aria-label={key}
                >
                  <Icon className={`h-[35px] w-[35px] lg:h-7 lg:w-7 ${!isMobile ? 'lg:mr-2' : ''}`} /> {/* Responsive icon size: 35px on mobile, 28px on lg and up */}
                  {!isMobile && (
                    <span className="hidden lg:inline text-sm font-medium capitalize">{key}</span>
                  )}
                  {activeTab === key && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full sm:hidden" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-4 px-3 sm:py-6 sm:px-4 lg:px-8 w-full overflow-x-hidden">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default AppLayout;