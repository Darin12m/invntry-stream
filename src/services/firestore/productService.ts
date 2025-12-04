import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, FieldValue } from 'firebase/firestore';
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
};