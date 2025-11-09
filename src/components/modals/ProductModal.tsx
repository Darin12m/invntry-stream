import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Save, X, Loader2 } from 'lucide-react'; // Added Loader2 for spinner
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { Product } from '../InventoryManagement';
import { toast } from "sonner";
import { logActivity } from '@/utils/logActivity';

// The 'onHand' field is managed exclusively by the backend stock system (Netlify Functions).
// Frontend operations should not directly modify 'onHand'.
// The 'quantity' field in the product form represents the base/initial quantity.

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
  const [isSaving, setIsSaving] = useState(false); // NEW: Saving state
  const nameInputRef = useRef<HTMLInputElement>(null); // NEW: Ref for auto-focus

  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name,
        sku: editingProduct.sku,
        quantity: (editingProduct.quantity ?? 0).toString(),
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
    // NEW: Auto-focus on modal open
    if (showProductModal) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [editingProduct, showProductModal]);

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

    setIsSaving(true); // NEW: Set saving state

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
        const oldProductSnap = await getDoc(doc(db, 'products', editingProduct.id));
        const oldQty = oldProductSnap.exists() ? (oldProductSnap.data().onHand ?? oldProductSnap.data().quantity) : 0;

        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success("✅ Product updated successfully!"); // NEW: Success toast
        await logActivity("Edited product", productForm.name, `qty: ${oldQty} → ${productData.quantity}`);
      } else {
        await addDoc(collection(db, 'products'), productData);
        toast.success("✅ Product added successfully!"); // NEW: Success toast
        await logActivity("Added product", productForm.name, `qty: ${productData.quantity}`);
      }
      handleCloseProductModal();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('❌ Failed to save product'); // NEW: Error toast
    } finally {
      setIsSaving(false); // NEW: Reset saving state
    }
  };

  // NEW: Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveProduct();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCloseProductModal();
    }
  };

  if (!showProductModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[95vh] flex flex-col animate-scale-in shadow-glow" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-center border-b">
          <h3 className="text-xl font-semibold">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </h3>
          <Button
            onClick={handleCloseProductModal}
            variant="ghost"
            size="sm"
            disabled={isSaving} // NEW: Disable close button while saving
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
              ref={nameInputRef} // NEW: Attach ref
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="Enter product name"
              disabled={isSaving} // NEW: Disable inputs while saving
            />
          </div>

          <div>
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={productForm.sku}
              onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
              placeholder="Enter SKU"
              disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
              />
            </div>
          </div>

          {editingProduct && (
            <div>
              <Label htmlFor="onHandStock">Current On-Hand Stock</Label>
              <Input
                id="onHandStock"
                type="number"
                value={editingProduct.onHand ?? 0}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is the live stock count, managed by the backend.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              placeholder="Enter category"
              disabled={isSaving}
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
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              A short description for the mini catalog.
            </p>
          </div>

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
              disabled={isSaving}
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
            disabled={isSaving} // NEW: Disable cancel button while saving
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveProduct}
            className="bg-gradient-primary shadow-elegant"
            disabled={isSaving} // NEW: Disable save button while saving
          >
            {isSaving ? ( // NEW: Show spinner and text when saving
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {editingProduct ? 'Update' : 'Add'} Product
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProductModal;