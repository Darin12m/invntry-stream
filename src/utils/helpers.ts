import { Product } from '@/types';

export const getStockStatus = (quantity: number) => {
  if (quantity === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
  if (quantity < 10) return { label: 'Low', variant: 'warning' as const };
  if (quantity < 30) return { label: 'Medium', variant: 'secondary' as const };
  return { label: 'In Stock', variant: 'default' as const };
};