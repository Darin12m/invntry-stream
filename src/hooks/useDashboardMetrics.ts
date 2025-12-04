import { useState, useEffect, useCallback, useContext } from 'react';
import { DashboardMetrics, Invoice, Product } from '@/types';
import { dashboardService } from '@/services/firestore/dashboardService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';

export const useDashboardMetrics = (products: Product[], invoices: Invoice[]) => {
  const { setLoading, setError } = useContext(AppContext);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSales: 0,
    totalCosts: 0,
    totalProfit: 0,
    numberOfInvoices: 0,
    totalNegativeQuantity: 0,
    totalNegativeValue: 0,
    filteredInvoices: [],
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [errorMetrics, setErrorMetrics] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState({ 
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    to: new Date().toISOString().split('T')[0] // Today
  });

  const calculateDashboardMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    setErrorMetrics(null);
    try {
      const fetchedMetrics = await dashboardService.getMetrics(dateFilter.from, dateFilter.to);
      const { invoices: filteredInvoices } = await dashboardService.getInvoiceTable(dateFilter.from, dateFilter.to);
      
      setMetrics({
        ...fetchedMetrics,
        filteredInvoices: filteredInvoices.filter(invoice => !invoice.deletedAt), // Only show active invoices
      });
    } catch (error: any) {
      console.error('Error calculating dashboard metrics:', error);
      setErrorMetrics('Failed to load dashboard metrics.');
      setError('Failed to load dashboard metrics.');
      toast.error('Failed to load dashboard metrics.');
      setMetrics({
        totalSales: 0,
        totalCosts: 0,
        totalProfit: 0,
        numberOfInvoices: 0,
        totalNegativeQuantity: 0,
        totalNegativeValue: 0,
        filteredInvoices: [],
      });
    } finally {
      setLoadingMetrics(false);
    }
  }, [dateFilter, setError]); // Recalculate only when dateFilter changes

  useEffect(() => {
    calculateDashboardMetrics();
  }, [dateFilter, products, invoices, calculateDashboardMetrics]); // Re-fetch when date filter, products, or invoices change

  return {
    metrics,
    loadingMetrics,
    errorMetrics,
    dateFilter,
    setDateFilter,
    calculateDashboardMetrics,
  };
};