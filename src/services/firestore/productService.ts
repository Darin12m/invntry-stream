import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, FieldValue, writeBatch, query, where } from 'firebase/firestore';
import { Product } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';

// Helper function to sanitize product data before writing to Firestore
const sanitizeProductData = (product: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> => {
  const defaults = {
    shortDescription: "",
    category: "Uncategorized",
    sku: "",
    purchasePrice: 0,
    price: 0,
    onHand: 0,
    quantity: 0, // Ensure quantity also has a default
    initialStock: 0, // Ensure initialStock also has a default
  };

  const cleaned: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> = { ...product };

  for (const key in defaults) {
    // If the key exists in defaults and is undefined in the product, set its default
    if (cleaned[key as keyof typeof cleaned] === undefined) {
      (cleaned as any)[key] = (defaults as any)[key];
    }
  }
  // Ensure price and purchasePrice are numbers, even if they come as strings or null
  if (typeof cleaned.price === 'string') cleaned.price = parseFloat(cleaned.price);
  if (isNaN(cleaned.price as number)) cleaned.price = defaults.price;

  if (typeof cleaned.purchasePrice === 'string') cleaned.purchasePrice = parseFloat(cleaned.purchasePrice);
  if (isNaN(cleaned.purchasePrice as number)) cleaned.purchasePrice = defaults.purchasePrice;

  if (typeof cleaned.onHand === 'string') cleaned.onHand = parseInt(cleaned.onHand);
  if (isNaN(cleaned.onHand as number)) cleaned.onHand = defaults.onHand;

  if (typeof cleaned.quantity === 'string') cleaned.quantity = parseInt(cleaned.quantity);
  if (isNaN(cleaned.quantity as number)) cleaned.quantity = defaults.quantity;

  if (typeof cleaned.initialStock === 'string') cleaned.initialStock = parseInt(cleaned.initialStock);
  if (isNaN(cleaned.initialStock as number)) cleaned.initialStock = defaults.initialStock;

  return cleaned;
};

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
      ...sanitizeProductData(product) as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, // Sanitize before creating
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const docRef = await addDoc(collection(db, 'products'), newProduct);
    await activityLogService.logAction(`New product "${product.name}" added by ${userEmail}`, userId, userEmail);
    return docRef.id;
  },
  update: async (id: string, product: Partial<Omit<Product, 'id' | 'updatedAt'>>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    const productRef = doc(db, 'products', id);
    await updateDoc(productRef, { ...sanitizeProductData(product), updatedAt: new Date() }); // Sanitize before updating
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
            ...sanitizeProductData(productData) as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, // Sanitize before creating
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

  // One-time migration function to ensure all products have default values
  migrateProductData: async (userEmail: string = 'System', userId: string | null = null): Promise<void> => {
    const productsCol = collection(db, 'products');
    const productSnapshot = await getDocs(productsCol);
    const batch = writeBatch(db);
    let migratedCount = 0;

    productSnapshot.docs.forEach(docSnap => {
      const product = docSnap.data() as Product;
      const cleanedProduct = sanitizeProductData(product);

      // Check if any fields were actually changed
      const changed = Object.keys(cleanedProduct).some(key => (cleanedProduct as any)[key] !== (product as any)[key]);

      if (changed) {
        batch.update(doc(db, 'products', docSnap.id), cleanedProduct);
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      await batch.commit();
      await activityLogService.logAction(`Migrated ${migratedCount} products with default values by ${userEmail}`, userId, userEmail);
      console.log(`Firestore migration: ${migratedCount} products updated with default values.`);
    } else {
      console.log('Firestore migration: No products needed updates.');
    }
  },
};