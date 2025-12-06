import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react'; // Import useMemo
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Trash, X, Save } from 'lucide-react';
import { db } from '@/firebase/config';
import { doc, writeBatch, collection } from 'firebase/firestore'; // Import collection and writeBatch
import { Product, Invoice, InvoiceItem } from '@/types';
import { toast } from "sonner";
import { AppContext } from '@/context/AppContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { calculateInvoiceTotals } from '@/utils/invoiceCalculations';
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

interface InvoiceModalProps {
  showInvoiceModal: boolean;
  setShowInvoiceModal: (show: boolean) => void;
  editingInvoice: Invoice | null;
  setEditingInvoice: (invoice: Invoice | null) => void;
  // Removed products, invoices, fetchInvoices, fetchProducts, createInvoice, updateInvoice props
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({
  showInvoiceModal,
  setShowInvoiceModal,
  editingInvoice,
  setEditingInvoice,
}) => {
  const { currentUser, products, invoices: allInvoices } = useContext(AppContext);
  const { createInvoice, updateInvoice } = useInvoices();
  const { fetchProducts } = useProducts(); // To refresh product list after stock changes
  const { isIOS } = useDeviceType(); // Use the hook

  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', address: '', phone: '' });
  const [invoiceProductSearch, setInvoiceProductSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [invoiceType, setInvoiceType] = useState<'sale' | 'return' | 'gifted-damaged'>('sale');

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
        invoiceType: editingInvoice.invoiceType || 'sale',
        itemsIds: editingInvoice.itemsIds || [],
        createdAt: editingInvoice.createdAt,
        buyerName: editingInvoice.buyerName || '',
        buyerEmail: editingInvoice.buyerEmail || '',
        buyerAddress: editingInvoice.buyerAddress || '',
      });

      const refreshedItems = editingInvoice.items.map((item) => {
        const latestProduct = products.find(p => p.id === item.productId);
        return latestProduct
          ? {
              ...item,
              name: latestProduct.name,
              sku: latestProduct.sku,
              price: latestProduct.price,
              purchasePrice: latestProduct.purchasePrice || 0,
            }
          : { ...item };
      });
      setInvoiceItems(refreshedItems);

      setCustomerInfo({ 
        name: editingInvoice.customer.name, 
        email: editingInvoice.customer.email, 
        address: editingInvoice.customer.address, 
        phone: editingInvoice.customer.phone || '' 
      });
      setDiscount(editingInvoice.discountPercentage || 0);
      setInvoiceType(editingInvoice.invoiceType || 'sale');
    } else {
      const year = new Date().getFullYear().toString().slice(-2);
      const nextNumber = (allInvoices.length + 1).toString().padStart(3, '0'); // Use allInvoices from context
      
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
        invoiceType: 'sale',
        itemsIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        buyerName: '',
        buyerEmail: '',
        buyerAddress: '',
      });
      setInvoiceItems([]);
      setCustomerInfo({ name: '', email: '', address: '', phone: '' });
      setInvoiceProductSearch('');
      setDiscount(0);
      setInvoiceType('sale');
    }
    setInvoiceProductSearch('');
  }, [editingInvoice, products, allInvoices]); // Depend on allInvoices from context

  const handleCloseInvoiceModal = useCallback(() => {
    setShowInvoiceModal(false);
    setEditingInvoice(null);
    setCurrentInvoice(null);
    setInvoiceItems([]);
    setCustomerInfo({ name: '', email: '', address: '', phone: '' });
    setInvoiceProductSearch('');
    setDiscount(0);
    setInvoiceType('sale');
  }, [setShowInvoiceModal, setEditingInvoice]);

  const filteredInvoiceProducts = useMemo(() => products.filter(product =>
    (product.name || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.sku || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.category || '').toLowerCase().includes(invoiceProductSearch.toLowerCase())
  ), [products, invoiceProductSearch]);

  const addItemToInvoice = useCallback((product: Product) => {
    const existingItemIndex = invoiceItems.findIndex(item => item.productId === product.id);
    if (existingItemIndex > -1) {
      setInvoiceItems(prevItems => prevItems.map((item, index) =>
        index === existingItemIndex
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setInvoiceItems(prevItems => [...prevItems, {
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
  }, [invoiceItems]);

  const updateInvoiceItemQuantity = useCallback((productId: string, newQuantity: number) => {
    setInvoiceItems(prevItems => {
      return prevItems.map(item => {
        if (item.productId === productId) {
          // Safety Logic: Allow Negative QTY ONLY for Return & Damaged
          if (invoiceType === 'sale' && newQuantity < 0) {
            toast.error("Sale invoice items cannot have negative quantity.");
            return item;
          }
          if (newQuantity === 0) {
            toast.warning("Quantity is zero - this item will have no effect on stock.");
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
    });
  }, [invoiceType]);

  const updateInvoiceItemDiscount = useCallback((productId: string, discount: number) => {
    setInvoiceItems(prevItems => prevItems.map(item =>
      item.productId === productId
        ? { ...item, discount: Math.max(0, Math.min(100, discount)) }
        : item
    ));
  }, []);

  const removeInvoiceItem = useCallback((productId: string) => {
    setInvoiceItems(prevItems => prevItems.filter(item => item.productId !== productId));
    toast.success("Item removed from invoice");
  }, []);

  const clearAllInvoiceItems = useCallback(() => {
    if (invoiceItems.length === 0) {
      toast.error("No items to clear");
      return;
    }
    
    if (window.confirm(`Are you sure you want to remove all ${invoiceItems.length} items from this invoice?`)) {
      setInvoiceItems([]);
      toast.success("All items cleared from invoice");
    }
  }, [invoiceItems]);

  const handleSaveInvoice = useCallback(async () => {
    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }

    const { subtotal, discount: calculatedDiscountAmount, total } = calculateInvoiceTotals(invoiceItems, discount);
    
    const newItems = invoiceItems.map(item => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      price: parseFloat(item.price.toFixed(2)),
      quantity: item.quantity,
      purchasePrice: parseFloat(item.purchasePrice?.toFixed(2) || '0'),
      discount: parseFloat(item.discount?.toFixed(2) || '0'),
    }));

    const invoicePayloadBase: Omit<Invoice, 'id'> = {
      number: currentInvoice!.number,
      date: currentInvoice!.date,
      customer: customerInfo,
      subtotal: subtotal,
      discount: calculatedDiscountAmount,
      discountPercentage: parseFloat(discount.toFixed(2)),
      total: total,
      status: 'saved',
      items: newItems,
      invoiceType,
      itemsIds: newItems.map(item => item.productId),
      createdAt: currentInvoice?.createdAt || new Date(),
      updatedAt: new Date(),
      buyerName: customerInfo.name,
      buyerEmail: customerInfo.email,
      buyerAddress: customerInfo.address,
    };

    try {
      const batch = writeBatch(db); // Corrected: use writeBatch
      
      // If editing an existing invoice, first revert its previous stock changes
      if (editingInvoice) {
        const previousInvoice = allInvoices.find(inv => inv.id === editingInvoice.id);
        if (previousInvoice) {
          // Safety Logic: Prevent Editing Deleted Invoice
          if (previousInvoice.deletedAt) {
            throw new Error("Cannot edit a deleted invoice. Please restore it first.");
          }

          for (const item of previousInvoice.items) {
            const productRef = doc(db, 'products', item.productId);
            const product = products.find(p => p.id === item.productId);
            if (!product) {
              throw new Error(`Product "${item.name}" (ID: ${item.productId}) not found. Cannot revert previous stock changes.`);
            }
            let newOnHand = product.onHand;
            // Reverse previous effect
            if (previousInvoice.invoiceType === 'sale' || previousInvoice.invoiceType === 'gifted-damaged') {
              newOnHand += item.quantity;
            } else if (previousInvoice.invoiceType === 'return') {
              newOnHand -= item.quantity;
            }
            batch.update(productRef, { onHand: newOnHand });
          }
        }
      }

      // Apply new stock changes and safety checks
      for (const item of newItems) {
        // Safety Logic: Verify Product Exists
        const productRef = doc(db, 'products', item.productId);
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          throw new Error(`Product "${item.name}" (ID: ${item.productId}) not found. Cannot update stock.`);
        }

        // Safety Logic: Allow Negative QTY ONLY for Return & Damaged
        if (invoicePayloadBase.invoiceType === 'sale' && item.quantity < 0) {
          throw new Error(`Sale invoice item "${item.name}" cannot have negative quantity.`);
        }
        if (item.quantity === 0) {
          toast.warning(`Item "${item.name}" has zero quantity and will not affect stock.`);
          continue; // Skip stock update for 0 quantity items
        }

        let newOnHand = product.onHand;
        // Base Math: Apply new effect
        if (invoicePayloadBase.invoiceType === 'sale' || invoicePayloadBase.invoiceType === 'gifted-damaged') {
          newOnHand -= item.quantity;
        } else if (invoicePayloadBase.invoiceType === 'return') {
          newOnHand += item.quantity;
        }
        
        // Safety Logic: Prevent Negative Stock (Except where allowed)
        if (newOnHand < 0 && (invoicePayloadBase.invoiceType === 'sale' || invoicePayloadBase.invoiceType === 'gifted-damaged')) {
          throw new Error(`Cannot save invoice: Product "${item.name}" would go into negative stock (${newOnHand}). Current: ${product.onHand}, Change: -${item.quantity}`);
        }
        batch.update(productRef, { onHand: newOnHand });
      }
      
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, invoicePayloadBase);
      } else {
        // Safety Logic: Detect Duplicate Invoices (basic check for invoice number)
        const isDuplicateNumber = allInvoices.some(inv => inv.number === invoicePayloadBase.number && !inv.deletedAt);
        if (isDuplicateNumber) {
          throw new Error(`Invoice number "${invoicePayloadBase.number}" already exists. Please use a unique number.`);
        }

        const newInvoiceRef = doc(collection(db, 'invoices'));
        batch.set(newInvoiceRef, invoicePayloadBase);
      }
      
      await batch.commit();
      await fetchProducts(); // Refresh products to reflect stock changes
      handleCloseInvoiceModal();
    } catch (error: any) {
      console.error('Error saving invoice or updating stock:', error);
      toast.error(`Failed to save invoice: ${error.message || 'Unknown error'}`);
    }
  }, [
    customerInfo,
    invoiceItems,
    discount,
    currentInvoice,
    invoiceType,
    editingInvoice,
    allInvoices,
    products,
    updateInvoice,
    createInvoice,
    fetchProducts,
    handleCloseInvoiceModal,
  ]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showInvoiceModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showInvoiceModal]);

  if (!showInvoiceModal || !currentInvoice) return null;

  const { subtotal, discount: calculatedDiscountAmount, total } = calculateInvoiceTotals(invoiceItems, discount);

  return (
    <div className="modal-overlay">
      <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
        <Card className="modal-panel-lg w-full flex flex-col animate-scale-in shadow-glow">
          
          {/* Header - Fixed at top */}
          <div className="flex justify-between items-center p-3 sm:p-6 border-b sticky top-0 bg-card z-10">
            <h2 className="text-lg sm:text-2xl font-bold truncate">{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</h2>
            <Button onClick={handleCloseInvoiceModal} variant="ghost" size="sm" className="flex-shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
          
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden modal-content">
              
              {/* LEFT SIDE - Products (Hidden on mobile, show as collapsible) */}
              <div className="w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r bg-muted/30 flex flex-col max-h-[40vh] sm:max-h-none">
                
                {/* Search Section */}
                <div className="p-3 sm:p-4 bg-primary/5 border-b">
                  <h3 className="font-bold text-sm sm:text-lg mb-2 text-primary">Search Products</h3>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={invoiceProductSearch}
                      onChange={(e) => setInvoiceProductSearch(e.target.value)}
                      className="pl-9 text-base"
                    />
                  </div>
                  {invoiceProductSearch && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Found {filteredInvoiceProducts.length} products
                    </p>
                  )}
                </div>
                
                {/* Products List - Scrollable */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-4 modal-search-results">
                  <div className="space-y-2">
                    {filteredInvoiceProducts.map(product => (
                      <Card
                        key={product.id}
                        onClick={() => addItemToInvoice(product)}
                        className="p-3 cursor-pointer hover:shadow-elegant transition-all duration-300 hover:border-primary/50 active:scale-[0.98]"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">{product.name}</h4>
                            <p className="text-xs text-muted-foreground truncate">SKU: {product.sku}</p>
                            <p className="text-primary font-semibold text-sm">{product.price.toFixed(2)} ден.</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">Stock: {product.onHand}</p>
                            <div className="rounded-full p-1.5 mt-1 bg-primary text-primary-foreground inline-flex">
                              <Plus className="h-3 w-3" />
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
                <div className="mb-4 sm:mb-6 grid grid-cols-2 gap-3 sm:gap-4"> {/* Adjusted spacing */}
                  <div>
                    <Label className="text-sm sm:text-base">Invoice Number</Label> {/* Adjusted font size */}
                    <Input
                      value={currentInvoice.number}
                      onChange={(e) => setCurrentInvoice({ ...currentInvoice, number: e.target.value })}
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoiceDate" className="text-sm sm:text-base">Invoice Date *</Label> {/* Adjusted font size */}
                    <Input
                      id="invoiceDate"
                      type="date"
                      value={currentInvoice.date}
                      onChange={(e) => setCurrentInvoice({ ...currentInvoice, date: e.target.value })}
                      className="text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Invoice Type */}
                <div className="mb-4 sm:mb-6"> {/* Adjusted spacing */}
                  <Label htmlFor="invoiceType" className="text-sm sm:text-base">Invoice Type</Label> {/* Adjusted font size */}
                  <select
                    id="invoiceType"
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value as 'sale' | 'return' | 'gifted-damaged')}
                    className="w-full p-2 border border-border rounded-md bg-background text-sm sm:text-base" /* Adjusted font size */
                  >
                    <option value="sale">Sale</option>
                    <option value="return">Return</option>
                    <option value="gifted-damaged">Gifted/Damaged</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sales decrease stock, Returns increase stock, Gifted/Damaged decreases stock.
                  </p>
                </div>

                  {/* Customer Information */}
                <div className="mb-4 sm:mb-6"> {/* Adjusted spacing */}
                  <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3">Customer Information</h3> {/* Adjusted font size and spacing */}
                  <div className="space-y-2 sm:space-y-3"> {/* Adjusted spacing */}
                    <Input
                      placeholder="Customer Name *"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="text-sm sm:text-base"
                    />
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                      className="text-sm sm:text-base"
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                      className="text-sm sm:text-base"
                      />
                    <Textarea
                      placeholder="Address"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                      rows={3}
                      className="text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="mb-4 sm:mb-6"> {/* Adjusted spacing */}
                  <div className="flex justify-between items-center mb-2 sm:mb-3"> {/* Adjusted spacing */}
                    <h3 className="font-bold text-base sm:text-lg">Invoice Items</h3> {/* Adjusted font size */}
                    {invoiceItems.length > 0 && (
                      <Button
                        onClick={clearAllInvoiceItems}
                        variant="outline"
                        size={isIOS ? "sm" : "default"} // Smaller button on iOS
                      >
                        <Trash className="h-3 w-3 sm:h-4 w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                        Clear All
                      </Button>
                    )}
                  </div>
                  {invoiceItems.length === 0 ? (
                    <Card className="p-6 sm:p-8 text-center"> {/* Adjusted padding */}
                      <p className="text-muted-foreground text-sm sm:text-base">Click products on the left to add them here</p> {/* Adjusted font size */}
                    </Card>
                  ) : (
                    <div className="space-y-2 sm:space-y-3"> {/* Adjusted spacing */}
                      {invoiceItems.map(item => {
                        const itemSubtotal = item.price * item.quantity;
                        const itemDiscountAmount = itemSubtotal * ((item.discount || 0) / 100);
                        const itemTotal = itemSubtotal - itemDiscountAmount;
                        
                        return (
                          <Card key={item.productId} className="p-3 sm:p-4"> {/* Adjusted padding */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm sm:text-base truncate">{item.name}</h4> {/* Adjusted font size */}
                                  <p className="text-xs text-muted-foreground truncate">{item.sku}</p> {/* Adjusted font size */}
                                </div>
                                <Button
                                  onClick={() => removeInvoiceItem(item.productId)}
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 w-7 sm:h-8 w-8 p-0 flex-shrink-0" // Adjusted size
                                >
                                  <X className="h-3 w-3 sm:h-4 w-4" /> {/* Adjusted icon size */}
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Quantity</Label>
                                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 sm:p-1"> {/* Adjusted padding */}
                                    <Button
                                      onClick={() => updateInvoiceItemQuantity(item.productId, item.quantity - 1)}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 sm:h-8 w-8 p-0" // Adjusted size
                                      disabled={item.quantity <= 1 && invoiceType === 'sale'}
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateInvoiceItemQuantity(item.productId, parseInt(e.target.value) || 0)}
                                      className="w-full h-7 sm:h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm sm:text-base" // Adjusted height and font size
                                      placeholder="0"
                                    />
                                    <Button
                                      onClick={() => updateInvoiceItemQuantity(item.productId, item.quantity + 1)}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 sm:h-8 w-8 p-0" // Adjusted size
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
                                    className="h-7 sm:h-8 text-sm sm:text-base" // Adjusted height and font size
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                              
                              <div className="text-right text-xs sm:text-sm space-y-1 pt-2 border-t"> {/* Adjusted font size and spacing */}
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
                    <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4"> {/* Adjusted padding and spacing */}
                      <div>
                        <Label htmlFor="discount" className="text-sm sm:text-base">Попуст (%)</Label> {/* Adjusted font size */}
                        <Input
                          id="discount"
                          type="number"
                          min="0"
                          max="100"
                          value={discount}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div className="space-y-1.5 sm:space-y-2 text-right text-sm sm:text-base"> {/* Adjusted spacing and font size */}
                          <div className="flex justify-between">
                            <span>Мегузбир:</span>
                            <span>{subtotal.toFixed(2)} ден.</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-success">
                              <span>Попуст ({discount}%):</span>
                              <span>-{calculatedDiscountAmount.toFixed(2)} ден.</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-base sm:text-lg border-t pt-2"> {/* Adjusted font size and padding */}
                            <span>ВКУПНО:</span>
                            <span className="text-primary">{total.toFixed(2)} ден.</span>
                          </div>
                      </div>
                    </Card>
                  )}

              </div>
              
            </div>
            
            {/* Footer Buttons - Sticky at bottom */}
            <div className="modal-footer flex justify-end gap-2">
              <Button
                onClick={handleCloseInvoiceModal}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveInvoice}
                disabled={invoiceItems.length === 0 || !customerInfo.name.trim()}
                className="bg-success"
                size="sm"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Invoice
              </Button>
            </div>
            
          </Card>
        </div>
      </div>
  );
};

export default InvoiceModal;