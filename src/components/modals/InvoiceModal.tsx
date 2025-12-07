import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Trash, X, Save } from 'lucide-react';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore'; // Added query, where, getDocs
import { Product, Invoice, InvoiceItem } from '@/types';
import { toast } from "sonner";
import { AppContext } from '@/context/AppContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import { calculateInvoiceTotals } from '@/utils/invoiceCalculations';
import { useDeviceType } from '@/hooks/useDeviceType';
import { debugLog } from '@/utils/debugLog'; // Import debugLog
import { invoiceService } from '@/services/firestore/invoiceService'; // Import invoiceService to access new helper

interface InvoiceModalProps {
  showInvoiceModal: boolean;
  setShowInvoiceModal: (show: boolean) => void;
  editingInvoice: Invoice | null;
  setEditingInvoice: (invoice: Invoice | null) => void;
}

const invoiceNumberRegex = /^[0-9]{3}\/[0-9]{2}$/; // Validation regex

const InvoiceModal: React.FC<InvoiceModalProps> = ({
  showInvoiceModal,
  setShowInvoiceModal,
  editingInvoice,
  setEditingInvoice,
}) => {
  const { currentUser, products, invoices: allInvoices } = useContext(AppContext);
  const { createInvoice, updateInvoice } = useInvoices();
  const { fetchProducts } = useProducts(); // To refresh product list after stock changes
  const { isIOS } = useDeviceType();

  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', address: '', phone: '' });
  const [invoiceProductSearch, setInvoiceProductSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [invoiceType, setInvoiceType] = useState<'sale' | 'return' | 'gifted-damaged' | 'cash'>('sale');
  
  // New states for manual invoice number entry and validation
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState('');
  const [invoiceNumberError, setInvoiceNumberError] = useState<string | null>(null);
  const [isDuplicateInvoiceNumber, setIsDuplicateInvoiceNumber] = useState(false);


  useEffect(() => {
    const initializeInvoiceData = async () => {
      if (!editingInvoice) { // Only for new invoices
        debugLog("InvoiceModal: Initializing new invoice.");
        const latestInvoiceNumber = await invoiceService._getLatestInvoiceNumber();
        
        setCurrentInvoice({
          id: Date.now().toString(), // Temporary ID
          number: '', // Will be set by manualInvoiceNumber
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
        setManualInvoiceNumber(latestInvoiceNumber); // Pre-fill with the last invoice number
        setInvoiceNumberError(null);
        setIsDuplicateInvoiceNumber(false);
        setInvoiceItems([]);
        setCustomerInfo({ name: '', email: '', address: '', phone: '' });
        setDiscount(0);
        setInvoiceType('sale');
      } else {
        // For existing invoices, populate with existing data
        debugLog("InvoiceModal: Initializing existing invoice for editing:", editingInvoice.number);
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
          invoiceType: editingInvoice.invoiceType as 'sale' | 'return' | 'gifted-damaged' | 'cash' || 'sale',
          itemsIds: editingInvoice.itemsIds || [],
          createdAt: editingInvoice.createdAt,
          buyerName: editingInvoice.buyerName || '',
          buyerEmail: editingInvoice.buyerEmail || '',
          buyerAddress: editingInvoice.buyerAddress || '',
        });

        setManualInvoiceNumber(editingInvoice.number); // Set manual input for editing
        setInvoiceNumberError(null);
        setIsDuplicateInvoiceNumber(false);

        const refreshedItems = editingInvoice.items.map((item) => {
          const latestProduct = products.find(p => p.id === item.productId);
          return latestProduct
            ? {
                ...item,
                name: latestProduct.name,
                sku: latestProduct.sku,
                price: item.price ?? latestProduct.price, 
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
        setInvoiceType(editingInvoice.invoiceType as 'sale' | 'return' | 'gifted-damaged' | 'cash' || 'sale');
      }
      setInvoiceProductSearch('');
    };

    if (showInvoiceModal) {
      initializeInvoiceData();
    }
  }, [editingInvoice, showInvoiceModal, products]); // Added products to dependency array

  const handleCloseInvoiceModal = useCallback(() => {
    setShowInvoiceModal(false);
    setEditingInvoice(null);
    setCurrentInvoice(null); // Ensure currentInvoice is reset
    setInvoiceItems([]);
    setCustomerInfo({ name: '', email: '', address: '', phone: '' });
    setInvoiceProductSearch('');
    setDiscount(0);
    setInvoiceType('sale');
    setManualInvoiceNumber(''); // Reset manual input
    setInvoiceNumberError(null);
    setIsDuplicateInvoiceNumber(false);
  }, [setShowInvoiceModal, setEditingInvoice]);

  const validateManualInvoiceNumber = useCallback(async (number: string) => {
    if (!number.trim()) {
      setInvoiceNumberError("Invoice number is required.");
      setIsDuplicateInvoiceNumber(false);
      return false;
    }
    if (!invoiceNumberRegex.test(number)) {
      setInvoiceNumberError("Format must be ###/YY (e.g., 001/25)");
      setIsDuplicateInvoiceNumber(false);
      return false;
    }

    // Check for duplicates in Firestore
    const invoicesColRef = collection(db, 'invoices');
    const q = query(invoicesColRef, where("number", "==", number));
    const querySnapshot = await getDocs(q);

    let isDuplicate = false;
    if (!querySnapshot.empty) {
      // If editing, allow the current invoice to have its own number
      if (editingInvoice && querySnapshot.docs.some(doc => doc.id === editingInvoice.id)) {
        isDuplicate = false; // It's the same invoice being edited
      } else {
        isDuplicate = true;
      }
    }
    
    setIsDuplicateInvoiceNumber(isDuplicate);
    if (isDuplicate) {
      setInvoiceNumberError(`Invoice number "${number}" already exists.`);
      return false;
    }

    setInvoiceNumberError(null);
    return true;
  }, [editingInvoice]);

  const handleManualInvoiceNumberChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualInvoiceNumber(value);
    // Validate immediately, but also before saving
    await validateManualInvoiceNumber(value);
  }, [validateManualInvoiceNumber]);


  const filteredInvoiceProducts = useMemo(() => products.filter(product =>
    (product.name || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.sku || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.category || '').toLowerCase().includes(invoiceProductSearch.toLowerCase())
  ), [products, invoiceProductSearch]);

  const addItemToInvoice = useCallback((product: Product) => {
    const existingItemIndex = invoiceItems.findIndex(item => item.productId === product.id);
    // For return invoices, quantity should be negative (restores stock)
    const initialQuantity = invoiceType === 'return' ? -1 : 1;
    
    if (existingItemIndex > -1) {
      setInvoiceItems(prevItems => prevItems.map((item, index) =>
        index === existingItemIndex
          ? { ...item, quantity: invoiceType === 'return' ? item.quantity - 1 : item.quantity + 1 }
          : item
      ));
    } else {
      setInvoiceItems(prevItems => [...prevItems, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price, // Default to product's sale price
        quantity: initialQuantity,
        purchasePrice: product.purchasePrice || 0,
        discount: 0
      }]);
    }
    toast.success(`${product.name} added to invoice`);
  }, [invoiceItems, invoiceType]);

  const updateInvoiceItemQuantity = useCallback((productId: string, newQuantity: number) => {
    setInvoiceItems(prevItems => {
      return prevItems.map(item => {
        if (item.productId === productId) {
          // Return invoices: quantity must always be negative (or zero)
          if (invoiceType === 'return') {
            if (newQuantity > 0) {
              toast.error("Return invoice items must have negative quantity (restores stock).");
              return item;
            }
          } else if (invoiceType === 'sale' || invoiceType === 'cash') {
            // Sale and Cash invoices: quantity must be positive
            if (newQuantity < 0) {
              toast.error("Sale/Cash invoice items cannot have negative quantity.");
              return item;
            }
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

  const updateInvoiceItemPrice = useCallback((productId: string, newPrice: number) => {
    setInvoiceItems(prevItems => prevItems.map(item =>
      item.productId === productId
        ? { ...item, price: Math.max(0, newPrice) } // Ensure price is non-negative
        : item
    ));
  }, []);

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
    if (!currentInvoice) {
      toast.error("Invoice data not initialized.");
      return;
    }
    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }

    // Re-validate invoice number before saving
    const isInvoiceNumberValid = await validateManualInvoiceNumber(manualInvoiceNumber);
    if (!isInvoiceNumberValid) {
      toast.error(invoiceNumberError || "Please fix the invoice number errors.");
      return;
    }
    if (isDuplicateInvoiceNumber) {
      toast.error(`Invoice number "${manualInvoiceNumber}" already exists.`);
      return;
    }

    const { subtotal, discount: calculatedDiscountAmount, total } = calculateInvoiceTotals(invoiceItems, discount);
    
    const newItems = invoiceItems.map(item => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      price: parseFloat(item.price.toFixed(2)), // Use the potentially overridden price
      quantity: item.quantity,
      purchasePrice: parseFloat(item.purchasePrice?.toFixed(2) || '0'),
      discount: parseFloat(item.discount?.toFixed(2) || '0'),
    }));

    // --- START: Robust Validation ---
    // Validate newItems for completeness and valid numbers
    for (const item of newItems) {
      if (!item.productId || !item.name || !item.sku) {
        toast.error(`Invoice item is missing critical information (ID, name, or SKU).`);
        return;
      }
      if (isNaN(item.price) || isNaN(item.quantity)) {
        toast.error(`Invoice item "${item.name}" has invalid price or quantity.`);
        return;
      }
      if (item.purchasePrice !== undefined && isNaN(item.purchasePrice)) {
        toast.error(`Invoice item "${item.name}" has an invalid purchase price.`);
        return;
      }
      if (item.discount !== undefined && isNaN(item.discount)) {
        toast.error(`Invoice item "${item.name}" has an invalid discount value.`);
        return;
      }
    }

    // Validate top-level invoice fields
    if (!currentInvoice.date) {
      toast.error("Invoice date is missing.");
      return;
    }
    if (!customerInfo.name) {
      toast.error("Customer name is missing.");
      return;
    }
    if (isNaN(subtotal) || isNaN(calculatedDiscountAmount) || isNaN(total)) {
      toast.error("Calculated invoice totals are invalid. Please check item prices and quantities.");
      return;
    }
    // --- END: Robust Validation ---

    const invoicePayloadBase: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = { // Removed 'number' from Omit
      number: manualInvoiceNumber, // Use the manually entered number
      date: currentInvoice.date,
      customer: customerInfo,
      subtotal: subtotal,
      discount: calculatedDiscountAmount,
      discountPercentage: parseFloat(discount.toFixed(2)),
      total: total,
      status: 'saved',
      items: newItems,
      invoiceType,
      itemsIds: newItems.map(item => item.productId),
      buyerName: customerInfo.name,
      buyerEmail: customerInfo.email,
      buyerAddress: customerInfo.address,
    };

    try {
      const batch = writeBatch(db);
      const productStockMap = new Map<string, number>(); // Map to store initial onHand for calculation
      const productNetStockChanges = new Map<string, number>(); // Map to store net changes

      // Populate productStockMap with current onHand values
      products.forEach(p => productStockMap.set(p.id, p.onHand));

      // If editing an existing invoice, calculate "revert" changes first
      if (editingInvoice) {
        const previousInvoice = allInvoices.find(inv => inv.id === editingInvoice.id);
        if (previousInvoice) {
          if (previousInvoice.deletedAt) {
            throw new Error("Cannot edit a deleted invoice. Please restore it first.");
          }

          for (const item of previousInvoice.items) {
            const productId = item.productId;
            const quantityToRevert = item.quantity ?? 0;
            let change = 0;

            if (previousInvoice.invoiceType === 'sale' || previousInvoice.invoiceType === 'cash' || previousInvoice.invoiceType === 'gifted-damaged') {
              change = quantityToRevert; // Add back what was subtracted
            } else if (previousInvoice.invoiceType === 'return') {
              change = quantityToRevert; // qty is negative, so adding it back subtracts stock
            }
            productNetStockChanges.set(productId, (productNetStockChanges.get(productId) || 0) + change);
          }
        }
      }

      // Apply new stock changes
      for (const item of newItems) {
        const productId = item.productId;
        const quantityToApply = item.quantity ?? 0;
        let change = 0;

        if (invoicePayloadBase.invoiceType === 'sale' || invoicePayloadBase.invoiceType === 'cash' || invoicePayloadBase.invoiceType === 'gifted-damaged') {
          change = -quantityToApply; // Subtract for sales/cash/gifted
        } else if (invoicePayloadBase.invoiceType === 'return') {
          change = -quantityToApply; // qty is negative, so subtracting negative = adding stock
        }
        productNetStockChanges.set(productId, (productNetStockChanges.get(productId) || 0) + change);
      }

      // Apply net changes to products in the batch
      for (const [productId, netChange] of productNetStockChanges.entries()) {
        const productRef = doc(db, 'products', productId);
        const initialOnHand = productStockMap.get(productId);
        const product = products.find(p => p.id === productId); // Get product for name/error messages

        if (initialOnHand === undefined || !product) {
          throw new Error(`Product (ID: ${productId}) not found. Cannot update stock.`);
        }

        const newOnHand = initialOnHand + netChange;

        // Safety Logic: Prevent Negative Stock (Except where allowed)
        // Only check for negative stock if the invoice type is one that typically reduces stock
        if (newOnHand < 0 && (invoicePayloadBase.invoiceType === 'sale' || invoicePayloadBase.invoiceType === 'cash' || invoicePayloadBase.invoiceType === 'gifted-damaged')) {
          throw new Error(`Cannot save invoice: Product "${product.name}" would go into negative stock (${newOnHand}). Current: ${initialOnHand}, Net Change: ${netChange}`);
        }
        
        batch.update(productRef, { onHand: newOnHand });
      }
      
      // Add invoice update/create to the batch
      if (editingInvoice) {
        // For existing invoices, the number is already set and should not be re-generated
        await updateInvoice(editingInvoice.id, invoicePayloadBase); // Pass the full payload including number
        debugLog("Invoice updated successfully. ID:", editingInvoice.id, "Number:", manualInvoiceNumber);
        toast.success(`Invoice ${manualInvoiceNumber} updated successfully!`);
      } else {
        // For new invoices, the createInvoice service will handle number generation transactionally
        const { invoiceId, invoiceNumber } = await createInvoice(invoicePayloadBase); // Pass the pre-filled number
        debugLog("Invoice created successfully. Final ID:", invoiceId, "Number:", invoiceNumber); // Log as requested
        toast.success(`Invoice ${invoiceNumber} created successfully!`);
      }
      
      await batch.commit();
      await fetchProducts(); // Refresh products to reflect stock changes
      handleCloseInvoiceModal();
    } catch (error: any) {
      debugLog("ERROR in InvoiceModal.tsx (handleSaveInvoice):", error, error?.stack);
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
    manualInvoiceNumber,
    validateManualInvoiceNumber,
    invoiceNumberError,
    isDuplicateInvoiceNumber,
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

  const isSaveDisabled = invoiceItems.length === 0 || !customerInfo.name.trim() || !!invoiceNumberError || isDuplicateInvoiceNumber || !manualInvoiceNumber.trim();

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
                <div className="mb-4 sm:mb-6 grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="invoiceNumber" className="text-sm sm:text-base">Invoice Number *</Label>
                    <Input
                      id="invoiceNumber"
                      value={manualInvoiceNumber}
                      onChange={handleManualInvoiceNumberChange}
                      placeholder="e.g., 001/25"
                      className={`text-sm sm:text-base ${invoiceNumberError ? 'border-destructive' : ''}`}
                    />
                    {invoiceNumberError && (
                      <p className="text-xs text-destructive mt-1">{invoiceNumberError}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="invoiceDate" className="text-sm sm:text-base">Invoice Date *</Label>
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
                <div className="mb-4 sm:mb-6">
                  <Label htmlFor="invoiceType" className="text-sm sm:text-base">Invoice Type</Label>
                  <select
                    id="invoiceType"
                    value={invoiceType}
                    onChange={(e) => {
                      const newType = e.target.value as 'sale' | 'return' | 'gifted-damaged' | 'cash';
                      setInvoiceType(newType);
                      // Auto-convert quantities when switching to/from return
                      if (newType === 'return') {
                        setInvoiceItems(prevItems => prevItems.map(item => ({
                          ...item,
                          quantity: item.quantity > 0 ? -item.quantity : item.quantity
                        })));
                      } else if (invoiceType === 'return') {
                        // Switching from return to another type - make quantities positive
                        setInvoiceItems(prevItems => prevItems.map(item => ({
                          ...item,
                          quantity: Math.abs(item.quantity)
                        })));
                      }
                    }}
                    className="w-full p-2 border border-border rounded-md bg-background text-sm sm:text-base"
                  >
                    <option value="sale">Sale</option>
                    <option value="cash">Cash</option>
                    <option value="return">Return</option>
                    <option value="gifted-damaged">Gifted/Damaged</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {invoiceType === 'return' 
                      ? 'Return invoices restore stock (auto-negative quantity).'
                      : invoiceType === 'cash'
                        ? 'Cash invoices decrease stock (same as sale).'
                        : 'Sales/Cash decrease stock, Returns increase stock, Gifted/Damaged decreases stock.'}
                  </p>
                </div>

                  {/* Customer Information */}
                <div className="mb-4 sm:mb-6">
                  <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3">Customer Information</h3>
                  <div className="space-y-2 sm:space-y-3">
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
                <div className="mb-4 sm:mb-6">
                  <div className="flex justify-between items-center mb-2 sm:mb-3">
                    <h3 className="font-bold text-base sm:text-lg">Invoice Items</h3>
                    {invoiceItems.length > 0 && (
                      <Button
                        onClick={clearAllInvoiceItems}
                        variant="outline"
                        size={isIOS ? "sm" : "default"}
                      >
                        <Trash className="h-3 w-3 sm:h-4 w-4 mr-1 sm:mr-2" />
                        Clear All
                      </Button>
                    )}
                  </div>
                  {invoiceItems.length === 0 ? (
                    <Card className="p-6 sm:p-8 text-center">
                      <p className="text-muted-foreground text-sm sm:text-base">Click products on the left to add them here</p>
                    </Card>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {invoiceItems.map(item => {
                        const itemSubtotal = item.price * item.quantity;
                        const itemDiscountAmount = itemSubtotal * ((item.discount || 0) / 100);
                        const itemTotal = itemSubtotal - itemDiscountAmount;
                        
                        return (
                          <Card key={item.productId} className="p-3 sm:p-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm sm:text-base truncate">{item.name}</h4>
                                  <p className="text-xs text-muted-foreground truncate">SKU: {item.sku}</p>
                                </div>
                                <Button
                                  onClick={() => removeInvoiceItem(item.productId)}
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 w-7 sm:h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <X className="h-3 w-3 sm:h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2"> {/* Changed to 3 columns for price */}
                                <div>
                                  <Label className="text-xs">Quantity</Label>
                                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 sm:p-1">
                                    <Button
                                      onClick={() => updateInvoiceItemQuantity(item.productId, item.quantity - 1)}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 sm:h-8 w-8 p-0"
                                      disabled={item.quantity <= 1 && invoiceType === 'sale'}
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateInvoiceItemQuantity(item.productId, parseInt(e.target.value) || 0)}
                                      className="w-full h-7 sm:h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm sm:text-base"
                                      placeholder="0"
                                    />
                                    <Button
                                      onClick={() => updateInvoiceItemQuantity(item.productId, item.quantity + 1)}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 sm:h-8 w-8 p-0"
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                                
                                <div> {/* New Price Input */}
                                  <Label className="text-xs">Price</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.price}
                                    onChange={(e) => updateInvoiceItemPrice(item.productId, parseFloat(e.target.value) || 0)}
                                    className="h-7 sm:h-8 text-sm sm:text-base"
                                    placeholder="0.00"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Discount (%)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={item.discount || 0}
                                    onChange={(e) => updateInvoiceItemDiscount(item.productId, parseFloat(e.target.value) || 0)}
                                    className="h-7 sm:h-8 text-sm sm:text-base"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                              
                              <div className="text-right text-xs sm:text-sm space-y-1 pt-2 border-t">
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
                    <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                      <div>
                        <Label htmlFor="discount" className="text-sm sm:text-base">Попуст (%)</Label>
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
                      <div className="space-y-1.5 sm:space-y-2 text-right text-sm sm:text-base">
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
                          <div className="flex justify-between font-bold text-base sm:text-lg border-t pt-2">
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
                disabled={isSaveDisabled}
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