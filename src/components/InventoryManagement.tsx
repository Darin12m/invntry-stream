import React, { useState, useEffect, useRef, useDeferredValue, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, Package, FileText, Upload, Download, Save, Printer, X, Eye, Calendar, DollarSign, Hash, ShoppingCart, CheckSquare, Square, Trash, FileDown, BarChart3, TrendingUp, Users, TrendingDown, LogOut, User as UserIcon, ArrowUpDown, ChevronUp, ChevronDown, Sun, Moon, BookOpenText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { signOut, User } from 'firebase/auth';

// Import the new tab components
import InventoryTab from './inventory/InventoryTab';
import InvoicesTab from './invoices/InvoicesTab';
import DashboardTab from './dashboard/DashboardTab';
// Lazy load DataTab for code splitting
const LazyDataTab = React.lazy(() => import('./data/DataTab'));

// Product interface with purchase price for profit calculations
interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  purchasePrice?: number; // Admin-only field for profit calculations
  // MINI-CATALOG FEATURE: New fields
  thumbnail?: string; // URL for a small image
  shortDescription?: string; // Short text description
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  customer: {
    name: string;
    email: string;
    address: string;
    phone?: string;
  };
  items: {
    productId: string;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    purchasePrice?: number;
    discount?: number; // Per-item discount percentage
  }[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  total: number;
  status: string;
}

const InventoryManagementApp = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // State management
  const [activeTab, setActiveTab] = useState('inventory');
  const [dateFilter, setDateFilter] = useState({ 
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    to: new Date().toISOString().split('T')[0] // Today
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search term state for InventoryTab
  const [localSearchInput, setLocalSearchInput] = useState(''); // Local state for the input field
  const deferredSearchTerm = useDeferredValue(localSearchInput); // Deferred value for actual filtering

  const [showProductModal, setShowProductModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]); // Using any[] for simplicity, could define a more specific type
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', address: '', phone: '' });
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [invoiceProductSearch, setInvoiceProductSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [invoiceSortBy, setInvoiceSortBy] = useState<'number' | 'date' | 'customer' | 'total'>('number');
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set()); // Initialize as Set
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set()); // Initialize as Set with useState
  const [showColumnMappingModal, setShowColumnMappingModal] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    sku: '',
        quantity: '',
    price: '',
    category: '',
    purchasePrice: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sorting state for InventoryTab
  const [sortColumn, setSortColumn] = useState<'name' | 'sku' | 'category' | 'quantity' | 'price'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Product form state
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    quantity: '',
    price: '',
    category: '',
    purchasePrice: '', // Admin-only field
    // MINI-CATALOG FEATURE: New fields
    thumbnail: '',
    shortDescription: ''
  });

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Real-time product loading from Firebase
  useEffect(() => {
    const productsQuery = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(productsQuery, (querySnapshot) => {
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading products in real-time:', error);
      toast.error('Failed to load products');
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []);

  // Real-time invoice loading from Firebase
  useEffect(() => {
    const invoicesQuery = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(invoicesQuery, (querySnapshot) => {
      const invoicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
      setInvoices(invoicesData);
    }, (error) => {
      console.error('Error loading invoices in real-time:', error);
      toast.error('Failed to load invoices');
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  // Filter products for invoice creation
  const filteredInvoiceProducts = products.filter(product =>
    (product.name || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.sku || '').toLowerCase().includes(invoiceProductSearch.toLowerCase()) ||
    (product.category || '').toLowerCase().includes(invoiceProductSearch.toLowerCase())
  );

  // Filter products based on search (memoized)
  const filteredProducts = React.useMemo(() => {
    return products.filter(product => {
      const matchesSearch = (product.name || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (product.sku || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (product.category || '').toLowerCase().includes(deferredSearchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [products, deferredSearchTerm]);

  // Sort products (memoized)
  const sortedProducts = React.useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aValue: string | number = a[sortColumn];
      let bValue: string | number = b[sortColumn];
      
      if (sortColumn === 'name' || sortColumn === 'sku' || sortColumn === 'category') {
        aValue = (aValue as string || '').toLowerCase(); // Explicitly cast to string
        bValue = (bValue as string || '').toLowerCase(); // Explicitly cast to string
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortColumn, sortDirection]);

  // Handle column sorting
  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get stock status
  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (quantity < 10) return { label: 'Low', variant: 'warning' as const };
    if (quantity < 30) return { label: 'Medium', variant: 'secondary' as const };
    return { label: 'In Stock', variant: 'default' as const };
  };

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
    const displayedProducts = products.filter(product =>
      (product.name || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      (product.sku || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      (product.category || '').toLowerCase().includes(deferredSearchTerm.toLowerCase())
    );
    
    if (selectedProducts.size === displayedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(displayedProducts.map(p => p.id)));
    }
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
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
    setProductForm({ 
      name: '', 
      sku: '', 
      quantity: '', 
      price: '', 
      category: '', 
      purchasePrice: '',
      // MINI-CATALOG FEATURE: Initialize new fields
      thumbnail: '',
      shortDescription: ''
    });
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      quantity: product.quantity.toString(),
      price: product.price.toString(),
      category: product.category,
      purchasePrice: product.purchasePrice?.toString() || '',
      // MINI-CATALOG FEATURE: Populate new fields
      thumbnail: product.thumbnail || '',
      shortDescription: product.shortDescription || ''
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
      category: productForm.category,
      ...(productForm.purchasePrice && { purchasePrice: parseFloat(productForm.purchasePrice) }),
      // MINI-CATALOG FEATURE: Save new fields
      ...(productForm.thumbnail && { thumbnail: productForm.thumbnail }),
      ...(productForm.shortDescription && { shortDescription: productForm.shortDescription })
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
      setProductForm({ 
        name: '', 
        sku: '', 
        quantity: '', 
        price: '', 
        category: '', 
        purchasePrice: '',
        // MINI-CATALOG FEATURE: Reset new fields
        thumbnail: '',
        shortDescription: ''
      });
      // Data will reload automatically via onSnapshot
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  // DELETE FUNCTIONS - Multiple implementations

  // 1. Delete single product
  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        toast.success("Product deleted successfully");
        // Data will reload automatically via onSnapshot
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
        // Data will reload automatically via onSnapshot
      } catch (error)
      {
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
        // Data will reload automatically via onSnapshot
      } catch (error) {
        console.error('Error deleting all products:', error);
        toast.error('Failed to delete all products');
      }
    }
  };

  // 4. Delete single invoice
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        // Find the invoice to restore quantities
        const invoice = invoices.find(inv => inv.id === invoiceId);
        
        // Restore product quantities before deleting invoice
        if (invoice && invoice.items) {
          const restorePromises = invoice.items.map(async (item) => {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              const restoredQuantity = product.quantity + item.quantity;
              await updateDoc(doc(db, 'products', item.productId), { quantity: restoredQuantity });
            }
          });
          await Promise.all(restorePromises);
        }
        
        // Delete the invoice
        await deleteDoc(doc(db, 'invoices', invoiceId));
        toast.success("Invoice deleted successfully");
        // Data will reload automatically via onSnapshot
      } catch (error) {
        console.error('Error deleting invoice:', error);
        toast.error('Failed to delete invoice');
      }
    }
  };

  // 5. Bulk delete invoices
  const handleBulkDeleteInvoices = async () => {
    if (selectedInvoices.size === 0) {
      toast.error("Please select invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedInvoices.size} selected invoice(s)?`)) {
      try {
        // Restore product quantities for all selected invoices
        const restorePromises = Array.from(selectedInvoices).flatMap((invoiceId) => {
          const invoice = invoices.find(inv => inv.id === invoiceId);
          if (invoice && invoice.items) {
            return invoice.items.map(async (item) => {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                const restoredQuantity = product.quantity + item.quantity;
                await updateDoc(doc(db, 'products', item.productId), { quantity: restoredQuantity });
              }
            });
          }
          return [];
        });
        await Promise.all(restorePromises);
        
        // Delete the invoices
        const deletePromises = Array.from(selectedInvoices).map((invoiceId) =>
          deleteDoc(doc(db, 'invoices', invoiceId))
        );
        await Promise.all(deletePromises);
        setSelectedInvoices(new Set());
        toast.success(`${selectedInvoices.size} invoices deleted successfully`);
        // Data will reload automatically via onSnapshot
      } catch (error) {
        console.error('Error bulk deleting invoices:', error);
        toast.error('Failed to delete invoices');
      }
    }
  };

  // 6. Delete all invoices
  const handleDeleteAllInvoices = async () => {
    if (invoices.length === 0) {
      toast.error("No invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ALL ${invoices.length} invoices? This action cannot be undone.`)) {
      try {
        // Restore product quantities for all invoices
        const restorePromises = invoices.flatMap((invoice) => {
          if (invoice && invoice.items) {
            return invoice.items.map(async (item) => {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                const restoredQuantity = product.quantity + item.quantity;
                await updateDoc(doc(db, 'products', item.productId), { quantity: restoredQuantity });
              }
            });
          }
          return [];
        });
        await Promise.all(restorePromises);
        
        // Delete all invoices
        const deletePromises = invoices.map((invoice) =>
          deleteDoc(doc(db, 'invoices', invoice.id))
        );
        await Promise.all(deletePromises);
        setSelectedInvoices(new Set());
        toast.success("All invoices deleted successfully");
        // Data will reload automatically via onSnapshot
      } catch (error) {
        console.error('Error deleting all invoices:', error);
        toast.error('Failed to delete all invoices');
      }
    }
  };

  // 7. Remove invoice item (in invoice creation modal)
  const removeInvoiceItem = (productId: string) => {
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
  const handleClearAllData = async () => {
    if (products.length === 0 && invoices.length === 0) {
      toast.error("No data to clear");
      return;
    }
    
    if (window.confirm("⚠️ WARNING: This will delete ALL products and invoices permanently. This action cannot be undone. Are you absolutely sure?")) {
      try {
        // Delete all products and invoices in parallel
        const deleteProductsPromises = products.map((product) =>
          deleteDoc(doc(db, 'products', product.id))
        );
        const deleteInvoicesPromises = invoices.map((invoice) =>
          deleteDoc(doc(db, 'invoices', invoice.id))
        );
        
        await Promise.all([...deleteProductsPromises, ...deleteInvoicesPromises]);
        
        setSelectedProducts(new Set());
        setSelectedInvoices(new Set());
        toast.success("All data cleared successfully");
        // Data will reload automatically via onSnapshot
      } catch (error) {
        console.error('Error clearing all data:', error);
        toast.error('Failed to clear all data');
      }
    }
  };

  // Invoice operations
  const handleCloseInvoiceModal = () => {
    setShowInvoiceModal(false);
    setCurrentInvoice(null);
    setInvoiceItems([]);
    setCustomerInfo({ name: '', email: '', address: '', phone: '' });
    setInvoiceProductSearch('');
    setDiscount(0);
    setEditingInvoice(null);
  };

  const handleCreateInvoice = () => {
    // Generate invoice number in format 001/25, 002/25, etc.
    const year = new Date().getFullYear().toString().slice(-2);
    const nextNumber = (invoices.length + 1).toString().padStart(3, '0');
    
    const newInvoice: Invoice = {
      id: Date.now().toString(),
      number: `${nextNumber}/${year}`,
      date: new Date().toISOString().split('T')[0],
      customer: { name: '', email: '', address: '', phone: '' },
      items: [],
      subtotal: 0,
      discount: 0,
      discountPercentage: 0,
      total: 0,
      status: 'draft'
    };
    setCurrentInvoice(newInvoice);
    setInvoiceItems([]);
    setCustomerInfo({ name: '', email: '', address: '', phone: '' });
    setDiscount(0);
    setInvoiceProductSearch('');
    setEditingInvoice(null);
    setShowInvoiceModal(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
  setEditingInvoice(invoice);
  setCurrentInvoice({
    id: invoice.id,
    number: invoice.number,
    date: invoice.date,
    customer: invoice.customer,
    items: invoice.items,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    discountPercentage: invoice.discountPercentage,
    total: invoice.total,
    status: invoice.status
  });

  // ✅ Refresh invoice items with the latest product data
  const refreshedItems = invoice.items.map((item) => {
    const latestProduct = products.find(p => p.id === item.productId);
    return latestProduct
      ? {
          ...item,
          name: latestProduct.name,
          price: latestProduct.price,
          purchasePrice: latestProduct.purchasePrice || 0,
          // currentStock: latestProduct.quantity, // optional to display or debug
        }
      : {
          ...item,
          // missing: true // optional flag if product no longer exists
        };
  });
  setInvoiceItems(refreshedItems);

  setCustomerInfo({ ...invoice.customer, phone: invoice.customer.phone || '' }); // Ensure phone is always a string
  setDiscount(invoice.discountPercentage || 0);
  setInvoiceProductSearch('');
  setShowInvoiceModal(true);
};

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowInvoiceViewer(true);
  };

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
    // Allow negative quantities for returns/damaged items
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
    // Calculate subtotal with per-item discounts
    const subtotal = invoiceItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const itemDiscount = itemTotal * ((item.discount || 0) / 100);
      return sum + (itemTotal - itemDiscount);
    }, 0);
    const globalDiscountAmount = subtotal * (discount / 100);
    const total = subtotal - globalDiscountAmount;
    return { subtotal, discount: globalDiscountAmount, total };
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

    const { subtotal, discount: discountAmount, total } = calculateInvoiceTotal();
    const invoiceData = {
      number: currentInvoice!.number,
      date: currentInvoice!.date,
      customer: customerInfo,
      items: invoiceItems,
      subtotal,
      discount: discountAmount,
      discountPercentage: discount,
      total,
      status: 'saved'
    };

    try {
      if (editingInvoice) {
        // Update existing invoice
        await updateDoc(doc(db, 'invoices', editingInvoice.id), invoiceData);
        
        // Restore previous quantities then apply new ones
        if (editingInvoice.items) {
          const restorePromises = editingInvoice.items.map(async (item) => {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              const restoredQuantity = product.quantity + item.quantity;
              await updateDoc(doc(db, 'products', item.productId), { quantity: restoredQuantity });
            }
          });
          await Promise.all(restorePromises);
        }
      } else {
        // Create new invoice
        await addDoc(collection(db, 'invoices'), invoiceData);
      }

      // Update product quantities in Firebase (handle positive and negative quantities)
      const updatePromises = invoiceItems.map(async (item) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          // For existing invoices, we already restored quantities above
          // For new invoices, subtract from current stock
          const currentStock = editingInvoice 
            ? products.find(p => p.id === item.productId)?.quantity || 0
            : product.quantity;
          // Handle negative quantities correctly (negative means adding back to stock)
          const newQuantity = currentStock - Number(item.quantity);
          await updateDoc(doc(db, 'products', item.productId), { quantity: Math.max(0, newQuantity) });
        }
      });
      await Promise.all(updatePromises);

      handleCloseInvoiceModal(); // Reset state after successful save
      
      toast.success(editingInvoice ? 'Invoice updated successfully!' : 'Invoice saved successfully!');
      // Data will reload automatically via onSnapshot
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    }
  };

  // Import/Export functions
  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' });
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
          category: '',
          purchasePrice: ''
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
        category: columnMapping.category ? (row[columnMapping.category] || 'Uncategorized') : 'Uncategorized',
        ...(columnMapping.purchasePrice && row[columnMapping.purchasePrice] && { 
          purchasePrice: parseFloat(row[columnMapping.purchasePrice] || 0) 
        })
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
      // Data will reload automatically via onSnapshot
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('Failed to import products');
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
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

  const exportToJSON = (data: any[], filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    toast.success(`${filename} exported successfully`);
  };

  const printInvoice = async () => {
    try {
      // Check if running on native iOS
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        // Use native iOS AirPrint
        const element = document.querySelector('[data-invoice-content]') as HTMLElement;
        if (!element) {
          toast.error('Invoice content not found');
          return;
        }

        // Generate canvas for native print
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Use the native print plugin (requires @capacitor/print plugin)
        // For now, we'll use the PDF generation as fallback
        await saveInvoiceAsPDF();
        toast.success('Ready to print via AirPrint');
      } else {
        // On web or Android, use standard print
        window.print();
      }
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('Failed to print invoice');
    }
  };

  const saveInvoiceAsPDF = async () => {
    try {
      const element = document.querySelector('[data-invoice-content]') as HTMLElement;
      if (!element) {
        toast.error('Invoice content not found');
        return;
      }

      // Create a temporary container with white background for edge-to-edge rendering
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm';
      tempContainer.style.padding = '10mm';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.innerHTML = element.innerHTML;
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 3, // Higher quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 794, // A4 width in pixels at 96 DPI
        windowHeight: 1123 // A4 height in pixels at 96 DPI
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = -(pdfHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${viewingInvoice?.number || 'invoice'}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Failed to save PDF');
    }
  };

  // MINI-CATALOG FEATURE: New function to create a mini catalog PDF
  const createMiniCatalog = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Please select at least one product to create a mini catalog.");
      return;
    }

    toast.loading("Generating mini catalog...", { id: "catalog-toast" });

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      let cursorY = margin;
      let productsPerRow = 2; // Can be 2 or 3
      let productWidth = (contentWidth - (productsPerRow - 1) * 10) / productsPerRow; // 10mm spacing between products
      let productHeight = 100; // Fixed height for each product card
      let rowHeight = productHeight + 10; // Product height + spacing

      const selectedProductsData = products.filter(p => selectedProducts.has(p.id));

      // Helper to add header and footer
      const addPageHeaderFooter = (pageNumber: number) => {
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("КАТАЛОГ НА ПРОИЗВОДИ", pageWidth / 2, margin + 10, { align: "center" });
        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.text("Колекција Вселена", pageWidth / 2, margin + 18, { align: "center" });

        doc.setFontSize(10);
        doc.text(`Страна ${pageNumber}`, pageWidth / 2, pageHeight - margin + 5, { align: "center" });
      };

      addPageHeaderFooter(1);
      cursorY += 30; // Space for header

      let productCount = 0;
      let currentPage = 1;

      for (const product of selectedProductsData) {
        const colIndex = productCount % productsPerRow;
        const rowIndex = Math.floor(productCount / productsPerRow);

        let x = margin + colIndex * (productWidth + 10);
        let y = cursorY + rowIndex * rowHeight;

        // Check if new page is needed
        if (y + productHeight > pageHeight - margin - 10) { // 10mm buffer for footer
          doc.addPage();
          currentPage++;
          addPageHeaderFooter(currentPage);
          cursorY = margin + 30; // Reset cursorY for new page, accounting for header
          y = cursorY; // Reset y for the first product on new page
          productCount = 0; // Reset product count for new page layout
          x = margin + colIndex * (productWidth + 10); // Recalculate x based on new productCount
        }

        // Product Card Background
        doc.setFillColor(245, 245, 245); // Light grey background
        doc.rect(x, y, productWidth, productHeight, 'F');
        doc.setDrawColor(200, 200, 200); // Light grey border
        doc.rect(x, y, productWidth, productHeight, 'S');

        // Add Thumbnail
        if (product.thumbnail) {
          try {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Important for CORS if images are from different domain
            img.src = product.thumbnail;

            await new Promise<void>((resolve) => {
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  ctx.drawImage(img, 0, 0);
                  const imgData = canvas.toDataURL('image/png'); // Use PNG for better quality and transparency support

                  const imgX = x + productWidth / 2;
                  const imgY = y + 5; // 5mm padding from top
                  const imgMaxHeight = productHeight * 0.4; // Max 40% of card height
                  const imgMaxWidth = productWidth * 0.8; // Max 80% of card width

                  const aspectRatio = img.width / img.height;
                  let finalImgWidth = imgMaxWidth;
                  let finalImgHeight = imgMaxWidth / aspectRatio;

                  if (finalImgHeight > imgMaxHeight) {
                    finalImgHeight = imgMaxHeight;
                    finalImgWidth = imgMaxHeight * aspectRatio;
                  }
                  
                  doc.addImage(imgData, 'PNG', imgX - finalImgWidth / 2, imgY, finalImgWidth, finalImgHeight);
                }
                resolve();
              };
              img.onerror = (e) => {
                console.warn(`Failed to load image for product ${product.name} from ${product.thumbnail}:`, e);
                resolve(); // Resolve even if image fails to load
              };
            });
          } catch (imgError) {
            console.error("Error adding image to PDF:", imgError);
          }
        }

        // Add Product Name
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(product.name, x + productWidth / 2, y + productHeight * 0.55, { align: "center" });

        // Add Short Description
        if (product.shortDescription) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          const splitDescription = doc.splitTextToSize(product.shortDescription, productWidth - 10); // 10mm padding
          doc.text(splitDescription, x + productWidth / 2, y + productHeight * 0.65, { align: "center" });
        }
        
        productCount++;
      }

      doc.save("mini-catalog.pdf");
      toast.success("Mini catalog generated successfully!", { id: "catalog-toast" });
    } catch (error) {
      console.error("Error generating mini catalog:", error);
      toast.error("Failed to generate mini catalog.", { id: "catalog-toast" });
    }
  };

  // Dashboard calculations
  const getFilteredInvoices = () => {
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.date);
      const fromDate = new Date(dateFilter.from);
      const toDate = new Date(dateFilter.to);
      return invoiceDate >= fromDate && invoiceDate <= toDate;
    });
  };

  const calculateDashboardMetrics = () => {
    const filteredInvoices = getFilteredInvoices();
    
    let totalSales = 0;
    let totalCosts = 0;
    let totalNegativeQuantity = 0;
    let totalNegativeValue = 0;
    
    filteredInvoices.forEach(invoice => {
      totalSales += invoice.total;
      
      // Calculate costs and track negative quantities
      invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const purchasePrice = product?.purchasePrice || item.purchasePrice || 0;
        totalCosts += purchasePrice * item.quantity;
        
        // Track negative quantities (returns/damaged/free items)
        if (item.quantity < 0) {
          totalNegativeQuantity += Math.abs(item.quantity);
          totalNegativeValue += Math.abs(item.price * item.quantity);
        }
      });
    });
    
    const totalProfit = totalSales - totalCosts;
    const numberOfInvoices = filteredInvoices.length;
    
    return {
      totalSales,
      totalCosts,
      totalProfit,
      numberOfInvoices,
      totalNegativeQuantity,
      totalNegativeValue,
      filteredInvoices
    };
  };

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
              <span className="ml-3 text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">WeParty Inventory</span>
            </div>
            <div className="hidden sm:flex space-x-8">
              {[
                { key: 'inventory', label: 'Inventory', icon: Package },
                { key: 'invoices', label: 'Invoices', icon: FileText },
                { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
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

            {/* User Profile Menu */}
            <div className="flex items-center space-x-4">
              {currentUser && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-10 w-10 rounded-full p-0 hidden sm:flex">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {currentUser.email?.[0].toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {currentUser.email?.[0].toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Logged in as</p>
                          <p className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
                        </div>
                      </div>
                      <Button 
                        onClick={handleLogout} 
                        variant="destructive" 
                        className="w-full"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Mobile Navigation */}
            <div className="flex sm:hidden items-center space-x-2">
              <div className="flex space-x-1">
                {[
                  { key: 'inventory', icon: Package },
                  { key: 'invoices', icon: FileText },
                  { key: 'dashboard', icon: BarChart3 },
                  { key: 'data', icon: Upload }
                ].map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`p-2 rounded-lg transition-all duration-300 ${
                      activeTab === key
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                ))}
              </div>
              {currentUser && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {currentUser.email?.[0].toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {currentUser.email?.[0].toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Logged in as</p>
                          <p className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
                        </div>
                      </div>
                      <Button 
                        onClick={handleLogout} 
                        variant="destructive" 
                        className="w-full"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {activeTab === 'inventory' && (
          <InventoryTab
            localSearchInput={localSearchInput}
            setLocalSearchInput={setLocalSearchInput}
            filteredProducts={filteredProducts}
            products={products}
            sortedProducts={sortedProducts}
            selectedProducts={selectedProducts}
            toggleProductSelection={toggleProductSelection}
            selectAllProducts={selectAllProducts}
            handleBulkDeleteProducts={handleBulkDeleteProducts}
            handleDeleteAllProducts={handleDeleteAllProducts}
            handleAddProduct={handleAddProduct}
            handleEditProduct={handleEditProduct}
            handleDeleteProduct={handleDeleteProduct}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            handleSort={handleSort}
            getStockStatus={getStockStatus}
            // MINI-CATALOG FEATURE: Pass the new function
            handleCreateMiniCatalog={createMiniCatalog}
          />
        )}
        {activeTab === 'invoices' && (
          <InvoicesTab
            invoices={invoices}
            selectedInvoices={selectedInvoices}
            toggleInvoiceSelection={toggleInvoiceSelection}
            selectAllInvoices={selectAllInvoices}
            handleBulkDeleteInvoices={handleBulkDeleteInvoices}
            handleDeleteAllInvoices={handleDeleteAllInvoices}
            handleCreateInvoice={handleCreateInvoice}
            handleViewInvoice={handleViewInvoice}
            handleEditInvoice={handleEditInvoice}
            handleDeleteInvoice={handleDeleteInvoice}
            invoiceSortBy={invoiceSortBy}
            invoiceSortDirection={invoiceSortDirection}
            handleInvoiceSort={setInvoiceSortBy} // Pass setInvoiceSortBy directly
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            calculateDashboardMetrics={calculateDashboardMetrics}
            handleViewInvoice={handleViewInvoice}
            products={products}
          />
        )}
        {activeTab === 'data' && (
          <Suspense fallback={
            <Card className="p-12 text-center animate-pulse">
              <Upload className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-2xl font-bold mb-2">Loading Data Management...</h3>
              <p className="text-muted-foreground">Please wait while we load the data tools.</p>
            </Card>
          }>
            <LazyDataTab
              products={products}
              invoices={invoices}
              handleClearAllData={handleClearAllData}
              handleImportExcel={handleImportExcel}
              exportToCSV={exportToCSV}
              exportToJSON={exportToJSON}
              fileInputRef={fileInputRef}
            />
          </Suspense>
        )}
      </main>

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[95vh] flex flex-col animate-scale-in shadow-glow">
            {/* Header */}
            <div className="p-6 pb-4 flex justify-between items-center border-b">
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

              {/* MINI-CATALOG FEATURE: New fields for thumbnail and short description */}
              <div>
                <Label htmlFor="thumbnail">Thumbnail URL</Label>
                <Input
                  id="thumbnail"
                  value={productForm.thumbnail}
                  onChange={(e) => setProductForm({ ...productForm, thumbnail: e.target.value })}
                  placeholder="e.g., https://example.com/image.jpg"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL for a small product image (e.g., 60x60px).
                </p>
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
          </Card>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && currentInvoice && (
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
      )}

      {/* Invoice Viewer Modal */}
      {showInvoiceViewer && viewingInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-4xl h-full sm:h-5/6 flex flex-col animate-scale-in shadow-glow">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 border-b print:hidden gap-4">
              <h3 className="text-lg sm:text-xl font-semibold">Invoice Details</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={printInvoice}
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  <Printer className="h-4 w-4 mr-1 sm:mr-2" />
                  {Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' ? 'AirPrint' : 'Print'}
                </Button>
                <Button
                  onClick={saveInvoiceAsPDF}
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  <FileDown className="h-4 w-4 mr-1 sm:mr-2" />
                  Download PDF
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0">
              <div data-invoice-content>
                <style>{`
                  /* Print settings - Edge to edge with no grey borders */
                  @media print {
                    html, body {
                      margin: 0 !important;
                      padding: 0 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      color-adjust: exact !important;
                    }

                    .invoice-container {
                      width: 100% !important;
                      max-width: 100% !important;
                      margin: 0 !important;
                      padding: 15mm !important;
                      border: none !important;
                      box-shadow: none !important;
                      background: white !important;
                    }

                    .invoice-header {
                      flex-wrap: nowrap !important;
                      align-items: flex-start !important;
                    }
                    
                    .company-info {
                      text-align: right !important;
                      margin-top: 0 !important;
                    }

                    @page {
                      size: A4;
                      margin: 0 !important;
                    }

                    /* Hide scrollbars and other UI elements */
                    *::-webkit-scrollbar {
                      display: none !important;
                    }
                  }

                  /* Normal screen view */
                  .invoice-container {
                    max-width: 800px;
                    margin: auto;
                    padding: 20px;
                    border: 1px solid #ccc;
                    box-shadow: 0 0 5px rgba(0,0,0,0.2);
                    background: #fff;
                    font-family: Arial, sans-serif;
                  }
                `}</style>

                <div className="invoice-container">
                  {/* Header */}
                  <div className="invoice-header" style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    marginBottom: "30px",
                  }}>
                    <div style={{ flex: "1" }}>
                      <h1 style={{
                        margin: "0",
                        fontSize: "32px",
                        fontWeight: "bold",
                      }}>WeParty.</h1>
                      <p style={{
                        margin: "0",
                        fontSize: "14px",
                        color: "#666",
                      }}>PARTY DECOR</p>
                    </div>
                    <div className="company-info" style={{
                      textAlign: "right",
                      fontSize: "12px",
                      flex: "1",
                      lineHeight: "1.6",
                    }}>
                      <p style={{ margin: "2px 0" }}>ПАРТИЛАБ увоз-извоз ДОО Скопје</p>
                      <p style={{ margin: "2px 0" }}>Друштво за трговија и услуги</p>
                      <p style={{ margin: "2px 0" }}>ул. Гари 65Б/1-2, Карпош, Скопје</p>
                      <p style={{ margin: "2px 0" }}>Даночен број: 4057025575047</p>
                      <p style={{ margin: "2px 0" }}>Трансакциска сметка: 270078458980186</p>
                      <p style={{ margin: "2px 0" }}>Халк Банка АД Скопје</p>
                    </div>
                  </div>

                  {/* Invoice Number and Customer Info Row */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "30px",
                  }}>
                    {/* Left - Invoice Number */}
                    <div>
                      <h2 style={{
                        margin: "0 0 5px 0",
                        fontSize: "22px",
                        fontWeight: "bold",
                        color: "#6366f1",
                      }}>
                        ФАКТУРА Бр. #{viewingInvoice.number}
                      </h2>
                      <p style={{
                        margin: "0",
                        fontSize: "14px",
                        color: "#666",
                      }}>
                        Датум: {new Date(viewingInvoice.date).toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}г.
                      </p>
                    </div>
                    
                    {/* Right - Customer Info */}
                    <div style={{ textAlign: "right" }}>
                      <p style={{
                        margin: "0 0 5px 0",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#6366f1",
                      }}>
                        Клиент:
                      </p>
                      <p style={{ margin: "2px 0", fontSize: "14px", fontWeight: "bold" }}>
                        {viewingInvoice.customer.name}
                      </p>
                      {viewingInvoice.customer.phone && (
                        <p style={{ margin: "2px 0", fontSize: "14px" }}>
                          Телефон: {viewingInvoice.customer.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Table */}
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "20px",
                  }}>
                    <thead>
                      <tr>
                        <th style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "center",
                          fontSize: "12px",
                          backgroundColor: "#f9f9f9",
                          fontWeight: "bold",
                          width: "40px",
                        }}>Бр.</th>
                        <th style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "left",
                          fontSize: "12px",
                          backgroundColor: "#f9f9f9",
                          fontWeight: "bold",
                        }}>Име на производ</th>
                        <th style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "center",
                          fontSize: "12px",
                          backgroundColor: "#f9f9f9",
                          fontWeight: "bold",
                          width: "80px",
                        }}>Количина</th>
                        <th style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "right",
                          fontSize: "12px",
                          backgroundColor: "#f9f9f9",
                          fontWeight: "bold",
                          width: "100px",
                        }}>Цена без ДДВ</th>
                        <th style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "center",
                          fontSize: "12px",
                          backgroundColor: "#f9f9f9",
                          fontWeight: "bold",
                          width: "70px",
                        }}>ДДВ (%)</th>
                        <th style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "center",
                          fontSize: "12px",
                          backgroundColor: "#f9f9f9",
                          fontWeight: "bold",
                          width: "80px",
                        }}>Попуст (%)</th>
                        <th style={{
                          border: "1px solid #ddd",
                          padding: "8px",
                          textAlign: "right",
                          fontSize: "12px",
                          backgroundColor: "#f9f9f9",
                          fontWeight: "bold",
                          width: "100px",
                        }}>Вкупно</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingInvoice.items.length > 0 ? (
                        viewingInvoice.items.map((item, i) => (
                          <tr key={i}>
                            <td style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "center",
                              fontSize: "12px",
                            }}>{i + 1}</td>
                            <td style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "left",
                              fontSize: "12px",
                            }}>{item.name}</td>
                            <td style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "center",
                              fontSize: "12px",
                              color: item.quantity < 0 ? '#dc2626' : 'inherit',
                              fontWeight: item.quantity < 0 ? 'bold' : 'normal'
                            }}>{item.quantity}</td>
                            <td style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "right",
                              fontSize: "12px",
                            }}>{item.price.toFixed(2)} ден</td>
                            <td style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "center",
                              fontSize: "12px",
                            }}>0%</td>
                            <td style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "center",
                              fontSize: "12px",
                            }}>{viewingInvoice.discountPercentage > 0 ? `${viewingInvoice.discountPercentage}%` : '5%'}</td>
                            <td style={{
                              border: "1px solid #ddd",
                              padding: "8px",
                              textAlign: "right",
                              fontSize: "12px",
                            }}>{(item.price * item.quantity).toFixed(2)} ден</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} style={{
                            border: "1px solid #ddd",
                            padding: "10px",
                            textAlign: "center",
                            fontSize: "12px",
                            color: "#888"
                          }}>
                            Нема внесени ставки
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div style={{
                    textAlign: "right",
                    fontSize: "14px",
                    marginTop: "10px",
                    marginBottom: "40px",
                  }}>
                    <p style={{ margin: "5px 0" }}>
                      Меѓузбир: <span style={{ marginLeft: "20px" }}>{viewingInvoice.subtotal.toFixed(2)} ден</span>
                    </p>
                    {viewingInvoice.discountPercentage > 0 && (
                      <p style={{ margin: "5px 0", color: "#dc2626" }}>
                        Попуст: <span style={{ marginLeft: "20px" }}>-{viewingInvoice.discount.toFixed(2)} ден</span>
                      </p>
                    )}
                    <p style={{ margin: "5px 0" }}>
                      ДДВ (18%): <span style={{ marginLeft: "20px" }}>0.00 ден</span>
                    </p>
                    <p style={{ 
                      margin: "10px 0 0 0",
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#6366f1",
                      borderTop: "2px solid #ddd",
                      paddingTop: "10px"
                    }}>
                      ВКУПНО: <span style={{ marginLeft: "20px" }}>{viewingInvoice.total.toFixed(2)} ден</span>
                    </p>
                  </div>

                  {/* Signature Section */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "60px",
                    marginBottom: "40px",
                  }}>
                    <div style={{ textAlign: "center", flex: "1" }}>
                      <p style={{ margin: "0 0 40px 0", fontSize: "14px" }}>Издал</p>
                      <div style={{ borderBottom: "1px solid #000", width: "200px", margin: "0 auto" }}></div>
                    </div>
                    <div style={{ textAlign: "center", flex: "1" }}>
                      <p style={{ margin: "0 0 40px 0", fontSize: "14px" }}>Примил</p>
                      <div style={{ borderBottom: "1px solid #000", width: "200px", margin: "0 auto" }}></div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#666",
                    marginTop: "20px",
                    borderTop: "1px solid #ddd",
                    paddingTop: "15px",
                  }}>
                    <p style={{ margin: "0" }}>
                      Благодариме за вашата доверба!
                    </p>
                    <p style={{ margin: "5px 0 0 0", fontSize: "11px" }}>
                      Генерирано на: {new Date().toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' })} во {new Date().toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
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
            <div className="p-6 max-h-[70vh] overflow-y-auto">
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

                <div>
                  <Label htmlFor="purchasePrice-mapping">Purchase Price (Optional) → Excel Column</Label>
                  <select
                    id="purchasePrice-mapping"
                    value={columnMapping.purchasePrice}
                    onChange={(e) => setColumnMapping({ ...columnMapping, purchasePrice: e.target.value })}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    <option value="">Select column or leave empty...</option>
                    {excelColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Maps to admin-only purchase price field for profit calculations
                  </p>
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

             
            </div>
            
             <div className="sticky bottom-0 bg-background p-4 flex justify-end gap-3">
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
              
          </Card>
        </div>
      )}
    </div>
  );
};

export default InventoryManagementApp;