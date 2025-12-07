import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { Product, SortDirection } from '@/types';
import { productService } from '@/services/firestore/productService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { activityLogService } from '@/services/firestore/activityLogService';
import { db } from '@/firebase/config';
import { doc, writeBatch, collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export const useProducts = () => {
  const { products, setProducts, currentUser, setError } = useContext(AppContext);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorProducts, setErrorProducts] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'sku' | 'category' | 'quantity' | 'price' | 'onHand'>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // Track if we've received the first snapshot
  const hasInitialSnapshot = useRef(false);

  // Real-time listener for products
  useEffect(() => {
    if (!currentUser) {
      setLoadingProducts(false);
      return;
    }

    setLoadingProducts(true);
    setErrorProducts(null);
    hasInitialSnapshot.current = false;

    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const productsList: Product[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            sku: data.sku || '',
            quantity: data.quantity ?? 0,
            onHand: data.onHand ?? 0,
            price: data.price ?? 0,
            category: data.category || '',
            purchasePrice: data.purchasePrice ?? 0,
            shortDescription: data.shortDescription || '',
            initialStock: data.initialStock ?? 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as Product;
        });

        // Sort alphabetically by name
        productsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        setProducts(productsList);
        
        if (!hasInitialSnapshot.current) {
          hasInitialSnapshot.current = true;
          setLoadingProducts(false);
        }
      },
      (error) => {
        console.error('Error in products real-time listener:', error);
        setErrorProducts('Failed to load products');
        setError('Failed to load products');
        toast.error('Failed to load products');
        setLoadingProducts(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [currentUser, setProducts, setError]);

  const addProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await productService.create(product, userEmail, userId);
      toast.success("Product added successfully");
      // No need to fetch - real-time listener will update
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast.error(`Failed to add product: ${error.message}`);
      setError(`Failed to add product: ${error.message}`);
      throw error;
    }
  }, [currentUser, setError]);

  const updateProduct = useCallback(async (id: string, product: Partial<Product>) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await productService.update(id, product, userEmail, userId);
      toast.success("Product updated successfully");
      // No need to fetch - real-time listener will update
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(`Failed to update product: ${error.message}`);
      setError(`Failed to update product: ${error.message}`);
      throw error;
    }
  }, [currentUser, setError]);

  const deleteProduct = useCallback(async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        await productService.delete(productId, userEmail, userId);
        toast.success("Product deleted successfully");
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error deleting product:', error);
        toast.error(`Failed to delete product: ${error.message}`);
        setError(`Failed to delete product: ${error.message}`);
      }
    }
  }, [currentUser, setError]);

  const bulkDeleteProducts = useCallback(async (productIds: Set<string>) => {
    if (productIds.size === 0) {
      toast.error("Please select products to delete.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${productIds.size} selected product(s)? This action cannot be undone.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db);
        Array.from(productIds).forEach((productId) => {
          const productRef = doc(db, 'products', productId);
          batch.delete(productRef);
        });
        await batch.commit();
        setSelectedProducts(new Set());
        toast.success(`${productIds.size} products deleted successfully`);
        await activityLogService.logAction(`Bulk products deleted by ${userEmail}`, userId, userEmail);
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error bulk deleting products:', error);
        toast.error(`Failed to delete selected products: ${error.message}`);
        setError(`Failed to delete selected products: ${error.message}`);
      }
    }
  }, [currentUser, setError]);

  const deleteAllProducts = useCallback(async () => {
    if (products.length === 0) {
      toast.error("No products to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ALL ${products.length} products? This action cannot be undone.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db);
        products.forEach((product) => {
          const productRef = doc(db, 'products', product.id);
          batch.delete(productRef);
        });
        await batch.commit();
        toast.success("All products deleted successfully");
        await activityLogService.logAction(`All products deleted by ${userEmail}`, userId, userEmail);
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error deleting all products:', error);
        toast.error(`Failed to delete all products: ${error.message}`);
        setError(`Failed to delete all products: ${error.message}`);
      }
    }
  }, [products, currentUser, setError]);

  const bulkCreateOrUpdateProducts = useCallback(async (productsToImport: Omit<Product, 'id'>[]) => {
    const userEmail = currentUser?.email || 'Unknown User';
    const userId = currentUser?.uid || null;
    const results = await productService.bulkCreateOrUpdate(productsToImport, products, userEmail, userId);
    if (results.errors.length > 0) {
      toast.warning(`Import finished with ${results.errors.length} issues.`);
    } else {
      toast.success(`Successfully imported ${results.successCount} products.`);
    }
    await activityLogService.logAction(`Bulk product import completed by ${userEmail}. Success: ${results.successCount}, Errors: ${results.errors.length}`, userId, userEmail);
    return results;
  }, [currentUser, products]);

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

  // Manual refresh function (still available if needed)
  const fetchProducts = useCallback(async () => {
    // With real-time listeners, this is mostly a no-op
    // but kept for compatibility
    try {
      const productsList = await productService.list();
      setProducts(productsList);
    } catch (error: any) {
      console.error('Error loading products:', error);
      setErrorProducts('Failed to load products');
      toast.error('Failed to load products');
    }
  }, [setProducts]);

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
    bulkCreateOrUpdateProducts, // Expose the new bulk import function
    sortColumn,
    sortDirection,
    handleSort,
    selectedProducts,
    toggleProductSelection,
    selectAllProducts,
    clearSelectedProducts,
  };
};