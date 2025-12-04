import { db } from '@/firebase/config';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Invoice, Product, DashboardMetrics } from '@/types';

export const dashboardService = {
  getMetrics: async (fromDate: string, toDate: string): Promise<Omit<DashboardMetrics, 'filteredInvoices'>> => {
    const invoicesCol = collection(db, 'invoices');
    const q = query(
      invoicesCol,
      where('date', '>=', fromDate),
      where('date', '<=', toDate)
    );
    const invoiceSnapshot = await getDocs(q);
    const invoices = invoiceSnapshot.docs.map(doc => doc.data() as Invoice);

    const productsSnapshot = await getDocs(collection(db, 'products'));
    const productsMap = new Map(productsSnapshot.docs.map(doc => [doc.id, doc.data() as Product]));

    let totalSales = 0;
    let totalCosts = 0;
    let totalProfit = 0;
    let totalNegativeQuantity = 0;
    let totalNegativeValue = 0;

    invoices.forEach(invoice => {
      if (!invoice.deletedAt) { // Only count active invoices for dashboard metrics
        totalSales += invoice.total || 0;

        invoice.items.forEach((item: any) => {
          const product = productsMap.get(item.productId);
          const purchasePrice = product?.purchasePrice || item.purchasePrice || 0;
          totalCosts += purchasePrice * item.quantity;

          if (item.quantity < 0) {
            totalNegativeQuantity += Math.abs(item.quantity);
            totalNegativeValue += Math.abs(item.price * item.quantity);
          }
        });
      }
    });

    totalProfit = totalSales - totalCosts;
    const numberOfInvoices = invoices.filter(inv => !inv.deletedAt).length; // Count only active invoices

    return {
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalCosts: parseFloat(totalCosts.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      numberOfInvoices,
      totalNegativeQuantity,
      totalNegativeValue: parseFloat(totalNegativeValue.toFixed(2)),
    };
  },

  getInvoiceTable: async (fromDate: string, toDate: string): Promise<{ invoices: Invoice[] }> => {
    const invoicesCol = collection(db, 'invoices');
    const q = query(
      invoicesCol,
      where('date', '>=', fromDate),
      where('date', '<=', toDate),
      orderBy('date', 'desc')
    );
    const invoiceSnapshot = await getDocs(q);
    const invoices = invoiceSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt,
      } as Invoice;
    });

    const productsSnapshot = await getDocs(collection(db, 'products'));
    const productsMap = new Map(productsSnapshot.docs.map(doc => [doc.id, doc.data() as Product]));

    const invoicesWithCosts = invoices.map(invoice => {
      let invoiceCosts = 0;
      invoice.items.forEach((item: any) => {
        const product = productsMap.get(item.productId);
        const purchasePrice = product?.purchasePrice || item.purchasePrice || 0;
        invoiceCosts += purchasePrice * item.quantity;
      });
      const invoiceProfit = invoice.total - invoiceCosts;

      return {
        ...invoice,
        invoiceCosts: parseFloat(invoiceCosts.toFixed(2)),
        invoiceProfit: parseFloat(invoiceProfit.toFixed(2)),
      };
    });

    return { invoices: invoicesWithCosts };
  },
};