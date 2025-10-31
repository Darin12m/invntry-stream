import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Save, X } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore'; // Import getDoc
import { Product } from '../InventoryManagement'; // Import Product interface
import { toast } from "sonner"; // Correct import for sonner toast
import { logActivity } from '@/utils/logActivity'; // NEW: Import logActivity

interface ProductModalProps {
  showProductModal: boolean;
  setShowProductModal: (show: boolean) => void;
  editingProduct: Product | null;
  setEditingProduct: (product: Product | null) => void;
  db: any; // Firebase Firestore instance
  toast: any; // Sonner toast instance
}

const ProductModal: React.FC<ProductModalProps> = ({
  showProductModal,
  setShowProductModal,
  editingProduct,
  setEditingProduct,
  db,
  toast,
}) => {
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    quantity: '',
    price: '',
    category: '',
    purchasePrice: '',
    shortDescription: ''
  });

  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name,
        sku: editingProduct.sku,
        quantity: editingProduct.quantity.toString(),
        price: editingProduct.price.toString(),
        category: editingProduct.category,
        purchasePrice: editingProduct.purchasePrice?.toString() || '',
        shortDescription: editingProduct.shortDescription || ''
      });
    } else {
      setProductForm({
        name: '',
        sku: '',
        quantity: '',
        price: '',
        category: '',
        purchasePrice: '',
        shortDescription: ''
      });
    }
  }, [editingProduct]);

  const handleCloseProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      quantity: '',
      price: '',
      category: '',
      purchasePrice: '',
      shortDescription: ''
    });
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.price || !productForm.quantity) {
      toast.error("Please fill in all required fields");
      return;
    }

    const productData = {
      name: productForm.name,
      sku: productForm.sku,
      quantity: parseInt(productForm.quantity),
      price: parseFloat(productForm.price),
      category: productForm.category,
      ...(productForm.purchasePrice && { purchasePrice: parseFloat(productForm.purchasePrice) }),
      ...(productForm.shortDescription && { shortDescription: productForm.shortDescription })
    };

    try {
      if (editingProduct) {
        // When editing, only update the fields provided in productData.
        // initialStock should not be changed here.
        const oldProductSnap = await getDoc(doc(db, 'products', editingProduct.id));
        const oldQty = oldProductSnap.exists() ? oldProductSnap.data().quantity : 0;

        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success("Product updated successfully");
        await logActivity("Edited product", productForm.name, `qty: ${oldQty} → ${productData.quantity}`); // Log activity
      } else {
        // For new products, set initialStock to the current quantity
        const docRef = await addDoc(collection(db, 'products'), {
          ...productData,
          initialStock: parseInt(productForm.quantity) // Set initialStock for new products
        });
        toast.success("Product added successfully");
        await logActivity("Added product", productForm.name, `qty: ${productData.quantity}`); // Log activity
      }
      handleCloseProductModal();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  if (!showProductModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[95vh] flex flex-col animate-scale-in shadow-glow">
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-center border-b">
          <h3 className="text-xl font-semibold">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </h3>
          <Button
            onClick={handleCloseProductModal}
            variant="ghost"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="Enter product name"
            />
          </div>

          <div>
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={productForm.sku}
              onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
              placeholder="Enter SKU"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                value={productForm.quantity}
                onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="price">Price *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              placeholder="Enter category"
            />
          </div>

          <div>
            <Label htmlFor="shortDescription">Short Description</Label>
            <Textarea
              id="shortDescription"
              value={productForm.shortDescription}
              onChange={(e) => setProductForm({ ...productForm, shortDescription: e.target.value })}
              placeholder="A brief description of the product (max 100 characters)"
              rows={3}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground mt-1">
              A short description for the mini catalog.
            </p>
          </div>

          {/* Purchase Price - Admin Only Field */}
          <div className="bg-muted/30 p-4 rounded-lg border-dashed border-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-warning/10 text-warning-foreground px-2 py-1 rounded text-xs font-medium">
                ADMIN ONLY
              </div>
            </div>
            <Label htmlFor="purchasePrice">Purchase Price (for profit calculations)</Label>
            <Input
              id="purchasePrice"
              type="number"
              step="0.01"
              value={productForm.purchasePrice}
              onChange={(e) => setProductForm({ ...productForm, purchasePrice: e.target.value })}
              placeholder="0.00 (optional)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This field is only visible to admin users and used for profit calculations. Leave empty if not needed.
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-6 pt-4 border-t flex justify-end gap-3">
          <Button
            onClick={handleCloseProductModal}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveProduct}
            className="bg-gradient-primary shadow-elegant"
          >
            <Save className="h-4 w-4 mr-2" />
            {editingProduct ? 'Update' : 'Add'} Product
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProductModal;