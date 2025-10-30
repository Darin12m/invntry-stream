import React from 'react';
import { FileText, Trash2, Plus, Eye, Edit, Trash, CheckSquare, Square, ChevronUp, ChevronDown, User as UserIcon, Calendar, DollarSign } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Invoice } from '../InventoryManagement'; // Import Invoice interface

interface InvoicesTabProps {
  invoices: Invoice[];
  selectedInvoices: Set<string>;
  toggleInvoiceSelection: (invoiceId: string) => void;
  selectAllInvoices: () => void;
  handleBulkDeleteInvoices: () => Promise<void>;
  handleDeleteAllInvoices: () => Promise<void>;
  handleCreateInvoice: () => void;
  handleViewInvoice: (invoice: Invoice) => void;
  handleEditInvoice: (invoice: Invoice) => void;
  handleDeleteInvoice: (invoice: Invoice) => Promise<void>; // Updated prop type
  invoiceSortBy: 'number' | 'date' | 'customer' | 'total';
  invoiceSortDirection: 'asc' | 'desc';
  handleInvoiceSort: (column: 'number' | 'date' | 'customer' | 'total') => void;
}

const InvoicesTab: React.FC<InvoicesTabProps> = ({
  invoices,
  selectedInvoices,
  toggleInvoiceSelection,
  selectAllInvoices,
  handleBulkDeleteInvoices,
  handleDeleteAllInvoices,
  handleCreateInvoice,
  handleViewInvoice,
  handleEditInvoice,
  handleDeleteInvoice,
  invoiceSortBy,
  invoiceSortDirection,
  handleInvoiceSort,
}) => {
  // Sort invoices
  const sortedInvoices = [...invoices].sort((a, b) => {
    // First, sort by whether they have invoice numbers
    const aHasNumber = a.number && a.number.trim() !== '';
    const bHasNumber = b.number && b.number.trim() !== '';
    
    if (!aHasNumber && bHasNumber) return -1;
    if (aHasNumber && !bHasNumber) return 1;
    
    let aValue, bValue;
    
    switch (invoiceSortBy) {
      case 'number':
        aValue = a.number || '';
        bValue = b.number || '';
        break;
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'customer':
        aValue = a.customer?.name?.toLowerCase() || '';
        bValue = b.customer?.name?.toLowerCase() || '';
        break;
      case 'total':
        aValue = a.total || 0;
        bValue = b.total || 0;
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return invoiceSortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return invoiceSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Invoices</h2>
          <p className="text-muted-foreground mt-1">Manage and track all invoices</p>
        </div>
        <div className="flex gap-3">
          {selectedInvoices.size > 0 && (
            <Button
              onClick={handleBulkDeleteInvoices}
              variant="destructive"
              className="shadow-elegant"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedInvoices.size})
            </Button>
          )}
          <Button
            onClick={handleCreateInvoice}
            className="bg-success hover:shadow-glow transition-all duration-300"
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Sort Controls */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium">Sort by:</span>
          {[
            { key: 'number' as const, label: 'Invoice #' },
            { key: 'date' as const, label: 'Date' },
            { key: 'customer' as const, label: 'Customer' },
            { key: 'total' as const, label: 'Amount' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              onClick={() => handleInvoiceSort(key)}
              variant={invoiceSortBy === key ? 'default' : 'outline'}
              size="sm"
              className="gap-1"
            >
              {label}
              {invoiceSortBy === key && (
                invoiceSortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* Invoice Actions */}
      <Card className="p-4 shadow-card">
        <div className="flex gap-2 justify-end">
          <Button
            onClick={selectAllInvoices}
            variant="outline"
            size="sm"
            disabled={invoices.length === 0}
          >
            {selectedInvoices.size === invoices.length && invoices.length > 0 ? (
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
          {invoices.length > 0 && (
            <Button
              onClick={handleDeleteAllInvoices}
              variant="destructive"
              size="sm"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          )}
        </div>
      </Card>

      {/* Invoice History */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Invoice History</h3>
        </div>
        <div className="p-6">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No invoices created yet</h3>
              <p className="text-muted-foreground mb-4">Create your first invoice to get started</p>
              <Button onClick={handleCreateInvoice}>
                <FileText className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedInvoices.map(invoice => (
                <Card key={invoice.id} className="p-6 hover:shadow-elegant transition-all duration-300 bg-card border-border">
                  <div className="flex items-start gap-3 mb-4">
                    <Checkbox
                      checked={selectedInvoices.has(invoice.id)}
                      onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg truncate">{invoice.number || 'No Number'}</h4>
                        {/* NEW: Invoice Type Badge */}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.invoiceType === 'refund'
                              ? 'bg-red-100 text-red-700'
                              : invoice.invoiceType === 'writeoff'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {invoice.invoiceType === 'refund'
                            ? 'Refund'
                            : invoice.invoiceType === 'writeoff'
                            ? 'Write-off'
                            : 'Sale'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground truncate">{invoice.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{new Date(invoice.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold text-primary">{invoice.total.toFixed(2)} ден.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-3 border-t">
                    <Button
                      onClick={() => handleViewInvoice(invoice)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      onClick={() => handleEditInvoice(invoice)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteInvoice(invoice)} // Updated call site
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default InvoicesTab;