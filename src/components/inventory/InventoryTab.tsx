import React from 'react';
import { Search, Plus, Edit, Trash2, Package, FileText, Upload, Download, Save, Printer, X, Eye, Calendar, DollarSign, Hash, ShoppingCart, CheckSquare, Square, Trash, FileDown, BarChart3, TrendingUp, Users, TrendingDown, LogOut, User as UserIcon, ArrowUpDown, ChevronUp, ChevronDown, Sun, Moon } from 'lucide-react';
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
}

interface InventoryTabProps {
  localSearchInput: string;
  setLocalSearchInput: (value: string) => void;
  filteredProducts: Product[];
  products: Product[]; // All products, for selectAll logic
  sortedProducts: Product[];
  selectedProducts: Set<string>;
  toggleProductSelection: (productId: string) => void;
  selectAllProducts: () => void;
  handleBulkDeleteProducts: () => void;
  handleDeleteAllProducts: () => void;
  handleAddProduct: () => void;
  handleEditProduct: (product: Product) => void;
  handleDeleteProduct: (productId: string) => void;
  sortColumn: 'name' | 'sku' | 'category' | 'quantity' | 'price';
  sortDirection: 'asc' | 'desc';
  handleSort: (column: 'name' | 'sku' | 'category' | 'quantity' | 'price') => void;
  getStockStatus: (quantity: number) => { label: string; variant: 'default' | 'secondary' | 'destructive' | 'warning' };
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
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
      <p className="text-muted-foreground">Manage your product stock, add new items, and track quantities.</p>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, SKU, or category..."
          value={localSearchInput}
          onChange={(e) => setLocalSearchInput(e.target.value)}
          className="pl-10 pr-4 py-2 rounded-lg shadow-sm focus-visible:ring-primary"
        />
      </div>

      {/* Bulk Actions */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-products"
              checked={selectedProducts.size > 0 && selectedProducts.size === filteredProducts.length}
              onCheckedChange={selectAllProducts}
            />
            <label
              htmlFor="select-all-products"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Select All ({selectedProducts.size})
            </label>
          </div>
          <div className="flex gap-2">
            {selectedProducts.size > 0 && (
              <Button
                onClick={handleBulkDeleteProducts}
                variant="destructive"
                size="sm"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            )}
            <Button
              onClick={handleAddProduct}
              className="bg-gradient-primary shadow-elegant"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </Card>

      {/* Product List */}
      <Card className="shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-muted-foreground">
            <thead className="text-xs text-foreground uppercase bg-muted/50">
              <tr>
                <th scope="col" className="p-4 w-12">
                  <Checkbox
                    checked={selectedProducts.size > 0 && selectedProducts.size === filteredProducts.length}
                    onCheckedChange={selectAllProducts}
                  />
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center">
                    Product Name
                    {sortColumn === 'name' && (sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('sku')}>
                  <div className="flex items-center">
                    SKU
                    {sortColumn === 'sku' && (sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('category')}>
                  <div className="flex items-center">
                    Category
                    {sortColumn === 'category' && (sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('quantity')}>
                  <div className="flex items-center">
                    Quantity
                    {sortColumn === 'quantity' && (sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('price')}>
                  <div className="flex items-center">
                    Price
                    {sortColumn === 'price' && (sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />)}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              ) : (
                sortedProducts.map((product) => {
                  const stockStatus = getStockStatus(product.quantity);
                  return (
                    <tr key={product.id} className="bg-background border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                      </td>
                      <th scope="row" className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                        {product.name}
                      </th>
                      <td className="px-6 py-4">{product.sku}</td>
                      <td className="px-6 py-4">{product.category}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span>{product.quantity}</span>
                          <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">{product.price.toFixed(2)} ден.</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          onClick={() => handleEditProduct(product)}
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:bg-primary/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteProduct(product.id)}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete All Products Button */}
      {products.length > 0 && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleDeleteAllProducts}
            variant="destructive"
            className="bg-destructive/80 hover:bg-destructive"
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete All Products
          </Button>
        </div>
      )}
    </div>
  );
};

export default InventoryTab;