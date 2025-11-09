import React, { useState, useEffect, useRef, useDeferredValue, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, Package, FileText, Upload, Download, Save, Printer, X, Eye, Calendar, DollarSign, Hash, ShoppingCart, Trash, FileDown, BarChart3, TrendingUp, Users, TrendingDown, LogOut, User as UserIcon, ArrowUpDown, ChevronUp, ChevronDown, Settings as SettingsIcon } from 'lucide-react'; // Added SettingsIcon
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { db, auth, storage } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc, getDocs, where, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { signOut, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Import the new tab components
import InventoryTab from './inventory/InventoryTab';
import InvoicesTab from './invoices/InvoicesTab';
import DashboardTab from './dashboard/DashboardTab';
import Settings from '@/pages/Settings'; // Import the new Settings page

// Import new modal components
import ProductModal from './modals/ProductModal';
import InvoiceModal from './modals/InvoiceModal';
import InvoiceViewerModal from './modals/InvoiceViewerModal';
import ColumnMappingModal from './modals/ColumnMappingModal';
import SellHistoryModal from './modals/SellHistoryModal';
// SanityCheckModal and ActivityLogModal are now handled within Settings.tsx

import { logActivity } from '@/utils/logActivity';

export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  onHand?: number;
  price: number;
  category: string;
  purchasePrice?: number;
  shortDescription?: string;
  initialStock?: number;
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
    discount?: number;
  }[];
  itemsIds?: string[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  total: number;
  status: string;
  invoiceType?: 'sale' | 'refund' | 'writeoff';
  deletedAt?: Timestamp;
  createdAt?: Timestamp;
}

const InventoryManagementApp = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [activeTab, setActiveTab] = useState('inventory');
  const [dateFilter, setDateFilter] = useState({ 
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [localSearchInput, setLocalSearchInput] = useState('');
  const deferredSearchTerm = useDeferredValue(localSearchInput);
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  // ColumnMappingModal is now handled within Settings.tsx
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  // Excel related states are now handled within Settings.tsx
  
  const [sortColumn, setSortColumn] = useState<'name' | 'sku' | 'category' | 'quantity' | 'price'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [invoiceSortBy, setInvoiceSortBy] = useState<'number' | 'date' | 'customer' | 'total'>('number');
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<'asc' | 'desc'>('asc');

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const productsQuery = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(productsQuery, (querySnapshot) => {
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading products in real-time:', error);
      toast.error('❌ Failed to load products');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const invoicesQuery = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(invoicesQuery, (querySnapshot) => {
      const invoicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Invoice[];
      setInvoices(invoicesData);
    }, (error) => {
      console.error('Error loading invoices in real-time:', error);
      toast.error('❌ Failed to load invoices');
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('✅ Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('❌ Failed to log out');
    }
  };

  const filteredProducts = React.useMemo(() => {
    return products.filter(product => {
      const matchesSearch = (product.name || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (product.sku || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (product.category || '').toLowerCase().includes(deferredSearchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [products, deferredSearchTerm]);

  const sortedProducts = React.useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aValue: string | number = a[sortColumn];
      let bValue: string | number = b[sortColumn];
      
      if (sortColumn === 'name' || sortColumn === 'sku' || sortColumn === 'category') {
        aValue = (aValue as string || '').toLowerCase();
        bValue = (bValue as string || '').toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortColumn, sortDirection]);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleInvoiceSort = (column: typeof invoiceSortBy) => {
    if (invoiceSortBy === column) {
      setInvoiceSortDirection(invoiceSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setInvoiceSortBy(column);
      setInvoiceSortDirection('asc');
    }
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (quantity < 10) return { label: 'Low', variant: 'warning' as const };
    if (quantity < 30) return { label: 'Medium', variant: 'secondary' as const };
    return { label: 'In Stock', variant: 'default' as const };
  };

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

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        toast.success('✅ Product deleted successfully!');
        await logActivity('Deleted product', productId);
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('❌ Failed to delete product');
      }
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select products to delete.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedProducts.size} selected product(s)? This action cannot be undone.`)) {
      try {
        const deletePromises = Array.from(selectedProducts).map((productId) =>
          deleteDoc(doc(db, 'products', productId))
        );
        await Promise.all(deletePromises);
        setSelectedProducts(new Set());
        toast.success(`✅ ${selectedProducts.size} products deleted successfully!`);
        await logActivity('Bulk deleted products', 'Multiple', `${selectedProducts.size} products`);
      } catch (error) {
        console.error('Error bulk deleting products:', error);
        toast.error('❌ Failed to delete selected products');
      }
    }
  };

  const handleDeleteAllProducts = async () => {
    if (products.length === 0) {
      toast.error('No products to delete');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ALL ${products.length} products? This action cannot be undone.`)) {
      try {
        const deletePromises = products.map((product) =>
          deleteDoc(doc(db, 'products', product.id))
        );
        await Promise.all(deletePromises);
        toast.success('✅ All products deleted successfully!');
        await logActivity('Deleted all products', 'All', `${products.length} products`);
      } catch (error) {
        console.error('Error deleting all products:', error);
        toast.error('❌ Failed to delete all products');
      }
    }
  };

  async function handleDeleteInvoice(invoice: Invoice) {
    if (!invoice || !invoice.id || !currentUser) return;

    if (!window.confirm(`Are you sure you want to delete invoice #${invoice.number || invoice.id} for ${invoice.customer.name}? It will be moved to Trash and stock will be returned.`)) {
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/apply-invoice-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          action: 'delete',
          newItems: invoice.items.map(item => ({ productId: item.productId, quantity: item.quantity, sku: item.sku })),
          idempotencyKey: `${invoice.id}:delete:${Date.now()}`,
          userId: currentUser.uid,
          reason: `Invoice ${invoice.number || invoice.id} deleted.`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to apply stock changes via Netlify function.');
      }

      await setDoc(doc(db, 'deletedInvoices', invoice.id), {
        ...invoice,
        deletedAt: serverTimestamp(),
      });

      await deleteDoc(doc(db, 'invoices', invoice.id));

      toast.success('🗑️ Invoice moved to Trash, stock returned.');
      await logActivity('Deleted invoice', invoice.number || invoice.id, 'Moved to Trash');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('❌ Failed to move invoice to Trash.');
    }
  }

  const handleBulkDeleteInvoices = async () => {
    if (selectedInvoices.size === 0) {
      toast.error('Please select invoices to delete');
      return;
    }
    if (!currentUser) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedInvoices.size} selected invoice(s)? They will be moved to Trash and stock will be returned.`)) {
      try {
        const deletePromises = Array.from(selectedInvoices).map(async (invoiceId) => {
          const invoice = invoices.find(inv => inv.id === invoiceId);
          if (invoice) {
            const response = await fetch('/.netlify/functions/apply-invoice-stock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                invoiceId: invoice.id,
                action: 'delete',
                newItems: invoice.items.map(item => ({ productId: item.productId, quantity: item.quantity, sku: item.sku })),
                idempotencyKey: `${invoice.id}:bulk-delete:${Date.now()}`,
                userId: currentUser.uid,
                reason: `Invoice ${invoice.number || invoice.id} bulk deleted.`,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to apply stock changes via Netlify function.');
            }

            // Move to deletedInvoices before deleting from main collection
            await setDoc(doc(db, 'deletedInvoices', invoice.id), {
              ...invoice,
              deletedAt: serverTimestamp(),
            });

            return deleteDoc(doc(db, 'invoices', invoice.id));
          }
          return Promise.resolve();
        });
        await Promise.all(deletePromises);
        setSelectedInvoices(new Set());
        toast.success(`🗑️ All invoices moved to Trash, stock returned.`);
        await logActivity('Bulk deleted invoices', 'Multiple', `${selectedInvoices.size} invoices`);

      } catch (error) {
        console.error('Error bulk deleting invoices:', error);
        toast.error('❌ Failed to delete invoices');
      }
    }
  };

  const handleDeleteAllInvoices = async () => {
    if (invoices.length === 0) {
      toast.error('No invoices to delete');
      return;
    }
    if (!currentUser) return;
    
    if (window.confirm(`Are you sure you want to delete ALL ${invoices.length} invoices? They will be moved to Trash and stock will be returned. This action cannot be undone.`)) {
      try {
        const deletePromises = invoices.map(async (invoice) => {
          const response = await fetch('/.netlify/functions/apply-invoice-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoiceId: invoice.id,
              action: 'delete',
              newItems: invoice.items.map(item => ({ productId: item.productId, quantity: item.quantity, sku: item.sku })),
              idempotencyKey: `${invoice.id}:delete-all:${Date.now()}`,
              userId: currentUser.uid,
              reason: `Invoice ${invoice.number || invoice.id} deleted (all).`,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to apply stock changes via Netlify function.');
          }

          // Move to deletedInvoices before deleting from main collection
          await setDoc(doc(db, 'deletedInvoices', invoice.id), {
            ...invoice,
            deletedAt: serverTimestamp(),
          });

          return deleteDoc(doc(db, 'invoices', invoice.id));
        });
        await Promise.all(deletePromises);
        setSelectedInvoices(new Set());
        toast.success('🗑️ All invoices moved to Trash, stock returned.');
        await logActivity('Deleted all invoices', 'All', `${invoices.length} invoices`);

      } catch (error) {
        console.error('Error deleting all invoices:', error);
        toast.error('❌ Failed to delete all data');
      }
    }
  };

  // handleClearAllData is now moved to Settings.tsx

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

  // handleImportExcel, exportToCSV, exportToJSON are now moved to Settings.tsx

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
      
      invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const purchasePrice = product?.purchasePrice || item.purchasePrice || 0;
        totalCosts += purchasePrice * item.quantity;
        
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
      filteredInvoices,
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
                { key: 'settings', label: 'Settings', icon: SettingsIcon }, // Changed 'data' to 'settings'
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
                  { key: 'settings', icon: SettingsIcon }, // Changed 'data' to 'settings'
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
            selectedProductForHistory={selectedProductForHistory}
            setSelectedProductForHistory={setSelectedProductForHistory}
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
        {activeTab === 'settings' && ( // Changed 'data' to 'settings'
          <Settings
            products={products}
            invoices={invoices}
            currentUser={currentUser}
          />
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
        currentUser={currentUser}
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

      {/* Column Mapping Modal is now handled within Settings.tsx */}

      {/* Sell History Modal */}
      {selectedProductForHistory && (
        <SellHistoryModal
          product={selectedProductForHistory}
          onClose={() => setSelectedProductForHistory(null)}
          db={db}
          toast={toast}
        />
      )}
    </div>
  );
};

export default InventoryManagementApp;