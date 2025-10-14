import React from 'react';
import { Search, Plus, Edit, Trash2, Package, X, CheckSquare, Square, Trash, ChevronUp, ChevronDown, BookOpenText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  purchasePrice?: number;
  thumbnail?: string;
  shortDescription?: string;
}

interface InventoryTabProps {
  localSearchInput: string;
  setLocalSearchInput: (value: string) => void;
  filteredProducts: Product[];
  products: Product[];
  sortedProducts: Product[];
  selectedProducts: Set<string>;
  toggleProductSelection: (productId: string) => void;
  selectAllProducts: () => void;
  handleBulkDeleteProducts: () => Promise<void>;
  handleDeleteAllProducts: () => Promise<void>;
  handleAddProduct: () => void;
  handleEditProduct: (product: Product) => void;
  handleDeleteProduct: (productId: string) => Promise<void>;
  sortColumn: 'name' | 'sku' | 'category' | 'quantity' | 'price';
  sortDirection: 'asc' | 'desc';
  handleSort: (column: 'name' | 'sku' | 'category' | 'quantity' | 'price') => void;
  getStockStatus: (quantity: number) => { label: string; variant: 'destructive' | 'warning' | 'secondary' | 'default' };
  handleCreateMiniCatalog: () => void;
}

const InventoryTab: React.FC<InventoryTabProps> = ({
  localSearchInput,
  setLocalSearchInput,
  filteredProducts,
  products,
  sortedProducts,
  selectedProducts,
  toggleProductSelection,
  selectAllProducts,
  handleBulkDeleteProducts,
  handleDeleteAllProducts,
  handleAddProduct,
  handleEditProduct,
  handleDeleteProduct,
  sortColumn,
  sortDirection,
  handleSort,
  getStockStatus,
  handleCreateMiniCatalog,
}) => (
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
            <Button
              onClick={handleCreateMiniCatalog}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-elegant transition-all duration-300"
              disabled={selectedProducts.size === 0}
            >
              <BookOpenText className="h-4 w-4 mr-2" />
              Create Mini Catalog
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

    {/* Search Bar and Bulk Actions */}
    <Card className="p-4 shadow-card space-y-4">
      <div className="relative w-full">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, SKU, or category..."
          value={localSearchInput}
          onChange={(e) => setLocalSearchInput(e.target.value)}
          className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary"
        />
      </div>
      {localSearchInput && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products matching "{localSearchInput}"
          <Button
            onClick={() => setLocalSearchInput('')}
            variant="ghost"
            size="sm"
            className="ml-2 h-auto px-2 py-1 text-xs"
          >
            <X className="h-3 w-3 mr-1" /> Clear Search
          </Button>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          onClick={selectAllProducts}
          variant="outline"
          size="sm"
          className="transition-all duration-200"
        >
          {selectedProducts.size === sortedProducts.length && sortedProducts.length > 0 ? (
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
            className="transition-all duration-200"
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete All
          </Button>
        )}
      </div>
    </Card>

    {/* Desktop Table View - Hidden on mobile */}
    <Card className="shadow-card hidden md:block overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="p-4 w-12">
                <Checkbox
                  checked={selectedProducts.size === sortedProducts.length && sortedProducts.length > 0}
                  onCheckedChange={selectAllProducts}
                />
              </th>
              <th className="text-left p-4 font-medium">
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
              <th className="text-center p-4 font-medium">
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
              <th className="text-center p-4 font-medium">
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
              <th className="text-right p-4 font-medium">
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
              <th className="text-right p-4 font-medium">
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
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product, index) => {
              const stockStatus = getStockStatus(product.quantity);
              return (
                <tr 
                  key={product.id} 
                  className={`border-b hover:bg-muted/50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                >
                  <td className="p-4">
                    <Checkbox
                      checked={selectedProducts.has(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                          onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                          No Img
                        </div>
                      )}
                      <div className="font-medium text-foreground">{product.name}</div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-muted-foreground text-sm">{product.sku}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-muted-foreground text-sm">{product.category}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium">{product.quantity}</span>
                      <Badge variant={stockStatus.variant} className="text-xs">
                        {stockStatus.label}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-medium text-primary">{product.price.toFixed(2)} ден.</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-end">
                      <Button
                        onClick={() => handleEditProduct(product)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteProduct(product.id)}
                        variant="destructive"
                        size="sm"
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
    <div className="space-y-4 md:hidden">
      {sortedProducts.map(product => {
        const stockStatus = getStockStatus(product.quantity);
        return (
          <Card key={product.id} className="p-4 hover:shadow-lg transition-all duration-300 animate-scale-in">
            <div className="flex items-start gap-3 mb-3">
              <Checkbox
                checked={selectedProducts.has(product.id)}
                onCheckedChange={() => toggleProductSelection(product.id)}
                className="mt-1 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                      onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                      No Img
                    </div>
                  )}
                  <h3 className="font-bold text-lg text-foreground">{product.name}</h3>
                </div>
                <div className="space-y-2 text-sm">
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{product.quantity}</span>
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
            <div className="flex gap-2 pt-3 border-t">
              <Button
                onClick={() => handleEditProduct(product)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                onClick={() => handleDeleteProduct(product.id)}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </Card>
        );
      })}
    </div>

    {sortedProducts.length === 0 && (
      <Card className="p-12 text-center animate-scale-in">
        <div className="max-w-md mx-auto">
          <Package className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-2xl font-bold mb-2">
            {products.length === 0 ? 'No products yet' : 'No results found'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {products.length === 0 
              ? "Add your first product using the + button above to get started with your inventory." 
              : localSearchInput 
                ? `No products match "${localSearchInput}". Try adjusting your search.`
                : "No products match the selected filters. Try different filter options."}
          </p>
          {products.length === 0 && (
            <Button onClick={handleAddProduct} className="transition-all duration-200 hover:scale-105">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Product
            </Button>
          )}
        </div>
      </Card>
    )}
  </div>
);

export default InventoryTab;