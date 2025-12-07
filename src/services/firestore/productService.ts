import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, FieldValue, writeBatch, query, where } from 'firebase/firestore';
import { Product } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';

export const productService = {
  list: async (): Promise<Product[]> => {
    const productsCol = collection(db, 'products');
    const productSnapshot = await getDocs(productsCol);
    return productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  },
  get: async (id: string): Promise<Product> => {
    const productRef = doc(db, 'products', id);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) throw new Error('Product not found');
    return { id: productSnap.id, ...productSnap.data() } as Product;
  },
  create: async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<string> => {
    const newProduct: Omit<Product, 'id'> = {
      ...product,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const docRef = await addDoc(collection(db, 'products'), newProduct);
    await activityLogService.logAction(`New product "${product.name}" added by ${userEmail}`, userId, userEmail);
    return docRef.id;
  },
  update: async (id: string, product: Partial<Omit<Product, 'id' | 'updatedAt'>>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    const productRef = doc(db, 'products', id);
    await updateDoc(productRef, { ...product, updatedAt: new Date() });
    await activityLogService.logAction(`Product "${product.name || id}" updated by ${userEmail}`, userId, userEmail);
  },
  delete: async (id: string, userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    const productRef = doc(db, 'products', id);
    await deleteDoc(productRef);
    await activityLogService.logAction(`Product ${id} deleted by ${userEmail}`, userId, userEmail);
  },

  bulkCreateOrUpdate: async (
    productsToImport: Omit<Product, 'id'>[],
    existingProducts: Product[],
    userEmail: string = 'Unknown User',
    userId: string | null = null
  ): Promise<{ successCount: number; errors: { originalRow?: number; sku?: string; message: string }[] }> => {
    const batch = writeBatch(db);
    const productsRef = collection(db, 'products');
    const errors: { originalRow?: number; sku?: string; message: string }[] = [];
    let successCount = 0;

    const existingSkuMap = new Map<string, Product>();
    existingProducts.forEach(p => existingSkuMap.set(p.sku.toLowerCase(), p));

    for (const [index, productData] of productsToImport.entries()) {
      const originalRow = index + 2; // +2 for header row + 1-based index

      try {
        const existingProduct = existingSkuMap.get(productData.sku.toLowerCase());

        if (existingProduct) {
          // Skip if SKU already exists
          errors.push({
            originalRow,
            sku: productData.sku,
            message: `SKU "${productData.sku}" already exists. Skipping import.`,
          });
        } else {
          // Create new product
          const newProduct: Omit<Product, 'id'> = {
            ...productData,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const newDocRef = doc(productsRef);
          batch.set(newDocRef, newProduct);
          successCount++;
        }
      } catch (error: any) {
        errors.push({
          originalRow,
          sku: productData.sku,
          message: `Failed to process product: ${error.message}`,
        });
      }
    }

    if (productsToImport.length > 0) {
      await batch.commit();
    }

    return { successCount, errors };
  },
};