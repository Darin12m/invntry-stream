import React, { useState, useCallback, useMemo, useContext, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, UploadCloud, FileText, CheckCircle, AlertTriangle, DownloadCloud, Package, Info } from 'lucide-react';
import { toast } from "sonner";
import { readExcelFile, generateErrorExcel } from '@/utils/excelUtils';
import { Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import { AppContext } from '@/context/AppContext';
import { useDeviceType } from '@/hooks/useDeviceType';

interface ImportProductsModalProps {
  showImportProductsModal: boolean;
  setShowImportProductsModal: (show: boolean) => void;
  onImportSuccess: () => void;
}

interface ExcelRow {
  [key: string]: any;
}

interface MappedProductData {
  originalRow: number;
  sku: string;
  name: string;
  category: string;
  purchasePrice: number;
  price: number;
  onHand: number;
  isValid: boolean;
  errors: string[];
}

const REQUIRED_FIELDS = ['sku', 'name', 'category', 'purchasePrice', 'price', 'onHand'];
const FIELD_LABELS: { [key: string]: string } = {
  sku: 'SKU',
  name: 'Name',
  category: 'Category',
  purchasePrice: 'Cost Price',
  price: 'Sale Price',
  onHand: 'Quantity (On Hand)',
};

const ImportProductsModal: React.FC<ImportProductsModalProps> = ({
  showImportProductsModal,
  setShowImportProductsModal,
  onImportSuccess,
}) => {
  const { products: existingProducts } = useContext(AppContext);
  const { bulkCreateOrUpdateProducts } = useProducts();
  const { isIOS } = useDeviceType();

  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns, 3: Review & Import, 4: Results
  const [file, setFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<ExcelRow[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [mappedProductData, setMappedProductData] = useState<MappedProductData[]>([]);
  const [importResults, setImportResults] = useState<{ successCount: number; errors: any[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleCloseModal = useCallback(() => {
    setShowImportProductsModal(false);
    setStep(1);
    setFile(null);
    setExcelHeaders([]);
    setExcelData([]);
    setColumnMappings({});
    setMappedProductData([]);
    setImportResults(null);
    setIsImporting(false);
  }, [setShowImportProductsModal]);

  useEffect(() => {
    if (showImportProductsModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showImportProductsModal]);

  const handleFileChange = useCallback(async (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx')) {
      toast.error('Please upload a valid .xlsx Excel file.');
      return;
    }

    setFile(selectedFile);
    try {
      const { headers, data } = await readExcelFile(selectedFile);
      setExcelHeaders(headers);
      setExcelData(data);
      autoMapColumns(headers);
      setStep(2); // Move to column mapping step
    } catch (error: any) {
      toast.error(error.message);
      setFile(null);
    }
  }, []);

  const autoMapColumns = useCallback((headers: string[]) => {
    const newMappings: Record<string, string> = {};
    REQUIRED_FIELDS.forEach(field => {
      const lowerField = field.toLowerCase();
      const matchedHeader = headers.find(header =>
        header.toLowerCase().includes(lowerField.replace('price', '')) ||
        header.toLowerCase().includes(lowerField.replace('onhand', 'quantity')) ||
        header.toLowerCase().includes(lowerField.replace('onhand', 'stock'))
      );
      newMappings[field] = matchedHeader || '';
    });
    setColumnMappings(newMappings);
  }, []);

  const handleMappingChange = useCallback((field: string, excelColumn: string) => {
    setColumnMappings(prev => ({ ...prev, [field]: excelColumn }));
  }, []);

  const validateAndMapData = useCallback(() => {
    const newMappedData: MappedProductData[] = [];
    const skuSet = new Set<string>();
    const existingSkuSet = new Set(existingProducts.map(p => p.sku.toLowerCase()));

    excelData.forEach((row, index) => {
      const product: Partial<MappedProductData> = { originalRow: index + 2, errors: [] }; // +2 for header row + 1-based index

      REQUIRED_FIELDS.forEach(field => {
        const excelColumn = columnMappings[field];
        let value = row[excelColumn];

        if (value === undefined || value === null || String(value).trim() === '') {
          product.errors?.push(`${FIELD_LABELS[field]} is required.`);
          return;
        }

        switch (field) {
          case 'sku':
            value = String(value).trim();
            if (skuSet.has(value.toLowerCase())) {
              product.errors?.push(`Duplicate SKU "${value}" in import file.`);
            } else {
              skuSet.add(value.toLowerCase());
            }
            product.sku = value;
            break;
          case 'name':
            product.name = String(value).trim();
            break;
          case 'category':
            product.category = String(value).trim();
            break;
          case 'purchasePrice':
          case 'price':
            value = parseFloat(value);
            if (isNaN(value) || value < 0) {
              product.errors?.push(`${FIELD_LABELS[field]} must be a non-negative number.`);
            }
            (product as any)[field] = value;
            break;
          case 'onHand':
            value = parseInt(value);
            if (isNaN(value) || value < 0) {
              product.errors?.push(`${FIELD_LABELS[field]} must be a non-negative integer.`);
            }
            product.onHand = value;
            break;
        }
      });

      product.isValid = product.errors?.length === 0;
      newMappedData.push(product as MappedProductData);
    });

    setMappedProductData(newMappedData);
    setStep(3); // Move to review step
  }, [excelData, columnMappings, existingProducts]);

  const productsToImport = useMemo(() => mappedProductData.filter(p => p.isValid), [mappedProductData]);
  const productsWithErrors = useMemo(() => mappedProductData.filter(p => !p.isValid), [mappedProductData]);

  const handleImportNow = useCallback(async () => {
    if (productsToImport.length === 0) {
      toast.error("No valid products to import.");
      return;
    }

    setIsImporting(true);
    try {
      const productsForFirestore: Omit<Product, 'id'>[] = productsToImport.map(p => ({
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: p.price,
        purchasePrice: p.purchasePrice,
        onHand: p.onHand,
        quantity: p.onHand, // Assuming quantity is same as onHand for import
        initialStock: p.onHand,
      }));

      const results = await bulkCreateOrUpdateProducts(productsForFirestore);
      setImportResults(results);
      setStep(4); // Move to results step
      onImportSuccess(); // Trigger refresh in parent
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
      setImportResults({ successCount: 0, errors: [{ message: `Import process failed: ${error.message}` }] });
      setStep(4);
    } finally {
      setIsImporting(false);
    }
  }, [productsToImport, bulkCreateOrUpdateProducts, onImportSuccess]);

  const handleDownloadErrors = useCallback(() => {
    if (!importResults || importResults.errors.length === 0) {
      toast.info("No errors to download.");
      return;
    }
    const errorData = importResults.errors.map(err => ({
      "Row Number": err.originalRow || 'N/A',
      "SKU": err.sku || 'N/A',
      "Error Message": err.message,
    }));
    generateErrorExcel(errorData, 'product_import_errors.xlsx');
    toast.success("Error report downloaded.");
  }, [importResults]);

  if (!showImportProductsModal) return null;

  return (
    <div className="modal-overlay">
      <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
        <Card className="modal-panel-lg w-full flex flex-col animate-scale-in shadow-glow">
          {/* Header */}
          <div className="p-3 sm:p-6 flex justify-between items-center border-b sticky top-0 bg-card z-10">
            <h3 className="text-lg sm:text-xl font-semibold truncate">Import Products from Excel</h3>
            <Button onClick={handleCloseModal} variant="ghost" size="sm" className="flex-shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 modal-content">
            {step === 1 && (
              <div className="text-center space-y-4">
                <UploadCloud className="h-16 w-16 mx-auto text-muted-foreground" />
                <h4 className="text-lg font-semibold">Upload your .xlsx file</h4>
                <p className="text-sm text-muted-foreground">Drag & drop your Excel file here, or click to select.</p>
                <Label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                  <FileText className="h-4 w-4 mr-2" /> Select File
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                {file && <p className="text-sm text-muted-foreground mt-2">Selected file: {file.name}</p>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" /> Map Columns
                </h4>
                <p className="text-sm text-muted-foreground">
                  Auto-detected headers. Please confirm or manually select the Excel columns for each required product field.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {REQUIRED_FIELDS.map(field => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={`map-${field}`} className="text-sm">
                        {FIELD_LABELS[field]} <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={columnMappings[field]}
                        onValueChange={(value) => handleMappingChange(field, value)}
                      >
                        <SelectTrigger id={`map-${field}`} className="w-full text-foreground text-sm">
                          <SelectValue placeholder={`Select column for ${FIELD_LABELS[field]}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {excelHeaders.length > 0 ? (
                            excelHeaders.map(header => (
                              <SelectItem key={header} value={header} className="text-foreground text-sm">
                                {header}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled className="text-muted-foreground text-sm">
                              No headers found
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button onClick={() => setStep(1)} variant="outline" size="sm">Back</Button>
                  <Button onClick={validateAndMapData} disabled={Object.values(columnMappings).some(val => !val)} size="sm">
                    Next: Review Data
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" /> Review Data
                </h4>
                <p className="text-sm text-muted-foreground">
                  Review the mapped data. Products with errors will not be imported.
                </p>

                {productsWithErrors.length > 0 && (
                  <Card className="border-destructive/20 bg-destructive/5 p-3 sm:p-4 space-y-2">
                    <h5 className="font-semibold text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> {productsWithErrors.length} Products with Errors
                    </h5>
                    <div className="overflow-x-auto max-h-60"> {/* Added max-h-60 for scrollability */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left">Row</th>
                            <th className="p-2 text-left">SKU</th>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Errors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productsWithErrors.map((p, i) => (
                            <tr key={i} className="border-b last:border-b-0">
                              <td className="p-2">{p.originalRow}</td>
                              <td className="p-2">{p.sku || 'N/A'}</td>
                              <td className="p-2">{p.name || 'N/A'}</td>
                              <td className="p-2 text-destructive-foreground">{p.errors.join(', ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {productsToImport.length > 0 && (
                  <Card className="border-success/20 bg-success/5 p-3 sm:p-4 space-y-2">
                    <h5 className="font-semibold text-success flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> {productsToImport.length} Products Ready to Import
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left">Row</th>
                            <th className="p-2 text-left">SKU</th>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-right">Price</th>
                            <th className="p-2 text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productsToImport.slice(0, 10).map((p, i) => (
                            <tr key={i} className="border-b last:border-b-0">
                              <td className="p-2">{p.originalRow}</td>
                              <td className="p-2">{p.sku}</td>
                              <td className="p-2">{p.name}</td>
                              <td className="p-2 text-right">{p.price.toFixed(2)}</td>
                              <td className="p-2 text-right">{p.onHand}</td>
                            </tr>
                          ))}
                          {productsToImport.length > 10 && (
                            <tr>
                              <td colSpan={5} className="p-2 text-center text-muted-foreground">
                                ...and {productsToImport.length - 10} more.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {mappedProductData.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2" />
                    <p>No product data found after mapping.</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button onClick={() => setStep(2)} variant="outline" size="sm">Back</Button>
                  <Button
                    onClick={handleImportNow}
                    disabled={productsToImport.length === 0 || isImporting}
                    size="sm"
                  >
                    {isImporting ? 'Importing...' : `Import ${productsToImport.length} Products`}
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && importResults && (
              <div className="space-y-4 text-center">
                <h4 className="text-lg font-semibold flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" /> Import Complete!
                </h4>
                <p className="text-sm text-muted-foreground">
                  Successfully imported {importResults.successCount} products.
                </p>

                {importResults.errors.length > 0 && (
                  <Card className="border-destructive/20 bg-destructive/5 p-3 sm:p-4 space-y-2 text-left">
                    <h5 className="font-semibold text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> {importResults.errors.length} Issues Encountered
                    </h5>
                    <ul className="list-disc list-inside text-sm text-destructive-foreground">
                      {importResults.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>
                          {err.originalRow ? `Row ${err.originalRow} (SKU: ${err.sku || 'N/A'}): ` : ''}
                          {err.message}
                        </li>
                      ))}
                      {importResults.errors.length > 5 && <li>...and {importResults.errors.length - 5} more.</li>}
                    </ul>
                    <Button onClick={handleDownloadErrors} variant="outline" size="sm" className="mt-3">
                      <DownloadCloud className="h-4 w-4 mr-2" /> Download Error Report
                    </Button>
                  </Card>
                )}

                <div className="flex justify-center gap-2 pt-4 border-t">
                  <Button onClick={handleCloseModal} size="sm">Done</Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ImportProductsModal;