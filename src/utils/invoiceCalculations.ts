import { InvoiceItem } from '@/types';

export const calculateInvoiceTotals = (items: InvoiceItem[], globalDiscountPercentage: number) => {
  let subtotal = 0;
  items.forEach(item => {
    const itemSubtotal = item.price * item.quantity;
    const itemDiscountAmount = itemSubtotal * ((item.discount || 0) / 100);
    subtotal += (itemSubtotal - itemDiscountAmount);
  });

  const globalDiscountAmount = subtotal * (globalDiscountPercentage / 100);
  const total = subtotal - globalDiscountAmount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(globalDiscountAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};