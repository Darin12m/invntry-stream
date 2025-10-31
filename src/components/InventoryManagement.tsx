import React, { useState, useEffect, useRef, useDeferredValue, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, Package, FileText, Upload, Download, Save, Printer, X, Eye, Calendar, DollarSign, Hash, ShoppingCart, Trash, FileDown, BarChart3, TrendingUp, Users, TrendingDown, LogOut, User as UserIcon, ArrowUpDown, ChevronUp, ChevronDown, Sun, Moon } from 'lucide-react';
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
import { db, auth, storage } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc, getDocs, where, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { signOut, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Import the new tab components
import InventoryTab from './inventory/InventoryTab';
import InvoicesTab from './invoices/InvoicesTab';
import DashboardTab from './dashboard/DashboardTab';
// Lazy load DataTab for code splitting
const LazyDataTab = React.lazy(() => import('./data/DataTab'));

// Import new modal components (will be created in subsequent steps)
import ProductModal from './modals/ProductModal';
import InvoiceModal from './modals/InvoiceModal';
import InvoiceViewerModal from './modals/InvoiceViewerModal';
import ColumnMappingModal from './modals/ColumnMappingModal';

// Import the new stock controller
import { recalcProductStock } from '@/utils/recalcStock';

// Product interface with purchase price for profit calculations
export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  purchasePrice?: number; // Admin-only field for profit calculations
  shortDescription?: string; // Short text description
  initialStock?: number; // NEW: Initial stock for deterministic calculations
}

export interface Invoice {
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
  itemsIds?: string[]; // NEW: Array of product IDs for easier querying
  subtotal: number;
  discount: number;
  discountPercentage: number;
  total: number;
  status: string;
  invoiceType?: 'sale' | 'refund' | 'writeoff'; // NEW: Invoice Type
  deletedAt?: Timestamp; // NEW: Add deletedAt property for invoices moved to trash
}

const InventoryManagementApp = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Top-level state management
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
  const deferredSearchTerm = useDeferredValue(localSearchInput); // Corrected: use localSearchInput
  
  // Modal visibility states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  const [showColumnMappingModal, setShowColumnMappingModal] = useState(false);

  // Data for modals
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
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
  
  // Sorting state for InventoryTab (products)
  const [sortColumn, setSortColumn] = useState<'name' | 'sku' | 'category' | 'quantity' | 'price'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Sorting state for InvoicesTab (invoices)
  const [invoiceSortBy, setInvoiceSortBy] = useState<'number' | 'date' | 'customer' | 'total'>('number');
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<'asc' | 'desc'>('asc');

  // Product and Invoice selection states
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

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

  // Handle column sorting for products
  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle column sorting for invoices
  const handleInvoiceSort = (column: typeof invoiceSortBy) => {
    if (invoiceSortBy === column) {
      setInvoiceSortDirection(invoiceSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setInvoiceSortBy(column);
      setInvoiceSortDirection('asc');
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
    if (selectedProducts.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
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

  // Product CRUD operations (handlers to open modal)
  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

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
      toast.error("Please select products to delete.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedProducts.size} selected product(s)? This action cannot be undone.`)) {
      try {
        const deletePromises = Array.from(selectedProducts).map((productId) =>
          deleteDoc(doc(db, 'products', productId))
        );
        await Promise.all(deletePromises);
        setSelectedProducts(new Set()); // Clear selection after deletion
        toast.success(`${selectedProducts.size} products deleted successfully`);
      } catch (error) {
        console.error('Error bulk deleting products:', error);
        toast.error('Failed to delete selected products');
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
        toast.success("All products deleted successfully");
        // Data will reload automatically via onSnapshot
      } catch (error) {
        console.error('Error deleting all products:', error);
        toast.error('Failed to delete all products');
      }
    }
  };

  // 4. Delete single invoice
  async function handleDeleteInvoice(invoice: Invoice) {
    if (!invoice || !invoice.id) {
      toast.error("❌ No invoice selected for deletion.");
      return;
    }

    if (!window.confirm('Are you sure you want to delete this invoice? It will be moved to Trash.')) {
      return;
    }

    try {
      // Move to deletedInvoices
      await setDoc(doc(db, "deletedInvoices", invoice.id), {
        ...invoice,
        deletedAt: serverTimestamp(),
      });

      // Remove from main
      await deleteDoc(doc(db, "invoices", invoice.id));

      // 🔄 Recalculate stock based only on remaining active invoices
      for (const item of invoice.items || []) {
        await recalcProductStock(item.productId);
      }

      toast.success("🗑️ Invoice moved to Trash and stock recalculated.");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("❌ Failed to delete invoice.");
    }
  }

  // 5. Bulk delete invoices
  const handleBulkDeleteInvoices = async () => {
    if (selectedInvoices.size === 0) {
      toast.error("Please select invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedInvoices.size} selected invoice(s)?`)) {
      try {
        const productIdsToRecalculate = new Set<string>();

        const deletePromises = Array.from(selectedInvoices).map(async (invoiceId) => {
          const invoice = invoices.find(inv => inv.id === invoiceId);
          if (invoice && invoice.items) {
            invoice.items.forEach(item => productIdsToRecalculate.add(item.productId));
          }
          return deleteDoc(doc(db, 'invoices', invoiceId));
        });
        await Promise.all(deletePromises);
        setSelectedInvoices(new Set());
        toast.success(`${selectedInvoices.size} invoices deleted successfully`);

        // Recalculate stock for affected products after bulk deletion
        for (const productId of productIdsToRecalculate) {
          await recalcProductStock(productId);
        }
        console.log("✅ Bulk invoices deleted and stock restored to correct values.");

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
        const productIdsToRecalculate = new Set<string>();
        invoices.forEach(invoice => {
          if (invoice.items) {
            invoice.items.forEach(item => productIdsToRecalculate.add(item.productId));
          }
        });

        const deletePromises = invoices.map((invoice) =>
          deleteDoc(doc(db, 'invoices', invoice.id))
        );
        await Promise.all(deletePromises);
        setSelectedInvoices(new Set());
        toast.success("All invoices deleted successfully");

        // Recalculate stock for all products that were ever in an invoice
        for (const productId of productIdsToRecalculate) {
          await recalcProductStock(productId);
        }
        console.log("✅ All invoices deleted and stock restored to correct values.");

      } catch (error) {
        console.error('Error deleting all invoices:', error);
        toast.error('Failed to delete all data');
      }
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
        
        setSelectedInvoices(new Set());
        toast.success("All data cleared successfully");
      } catch (error) {
        console.error('Error clearing all data:', error);
        toast.error('Failed to clear all data');
      }
    }
  };

  // Invoice operations (handlers to open modal)
  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setShowInvoiceModal(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowInvoiceViewer(true);
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
                          <p className className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
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
            handleBulkDeleteProducts={handleBulkDeleteProducts}
            handleDeleteAllProducts={handleDeleteAllProducts}
            handleAddProduct={handleAddProduct}
            handleEditProduct={handleEditProduct}
            handleDeleteProduct={handleDeleteProduct}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            handleSort={handleSort}
            getStockStatus={getStockStatus}
            selectedProducts={selectedProducts}
            toggleProductSelection={toggleProductSelection}
            selectAllProducts={selectAllProducts}
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
            handleInvoiceSort={handleInvoiceSort}
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
              db={db}
              toast={toast}
            />
          </Suspense>
        )}
      </main>

      {/* Product Modal */}
      <ProductModal
        showProductModal={showProductModal}
        setShowProductModal={setShowProductModal}
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}
        db={db}
        toast={toast}
      />

      {/* Invoice Modal */}
      <InvoiceModal
        showInvoiceModal={showInvoiceModal}
        setShowInvoiceModal={setShowInvoiceModal}
        editingInvoice={editingInvoice}
        setEditingInvoice={setEditingInvoice}
        products={products}
        invoices={invoices}
        db={db}
        toast={toast}
        recalcProductStock={recalcProductStock} // Pass recalc function
      />

      {/* Invoice Viewer Modal */}
      <InvoiceViewerModal
        showInvoiceViewer={showInvoiceViewer}
        setShowInvoiceViewer={setShowInvoiceViewer}
        viewingInvoice={viewingInvoice}
        toast={toast}
        Capacitor={Capacitor}
        html2canvas={html2canvas}
        jsPDF={jsPDF}
      />

      {/* Column Mapping Modal */}
      <ColumnMappingModal
        showColumnMappingModal={showColumnMappingModal}
        setShowColumnMappingModal={setShowColumnMappingModal}
        excelData={excelData}
        excelColumns={excelColumns}
        columnMapping={columnMapping}
        setColumnMapping={setColumnMapping}
        db={db}
        toast={toast}
      />
    </div>
  );
};

export default InventoryManagementApp;