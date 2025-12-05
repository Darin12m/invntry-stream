import React, { useContext, useMemo } from 'react';
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, FileText, TrendingDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Invoice, Product, DashboardMetrics } from '@/types';
import { AppContext } from '@/context/AppContext';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useInvoices } from '@/hooks/useInvoices'; // Import useInvoices to get handleViewInvoice
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

interface DashboardTabProps {
  dateFilter: { from: string; to: string };
  setDateFilter: (filter: { from: string; to: string }) => void;
  metrics: DashboardMetrics;
  calculateDashboardMetrics: () => Promise<void>;
  products: Product[]; // Needed for calculating invoice costs
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  dateFilter,
  setDateFilter,
  metrics,
  calculateDashboardMetrics,
  products,
}) => {
  const { loading, settings } = useContext(AppContext);
  const { handleViewInvoice } = useInvoices();
  const { isIOS } = useDeviceType();
  const currency = settings?.currency || 'MKD';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-base sm:text-lg">Loading dashboard...</p> {/* Adjusted font size */}
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Dashboard</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Sales performance and profit analysis</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="p-3 sm:p-4 shadow-card">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
          <Label className="whitespace-nowrap text-sm sm:text-base">Date Range:</Label>
          <div className="flex gap-1 sm:gap-2 items-center flex-wrap">
            <Input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
              className="w-auto text-sm sm:text-base"
            />
            <span className="text-muted-foreground text-sm sm:text-base">to</span>
            <Input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
              className="w-auto text-sm sm:text-base"
            />
          </div>
          <Button 
            onClick={() => setDateFilter({ 
              from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], 
              to: new Date().toISOString().split('T')[0] 
            })}
            variant="outline"
            size={isIOS ? "sm" : "default"}
          >
            Reset to Year
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6 shadow-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400">Total Sales</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-100">{metrics.totalSales.toFixed(2)} {currency}</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-500 rounded-full">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 shadow-card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">Total Costs</p>
              <p className="text-xl sm:text-2xl font-bold text-red-900 dark:text-red-100">{metrics.totalCosts.toFixed(2)} {currency}</p>
            </div>
            <div className="p-2 sm:p-3 bg-red-500 rounded-full">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 shadow-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">Total Profit</p>
              <p className="text-xl sm:text-2xl font-bold text-green-900 dark:text-green-100">{metrics.totalProfit.toFixed(2)} {currency}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-500 rounded-full">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 shadow-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400">Invoices</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-900 dark:text-purple-100">{metrics.numberOfInvoices}</p>
            </div>
            <div className="p-2 sm:p-3 bg-purple-500 rounded-full">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 shadow-card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400">Negative Items</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-900 dark:text-orange-100">{metrics.totalNegativeQuantity}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Returns/Damaged/Free</p>
            </div>
            <div className="p-2 sm:p-3 bg-orange-500 rounded-full">
              <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 shadow-card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400">Negative Value</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-amber-100">{metrics.totalNegativeValue.toFixed(2)} {currency}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Total lost/returned value</p>
            </div>
            <div className="p-2 sm:p-3 bg-amber-500 rounded-full">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Invoice Table */}
      <Card className="shadow-card">
        <div className="p-4 sm:p-6 border-b">
          <h3 className="text-lg sm:text-xl font-semibold">Invoice Details</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {metrics.filteredInvoices.length} invoices from {new Date(dateFilter.from).toLocaleDateString()} to {new Date(dateFilter.to).toLocaleDateString()}
          </p>
        </div>
        <div className="overflow-x-auto">
          {metrics.filteredInvoices.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <BarChart3 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
              <h3 className="text-lg sm:text-xl font-semibold mb-2">No invoices in selected period</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">Adjust the date range to see data</p>
            </div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-2 sm:p-4 font-medium text-xs sm:text-sm">Invoice #</th>
                  <th className="text-left p-2 sm:p-4 font-medium text-xs sm:text-sm">Date</th>
                  <th className="text-left p-2 sm:p-4 font-medium text-xs sm:text-sm">Customer</th>
                  <th className="text-right p-2 sm:p-4 font-medium text-xs sm:text-sm">Sales</th>
                  <th className="text-right p-2 sm:p-4 font-medium text-xs sm:text-sm">Costs</th>
                  <th className="text-right p-2 sm:p-4 font-medium text-xs sm:text-sm">Profit</th>
                  <th className="text-center p-2 sm:p-4 font-medium text-xs sm:text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {metrics.filteredInvoices.map(invoice => {
                  let invoiceCosts = 0;
                  invoice.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    const purchasePrice = product?.purchasePrice || item.purchasePrice || 0;
                    invoiceCosts += purchasePrice * item.quantity;
                  });
                  const invoiceProfit = invoice.total - invoiceCosts;
                  
                  return (
                    <tr key={invoice.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">{invoice.number}</td> {/* Adjusted padding and font size */}
                      <td className="p-2 sm:p-4 text-muted-foreground text-xs sm:text-sm">{new Date(invoice.date).toLocaleDateString()}</td> {/* Adjusted padding and font size */}
                      <td className="p-2 sm:p-4 text-xs sm:text-sm">{invoice.customer.name}</td> {/* Adjusted padding and font size */}
                      <td className="p-2 sm:p-4 text-right font-medium text-blue-600 text-xs sm:text-sm">{invoice.total.toFixed(2)} {currency}</td> {/* Adjusted padding and font size */}
                      <td className="p-2 sm:p-4 text-right font-medium text-red-600 text-xs sm:text-sm">{invoiceCosts.toFixed(2)} {currency}</td> {/* Adjusted padding and font size */}
                      <td className={`p-2 sm:p-4 text-right font-medium text-xs sm:text-sm ${invoiceProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}> {/* Adjusted padding and font size */}
                        {invoiceProfit.toFixed(2)} {currency}
                      </td>
                      <td className="p-2 sm:p-4 text-center"> {/* Adjusted padding */}
                        <Button
                          onClick={() => handleViewInvoice(invoice)}
                          variant="outline"
                          size="sm"
                        >
                          <FileText className="h-3 w-3 sm:h-4 sm:w-4" /> {/* Adjusted icon size */}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DashboardTab;