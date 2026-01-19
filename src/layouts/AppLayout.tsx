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
            products={products}
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Package className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground font-medium">Loading application data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-destructive/5 p-4">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Package className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Application Error</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">Reload App</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden max-w-full w-full">
      {/* Glassmorphism Navigation */}
      <nav 
        className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40 w-full max-w-full overflow-hidden"
        style={isIOS ? { paddingTop: 'env(safe-area-inset-top)' } : {}}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Title */}
            <div className="flex items-center flex-shrink-0">
              <div className="p-2.5 rounded-2xl bg-primary shadow-lg shadow-primary/25">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="ml-3 text-xl font-black tracking-tighter text-foreground">
                WeParty
              </span>
            </div>

            {/* Navigation - Pill style buttons */}
            <div className="flex items-center gap-1">
              {navItems.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`relative flex items-center justify-center px-3 py-2 sm:px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === key
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  aria-label={label}
                >
                  <Icon className={`h-5 w-5 ${!isMobile ? 'sm:mr-2' : ''}`} />
                  {!isMobile && (
                    <span className="hidden sm:inline">{label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full overflow-x-hidden">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default AppLayout;