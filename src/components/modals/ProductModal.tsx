import React, { useState, useEffect, useContext } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from 'lucide-react';
import { Product } from '@/types';
import { toast } from "sonner";
import { AppContext } from '@/context/AppContext';
import { useProducts } from '@/hooks/useProducts';
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

interface ProductModalProps {
  showProductModal: boolean;
  setShowProductModal: (show: boolean) => void;
  editingProduct: Product | null;
  setEditingProduct: (product: Product | null) => void;
  // Removed fetchProducts, addProduct, updateProduct props as they are now handled by useProducts hook
}

const ProductModal: React.FC<ProductModalProps> = ({
  showProductModal,
  setShowProductModal,
  editingProduct,
  setEditingProduct,
}) => {
  const { currentUser } = useContext(AppContext);
  const { addProduct, updateProduct } = useProducts();
  const { isIOS } = useDeviceType(); // Use the hook

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    quantity: '',
    onHand: '',
    price: '',
    category: '',
    purchasePrice: '',
    shortDescription: '',
    initialStock: '',
  });

  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name,
        sku: editingProduct.sku,
        quantity: (editingProduct.quantity ?? 0).toString(),
        onHand: (editingProduct.onHand ?? 0).toString(),
        price: editingProduct.price.toString(),
        category: editingProduct.category,
        purchasePrice: editingProduct.purchasePrice?.toString() || '',
        shortDescription: editingProduct.shortDescription || '',
        initialStock: (editingProduct.initialStock ?? 0).toString(),
      });
    } else {
      setProductForm({
        name: '',
        sku: '',
        quantity: '',
        onHand: '',
        price: '',
        category: '',
        purchasePrice: '',
        shortDescription: '',
        initialStock: '',
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
      onHand: '',
      price: '',
      category: '',
      purchasePrice: '',
      shortDescription: '',
      initialStock: '',
    });
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.price || !productForm.quantity || !productForm.onHand) {
      toast.error("Please fill in all required fields");
      return;
    }

    const productPayload: Omit<Product, 'id'> = {
      name: productForm.name,
      sku: productForm.sku,
      quantity: parseInt(productForm.quantity),
      onHand: parseInt(productForm.onHand),
      price: parseFloat(productForm.price),
      category: productForm.category,
      purchasePrice: productForm.purchasePrice ? parseFloat(productForm.purchasePrice) : undefined,
      shortDescription: productForm.shortDescription || undefined,
      initialStock: productForm.initialStock ? parseInt(productForm.initialStock) : parseInt(productForm.quantity),
    };

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productPayload);
      } else {
        await addProduct(productPayload);
      }
      handleCloseProductModal();
    } catch (error: any) {
      // Error handled by useProducts hook
    }
  };

  if (!showProductModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"> {/* Adjusted padding */}
      <Card className="w-full max-w-md max-h-[95vh] flex flex-col animate-scale-in shadow-glow">
        {/* Header */}
        <div className="p-4 pb-3 sm:p-6 sm:pb-4 flex justify-between items-center border-b"> {/* Adjusted padding */}
          <h3 className="text-lg sm:text-xl font-semibold"> {/* Adjusted font size */}
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4"> {/* Adjusted padding and spacing */}
          <div>
            <Label htmlFor="name" className="text-sm sm:text-base">Product Name *</Label> {/* Adjusted font size */}
            <Input
              id="name"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="Enter product name"
              className="text-sm sm:text-base"
            />
          </div>

          <div>
            <Label htmlFor="sku" className="text-sm sm:text-base">SKU *</Label> {/* Adjusted font size */}
            <Input
              id="sku"
              value={productForm.sku}
              onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
              placeholder="Enter SKU"
              className="text-sm sm:text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4"> {/* Adjusted spacing */}
            <div>
              <Label htmlFor="quantity" className="text-sm sm:text-base">Quantity *</Label> {/* Adjusted font size */}
              <Input
                id="quantity"
                type="number"
                value={productForm.quantity}
                onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                placeholder="0"
                className="text-sm sm:text-base"
              />
            </div>

            <div>
              <Label htmlFor="onHand" className="text-sm sm:text-base">On Hand Stock *</Label> {/* Adjusted font size */}
              <Input
                id="onHand"
                type="number"
                value={productForm.onHand}
                onChange={(e) => setProductForm({ ...productForm, onHand: e.target.value })}
                placeholder="0"
                className="text-sm sm:text-base"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is the actual stock available.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="price" className="text-sm sm:text-base">Price *</Label> {/* Adjusted font size */}
            <Input
              id="price"
              type="number"
              step="0.01"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              placeholder="0.00"
              className="text-sm sm:text-base"
            />
          </div>

          <div>
            <Label htmlFor="category" className="text-sm sm:text-base">Category</Label> {/* Adjusted font size */}
            <Input
              id="category"
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              placeholder="Enter category"
              className="text-sm sm:text-base"
            />
          </div>

          <div>
            <Label htmlFor="shortDescription" className="text-sm sm:text-base">Short Description</Label> {/* Adjusted font size */}
            <Textarea
              id="shortDescription"
              value={productForm.shortDescription}
              onChange={(e) => setProductForm({ ...productForm, shortDescription: e.target.value })}
              placeholder="A brief description of the product (max 100 characters)"
              rows={3}
              maxLength={100}
              className="text-sm sm:text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A short description for the mini catalog.
            </p>
          </div>

          {/* Initial Stock - Admin Only Field */}
          <div className="bg-muted/30 p-3 sm:p-4 rounded-lg border-dashed border-2"> {/* Adjusted padding */}
            <div className="flex items-center gap-1 sm:gap-2 mb-1.5 sm:mb-2"> {/* Adjusted spacing */}
              <div className="bg-warning/10 text-warning-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium"> {/* Adjusted padding and font size */}
                ADMIN ONLY
              </div>
            </div>
            <Label htmlFor="initialStock" className="text-sm sm:text-base">Initial Stock (for historical tracking)</Label> {/* Adjusted font size */}
            <Input
              id="initialStock"
              type="number"
              value={productForm.initialStock}
              onChange={(e) => setProductForm({ ...productForm, initialStock: e.target.value })}
              placeholder="0 (optional)"
              className="text-sm sm:text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This field is for tracking the original stock level when the product was first added.
            </p>
          </div>

          {/* Purchase Price - Admin Only Field */}
          <div className="bg-muted/30 p-3 sm:p-4 rounded-lg border-dashed border-2"> {/* Adjusted padding */}
            <div className="flex items-center gap-1 sm:gap-2 mb-1.5 sm:mb-2"> {/* Adjusted spacing */}
              <div className="bg-warning/10 text-warning-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium"> {/* Adjusted padding and font size */}
                ADMIN ONLY
              </div>
            </div>
            <Label htmlFor="purchasePrice" className="text-sm sm:text-base">Purchase Price (for profit calculations)</Label> {/* Adjusted font size */}
            <Input
              id="purchasePrice"
              type="number"
              step="0.01"
              value={productForm.purchasePrice}
              onChange={(e) => setProductForm({ ...productForm, purchasePrice: e.target.value })}
              placeholder="0.00 (optional)"
              className="text-sm sm:text-base"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This field is only visible to admin users and used for profit calculations. Leave empty if not needed.
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 pt-3 sm:p-6 sm:pt-4 border-t flex justify-end gap-2 sm:gap-3"> {/* Adjusted padding and spacing */}
          <Button
            onClick={handleCloseProductModal}
            variant="outline"
            size={isIOS ? "sm" : "default"} // Smaller button on iOS
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveProduct}
            className="bg-gradient-primary shadow-elegant"
            size={isIOS ? "sm" : "default"} // Smaller button on iOS
          >
            <Save className="h-3 w-3 sm:h-4 w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
            {editingProduct ? 'Update' : 'Add'} Product
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProductModal;