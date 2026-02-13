import React, { useContext, useMemo, useState } from 'react';
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, FileText, TrendingDown, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Invoice, Product, DashboardMetrics } from '@/types';
import { AppContext } from '@/context/AppContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import InvoiceViewerModal from '@/components/modals/InvoiceViewerModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';

interface DashboardTabProps {
  dateFilter: { from: string; to: string };
  setDateFilter: (filter: { from: string; to: string }) => void;
  metrics: DashboardMetrics;
  calculateDashboardMetrics: () => Promise<void>;
  products: Product[];
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  dateFilter,
  setDateFilter,
  metrics,
  calculateDashboardMetrics,
  products,
}) => {
  const { loading, settings } = useContext(AppContext);
  const { isIOS } = useDeviceType();
  const currency = settings?.currency || 'MKD';
  
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const [sortColumn, setSortColumn] = useState<'number' | 'date' | 'customer' | 'sales' | 'costs' | 'profit'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowInvoiceViewer(true);
  };

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedInvoices = useMemo(() => {
    const sortableInvoices = [...metrics.filteredInvoices].map(invoice => {
      let invoiceCosts = 0;
      invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const purchasePrice = product?.purchasePrice || item.purchasePrice || 0;
        invoiceCosts += purchasePrice * item.quantity;
      });
      const invoiceProfit = invoice.total - invoiceCosts;
      return { ...invoice, invoiceCosts, invoiceProfit };
    });

    return sortableInvoices.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'number':
          aValue = parseInt(a.number.split('/')[0], 10);
          bValue = parseInt(b.number.split('/')[0], 10);
          break;
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'customer':
          aValue = a.customer.name.toLowerCase();
          bValue = b.customer.name.toLowerCase();
          break;
        case 'sales':
          aValue = a.total;
          bValue = b.total;
          break;
        case 'costs':
          aValue = a.invoiceCosts;
          bValue = b.invoiceCosts;
          break;
        case 'profit':
          aValue = a.invoiceProfit;
          bValue = b.invoiceProfit;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [metrics.filteredInvoices, products, sortColumn, sortDirection]);


  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header - Swiss Bold Typography */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Sales performance and profit analysis</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">Date Range</Label>
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
              className="w-auto"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
              className="w-auto"
            />
          </div>
          <Button 
            onClick={() => setDateFilter({ 
              from: new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0], 
              to: new Date().toISOString().split('T')[0] 
            })}
            variant="outline"
            size="sm"
          >
            Reset to Year
          </Button>
        </div>
      </Card>

      {/* Summary Cards - Clean Neo-SaaS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Sales */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Total Sales</p>
              <p className="text-2xl font-black tracking-tight text-foreground">{metrics.totalSales.toFixed(2)} {currency}</p>
            </div>
          </div>
        </Card>

        {/* Total Costs */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-destructive/10">
              <ShoppingCart className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Total Costs</p>
              <p className="text-2xl font-black tracking-tight text-foreground">{metrics.totalCosts.toFixed(2)} {currency}</p>
            </div>
          </div>
        </Card>

        {/* Total Profit */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-success/10">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Total Profit</p>
              <p className="text-2xl font-black tracking-tight text-foreground">{metrics.totalProfit.toFixed(2)} {currency}</p>
            </div>
          </div>
        </Card>

        {/* Invoices */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Invoices</p>
              <p className="text-2xl font-black tracking-tight text-foreground">{metrics.numberOfInvoices}</p>
            </div>
          </div>
        </Card>

        {/* Negative Items */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-warning/10">
              <TrendingDown className="h-6 w-6 text-warning-foreground" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Negative Items</p>
              <p className="text-2xl font-black tracking-tight text-foreground">{metrics.totalNegativeQuantity}</p>
              <p className="text-xs text-muted-foreground">Returns/Damaged/Free</p>
            </div>
          </div>
        </Card>

        {/* Negative Value */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-warning/10">
              <DollarSign className="h-6 w-6 text-warning-foreground" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Negative Value</p>
              <p className="text-2xl font-black tracking-tight text-foreground">{metrics.totalNegativeValue.toFixed(2)} {currency}</p>
              <p className="text-xs text-muted-foreground">Total lost/returned value</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Invoice Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-border/50">
          <h3 className="text-lg font-bold tracking-tight text-foreground">Invoice Details</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {metrics.filteredInvoices.length} invoices from {new Date(dateFilter.from).toLocaleDateString()} to {new Date(dateFilter.to).toLocaleDateString()}
          </p>
        </div>
        <div className="overflow-x-auto">
          {metrics.filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold mb-2">No invoices in selected period</h3>
              <p className="text-muted-foreground mb-4">Adjust the date range to see data</p>
            </div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4">
                    <button
                      onClick={() => handleSort('number')}
                      className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      Invoice #
                      {sortColumn === 'number' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      Date
                      {sortColumn === 'date' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4">
                    <button
                      onClick={() => handleSort('customer')}
                      className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      Customer
                      {sortColumn === 'customer' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="text-right p-4">
                    <button
                      onClick={() => handleSort('sales')}
                      className="flex items-center justify-end gap-1 w-full text-[11px] uppercase tracking-widest text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      Sales
                      {sortColumn === 'sales' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="text-right p-4">
                    <button
                      onClick={() => handleSort('costs')}
                      className="flex items-center justify-end gap-1 w-full text-[11px] uppercase tracking-widest text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      Costs
                      {sortColumn === 'costs' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="text-right p-4">
                    <button
                      onClick={() => handleSort('profit')}
                      className="flex items-center justify-end gap-1 w-full text-[11px] uppercase tracking-widest text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      Profit
                      {sortColumn === 'profit' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="text-center p-4 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map(invoice => (
                  <tr key={invoice.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium text-sm">{invoice.number}</td>
                    <td className="p-4 text-muted-foreground text-sm">{new Date(invoice.date).toLocaleDateString()}</td>
                    <td className="p-4 text-sm">{invoice.customer.name}</td>
                    <td className="p-4 text-right font-medium text-primary text-sm">{invoice.total.toFixed(2)} {currency}</td>
                    <td className="p-4 text-right font-medium text-destructive text-sm">{invoice.invoiceCosts.toFixed(2)} {currency}</td>
                    <td className={`p-4 text-right font-medium text-sm ${invoice.invoiceProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {invoice.invoiceProfit.toFixed(2)} {currency}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        onClick={() => handleViewInvoice(invoice)}
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Invoice Viewer Modal */}
      <InvoiceViewerModal
        showInvoiceViewer={showInvoiceViewer}
        setShowInvoiceViewer={setShowInvoiceViewer}
        viewingInvoice={viewingInvoice}
        Capacitor={Capacitor}
        html2canvas={html2canvas}
        jsPDF={jsPDF}
      />
    </div>
  );
};

export default DashboardTab;