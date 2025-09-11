import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit, Trash2, Package, FileText, Upload, Download, Save, Printer, X, Eye, Calendar, DollarSign, Hash, ShoppingCart, CheckSquare, Square, Trash, FileDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

const InventoryManagementApp = () => {
  // State management
  const [activeTab, setActiveTab] = useState('inventory');
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', address: '' });
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [invoiceProductSearch, setInvoiceProductSearch] = useState('');
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showColumnMappingModal, setShowColumnMappingModal] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [excelColumns, setExcelColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    sku: '',
    quantity: '',
    price: '',
    category: ''
  });
  const fileInputRef = useRef(null);

  // Load data from Firebase on component mount
  useEffect(() => {
    loadProducts();
    loadInvoices();
  }, []);

  const loadProducts = async () => {
    try {
      const productsQuery = query(collection(db, 'products'), orderBy('name'));
      const querySnapshot = await getDocs(productsQuery);
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const invoicesQuery = query(collection(db, 'invoices'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(invoicesQuery);
      const invoicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('Failed to load invoices');
    }
  };

  // Product form state
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    quantity: '',
    price: '',
    category: ''
  });

  // Filter products for invoice creation
  const filteredInvoiceProducts = products.filter(product =>
    product.name.toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    product.sku.toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    product.category.toLowerCase().includes(invoiceProductSearch.toLowerCase())
  );

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Selection handlers
  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAllProducts = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleInvoiceSelection = (invoiceId) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const selectAllInvoices = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map(i => i.id)));
    }
  };

  // Product CRUD operations
  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', sku: '', quantity: '', price: '', category: '' });
    setShowProductModal(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      quantity: product.quantity.toString(),
      price: product.price.toString(),
      category: product.category
    });
    setShowProductModal(true);
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
      category: productForm.category
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success("Product updated successfully");
      } else {
        await addDoc(collection(db, 'products'), productData);
        toast.success("Product added successfully");
      }
      
      setShowProductModal(false);
      setProductForm({ name: '', sku: '', quantity: '', price: '', category: '' });
      loadProducts(); // Reload products from Firebase
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  // DELETE FUNCTIONS - Multiple implementations

  // 1. Delete single product
  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        toast.success("Product deleted successfully");
        loadProducts(); // Reload products from Firebase
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('Failed to delete product');
      }
    }
  };

  // 2. Bulk delete products
  const handleBulkDeleteProducts = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Please select products to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedProducts.size} selected product(s)?`)) {
      try {
        const deletePromises = Array.from(selectedProducts).map((productId) =>
          deleteDoc(doc(db, 'products', productId))
        );
        await Promise.all(deletePromises);
        setSelectedProducts(new Set());
        toast.success(`${selectedProducts.size} products deleted successfully`);
        loadProducts(); // Reload products from Firebase
      } catch (error) {
        console.error('Error bulk deleting products:', error);
        toast.error('Failed to delete products');
      }
    }
  };

  // 3. Delete all products
  const handleDeleteAllProducts = async () => {
    if (products.length === 0) {
      toast.error("No products to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ALL ${products.length} products? This action cannot be undone.`)) {
      try {
        const deletePromises = products.map((product) =>
          deleteDoc(doc(db, 'products', product.id))
        );
        await Promise.all(deletePromises);
        setSelectedProducts(new Set());
        toast.success("All products deleted successfully");
        loadProducts(); // Reload products from Firebase
      } catch (error) {
        console.error('Error deleting all products:', error);
        toast.error('Failed to delete all products');
      }
    }
  };

  // 4. Delete single invoice
  const handleDeleteInvoice = (invoiceId) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      setInvoices(invoices.filter(i => i.id !== invoiceId));
      toast.success("Invoice deleted successfully");
    }
  };

  // 5. Bulk delete invoices
  const handleBulkDeleteInvoices = () => {
    if (selectedInvoices.size === 0) {
      toast.error("Please select invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedInvoices.size} selected invoice(s)?`)) {
      setInvoices(invoices.filter(i => !selectedInvoices.has(i.id)));
      setSelectedInvoices(new Set());
      toast.success(`${selectedInvoices.size} invoices deleted successfully`);
    }
  };

  // 6. Delete all invoices
  const handleDeleteAllInvoices = () => {
    if (invoices.length === 0) {
      toast.error("No invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ALL ${invoices.length} invoices? This action cannot be undone.`)) {
      setInvoices([]);
      setSelectedInvoices(new Set());
      toast.success("All invoices deleted successfully");
    }
  };

  // 7. Remove invoice item (in invoice creation modal)
  const removeInvoiceItem = (productId) => {
    setInvoiceItems(invoiceItems.filter(item => item.productId !== productId));
    toast.success("Item removed from invoice");
  };

  // 8. Clear all invoice items
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

  // 9. Clear all data (nuclear option)
  const handleClearAllData = () => {
    if (products.length === 0 && invoices.length === 0) {
      toast.error("No data to clear");
      return;
    }
    
    if (window.confirm("⚠️ WARNING: This will delete ALL products and invoices permanently. This action cannot be undone. Are you absolutely sure?")) {
      setProducts([]);
      setInvoices([]);
      setSelectedProducts(new Set());
      setSelectedInvoices(new Set());
      toast.success("All data cleared successfully");
    }
  };

  // Invoice operations
  const handleCreateInvoice = () => {
    const newInvoice = {
      id: Date.now().toString(),
      number: `INV-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      customer: { name: '', email: '', address: '' },
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      status: 'draft'
    };
    setCurrentInvoice(newInvoice);
    setInvoiceItems([]);
    setCustomerInfo({ name: '', email: '', address: '' });
    setInvoiceProductSearch('');
    setShowInvoiceModal(true);
    toast.success('Invoice modal opened');
  };

  const handleViewInvoice = (invoice) => {
    setViewingInvoice(invoice);
    setShowInvoiceViewer(true);
  };

  const addItemToInvoice = (product) => {
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
        quantity: 1
      }]);
    }
    toast.success(`${product.name} added to invoice`);
  };

  const updateInvoiceItemQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeInvoiceItem(productId);
    } else {
      setInvoiceItems(invoiceItems.map(item =>
        item.productId === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const calculateInvoiceTotal = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSaveInvoice = async () => {
    // Validation
    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }

    const { subtotal, tax, total } = calculateInvoiceTotal();
    const invoiceData = {
      number: currentInvoice.number,
      date: currentInvoice.date,
      customer: customerInfo,
      items: invoiceItems,
      subtotal,
      tax,
      total,
      status: 'saved'
    };

    try {
      // Save invoice to Firebase
      await addDoc(collection(db, 'invoices'), invoiceData);

      // Update product quantities in Firebase
      const updatePromises = invoiceItems.map(async (item) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const newQuantity = Math.max(0, product.quantity - item.quantity);
          await updateDoc(doc(db, 'products', item.productId), { quantity: newQuantity });
        }
      });
      await Promise.all(updatePromises);

      setShowInvoiceModal(false);
      setCurrentInvoice(null);
      setInvoiceItems([]);
      setCustomerInfo({ name: '', email: '', address: '' });
      setCustomInvoiceNumber('');
      setInvoiceProductSearch('');
      
      toast.success('Invoice saved successfully!');
      loadInvoices(); // Reload invoices from Firebase
      loadProducts(); // Reload products to reflect updated quantities
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    }
  };

  // Import/Export functions
  const handleImportExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        // Get column names from the first row
        const columns = Object.keys(jsonData[0]);
        
        // Store data and show mapping modal
        setExcelData(jsonData);
        setExcelColumns(columns);
        setColumnMapping({
          name: '',
          sku: '',
          quantity: '',
          price: '',
          category: ''
        });
        setShowColumnMappingModal(true);
        
      } catch (error) {
        toast.error("Error reading Excel file. Please check the format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!columnMapping.name || !columnMapping.sku || !columnMapping.quantity || !columnMapping.price) {
      toast.error("Please map all required fields (Name, SKU, Quantity, Price)");
      return;
    }

    try {
      const importedProducts = excelData.map((row) => ({
        name: row[columnMapping.name] || '',
        sku: row[columnMapping.sku] || '',
        quantity: parseInt(row[columnMapping.quantity] || 0),
        price: parseFloat(row[columnMapping.price] || 0),
        category: columnMapping.category ? (row[columnMapping.category] || 'Uncategorized') : 'Uncategorized'
      })).filter(product => product.name && product.sku); // Filter out invalid rows

      // Save all products to Firebase
      const importPromises = importedProducts.map((product) =>
        addDoc(collection(db, 'products'), product)
      );
      await Promise.all(importPromises);

      setShowColumnMappingModal(false);
      setExcelData([]);
      setExcelColumns([]);
      
      toast.success(`Successfully imported ${importedProducts.length} products!`);
      loadProducts(); // Reload products from Firebase
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('Failed to import products');
    }
  };

  const exportToCSV = (data, filename) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    toast.success(`${filename} exported successfully`);
  };

  const exportToJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    toast.success(`${filename} exported successfully`);
  };

  const printInvoice = () => {
    window.print();
  };

  const saveInvoiceAsPDF = async () => {
    try {
      const element = document.querySelector('[data-invoice-content]') as HTMLElement;
      if (!element) {
        toast.error('Invoice content not found');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${viewingInvoice?.number || 'invoice'}.pdf`);
      toast.success('Invoice saved as PDF successfully');
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Failed to save PDF');
    }
  };

  // Tab content components
  const InventoryTab = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Inventory Management</h2>
          <p className="text-muted-foreground mt-1">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-3">
          {selectedProducts.size > 0 && (
            <>
              <Button
                onClick={handleBulkDeleteProducts}
                variant="destructive"
                className="shadow-elegant"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedProducts.size})
              </Button>
            </>
          )}
          <Button
            onClick={handleAddProduct}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search and bulk actions */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              key="product-search"
              placeholder="Search products by name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={selectAllProducts}
              variant="outline"
              size="sm"
            >
              {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select All
                </>
              )}
            </Button>
            {products.length > 0 && (
              <Button
                onClick={handleDeleteAllProducts}
                variant="destructive"
                size="sm"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Products List - Single Column Rectangular Layout */}
      <div className="space-y-4">
        {filteredProducts.map(product => (
          <Card key={product.id} className="p-4 hover:shadow-glow transition-all duration-300 animate-scale-in bg-gradient-card">
          <div className="flex items-center justify-between min-h-16">
            {/* Left Section: Checkbox & Product Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Checkbox
                checked={selectedProducts.has(product.id)}
                onCheckedChange={() => toggleProductSelection(product.id)}
                className="flex-shrink-0"
              />
              <div className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg text-foreground truncate max-w-60">{product.name}</h3>
                    <p className="text-muted-foreground text-sm truncate max-w-60">SKU: {product.sku}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center min-w-20">
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium text-sm truncate max-w-20">{product.category}</p>
                    </div>
                    
                    <div className="text-center min-w-24">
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-medium text-primary text-sm">{product.price.toFixed(2)} ден.</p>
                    </div>
                    
                    <div className="text-center min-w-20">
                      <p className="text-sm text-muted-foreground">Stock</p>
                      <p className={`font-medium text-sm ${product.quantity < 10 ? 'text-destructive' : 'text-success'}`}>
                        {product.quantity}
                      </p>
                    </div>

                    {product.quantity < 10 && (
                      <div className="bg-warning/10 border border-warning/20 rounded-lg px-2 py-1 flex-shrink-0">
                        <p className="text-warning-foreground text-xs font-medium">⚠️ Low</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Section: Action Buttons */}
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <Button
                    onClick={() => handleEditProduct(product)}
                    variant="outline"
                    size="sm"
                    className="min-w-10"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteProduct(product.id)}
                    variant="destructive"
                    size="sm"
                    className="min-w-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No products found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? `No products match "${searchTerm}"` : "Start by adding your first product"}
          </p>
          <Button onClick={handleAddProduct}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Card>
      )}
    </div>
  );

  const InvoicesTab = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Invoice Management</h2>
          <p className="text-muted-foreground mt-1">Create and manage customer invoices</p>
        </div>
        <div className="flex gap-3">
          {selectedInvoices.size > 0 && (
            <Button
              onClick={handleBulkDeleteInvoices}
              variant="destructive"
              className="shadow-elegant"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedInvoices.size})
            </Button>
          )}
          <Button
            onClick={handleCreateInvoice}
            type="button"
            className="bg-success hover:shadow-glow transition-all duration-300"
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Invoice Actions */}
      <Card className="p-4 shadow-card">
        <div className="flex gap-2 justify-end">
          <Button
            onClick={selectAllInvoices}
            variant="outline"
            size="sm"
            disabled={invoices.length === 0}
          >
            {selectedInvoices.size === invoices.length && invoices.length > 0 ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                Select All
              </>
            )}
          </Button>
          {invoices.length > 0 && (
            <Button
              onClick={handleDeleteAllInvoices}
              variant="destructive"
              size="sm"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          )}
        </div>
      </Card>

      {/* Invoice History */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Invoice History</h3>
        </div>
        <div className="p-6">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No invoices created yet</h3>
              <p className="text-muted-foreground mb-4">Create your first invoice to get started</p>
              <Button onClick={handleCreateInvoice} type="button">
                <FileText className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map(invoice => (
                <Card key={invoice.id} className="p-4 hover:shadow-elegant transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedInvoices.has(invoice.id)}
                        onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                        className="mt-1"
                      />
                      <div>
                        <h4 className="font-semibold text-lg">{invoice.number}</h4>
                        <p className="text-muted-foreground">{invoice.customer.name}</p>
                        <p className="text-sm text-muted-foreground">{invoice.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-xl text-primary">{invoice.total.toFixed(2)} ден.</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'saved' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleViewInvoice(invoice)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const DataTab = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Data Management</h2>
        <p className="text-muted-foreground mt-1">Import, export, and manage your data</p>
      </div>

      {/* Danger Zone */}
      <Card className="border-destructive/20 shadow-card">
        <div className="p-6 border-b border-destructive/20">
          <h3 className="text-lg font-semibold text-destructive flex items-center">
            <Trash className="h-5 w-5 mr-2" />
            Danger Zone
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-destructive/5 p-4 rounded-lg">
            <h4 className="font-semibold text-destructive mb-2">Clear All Data</h4>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete all products and invoices. This action cannot be undone.
            </p>
            <Button
              onClick={handleClearAllData}
              variant="destructive"
              className="shadow-elegant"
            >
              <Trash className="h-4 w-4 mr-2" />
              Clear All Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Import Section */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Import Data</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-base font-medium">
              Import Products from Excel (.xlsx/.xls)
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Upload an Excel file with columns: name, sku, quantity, price, category
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="shadow-elegant"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Excel File
            </Button>
          </div>
        </div>
      </Card>

      {/* Export Section */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Export Data</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Inventory Exports</h4>
              <div className="space-y-3">
                <Button
                  onClick={() => exportToCSV(products, 'inventory-backup.csv')}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={products.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Inventory (CSV)
                </Button>
                <Button
                  onClick={() => exportToJSON(products, 'inventory-backup.json')}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={products.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Inventory (JSON)
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">Invoice Exports</h4>
              <div className="space-y-3">
                <Button
                  onClick={() => exportToCSV(invoices, 'invoice-log.csv')}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={invoices.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Invoice Log (CSV)
                </Button>
                <Button
                  onClick={() => exportToJSON(invoices, 'invoice-log.json')}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={invoices.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Invoice Log (JSON)
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Navigation */}
      <nav className="bg-card/80 backdrop-blur-sm shadow-elegant border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-gradient-primary p-2 rounded-lg">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="ml-3 text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">WeParty Inventory</span>
            </div>
            <div className="flex space-x-8">
              {[
                { key: 'inventory', label: 'Inventory', icon: Package },
                { key: 'invoices', label: 'Invoices', icon: FileText },
                { key: 'data', label: 'Data', icon: Upload }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-300 ${
                    activeTab === key
                      ? 'text-primary border-b-2 border-primary shadow-glow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'invoices' && <InvoicesTab />}
        {activeTab === 'data' && <DataTab />}
      </main>

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 animate-scale-in shadow-glow">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <Button
                  onClick={() => setShowProductModal(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
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
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  onClick={() => setShowProductModal(false)}
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
            </div>
          </Card>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && currentInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
          <div className="h-full flex items-center justify-center p-4">
            <Card className="w-full max-w-7xl h-5/6 flex flex-col animate-scale-in shadow-glow">
              
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-2xl font-bold">Create New Invoice</h2>
                <Button onClick={() => setShowInvoiceModal(false)} variant="ghost">
                  <X className="h-6 w-6" />
                </Button>
              </div>
              
              {/* Main Content Area */}
              <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT SIDE - Products */}
                <div className="w-1/2 border-r bg-muted/30 flex flex-col">
                  
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
                <div className="w-1/2 p-6 overflow-y-auto">
                  
                  {/* Invoice Number */}
                  <div className="mb-6">
                    <Label>Invoice Number</Label>
                    <Input
                      value={currentInvoice.number}
                      onChange={(e) => setCurrentInvoice({ ...currentInvoice, number: e.target.value })}
                    />
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
                        {invoiceItems.map(item => (
                          <Card key={item.productId} className="p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium">{item.name}</h4>
                                <p className="text-sm text-muted-foreground">{item.sku}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateInvoiceItemQuantity(item.productId, parseInt(e.target.value))}
                                  className="w-16 text-center"
                                />
                                 <span>× {item.price.toFixed(2)} ден.</span>
                                 <span className="font-bold">{(item.quantity * item.price).toFixed(2)} ден.</span>
                                <Button
                                  onClick={() => removeInvoiceItem(item.productId)}
                                  variant="destructive"
                                  size="sm"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  {invoiceItems.length > 0 && (
                    <Card className="p-4">
                      <div className="space-y-2 text-right">
                         <div className="flex justify-between">
                           <span>Subtotal:</span>
                           <span>{calculateInvoiceTotal().subtotal.toFixed(2)} ден.</span>
                         </div>
                         <div className="flex justify-between">
                           <span>Tax (10%):</span>
                           <span>{calculateInvoiceTotal().tax.toFixed(2)} ден.</span>
                         </div>
                         <div className="flex justify-between font-bold text-lg border-t pt-2">
                           <span>TOTAL:</span>
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
                  onClick={() => setShowInvoiceModal(false)}
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
      )}

      {/* Invoice Viewer Modal */}
      {showInvoiceViewer && viewingInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl mx-4 h-5/6 flex flex-col animate-scale-in shadow-glow">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b print:hidden">
              <h3 className="text-xl font-semibold">Invoice Details</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  size="sm"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button
                  onClick={saveInvoiceAsPDF}
                  variant="outline"
                  size="sm"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Save as PDF
                </Button>
                <Button
                  onClick={() => setShowInvoiceViewer(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Invoice Content */}
            <div className="flex-1 overflow-y-auto p-8 print:p-0">
              <div data-invoice-content className="max-w-3xl mx-auto bg-card print:shadow-none shadow-card p-8 print:p-0">
                {/* Invoice Header */}
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h1 className="text-4xl font-bold text-primary">INVOICE</h1>
                    <p className="text-muted-foreground text-lg">WeParty Inventory</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{viewingInvoice.number}</p>
                    <p className="text-muted-foreground">Date: {viewingInvoice.date}</p>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3">Bill To:</h3>
                  <div className="text-foreground">
                    <p className="font-medium text-lg">{viewingInvoice.customer.name}</p>
                    <p>{viewingInvoice.customer.email}</p>
                    <p className="whitespace-pre-line">{viewingInvoice.customer.address}</p>
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="mb-8">
                  <table className="w-full border-collapse border border-border">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border px-4 py-3 text-left font-semibold">Item</th>
                        <th className="border border-border px-4 py-3 text-left font-semibold">SKU</th>
                        <th className="border border-border px-4 py-3 text-center font-semibold">Quantity</th>
                        <th className="border border-border px-4 py-3 text-right font-semibold">Unit Price</th>
                        <th className="border border-border px-4 py-3 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingInvoice.items.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-border px-4 py-3">{item.name}</td>
                          <td className="border border-border px-4 py-3">{item.sku}</td>
                          <td className="border border-border px-4 py-3 text-center">{item.quantity}</td>
                          <td className="border border-border px-4 py-3 text-right">{item.price.toFixed(2)} ден.</td>
                          <td className="border border-border px-4 py-3 text-right">
                            {(item.price * item.quantity).toFixed(2)} ден.
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{viewingInvoice.subtotal.toFixed(2)} ден.</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (10%):</span>
                      <span>{viewingInvoice.tax.toFixed(2)} ден.</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span className="text-primary">{viewingInvoice.total.toFixed(2)} ден.</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center text-muted-foreground text-sm border-t pt-4">
                  <p>Thank you for your business!</p>
                  <p>Generated by WeParty Inventory</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Column Mapping Modal */}
      {showColumnMappingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 animate-scale-in shadow-glow">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Map Excel Columns</h3>
                <Button
                  onClick={() => setShowColumnMappingModal(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-muted-foreground mb-6">
                Map the columns from your Excel file to the product fields. 
                Found {excelData.length} rows with columns: {excelColumns.join(', ')}
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name-mapping">Product Name * → Excel Column</Label>
                    <select
                      id="name-mapping"
                      value={columnMapping.name}
                      onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                      className="w-full p-2 border border-border rounded-md bg-background"
                    >
                      <option value="">Select column...</option>
                      {excelColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="sku-mapping">SKU * → Excel Column</Label>
                    <select
                      id="sku-mapping"
                      value={columnMapping.sku}
                      onChange={(e) => setColumnMapping({ ...columnMapping, sku: e.target.value })}
                      className="w-full p-2 border border-border rounded-md bg-background"
                    >
                      <option value="">Select column...</option>
                      {excelColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity-mapping">Quantity * → Excel Column</Label>
                    <select
                      id="quantity-mapping"
                      value={columnMapping.quantity}
                      onChange={(e) => setColumnMapping({ ...columnMapping, quantity: e.target.value })}
                      className="w-full p-2 border border-border rounded-md bg-background"
                    >
                      <option value="">Select column...</option>
                      {excelColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="price-mapping">Price * → Excel Column</Label>
                    <select
                      id="price-mapping"
                      value={columnMapping.price}
                      onChange={(e) => setColumnMapping({ ...columnMapping, price: e.target.value })}
                      className="w-full p-2 border border-border rounded-md bg-background"
                    >
                      <option value="">Select column...</option>
                      {excelColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="category-mapping">Category (Optional) → Excel Column</Label>
                  <select
                    id="category-mapping"
                    value={columnMapping.category}
                    onChange={(e) => setColumnMapping({ ...columnMapping, category: e.target.value })}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    <option value="">Select column or leave empty...</option>
                    {excelColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              {excelData.length > 0 && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Preview (First Row):</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>Name:</strong> {columnMapping.name ? excelData[0][columnMapping.name] : '(not mapped)'}</p>
                    <p><strong>SKU:</strong> {columnMapping.sku ? excelData[0][columnMapping.sku] : '(not mapped)'}</p>
                    <p><strong>Quantity:</strong> {columnMapping.quantity ? excelData[0][columnMapping.quantity] : '(not mapped)'}</p>
                    <p><strong>Price:</strong> {columnMapping.price ? excelData[0][columnMapping.price] : '(not mapped)'}</p>
                    <p><strong>Category:</strong> {columnMapping.category ? excelData[0][columnMapping.category] : 'Uncategorized'}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  onClick={() => setShowColumnMappingModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={!columnMapping.name || !columnMapping.sku || !columnMapping.quantity || !columnMapping.price}
                  className="bg-success"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import {excelData.length} Products
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default InventoryManagementApp;