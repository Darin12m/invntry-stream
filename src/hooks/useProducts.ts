import { useState, useEffect, useCallback, useContext } from 'react';
import { Product, SortDirection } from '@/types';
import { productService } from '@/services/firestore/productService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { activityLogService } from '@/services/firestore/activityLogService';
import { db } from '@/firebase/config'; // Import db
import { doc, writeBatch } from 'firebase/firestore'; // Import doc and writeBatch

export const useProducts = () => {
  const { products, setProducts, currentUser, setLoading, setError } = useContext(AppContext);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorProducts, setErrorProducts] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'sku' | 'category' | 'quantity' | 'price' | 'onHand'>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    setErrorProducts(null);
    try {
      const productsList = await productService.list();
      setProducts(productsList);
    } catch (error: any) {
      console.error('Error loading products:', error);
      setErrorProducts('Failed to load products');
      setError('Failed to load products');
      toast.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  }, [setProducts, setError]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await productService.create(product, userEmail, userId);
      toast.success("Product added successfully");
      await fetchProducts();
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast.error(`Failed to add product: ${error.message}`);
      setError(`Failed to add product: ${error.message}`);
      throw error;
    }
  }, [currentUser, fetchProducts, setError]);

  const updateProduct = useCallback(async (id: string, product: Partial<Product>) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await productService.update(id, product, userEmail, userId);
      toast.success("Product updated successfully");
      await fetchProducts();
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(`Failed to update product: ${error.message}`);
      setError(`Failed to update product: ${error.message}`);
      throw error;
    }
  }, [currentUser, fetchProducts, setError]);

  const deleteProduct = useCallback(async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        await productService.delete(productId, userEmail, userId);
        toast.success("Product deleted successfully");
        await fetchProducts();
      } catch (error: any) {
        console.error('Error deleting product:', error);
        toast.error(`Failed to delete product: ${error.message}`);
        setError(`Failed to delete product: ${error.message}`);
      }
    }
  }, [currentUser, fetchProducts, setError]);

  const bulkDeleteProducts = useCallback(async (productIds: Set<string>) => {
    if (productIds.size === 0) {
      toast.error("Please select products to delete.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${productIds.size} selected product(s)? This action cannot be undone.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db); // Corrected: use writeBatch
        Array.from(productIds).forEach((productId) => {
          const productRef = doc(db, 'products', productId); // Corrected: import doc
          batch.delete(productRef);
        });
        await batch.commit();
        setSelectedProducts(new Set());
        toast.success(`${productIds.size} products deleted successfully`);
        await activityLogService.logAction(`Bulk products deleted by ${userEmail}`, userId, userEmail);
        await fetchProducts();
      } catch (error: any) {
        console.error('Error bulk deleting products:', error);
        toast.error(`Failed to delete selected products: ${error.message}`);
        setError(`Failed to delete selected products: ${error.message}`);
      }
    }
  }, [currentUser, fetchProducts, setError]);

  const deleteAllProducts = useCallback(async () => {
    if (products.length === 0) {
      toast.error("No products to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ALL ${products.length} products? This action cannot be undone.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db); // Corrected: use writeBatch
        products.forEach((product) => {
          const productRef = doc(db, 'products', product.id); // Corrected: import doc
          batch.delete(productRef);
        });
        await batch.commit();
        toast.success("All products deleted successfully");
        await activityLogService.logAction(`All products deleted by ${userEmail}`, userId, userEmail);
        await fetchProducts();
      } catch (error: any) {
        console.error('Error deleting all products:', error);
        toast.error(`Failed to delete all products: ${error.message}`);
        setError(`Failed to delete all products: ${error.message}`);
      }
    }
  }, [products, currentUser, fetchProducts, setError]);

  const handleSort = useCallback((column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProducts(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(productId)) {
        newSelected.delete(productId);
      } else {
        newSelected.add(productId);
      }
      return newSelected;
    });
  }, []);

  const selectAllProducts = useCallback((filteredProductIds: string[]) => {
    setSelectedProducts(prev => {
      if (prev.size === filteredProductIds.length && filteredProductIds.length > 0) {
        return new Set();
      } else {
        return new Set(filteredProductIds);
      }
    });
  }, []);

  const clearSelectedProducts = useCallback(() => {
    setSelectedProducts(new Set());
  }, []);

  return {
    products,
    loadingProducts,
    errorProducts,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    deleteAllProducts,
    sortColumn,
    sortDirection,
    handleSort,
    selectedProducts,
    toggleProductSelection,
    selectAllProducts,
    clearSelectedProducts,
  };
};