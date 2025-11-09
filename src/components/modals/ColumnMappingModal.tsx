import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { X, Upload, Loader2 } from 'lucide-react'; // Added Loader2 for spinner
import { collection, addDoc } from 'firebase/firestore';
import { Product } from '../InventoryManagement';

interface ColumnMappingModalProps {
  showColumnMappingModal: boolean;
  setShowColumnMappingModal: (show: boolean) => void;
  excelData: any[];
  excelColumns: string[];
  columnMapping: {
    name: string;
    sku: string;
    quantity: string;
    price: string;
    category: string;
    purchasePrice: string;
  };
  setColumnMapping: (mapping: {
    name: string;
    sku: string;
    quantity: string;
    price: string;
    category: string;
    purchasePrice: string;
  }) => void;
  db: any; // Firebase Firestore instance
  toast: any; // Sonner toast instance
}

const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  showColumnMappingModal,
  setShowColumnMappingModal,
  excelData,
  excelColumns,
  columnMapping,
  setColumnMapping,
  db,
  toast,
}) => {
  const [isImporting, setIsImporting] = useState(false); // NEW: Importing state
  const nameMappingRef = useRef<HTMLSelectElement>(null); // NEW: Ref for auto-focus

  useEffect(() => {
    // NEW: Auto-focus on modal open
    if (showColumnMappingModal) {
      setTimeout(() => nameMappingRef.current?.focus(), 100);
    }
  }, [showColumnMappingModal]);

  const handleConfirmImport = async () => {
    if (!columnMapping.name || !columnMapping.sku || !columnMapping.quantity || !columnMapping.price) {
      toast.error('Please map all required fields (Name, SKU, Quantity, Price)');
      return;
    }

    setIsImporting(true); // NEW: Set importing state

    try {
      const importedProducts = excelData.map((row) => ({
        name: row[columnMapping.name] || '',
        sku: row[columnMapping.sku] || '',
        quantity: parseInt(row[columnMapping.quantity] || 0),
        price: parseFloat(row[columnMapping.price] || 0),
        category: columnMapping.category ? (row[columnMapping.category] || 'Uncategorized') : 'Uncategorized',
        ...(columnMapping.purchasePrice && row[columnMapping.purchasePrice] && { 
          purchasePrice: parseFloat(row[columnMapping.purchasePrice] || 0), 
        }),
      })).filter(product => product.name && product.sku);

      const importPromises = importedProducts.map((product) =>
        addDoc(collection(db, 'products'), product)
      );
      await Promise.all(importPromises);

      setShowColumnMappingModal(false);
      setColumnMapping({
        name: '', sku: '', quantity: '', price: '', category: '', purchasePrice: '',
      });
      
      toast.success(`✅ Successfully imported ${importedProducts.length} products!`); // NEW: Success toast
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('❌ Failed to import products'); // NEW: Error toast
    } finally {
      setIsImporting(false); // NEW: Reset importing state
    }
  };

  // NEW: Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmImport();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowColumnMappingModal(false);
    }
  };

  if (!showColumnMappingModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 animate-scale-in shadow-glow" onKeyDown={handleKeyDown}>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Map Excel Columns</h3>
            <Button
              onClick={() => setShowColumnMappingModal(false)}
              variant="ghost"
              size="sm"
              disabled={isImporting} // NEW: Disable close button while importing
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
                  ref={nameMappingRef} // NEW: Attach ref
                  value={columnMapping.name}
                  onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  disabled={isImporting} // NEW: Disable inputs while importing
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
                  disabled={isImporting}
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
                  disabled={isImporting}
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
                  disabled={isImporting}
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
                disabled={isImporting}
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
                disabled={isImporting}
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
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={!columnMapping.name || !columnMapping.sku || !columnMapping.quantity || !columnMapping.price || isImporting}
              className="bg-success"
            >
              {isImporting ? ( // NEW: Show spinner and text when importing
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {excelData.length} Products
                </>
              )}
            </Button>
          </div>
          
      </Card>
    </div>
  );
};

export default ColumnMappingModal;