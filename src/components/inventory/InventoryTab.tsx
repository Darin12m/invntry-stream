import React, { useState, useMemo, useCallback, useContext, useRef } from 'react';
import { Search, Plus, Edit, Trash2, Trash, X, ChevronUp, ChevronDown, Package, CheckSquare, Square, History, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import { getStockStatus } from '@/utils/helpers';
import ProductModal from '@/components/modals/ProductModal';
import SellHistoryModal from '@/components/modals/SellHistoryModal';
import { AppContext } from '@/context/AppContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner'; // Import toast
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

const LONG_PRESS_DURATION = 500; // milliseconds

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
  const { invoices: allInvoices } = useInvoices(); // Use allInvoices from useInvoices
  const { isIOS } = useDeviceType(); // Use the hook

  const [localSearchInput, setLocalSearchInput] = useState('');
  const [debouncedSearchTerm] = useDebounce(localSearchInput, 300);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showSellHistoryModal, setShowSellHistoryModal] = useState(false);
  const [currentProductSellHistory, setCurrentProductSellHistory] = useState<any[]>([]);
  const [currentProductForSellHistory, setCurrentProductForSellHistory] = useState<string>('');

  const [selectionMode, setSelectionMode] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

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
    setSelectionMode(false);
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

  // Long-press / Tap selection logic
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleInteractionStart = useCallback((productId: string) => {
    clearLongPressTimer(); // Clear any previous timer
    longPressTimer.current = setTimeout(() => {
      setSelectionMode(true);
      toggleProductSelection(productId);
      longPressTimer.current = null; // Clear timer after it fires
    }, LONG_PRESS_DURATION);
  }, [clearLongPressTimer, toggleProductSelection]);

  const handleInteractionEnd = useCallback((productId: string, isClick: boolean) => {
    clearLongPressTimer();
    if (selectionMode) {
      if (isClick) { // Only toggle on click/tap if in selection mode
        toggleProductSelection(productId);
      }
    } else {
      if (isClick) { // Normal click action if not in selection mode and not a long press
        const product = products.find(p => p.id === productId);
        if (product) {
          handleEditProduct(product);
        }
      }
    }
  }, [selectionMode, toggleProductSelection, handleEditProduct, products, clearLongPressTimer]);

  const handleCancelSelectionMode = useCallback(() => {
    setSelectionMode(false);
    clearSelectedProducts();
  }, [clearSelectedProducts]);

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
    <div className="space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted spacing */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4"> {/* Adjusted spacing */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Inventory Management</h2> {/* Adjusted font size */}
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your products and stock levels</p> {/* Adjusted font size */}
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap justify-end"> {/* Adjusted spacing */}
          {selectionMode ? (
            <>
              {selectedProducts.size > 0 && (
                <Button
                  onClick={handleBulkDelete}
                  variant="destructive"
                  className="shadow-elegant"
                  size={isIOS ? "sm" : "default"} // Smaller button on iOS
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                  Delete Selected ({selectedProducts.size})
                </Button>
              )}
              <Button
                onClick={handleCancelSelectionMode}
                variant="outline"
                size={isIOS ? "sm" : "default"}
              >
                <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Done
              </Button>
            </>
          ) : (
            <Button
              onClick={handleAddProduct}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              size={isIOS ? "sm" : "default"} // Smaller button on iOS
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar and Bulk Actions */}
      <Card className="p-3 sm:p-4 shadow-card space-y-3 sm:space-y-4"> {/* Adjusted padding and spacing */}
        <div className="relative w-full">
          <Search className="absolute left-2 sm:left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" /> {/* Adjusted icon size and position */}
          <Input
            placeholder="Search products by name, SKU, or category..."
            value={localSearchInput}
            onChange={(e) => setLocalSearchInput(e.target.value)}
            className="pl-8 sm:pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary text-sm sm:text-base" /* Adjusted padding and font size */
          />
        </div>
        {localSearchInput && (
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center flex-wrap gap-1 sm:gap-2"> {/* Adjusted font size and spacing */}
            Showing {filteredProducts.length} of {products.length} products matching "{localSearchInput}"
            <Button
              onClick={() => setLocalSearchInput('')}
              variant="ghost"
              size="sm"
              className="h-auto px-1 sm:px-2 py-0.5 sm:py-1 text-xs" /* Adjusted padding and font size */
            >
              <X className="h-2.5 w-2.5 sm:h-3 w-3 mr-0.5 sm:mr-1" /> Clear Search {/* Adjusted icon size */}
            </Button>
          </div>
        )}

        {selectionMode && (
          <div className="flex gap-1 sm:gap-2 justify-end flex-wrap"> {/* Adjusted spacing */}
            <Button
              onClick={handleSelectAll}
              variant="outline"
              size={isIOS ? "sm" : "default"} // Smaller button on iOS
              disabled={filteredProducts.length === 0}
            >
              {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                <>
                  <Square className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                  Select All
                </>
              )}
            </Button>
            <Button
              onClick={deleteAllProducts}
              variant="destructive"
              size={isIOS ? "sm" : "default"} // Smaller button on iOS
              className="transition-all duration-200"
            >
              <Trash className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
              Delete All
            </Button>
          </div>
        )}
      </Card>

      {/* Desktop Table View - Hidden on mobile */}
      <Card className="shadow-card hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]"> {/* Added min-width for better table experience */}
            <thead>
              <tr className="border-b bg-muted/30">
                {selectionMode && (
                  <th className="text-left p-4 font-medium w-12">
                    <Checkbox
                      checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                      onCheckedChange={handleSelectAll}
                      disabled={filteredProducts.length === 0}
                    />
                  </th>
                )}
                <th className="text-left p-4 font-medium text-sm"> {/* Adjusted font size */}
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    Name
                    {sortColumn === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm"> {/* Adjusted font size */}
                  <button
                    onClick={() => handleSort('sku')}
                    className="flex items-center gap-2 hover:text-primary transition-colors mx-auto"
                  >
                    SKU
                    {sortColumn === 'sku' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4 font-medium text-sm"> {/* Adjusted font size */}
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center gap-2 hover:text-primary transition-colors mx-auto"
                  >
                    Category
                    {sortColumn === 'category' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-right p-4 font-medium text-sm"> {/* Adjusted font size */}
                  <button
                    onClick={() => handleSort('quantity')}
                    className="flex items-center gap-2 hover:text-primary transition-colors ml-auto"
                  >
                    Quantity
                    {sortColumn === 'quantity' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-right p-4 font-medium text-sm"> {/* Adjusted font size */}
                  <button
                    onClick={() => handleSort('onHand')}
                    className="flex items-center gap-2 hover:text-primary transition-colors ml-auto"
                  >
                    On Hand
                    {sortColumn === 'onHand' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-right p-4 font-medium text-sm"> {/* Adjusted font size */}
                  <button
                    onClick={() => handleSort('price')}
                    className="flex items-center gap-2 hover:text-primary transition-colors ml-auto"
                  >
                    Price
                    {sortColumn === 'price' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-right p-4 font-medium text-sm">Actions</th> {/* Adjusted font size */}
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product, index) => {
                const displayQuantity = product.quantity ?? 0;
                const displayOnHand = product.onHand ?? 0;
                const stockStatus = getStockStatus(displayOnHand);
                return (
                  <tr 
                    key={product.id} 
                    className={`border-b hover:bg-muted/50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} ${selectedProducts.has(product.id) ? 'bg-primary/10' : ''}`}
                    onMouseDown={() => handleInteractionStart(product.id)}
                    onMouseUp={() => handleInteractionEnd(product.id, true)}
                    onMouseLeave={clearLongPressTimer}
                  >
                    {selectionMode && (
                      <td className="p-4">
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                      </td>
                    )}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-foreground text-sm">{product.name}</div> {/* Adjusted font size */}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground text-xs">{product.sku}</span> {/* Adjusted font size */}
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-muted-foreground text-xs">{product.category}</span> {/* Adjusted font size */}
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-medium text-sm">{displayQuantity}</span> {/* Adjusted font size */}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium text-sm">{displayOnHand}</span> {/* Adjusted font size */}
                        <Badge variant={stockStatus.variant} className="text-xs">
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-medium text-primary text-sm">{product.price.toFixed(2)} ден.</span> {/* Adjusted font size */}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => handleEditProduct(product)}
                          variant="outline"
                          size="sm"
                          disabled={selectionMode}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleViewSellHistory(product.id, product.name)}
                          variant="outline"
                          size="sm"
                          disabled={selectionMode}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => deleteProduct(product.id)}
                          variant="destructive"
                          size="sm"
                          disabled={selectionMode}
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
      <div className="space-y-3 sm:space-y-4 md:hidden"> {/* Adjusted spacing */}
        {sortedProducts.map(product => {
          const displayQuantity = product.quantity ?? 0;
          const displayOnHand = product.onHand ?? 0;
          const stockStatus = getStockStatus(displayOnHand);
          return (
            <Card 
              key={product.id} 
              className={`p-3 sm:p-4 hover:shadow-lg transition-all duration-300 animate-scale-in ${selectedProducts.has(product.id) ? 'bg-primary/10' : ''}`}
              onTouchStart={() => handleInteractionStart(product.id)}
              onTouchEnd={() => handleInteractionEnd(product.id, true)}
              onTouchCancel={clearLongPressTimer}
              onMouseDown={() => handleInteractionStart(product.id)}
              onMouseUp={() => handleInteractionEnd(product.id, true)}
              onMouseLeave={clearLongPressTimer}
            >
              <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3"> {/* Adjusted spacing */}
                {selectionMode && (
                  <Checkbox
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                    className="mt-0.5 sm:mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2"> {/* Adjusted spacing */}
                    <h3 className="font-bold text-base sm:text-lg text-foreground">{product.name}</h3> {/* Adjusted font size */}
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm"> {/* Adjusted spacing and font size */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">SKU:</span>
                      <span className="font-medium">{product.sku}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium">{product.category}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="font-medium">{displayQuantity}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">On Hand:</span>
                      <div className="flex items-center gap-1 sm:gap-2"> {/* Adjusted spacing */}
                        <span className="font-medium">{displayOnHand}</span>
                        <Badge variant={stockStatus.variant} className="text-xs">
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
              <div className="flex gap-1 sm:gap-2 pt-2 sm:pt-3 border-t"> {/* Adjusted spacing and padding */}
                <Button
                  onClick={() => handleEditProduct(product)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={selectionMode}
                >
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                  Edit
                </Button>
                <Button
                  onClick={() => handleViewSellHistory(product.id, product.name)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={selectionMode}
                >
                  <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                  History
                </Button>
                <Button
                  onClick={() => deleteProduct(product.id)}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={selectionMode}
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                  Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {sortedProducts.length === 0 && (
        <Card className="p-8 sm:p-12 text-center animate-scale-in"> {/* Adjusted padding */}
          <div className="max-w-md mx-auto">
            <Package className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" /> {/* Adjusted icon size */}
            <h3 className="text-xl sm:text-2xl font-bold mb-2"> {/* Adjusted font size */}
              {products.length === 0 ? 'No products yet' : 'No results found'}
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6"> {/* Adjusted font size and spacing */}
              {products.length === 0 
                ? "Add your first product using the + button above to get started with your inventory." 
                : debouncedSearchTerm 
                  ? `No products match "${debouncedSearchTerm}". Try adjusting your search.`
                  : "No products match the selected filters. Try different filter options."}
            </p>
            {products.length === 0 && !selectionMode && (
              <Button onClick={handleAddProduct} className="transition-all duration-200 hover:scale-105" size={isIOS ? "sm" : "default"}> {/* Smaller button on iOS */}
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
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