import React from 'react';
import { Upload, Download, Trash } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  purchasePrice?: number;
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
    discount?: number;
  }[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  total: number;
  status: string;
}

interface DataTabProps {
  products: Product[];
  invoices: Invoice[];
  handleClearAllData: () => Promise<void>;
  handleImportExcel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  exportToCSV: (data: any[], filename: string) => void;
  exportToJSON: (data: any[], filename: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const DataTab: React.FC<DataTabProps> = ({
  products,
  invoices,
  handleClearAllData,
  handleImportExcel,
  exportToCSV,
  exportToJSON,
  fileInputRef,
}) => (
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

export default DataTab;