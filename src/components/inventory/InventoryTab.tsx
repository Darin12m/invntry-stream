import React, { useState, useMemo, useCallback, useContext } from 'react';
import { Search, Plus, Edit, Trash2, Trash, ChevronUp, ChevronDown, Package, CheckSquare, History, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import { getStockStatus } from '@/utils/helpers';
import ProductModal from '@/components/modals/ProductModal';
import SellHistoryModal from '@/components/modals/SellHistoryModal';
import { AppContext } from '@/context/AppContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useDebounce } from 'use-debounce';
import { useDeviceType } from '@/hooks/useDeviceType';

const InventoryTab: React.FC = React.memo(() => {
  const { currentUser, products, invoices } = useContext(AppContext);
  const {
    loadingProducts,
    errorProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    deleteAllProducts,
    sortColumn,
    sortDirection,
    handleSort,
    selectedProducts,
    toggleProductSelection,
    selectAllProducts: selectAllProductsHook,
    clearSelectedProducts
  } = useProducts();
  const { invoices: allInvoices } = useInvoices();
  const { isIOS } = useDeviceType();

  const [localSearchInput, setLocalSearchInput] = useState('');
  const [debouncedSearchTerm] = useDebounce(localSearchInput, 300);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showSellHistoryModal, setShowSellHistoryModal] = useState(false);
  const [currentProductSellHistory, setCurrentProductSellHistory] = useState<any[]>([]);
  const [currentProductForSellHistory, setCurrentProductForSellHistory] = useState<string>('');

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = (product.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (product.sku || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (product.category || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [products, debouncedSearchTerm]);

  const sortedProducts = useMemo(() => {
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

  const handleAddProduct = useCallback(() => {
    setEditingProduct(null);
    setShowProductModal(true);
  }, []);

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  }, []);

  const handleBulkDelete = useCallback(() => {
    bulkDeleteProducts(selectedProducts);
    clearSelectedProducts();
  }, [bulkDeleteProducts, selectedProducts, clearSelectedProducts]);

  const handleSelectAll = useCallback(() => {
    selectAllProductsHook(filteredProducts.map(p => p.id));
  }, [selectAllProductsHook, filteredProducts]);

  const handleViewSellHistory = useCallback((productId: string, productName: string) => {
    const history = allInvoices.flatMap(invoice =>
      invoice.items
        .filter(item => item.productId === productId && item.quantity > 0)
        .map(item => ({
          invoiceNumber: invoice.number,
          date: invoice.date,
          quantity: item.quantity,
          price: item.price,
        }))
    );
    setCurrentProductSellHistory(history);
    setCurrentProductForSellHistory(productName);
    setShowSellHistoryModal(true);
  }, [allInvoices]);

  // Handle checkbox selection only - no long-press
  const handleCheckboxSelect = useCallback((productId: string, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    toggleProductSelection(productId);
  }, [toggleProductSelection]);

  if (loadingProducts) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-base sm:text-lg">Loading products...</p> {/* Adjusted font size */}
      </div>
    );
  }

  if (errorProducts) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-destructive">
        <p className="text-base sm:text-lg">Error: {errorProducts}</p> {/* Adjusted font size */}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-foreground">Inventory</h2>
          <p className="text-muted-foreground mt-1">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap justify-end">
          {selectedProducts.size > 0 && (
            <Button
              onClick={handleBulkDelete}
              variant="destructive"
              className="shadow-elegant"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedProducts.size})
            </Button>
          )}
          <Button
            onClick={handleAddProduct}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4 sm:p-5 shadow-card">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name, SKU, or category..."
            value={localSearchInput}
            onChange={(e) => setLocalSearchInput(e.target.value)}
            className="pl-10 h-11 transition-all duration-200 focus:ring-2 focus:ring-primary text-sm"
          />
        </div>
      </Card>

      {/* Bulk Actions Row */}
      <div className="flex items-center justify-end gap-3">
        <Button
          onClick={handleSelectAll}
          variant="outline"
          size="sm"
          className="h-9 px-4"
          disabled={filteredProducts.length === 0}
        >
          <CheckSquare className="h-4 w-4 mr-2" />
          Select All
        </Button>
        <Button
          onClick={deleteAllProducts}
          variant="destructive"
          size="sm"
          className="h-9 px-4"
          disabled={filteredProducts.length === 0}
        >
          <Trash className="h-4 w-4 mr-2" />
          Delete All
        </Button>
      </div>

      {/* Desktop Table View - Hidden on mobile */}
      <Card className="shadow-card hidden lg:block overflow-hidden border border-border/50">
        <div className="overflow-x-auto w-full"> {/* Horizontal scroll for product fields */}
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="w-12 p-4 text-left">
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                       onClick={handleSelectAll}>
                    {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-sm text-foreground w-[28%]">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    Name
                    {sortColumn === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm text-foreground w-[12%]">
                  <button
                    onClick={() => handleSort('sku')}
                    className="flex items-center gap-1 hover:text-primary transition-colors mx-auto"
                  >
                    SKU
                    {sortColumn === 'sku' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm text-foreground w-[15%]">
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center gap-1 hover:text-primary transition-colors mx-auto"
                  >
                    Category
                    {sortColumn === 'category' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm text-foreground w-[10%]">
                  <button
                    onClick={() => handleSort('quantity')}
                    className="flex items-center gap-1 hover:text-primary transition-colors mx-auto"
                  >
                    Quantity
                    {sortColumn === 'quantity' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm text-foreground w-[12%]">
                  <button
                    onClick={() => handleSort('onHand')}
                    className="flex items-center gap-1 hover:text-primary transition-colors mx-auto"
                  >
                    On Hand
                    {sortColumn === 'onHand' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm text-foreground w-[10%]">
                  <button
                    onClick={() => handleSort('price')}
                    className="flex items-center gap-1 hover:text-primary transition-colors mx-auto"
                  >
                    Price
                    {sortColumn === 'price' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm text-foreground w-[13%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product) => {
                const displayQuantity = product.quantity ?? 0;
                const displayOnHand = product.onHand ?? 0;
                const stockStatus = getStockStatus(displayOnHand);
                return (
                  <tr 
                    key={product.id} 
                    className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${selectedProducts.has(product.id) ? 'bg-primary/5' : ''}`}
                  >
                    <td className="p-4">
                      <div 
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          selectedProducts.has(product.id) 
                            ? 'border-primary bg-primary' 
                            : 'border-muted-foreground/30 hover:border-primary'
                        }`}
                        onClick={() => toggleProductSelection(product.id)}
                      >
                        {selectedProducts.has(product.id) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-foreground text-sm truncate block">{product.name}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground text-sm">{product.sku}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground text-sm truncate block">{product.category}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium text-sm">{displayQuantity}</span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium text-sm">{displayOnHand}</span>
                        <Badge 
                          variant={stockStatus.variant} 
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            stockStatus.label === 'Low' 
                              ? 'bg-warning/20 text-warning-foreground border-warning' 
                              : stockStatus.label === 'Out of Stock'
                              ? 'bg-destructive text-destructive-foreground'
                              : ''
                          }`}
                        >
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium text-primary text-sm">{product.price.toFixed(2)}</span>
                      <span className="text-primary text-sm ml-1">ден.</span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5 justify-center">
                        <Button
                          onClick={() => handleEditProduct(product)}
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-lg border-border/50"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          onClick={() => handleViewSellHistory(product.id, product.name)}
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-lg border-border/50"
                        >
                          <History className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          onClick={() => deleteProduct(product.id)}
                          variant="destructive"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Card View - Hidden on desktop */}
      <div className="space-y-3 lg:hidden w-full max-w-full overflow-hidden">
        {sortedProducts.map(product => {
          const displayQuantity = product.quantity ?? 0;
          const displayOnHand = product.onHand ?? 0;
          const stockStatus = getStockStatus(displayOnHand);
          return (
            <Card 
              key={product.id} 
              className={`p-4 hover:shadow-lg transition-all duration-300 w-full max-w-full overflow-hidden select-none ${selectedProducts.has(product.id) ? 'bg-primary/5' : ''}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div 
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                    selectedProducts.has(product.id) 
                      ? 'border-primary bg-primary' 
                      : 'border-muted-foreground/30'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent the card's onTouchEnd from firing if checkbox is clicked
                    toggleProductSelection(product.id);
                  }}
                >
                  {selectedProducts.has(product.id) && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-foreground truncate">{product.name}</h3>
                  <div className="space-y-2 text-sm mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">SKU:</span>
                      <span className="font-medium truncate ml-2">{product.sku}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium truncate ml-2">{product.category}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="font-medium">{displayQuantity}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">On Hand:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayOnHand}</span>
                        <Badge 
                          variant={stockStatus.variant} 
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            stockStatus.label === 'Low' 
                              ? 'bg-warning/20 text-warning-foreground border-warning' 
                              : stockStatus.label === 'Out of Stock'
                              ? 'bg-destructive text-destructive-foreground'
                              : ''
                          }`}
                        >
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-medium text-primary">{product.price.toFixed(2)} ден.</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/30">
                <Button
                  onClick={() => handleEditProduct(product)}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9"
                >
                  <Edit className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
                <Button
                  onClick={() => handleViewSellHistory(product.id, product.name)}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9"
                >
                  <History className="h-4 w-4 mr-1.5" />
                  History
                </Button>
                <Button
                  onClick={() => deleteProduct(product.id)}
                  variant="destructive"
                  size="sm"
                  className="flex-1 h-9"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {sortedProducts.length === 0 && (
        <Card className="p-8 sm:p-12 text-center animate-scale-in">
          <div className="max-w-md mx-auto">
            <Package className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              {products.length === 0 ? 'No products yet' : 'No results found'}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
              {products.length === 0 
                ? "Add your first product using the + button above to get started with your inventory." 
                : debouncedSearchTerm 
                  ? `No products match "${debouncedSearchTerm}". Try adjusting your search.`
                  : "No products match the selected filters. Try different filter options."}
            </p>
            {products.length === 0 && (
              <Button onClick={handleAddProduct} className="transition-all duration-200 hover:scale-105" size={isIOS ? "sm" : "default"}>
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Add Your First Product
              </Button>
            )}
          </div>
        </Card>
      )}

      <ProductModal
        showProductModal={showProductModal}
        setShowProductModal={setShowProductModal}
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}
        // Removed fetchProducts, currentUser, addProduct, updateProduct props as they are handled by hooks/context
      />

      <SellHistoryModal
        showSellHistoryModal={showSellHistoryModal}
        setShowSellHistoryModal={setShowSellHistoryModal}
        productName={currentProductForSellHistory}
        sellHistory={currentProductSellHistory}
      />
    </div>
  );
});

export default InventoryTab;