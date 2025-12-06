import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { DashboardMetrics, Invoice, Product } from '@/types';
import { AppContext } from '@/context/AppContext';

export const useDashboardMetrics = (products: Product[], invoices: Invoice[]) => {
  const { setError } = useContext(AppContext);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [errorMetrics, setErrorMetrics] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState({ 
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    to: new Date().toISOString().split('T')[0] // Today
  });

  // Compute metrics live from products and invoices (real-time from context)
  const metrics = useMemo<DashboardMetrics>(() => {
    try {
      // Filter invoices by date range and exclude deleted
      const filteredInvoices = invoices.filter(invoice => {
        if (invoice.deletedAt) return false;
        
        const invoiceDate = invoice.date || '';
        const fromDate = dateFilter.from;
        const toDate = dateFilter.to;
        
        return invoiceDate >= fromDate && invoiceDate <= toDate;
      });

      // Calculate totals from filtered invoices
      let totalSales = 0;
      let totalCosts = 0;
      let totalProfit = 0;

      filteredInvoices.forEach(invoice => {
        if (invoice.invoiceType === 'sale') {
          const invoiceTotal = invoice.total ?? 0;
          totalSales += invoiceTotal;

          // Calculate costs for this invoice
          let invoiceCost = 0;
          (invoice.items || []).forEach(item => {
            const quantity = item.quantity ?? 0;
            const purchasePrice = item.purchasePrice ?? 0;
            invoiceCost += quantity * purchasePrice;
          });
          totalCosts += invoiceCost;
          totalProfit += invoiceTotal - invoiceCost;
        } else if (invoice.invoiceType === 'return') {
          const invoiceTotal = invoice.total ?? 0;
          totalSales -= invoiceTotal;

          let invoiceCost = 0;
          (invoice.items || []).forEach(item => {
            const quantity = item.quantity ?? 0;
            const purchasePrice = item.purchasePrice ?? 0;
            invoiceCost += quantity * purchasePrice;
          });
          totalCosts -= invoiceCost;
          totalProfit -= invoiceTotal - invoiceCost;
        }
        // gifted-damaged doesn't affect sales/profit calculations
      });

      // Calculate negative stock values
      let totalNegativeQuantity = 0;
      let totalNegativeValue = 0;

      products.forEach(product => {
        const onHand = product.onHand ?? 0;
        if (onHand < 0) {
          totalNegativeQuantity += Math.abs(onHand);
          totalNegativeValue += Math.abs(onHand) * (product.price ?? 0);
        }
      });

      return {
        totalSales,
        totalCosts,
        totalProfit,
        numberOfInvoices: filteredInvoices.length,
        totalNegativeQuantity,
        totalNegativeValue,
        filteredInvoices,
      };
    } catch (error: any) {
      console.error('Error calculating dashboard metrics:', error);
      setErrorMetrics('Failed to calculate dashboard metrics.');
      return {
        totalSales: 0,
        totalCosts: 0,
        totalProfit: 0,
        numberOfInvoices: 0,
        totalNegativeQuantity: 0,
        totalNegativeValue: 0,
        filteredInvoices: [],
      };
    }
  }, [invoices, products, dateFilter]);

  // Manual recalculation function (mostly a no-op now since metrics are computed reactively)
  const calculateDashboardMetrics = useCallback(async () => {
    // Metrics are now computed reactively via useMemo
    // This function exists for compatibility
  }, []);

  return {
    metrics,
    loadingMetrics,
    errorMetrics,
    dateFilter,
    setDateFilter,
    calculateDashboardMetrics,
  };
};
