import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Trash, X, Save } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { Product, Invoice } from '../InventoryManagement'; // Import interfaces
import { toast } from "sonner"; // Correct import for sonner toast

interface InvoiceModalProps {
  showInvoiceModal: boolean;
  setShowInvoiceModal: (show: boolean) => void;
  editingInvoice: Invoice | null;
  setEditingInvoice: (invoice: Invoice | null) => void;
  products: Product[];
  invoices: Invoice[]; // All invoices for generating new number
  db: any; // Firebase Firestore instance
  toast: any; // Sonner toast instance
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({
  showInvoiceModal,
  setShowInvoiceModal,
  editingInvoice,
  setEditingInvoice,
  products,
  invoices,
  db,
  toast,
}) => {
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', address: '', phone: '' });
  const [invoiceProductSearch, setInvoiceProductSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<'sale' | 'refund' | 'writeoff'>('sale');

  useEffect(() => {
    if (editingInvoice) {
      setCurrentInvoice({
        id: editingInvoice.id,
        number: editingInvoice.number,
        date: editingInvoice.date,
        customer: editingInvoice.customer,
        items: editingInvoice.items,
        subtotal: editingInvoice.subtotal,
        discount: editingInvoice.discount,
        discountPercentage: editingInvoice.discountPercentage,
        total: editingInvoice.total,
        status: editingInvoice.status,
        invoiceType: editingInvoice.invoiceType // Set existing type
      });

      const refreshedItems = editingInvoice.items.map((item) => {
        const latestProduct = products.find(p => p.id === item.productId);
        return latestProduct
          ? {
              ...item,
              name: latestProduct.name,
              price: latestProduct.price,
              purchasePrice: latestProduct.purchasePrice || 0,
            }
          : { ...item };
      });
      setInvoiceItems(refreshedItems);

      setCustomerInfo({ ...editingInvoice.customer, phone: editingInvoice.customer.phone || '' });
      setDiscount(editingInvoice.discountPercentage || 0);
      setSelectedInvoiceType(editingInvoice.invoiceType || 'sale');
    } else {
      // Generate invoice number in format 001/25, 002/25, etc.
      const year = new Date().getFullYear().toString().slice(-2);
      const nextNumber = (invoices.length + 1).toString().padStart(3, '0');
      
      setCurrentInvoice({
        id: Date.now().toString(),
        number: `${nextNumber}/${year}`,
        date: new Date().toISOString().split('T')[0],
        customer: { name: '', email: '', address: '', phone: '' },
        items: [],
        subtotal: 0,
        discount: 0,
        discountPercentage: 0,
        total: 0,
        status: 'draft',
        invoiceType: 'sale'
      });
      setInvoiceItems([]);
      setCustomerInfo({ name: '', email: '', address: '', phone: '' });
      setDiscount(0);
      setSelectedInvoiceType('sale');
    }
    setInvoiceProductSearch(''); // Always clear search on modal open/edit
  }, [editingInvoice, products, invoices]);

  const handleCloseInvoiceModal = () => {
    setShowInvoiceModal(false);
    setEditingInvoice(null);
    setCurrentInvoice(null);
    setInvoiceItems([]);
    setCustomerInfo({ name: '', email: '', address: '', phone: '' });
    setInvoiceProductSearch('');
    setDiscount(0);
    setSelectedInvoiceType('sale');
  };

  const filteredInvoiceProducts = products.filter(product =>
    (product.name || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.sku || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.category || '').toLowerCase().includes(invoiceProductSearch.toLowerCase())
  );

  const addItemToInvoice = (product: Product) => {
    const existingItem = invoiceItems.find(item => item.productId === product.id);
    if (existingItem) {
      setInvoiceItems(invoiceItems.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setInvoiceItems([...invoiceItems, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: 1,
        purchasePrice: product.purchasePrice || 0,
        discount: 0
      }]);
    }
    toast.success(`${product.name} added to invoice`);
  };

  const updateInvoiceItemQuantity = (productId: string, quantity: number) => {
    setInvoiceItems(invoiceItems.map(item =>
      item.productId === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const updateInvoiceItemDiscount = (productId: string, discount: number) => {
    setInvoiceItems(invoiceItems.map(item =>
      item.productId === productId
        ? { ...item, discount: Math.max(0, Math.min(100, discount)) }
        : item
    ));
  };

  const calculateInvoiceTotal = () => {
    const subtotal = invoiceItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const itemDiscount = itemTotal * ((item.discount || 0) / 100);
      return sum + (itemTotal - itemDiscount);
    }, 0);
    const globalDiscountAmount = subtotal * (discount / 100);
    const total = subtotal - globalDiscountAmount;
    return { subtotal, discount: globalDiscountAmount, total };
  };

  const removeInvoiceItem = (productId: string) => {
    setInvoiceItems(invoiceItems.filter(item => item.productId !== productId));
    toast.success("Item removed from invoice");
  };

  const clearAllInvoiceItems = () => {
    if (invoiceItems.length === 0) {
      toast.error("No items to clear");
      return;
    }
    
    if (window.confirm(`Are you sure you want to remove all ${invoiceItems.length} items from this invoice?`)) {
      setInvoiceItems([]);
      toast.success("All items cleared from invoice");
    }
  };

  const handleSaveInvoice = async () => {
    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }

    const { subtotal, discount: discountAmount, total } = calculateInvoiceTotal();
    
    let itemsToSave = invoiceItems; // Start with the current state of items in the modal

    // If it's a new invoice, or if any item in an existing invoice doesn't have baseQuantity
    // (e.g., newly added item during edit, or legacy invoice item from before baseQuantity was implemented)
    const needsBaseQuantityCapture = !editingInvoice || invoiceItems.some(item => item.baseQuantity === undefined || item.baseQuantity === null);

    if (needsBaseQuantityCapture) {
      itemsToSave = await Promise.all(invoiceItems.map(async (item) => {
        if (item.baseQuantity === undefined || item.baseQuantity === null) {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          const productData = productSnap.data();
          return {
            ...item,
            baseQuantity: productData?.quantity || 0, // record true starting stock for new/legacy items
          };
        }
        return item; // For existing items with baseQuantity, keep it as is
      }));
    }

    const invoiceData = {
      number: currentInvoice!.number,
      date: currentInvoice!.date,
      customer: customerInfo,
      items: itemsToSave, // Use the processed items with baseQuantity
      subtotal,
      discount: discountAmount,
      discountPercentage: discount,
      total,
      status: 'saved',
      invoiceType: selectedInvoiceType,
    };

    try {
      if (editingInvoice) {
        // Update the invoice document
        await updateDoc(doc(db, 'invoices', editingInvoice.id), invoiceData);
      } else {
        // Add new invoice document
        await addDoc(collection(db, 'invoices'), invoiceData);
      }

      // --- CORRECTED STOCK LOGIC ---
      for (const item of itemsToSave) {
        const productRef = doc(db, 'products', item.productId);

        const base = Number(item.baseQuantity ?? 0);  // true stock before invoice
        const qty = Math.abs(Number(item.quantity));
        const oldType = editingInvoice ? editingInvoice.invoiceType || 'sale' : null;
        const newType = selectedInvoiceType;

        let finalStock = base;

        // Step 1️⃣: Undo the previous type’s effect (only if editing an existing invoice)
        if (editingInvoice && oldType) { // Only undo if it's an existing invoice
          if (oldType === 'sale') finalStock += qty;     // undo stock decrease
          else if (oldType === 'refund') finalStock -= qty; // undo stock increase
          else if (oldType === 'writeoff') finalStock += qty; // undo write-off
        }

        // Step 2️⃣: Apply the new type’s effect (fresh)
        if (newType === 'sale') finalStock -= qty;
        else if (newType === 'refund') finalStock += qty;
        else if (newType === 'writeoff') finalStock -= qty;

        await updateDoc(productRef, { quantity: Math.max(0, finalStock) });
      }

      handleCloseInvoiceModal();
      toast.success(editingInvoice ? 'Invoice updated successfully!' : 'Invoice saved successfully!');
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    }
  };

  if (!showInvoiceModal || !currentInvoice) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-2 sm:p-4">
        <Card className="w-full max-w-7xl max-h-[95vh] sm:h-5/6 flex flex-col animate-scale-in shadow-glow">
          
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-2xl font-bold">Create New Invoice</h2>
            <Button onClick={handleCloseInvoiceModal} variant="ghost">
              <X className="h-6 w-6" />
            </Button>
          </div>
          
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
              
              {/* LEFT SIDE - Products */}
              <div className="w-full sm:w-1/2 border-r bg-muted/30 flex flex-col max-h-64 sm:max-h-none">
                
                {/* Search Section */}
                <div className="p-4 bg-primary/5 border-b">
                  <h3 className="font-bold text-lg mb-3 text-primary">Search Products</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={invoiceProductSearch}
                      onChange={(e) => setInvoiceProductSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {invoiceProductSearch && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Found {filteredInvoiceProducts.length} products
                    </p>
                  )}
                </div>
                
                {/* Products List */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {filteredInvoiceProducts.map(product => (
                      <Card
                        key={product.id}
                        onClick={() => addItemToInvoice(product)}
                        className="p-4 cursor-pointer hover:shadow-elegant transition-all duration-300 hover:border-primary/50"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-bold">{product.name}</h4>
                            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                            <p className="text-primary font-semibold">{product.price.toFixed(2)} ден.</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Stock: {product.quantity}</p>
                            <div className="bg-primary text-primary-foreground rounded-full p-2 mt-2">
                              <Plus className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
                
              </div>
              
                {/* RIGHT SIDE - Invoice Form */}
                <div className="w-full sm:w-1/2 p-4 sm:p-6 overflow-y-auto">
                
                {/* Invoice Number and Date */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <Label>Invoice Number</Label>
                    <Input
                      value={currentInvoice.number}
                      onChange={(e) => setCurrentInvoice({ ...currentInvoice, number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoiceDate">Invoice Date *</Label>
                    <Input
                      id="invoiceDate"
                      type="date"
                      value={currentInvoice.date}
                      onChange={(e) => setCurrentInvoice({ ...currentInvoice, date: e.target.value })}
                    />
                  </div>
                </div>

                {/* NEW: Invoice Type Dropdown */}
                <div className="mb-6">
                  <Label className="block text-sm font-medium mb-1">Invoice type</Label>
                  <select
                    value={selectedInvoiceType}
                    onChange={(e) => setSelectedInvoiceType(e.target.value as 'sale' | 'refund' | 'writeoff')}
                    className="w-full border rounded-md p-2 bg-background text-foreground"
                  >
                    <option value="sale">Sale / Outgoing</option>
                    <option value="refund">Refund / Return</option>
                    <option value="writeoff">Free / Damaged / Promo</option>
                  </select>
                </div>

                  {/* Customer Information */}
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3">Customer Information</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder="Customer Name *"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    />
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                      />
                    <Textarea
                      placeholder="Address"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg">Invoice Items</h3>
                    {invoiceItems.length > 0 && (
                      <Button
                        onClick={clearAllInvoiceItems}
                        variant="outline"
                        size="sm"
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                    )}
                  </div>
                  {invoiceItems.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">Click products on the left to add them here</p>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {invoiceItems.map(item => {
                        const itemSubtotal = item.price * item.quantity;
                        const itemDiscountAmount = itemSubtotal * ((item.discount || 0) / 100);
                        const itemTotal = itemSubtotal - itemDiscountAmount;
                        
                        return (
                          <Card key={item.productId} className="p-3">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium truncate">{item.name}</h4>
                                  <p className="text-sm text-muted-foreground truncate">{item.sku}</p>
                                </div>
                                <Button
                                  onClick={() => removeInvoiceItem(item.productId)}
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Quantity</Label>
                                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                    <Button
                                      onClick={() => updateInvoiceItemQuantity(item.productId, item.quantity - 1)}
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateInvoiceItemQuantity(item.productId, parseInt(e.target.value) || 0)}
                                      className="w-full h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      placeholder="0"
                                    />
                                    <Button
                                      onClick={() => updateInvoiceItemQuantity(item.productId, item.quantity + 1)}
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label className="text-xs">Discount (%)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={item.discount || 0}
                                    onChange={(e) => updateInvoiceItemDiscount(item.productId, parseFloat(e.target.value) || 0)}
                                    className="h-8"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                              
                              <div className="text-right text-sm space-y-1 pt-2 border-t">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Price × Qty:</span>
                                  <span>{itemSubtotal.toFixed(2)} ден.</span>
                                </div>
                                {(item.discount || 0) > 0 && (
                                  <div className="flex justify-between text-success">
                                    <span>Discount ({item.discount}%):</span>
                                    <span>-{itemDiscountAmount.toFixed(2)} ден.</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold">
                                  <span>Total:</span>
                                  <span className="text-primary">{itemTotal.toFixed(2)} ден.</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                  {/* Discount and Totals */}
                  {invoiceItems.length > 0 && (
                    <Card className="p-4 space-y-4">
                      <div>
                        <Label htmlFor="discount">Попуст (%)</Label>
                        <Input
                          id="discount"
                          type="number"
                          min="0"
                          max="100"
                          value={discount}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2 text-right">
                          <div className="flex justify-between">
                            <span>Мегузбир:</span>
                            <span>{calculateInvoiceTotal().subtotal.toFixed(2)} ден.</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-success">
                              <span>Попуст ({discount}%):</span>
                              <span>-{calculateInvoiceTotal().discount.toFixed(2)} ден.</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-lg border-t pt-2">
                            <span>ВКУПНО:</span>
                            <span className="text-primary">{calculateInvoiceTotal().total.toFixed(2)} ден.</span>
                          </div>
                      </div>
                    </Card>
                  )}

              </div>
              
            </div>
            
            {/* Footer Buttons */}
            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                onClick={handleCloseInvoiceModal}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveInvoice}
                disabled={invoiceItems.length === 0 || !customerInfo.name.trim()}
                className="bg-success"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Invoice
              </Button>
            </div>
            
          </Card>
        </div>
      </div>
  );
};

export default InvoiceModal;