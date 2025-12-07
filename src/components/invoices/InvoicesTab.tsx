import React, { useMemo, useCallback, useContext, useState } from 'react'; // Import useState
import { FileText, Trash2, Plus, Eye, Edit, Trash, CheckSquare, Square, ChevronUp, ChevronDown, User as UserIcon, Calendar, DollarSign, RotateCcw, FileX } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Invoice } from '@/types';
import { useInvoices } from '@/hooks/useInvoices';
import InvoiceModal from '@/components/modals/InvoiceModal';
import InvoiceViewerModal from '@/components/modals/InvoiceViewerModal';
import { AppContext } from '@/context/AppContext';
import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas'; // Import html2canvas
import { jsPDF } from 'jspdf'; // Import jsPDF
import { toast } from 'sonner'; // Import toast
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

const InvoicesTab: React.FC = React.memo(() => {
  const { products, currentUser } = useContext(AppContext);
  const {
    invoices,
    loadingInvoices,
    errorInvoices,
    createInvoice,
    updateInvoice,
    softDeleteInvoice,
    bulkSoftDeleteInvoices,
    deleteAllInvoices,
    restoreInvoice,
    permanentDeleteInvoice,
    invoiceSortBy,
    invoiceSortDirection,
    handleInvoiceSort,
    selectedInvoices,
    toggleInvoiceSelection,
    selectAllInvoices: selectAllInvoicesHook,
    handleViewInvoice // Now correctly imported from useInvoices
  } = useInvoices();
  const { isIOS } = useDeviceType(); // Use the hook

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Filter out deleted invoices for the main view
  const activeInvoices = useMemo(() => invoices.filter(invoice => !invoice.deletedAt), [invoices]);

  // Sort invoices
  const sortedInvoices = useMemo(() => {
    return [...activeInvoices].sort((a, b) => {
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
        case 'invoiceType':
          aValue = a.invoiceType || '';
          bValue = b.invoiceType || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return invoiceSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return invoiceSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [activeInvoices, invoiceSortBy, invoiceSortDirection]);

  const getInvoiceTypeBadge = useCallback((type: 'sale' | 'return' | 'gifted-damaged' | 'cash') => {
    switch (type) {
      case 'sale':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs">Sale</Badge>;
      case 'cash':
        return <Badge variant="default" className="bg-red-500 hover:bg-red-600 text-white text-xs">Cash</Badge>;
      case 'return':
        return <Badge variant="destructive" className="text-xs">Return</Badge>; // Adjusted font size
      case 'gifted-damaged':
        return <Badge variant="secondary" className="text-xs">Gifted/Damaged</Badge>; // Adjusted font size
      default:
        return null;
    }
  }, []);

  const handleCreateInvoice = useCallback(() => {
    setEditingInvoice(null);
    setShowInvoiceModal(true);
  }, []);

  const handleEditInvoice = useCallback((invoice: Invoice) => {
    if (invoice.deletedAt) {
      toast.error("Cannot edit a deleted invoice. Please restore it first.");
      return;
    }
    setEditingInvoice(invoice);
    setShowInvoiceModal(true);
  }, []);

  // This local handleViewInvoice now calls the one from the hook
  const localHandleViewInvoice = useCallback((invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowInvoiceViewer(true);
    handleViewInvoice(invoice); // Call the hook's function for logging/side effects
  }, [handleViewInvoice]);

  const handleBulkDelete = useCallback(() => {
    bulkSoftDeleteInvoices(selectedInvoices);
  }, [bulkSoftDeleteInvoices, selectedInvoices]);

  const handleSelectAll = useCallback(() => {
    selectAllInvoicesHook(activeInvoices.map(i => i.id));
  }, [selectAllInvoicesHook, activeInvoices]);

  if (loadingInvoices) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-base sm:text-lg">Loading invoices...</p> {/* Adjusted font size */}
      </div>
    );
  }

  if (errorInvoices) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-destructive">
        <p className="text-base sm:text-lg">Error: {errorInvoices}</p> {/* Adjusted font size */}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted spacing */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4"> {/* Adjusted spacing */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Invoices</h2> {/* Adjusted font size */}
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage and track all invoices</p> {/* Adjusted font size */}
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap justify-end"> {/* Adjusted spacing */}
          {selectedInvoices.size > 0 && (
            <Button
              onClick={handleBulkDelete}
              variant="destructive"
              className="shadow-elegant"
              size={isIOS ? "sm" : "default"} // Smaller button on iOS
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
              Delete Selected ({selectedInvoices.size})
            </Button>
          )}
          <Button
            onClick={handleCreateInvoice}
            className="bg-success hover:shadow-glow transition-all duration-300"
            size={isIOS ? "sm" : "default"} // Smaller button on iOS
          >
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Sort Controls */}
      <Card className="p-3 sm:p-4 shadow-card"> {/* Adjusted padding */}
        <div className="flex flex-wrap gap-1 sm:gap-2 items-center"> {/* Adjusted spacing */}
          <span className="text-xs sm:text-sm font-medium">Sort by:</span> {/* Adjusted font size */}
          {[
            { key: 'number' as const, label: 'Invoice #' },
            { key: 'date' as const, label: 'Date' },
            { key: 'customer' as const, label: 'Customer' },
            { key: 'total' as const, label: 'Amount' },
            { key: 'invoiceType' as const, label: 'Type' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              onClick={() => handleInvoiceSort(key)}
              variant={invoiceSortBy === key ? 'default' : 'outline'}
              size="sm"
              className="gap-0.5 sm:gap-1 text-xs sm:text-sm" // Adjusted gap and font size
            >
              {label}
              {invoiceSortBy === key && (
                invoiceSortDirection === 'asc' ? <ChevronUp className="h-2.5 w-2.5 sm:h-3 w-3" /> : <ChevronDown className="h-2.5 w-2.5 sm:h-3 w-3" /> // Adjusted icon size
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* Invoice Actions */}
      <Card className="p-3 sm:p-4 shadow-card"> {/* Adjusted padding */}
        <div className="flex gap-1 sm:gap-2 justify-end flex-wrap"> {/* Adjusted spacing */}
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size={isIOS ? "sm" : "default"} // Smaller button on iOS
            disabled={activeInvoices.length === 0}
          >
            {selectedInvoices.size === activeInvoices.length && activeInvoices.length > 0 ? (
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
          {activeInvoices.length > 0 && (
            <Button
              onClick={deleteAllInvoices}
              variant="destructive"
              size={isIOS ? "sm" : "default"} // Smaller button on iOS
            >
              <Trash className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
              Delete All
            </Button>
          )}
        </div>
      </Card>

      {/* Invoice History */}
      <Card className="shadow-card">
        <div className="p-4 sm:p-6 border-b"> {/* Adjusted padding */}
          <h3 className="text-lg sm:text-xl font-semibold">Invoice History</h3> {/* Adjusted font size */}
        </div>
        <div className="p-4 sm:p-6"> {/* Adjusted padding */}
          {activeInvoices.length === 0 ? (
            <div className="text-center py-8 sm:py-12"> {/* Adjusted padding */}
              <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-muted-foreground" /> {/* Adjusted icon size */}
              <h3 className="text-xl sm:text-2xl font-semibold mb-2">No invoices created yet</h3> {/* Adjusted font size */}
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Create your first invoice to get started</p> {/* Adjusted font size and spacing */}
              <Button onClick={handleCreateInvoice} size={isIOS ? "sm" : "default"}> {/* Smaller button on iOS */}
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"> {/* Adjusted spacing */}
              {sortedInvoices.map(invoice => (
                <Card key={invoice.id} className="p-4 sm:p-6 hover:shadow-elegant transition-all duration-300 bg-card border-border"> {/* Adjusted padding */}
                  <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4"> {/* Adjusted spacing */}
                    <Checkbox
                      checked={selectedInvoices.has(invoice.id)}
                      onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                      className="mt-0.5 sm:mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1"> {/* Adjusted spacing */}
                        <h4 className="font-bold text-base sm:text-lg truncate">{invoice.number || 'No Number'}</h4> {/* Adjusted font size */}
                        {invoice.invoiceType && getInvoiceTypeBadge(invoice.invoiceType)}
                      </div>
                      <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm"> {/* Adjusted spacing and font size */}
                        <div className="flex items-center gap-1 sm:gap-2"> {/* Adjusted spacing */}
                          <UserIcon className="h-2.5 w-2.5 sm:h-3 w-3 text-muted-foreground" /> {/* Adjusted icon size */}
                          <span className="text-muted-foreground truncate">{invoice.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2"> {/* Adjusted spacing */}
                          <Calendar className="h-2.5 w-2.5 sm:h-3 w-3 text-muted-foreground" /> {/* Adjusted icon size */}
                          <span className="text-muted-foreground">{new Date(invoice.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2"> {/* Adjusted spacing */}
                          <DollarSign className="h-2.5 w-2.5 sm:h-3 w-3 text-muted-foreground" /> {/* Adjusted icon size */}
                          <span className="font-semibold text-primary">{invoice.total.toFixed(2)} ден.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:gap-2 justify-end pt-2 sm:pt-3 border-t"> {/* Adjusted spacing and padding */}
                    <Button
                      onClick={() => localHandleViewInvoice(invoice)} // Use local handleViewInvoice
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> {/* Adjusted icon size */}
                      View
                    </Button>
                    <Button
                      onClick={() => handleEditInvoice(invoice)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> {/* Adjusted icon size */}
                      Edit
                    </Button>
                    <Button
                      onClick={() => softDeleteInvoice(invoice.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" /> {/* Adjusted icon size */}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>

      <InvoiceModal
        key={showInvoiceModal ? "invoice-modal-open" : "invoice-modal-closed"}
        showInvoiceModal={showInvoiceModal}
        setShowInvoiceModal={setShowInvoiceModal}
        editingInvoice={editingInvoice}
        setEditingInvoice={setEditingInvoice}
        // Removed products, invoices, createInvoice, updateInvoice, currentUser props as they are handled by hooks/context
      />

      <InvoiceViewerModal
        showInvoiceViewer={showInvoiceViewer}
        setShowInvoiceViewer={setShowInvoiceViewer}
        viewingInvoice={viewingInvoice}
        Capacitor={Capacitor}
        html2canvas={html2canvas}
        jsPDF={jsPDF}
      />
    </div>
  );
});

export default InvoicesTab;