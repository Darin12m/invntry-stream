import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trash,
  RotateCcw,
  FileX,
  Settings as SettingsIcon,
  User as UserIcon,
  LogOut,
  Package,
  FileText,
  Key,
  AlertCircle,
  History,
  Database,
  Save,
  DownloadCloud,
  UploadCloud,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { toast } from "sonner";
import { AppContext } from '@/context/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { useInvoices } from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import ActivityLogModal from '@/components/modals/ActivityLogModal';
import { db } from '@/firebase/config';
import { writeBatch, doc } from 'firebase/firestore';
import { productService } from '@/services/firestore/productService';
import { invoiceService } from '@/services/firestore/invoiceService';
import { settingsService } from '@/services/firestore/settingsService';
import { activityLogService } from '@/services/firestore/activityLogService';
import { AppSettings } from '@/types';
import { useNavigate } from 'react-router-dom';
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

const SettingsPage: React.FC = () => {
  const { currentUser, products, invoices, activityLogs, handleClearAllData, fetchAppData } = useContext(AppContext);
  const { settings, loadingSettings, saveSettings, defaultSettings } = useSettings();
  const { logout } = useAuth();
  const { restoreInvoice, permanentDeleteInvoice } = useInvoices();
  const { fetchActivityLogs } = useActivityLogs();
  const navigate = useNavigate();
  const { isIOS } = useDeviceType(); // Use the hook

  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    try {
      await saveSettings(localSettings);
      fetchActivityLogs(); // Refresh activity logs after saving settings
    } catch (error) {
      // Error handled by useSettings hook
    }
  };

  const deletedInvoices = invoices.filter(invoice => invoice.deletedAt);

  const handleChangePassword = () => {
    toast.info("Change Password functionality coming soon! This would typically redirect to a Firebase Auth password reset flow.");
  };

  const handleCreateBackup = async () => {
    try {
      const allProducts = await productService.list();
      const allInvoices = await invoiceService.list();
      const allActivityLogs = await activityLogService.listActions();
      const currentSettings = await settingsService.getSettings();

      const backupData = {
        timestamp: new Date().toISOString(),
        products: allProducts,
        invoices: allInvoices,
        activityLogs: allActivityLogs,
        settings: currentSettings,
      };

      const filename = `invntry-stream-backup-${new Date().toISOString().split('T')[0]}.invbackup`;
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.click();
      toast.success('Backup created and downloaded successfully!');
      await activityLogService.logAction(`Data backup created by ${currentUser?.email}`, currentUser?.uid, currentUser?.email || 'Unknown User');
      fetchActivityLogs();
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast.error(`Failed to create backup: ${error.message}`);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("⚠️ WARNING: Restoring a backup will PERMANENTLY DELETE ALL CURRENT DATA and replace it with the backup data. This action cannot be undone. Are you absolutely sure you want to proceed?")) {
      event.target.value = ''; // Clear the file input
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backupData = JSON.parse(content);

        if (!backupData.products || !backupData.invoices || !backupData.activityLogs || !backupData.settings) {
          toast.error("Invalid backup file: Missing essential data sections.");
          event.target.value = '';
          return;
        }

        // Clear existing data
        await handleClearAllData(); // This function already handles product and invoice deletion and stock reversion

        // Restore settings
        if (backupData.settings) {
          await settingsService.saveSettings(backupData.settings);
        }

        const batch = writeBatch(db);

        // Restore products
        for (const product of backupData.products) {
          const docRef = doc(db, 'products', product.id);
          batch.set(docRef, product);
        }

        // Restore invoices
        for (const invoice of backupData.invoices) {
          const docRef = doc(db, 'invoices', invoice.id);
          batch.set(docRef, invoice);
        }

        // Restore activity logs
        for (const log of backupData.activityLogs) {
          const docRef = doc(db, 'logs', log.id);
          batch.set(docRef, log);
        }

        await batch.commit();

        toast.success('Backup restored successfully! Refreshing data...');
        await activityLogService.logAction(`Data restored from backup by ${currentUser?.email}`, currentUser?.uid, currentUser?.email || 'Unknown User');
        
        await fetchAppData(); // Re-fetch all data to update UI
        
        setActiveSection(null); // Go back to overview
      } catch (error: any) {
        console.error('Error restoring backup:', error);
        toast.error(`Failed to restore backup: ${error.message}`);
      } finally {
        event.target.value = ''; // Clear the file input
      }
    };
    reader.readAsText(file);
  };

  // Handle permanent delete all trashed invoices
  const handlePermanentDeleteAllTrashed = async () => {
    if (deletedInvoices.length === 0) {
      toast.error("No invoices in trash to delete.");
      return;
    }

    if (window.confirm(`⚠️ WARNING: This will permanently delete ALL ${deletedInvoices.length} invoices in trash. This action cannot be undone. Are you absolutely sure?`)) {
      try {
        const batch = writeBatch(db);
        
        for (const invoice of deletedInvoices) {
          // Revert stock for each invoice (already trashed, so stock was already reverted on soft delete)
          // For permanent delete, we just remove the document
          batch.delete(doc(db, 'invoices', invoice.id));
        }
        
        await batch.commit();
        toast.success(`${deletedInvoices.length} invoices permanently deleted.`);
        await activityLogService.logAction(
          `All trashed invoices (${deletedInvoices.length}) permanently deleted by ${currentUser?.email}`,
          currentUser?.uid || null,
          currentUser?.email || 'Unknown User'
        );
      } catch (error: any) {
        console.error('Error permanently deleting all trashed invoices:', error);
        toast.error(`Failed to delete all trashed invoices: ${error.message}`);
      }
    }
  };

  // Render functions for each section's content
  const renderDeletedInvoices = () => (
    <Card className="p-4 sm:p-6 shadow-card space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2">
        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2"><FileX className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" /> Deleted Invoices</h3>
        <Button onClick={() => setActiveSection(null)} variant="outline" size={isIOS ? "sm" : "default"}>Back to Overview</Button>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
        View and restore invoices that have been moved to trash, or permanently delete them.
      </p>
      {deletedInvoices.length === 0 ? (
        <div className="text-center py-6 sm:py-8 text-muted-foreground">
          <FileX className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3" />
          <p className="text-sm sm:text-base">No invoices in trash.</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Delete All Button */}
          <div className="flex justify-end">
            <Button
              onClick={handlePermanentDeleteAllTrashed}
              variant="destructive"
              size="sm"
              className="shadow-sm"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete All ({deletedInvoices.length})
            </Button>
          </div>
          
          <div className="space-y-2 sm:space-y-3">
            {deletedInvoices.map(invoice => (
              <Card key={invoice.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-md bg-background">
                <div className="flex-1 min-w-0 mb-1 sm:mb-0">
                  <p className="font-medium text-sm sm:text-base truncate">Invoice #{invoice.number} - {invoice.customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Deleted: {invoice.deletedAt instanceof Date ? invoice.deletedAt.toLocaleDateString() : 'N/A'} | Total: {invoice.total.toFixed(2)} {settings.currency}
                  </p>
                </div>
                <div className="flex gap-1 sm:gap-2 flex-wrap justify-end">
                  <Button
                    onClick={() => restoreInvoice(invoice.id)}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Restore
                  </Button>
                  <Button
                    onClick={() => permanentDeleteInvoice(invoice.id)}
                    variant="destructive"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <Trash className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Delete Permanently
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Card>
  );

  const renderGeneralSettings = () => (
    <Card className="p-4 sm:p-6 shadow-card space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted padding and spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2"> {/* Adjusted spacing */}
        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2"><SettingsIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> General Settings</h3> {/* Adjusted font size and icon size */}
        <Button onClick={() => setActiveSection(null)} variant="outline" size={isIOS ? "sm" : "default"}>Back to Overview</Button> {/* Smaller button on iOS */}
      </div>
      <div className="space-y-2">
        <Label htmlFor="businessName" className="text-sm sm:text-base">Business Name</Label> {/* Adjusted font size */}
        <Input
          id="businessName"
          value={localSettings.businessName}
          onChange={(e) => handleSettingChange('businessName', e.target.value)}
          placeholder="Your Business Name"
          className="text-sm sm:text-base"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"> {/* Adjusted spacing */}
        <div className="space-y-2">
          <Label htmlFor="currency" className="text-sm sm:text-base">Currency</Label> {/* Adjusted font size */}
          <Select
            value={localSettings.currency}
            onValueChange={(value) => handleSettingChange('currency', value)}
          >
            <SelectTrigger id="currency" className="text-sm sm:text-base"> {/* Adjusted font size */}
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ден." className="text-sm sm:text-base">ден. (MKD)</SelectItem> {/* Adjusted font size */}
              <SelectItem value="$" className="text-sm sm:text-base">USD ($)</SelectItem> {/* Adjusted font size */}
              <SelectItem value="€" className="text-sm sm:text-base">EUR (€)</SelectItem> {/* Adjusted font size */}
              <SelectItem value="£" className="text-sm sm:text-base">GBP (£)</SelectItem> {/* Adjusted font size */}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowStockWarning" className="text-sm sm:text-base">Low Stock Warning Threshold</Label> {/* Adjusted font size */}
          <Input
            id="lowStockWarning"
            type="number"
            value={localSettings.lowStockWarning}
            onChange={(e) => handleSettingChange('lowStockWarning', parseInt(e.target.value) || 0)}
            placeholder="10"
            className="text-sm sm:text-base"
          />
          <p className="text-xs text-muted-foreground">
            Receive warnings when product stock falls below this number.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dateFormat" className="text-sm sm:text-base">Date Format</Label> {/* Adjusted font size */}
        <Select
          value={localSettings.dateFormat}
          onValueChange={(value) => handleSettingChange('dateFormat', value)}
        >
          <SelectTrigger id="dateFormat" className="text-sm sm:text-base"> {/* Adjusted font size */}
            <SelectValue placeholder="Select date format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DD.MM.YYYY" className="text-sm sm:text-base">DD.MM.YYYY (e.g., 25.12.2023)</SelectItem> {/* Adjusted font size */}
            <SelectItem value="MM/DD/YYYY" className="text-sm sm:text-base">MM/DD/YYYY (e.g., 12/25/2023)</SelectItem> {/* Adjusted font size */}
            <SelectItem value="YYYY-MM-DD" className="text-sm sm:text-base">YYYY-MM-DD (e.g., 2023-12-25)</SelectItem> {/* Adjusted font size */}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );

  const renderInvoiceSettings = () => (
    <Card className="p-4 sm:p-6 shadow-card space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted padding and spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2"> {/* Adjusted spacing */}
        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2"><FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" /> Invoice Settings</h3> {/* Adjusted font size and icon size */}
        <Button onClick={() => setActiveSection(null)} variant="outline" size={isIOS ? "sm" : "default"}>Back to Overview</Button> {/* Smaller button on iOS */}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"> {/* Adjusted spacing */}
        <div className="space-y-2">
          <Label htmlFor="invoicePrefix" className="text-sm sm:text-base">Invoice Prefix</Label> {/* Adjusted font size */}
          <Input
            id="invoicePrefix"
            value={localSettings.invoicePrefix}
            onChange={(e) => handleSettingChange('invoicePrefix', e.target.value)}
            placeholder="INV-"
            className="text-sm sm:text-base"
          />
          <p className="text-xs text-muted-foreground">
            Prefix for new invoice numbers (e.g., INV-001).
          </p>
        </div>
        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-background">
          <Label htmlFor="autoNumbering" className="flex flex-col text-sm sm:text-base"> {/* Adjusted font size */}
            <span>Auto Numbering</span>
            <span className="text-xs text-muted-foreground font-normal">
              Automatically generate sequential invoice numbers.
            </span>
          </Label>
          <Switch
            id="autoNumbering"
            checked={localSettings.autoNumbering}
            onCheckedChange={(checked) => handleSettingChange('autoNumbering', checked)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"> {/* Adjusted spacing */}
        <div className="space-y-2">
          <Label htmlFor="defaultTaxRate" className="text-sm sm:text-base">Default Tax Rate (%)</Label> {/* Adjusted font size */}
          <Input
            id="defaultTaxRate"
            type="number"
            value={localSettings.defaultTaxRate}
            onChange={(e) => handleSettingChange('defaultTaxRate', parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-sm sm:text-base"
          />
          <p className="text-xs text-muted-foreground">
            Default tax percentage applied to new invoices.
          </p>
        </div>
        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-background">
          <Label htmlFor="preventNegativeStock" className="flex flex-col text-sm sm:text-base"> {/* Adjusted font size */}
            <span>Prevent Negative Stock</span>
            <span className="text-xs text-muted-foreground font-normal">
              Block sales if stock goes below zero.
            </span>
          </Label>
          <Switch
            id="preventNegativeStock"
            checked={localSettings.preventNegativeStock}
            onCheckedChange={(checked) => handleSettingChange('preventNegativeStock', checked)}
          />
        </div>
      </div>
    </Card>
  );

  const renderInventorySettings = () => (
    <Card className="p-4 sm:p-6 shadow-card space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted padding and spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2"> {/* Adjusted spacing */}
        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2"><Package className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" /> Inventory Settings</h3> {/* Adjusted font size and icon size */}
        <Button onClick={() => setActiveSection(null)} variant="outline" size={isIOS ? "sm" : "default"}>Back to Overview</Button> {/* Smaller button on iOS */}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"> {/* Adjusted spacing */}
        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-background">
          <Label htmlFor="autoStockUpdate" className="flex flex-col text-sm sm:text-base"> {/* Adjusted font size */}
            <span>Auto Stock Update</span>
            <span className="text-xs text-muted-foreground font-normal">
              Automatically adjust stock levels on invoice creation/edit.
            </span>
          </Label>
          <Switch
            id="autoStockUpdate"
            checked={localSettings.autoStockUpdate}
            onCheckedChange={(checked) => handleSettingChange('autoStockUpdate', checked)}
          />
        </div>
        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-background">
          <Label htmlFor="trackStockHistory" className="flex flex-col text-sm sm:text-base"> {/* Adjusted font size */}
            <span>Track Stock History</span>
            <span className="text-xs text-muted-foreground font-normal">
              Keep a detailed log of all stock movements.
            </span>
          </Label>
          <Switch
            id="trackStockHistory"
            checked={localSettings.trackStockHistory}
            onCheckedChange={(checked) => handleSettingChange('trackStockHistory', checked)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultCategory" className="text-sm sm:text-base">Default Category for New Products</Label> {/* Adjusted font size */}
        <Input
          id="defaultCategory"
          value={localSettings.defaultCategory}
          onChange={(e) => handleSettingChange('defaultCategory', e.target.value)}
          placeholder="General"
          className="text-sm sm:text-base"
        />
        <p className="text-xs text-muted-foreground">
          The category assigned to new products if none is specified.
        </p>
      </div>
    </Card>
  );

  const renderBackupRestore = () => (
    <Card className="p-4 sm:p-6 shadow-card space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted padding and spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2"> {/* Adjusted spacing */}
        <div>
          <h3 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2"><Database className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" /> Backup & Restore</h3> {/* Adjusted font size and icon size */}
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Safely download a complete backup of your data or restore a previous backup file.</p> {/* Adjusted font size */}
        </div>
        <Button onClick={() => setActiveSection(null)} variant="outline" size={isIOS ? "sm" : "default"}>Back to Overview</Button> {/* Smaller button on iOS */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"> {/* Adjusted spacing */}
        {/* Create Backup Card */}
        <Card
          className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
          onClick={handleCreateBackup}
        >
          <DownloadCloud className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" /> {/* Adjusted icon size */}
          <h3 className="text-lg sm:text-xl font-bold">Create Backup</h3> {/* Adjusted font size */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            Download a full backup containing invoices, products, activity logs, and settings to a `.invbackup` file.
          </p>
        </Card>

        {/* Restore Backup Card */}
        <Card
          className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
          onClick={() => restoreFileInputRef.current?.click()}
        >
          <div className="flex items-center gap-1 sm:gap-2"> {/* Adjusted spacing */}
            <UploadCloud className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" /> {/* Adjusted icon size */}
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" /> {/* Adjusted icon size */}
          </div>
          <h3 className="text-lg sm:text-xl font-bold">Restore Backup</h3> {/* Adjusted font size */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            Upload a `.invbackup` file to replace all current data with the backup. This action is irreversible.
          </p>
          <input
            ref={restoreFileInputRef}
            type="file"
            accept=".invbackup"
            onChange={handleRestoreBackup}
            className="hidden"
          />
        </Card>
      </div>
    </Card>
  );

  const renderSystemDiagnosticsTools = () => (
    <Card className="p-4 sm:p-6 shadow-card space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted padding and spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2"> {/* Adjusted spacing */}
        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2"><Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" /> System Diagnostics & Tools</h3> {/* Adjusted font size and icon size */}
        <Button onClick={() => setActiveSection(null)} variant="outline" size={isIOS ? "sm" : "default"}>Back to Overview</Button> {/* Smaller button on iOS */}
      </div>

      {/* Danger Zone - Clear All Data */}
      <Card className="border-destructive/20 shadow-card bg-destructive/5 p-3 sm:p-4 space-y-3 sm:space-y-4"> {/* Adjusted padding and spacing */}
        <h4 className="font-semibold text-destructive flex items-center gap-1 sm:gap-2 text-base sm:text-lg"> {/* Adjusted font size and gap */}
          <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" /> Danger Zone
        </h4>
        <p className="text-xs sm:text-sm text-muted-foreground">
          This will permanently delete all products and invoices. This action cannot be undone.
        </p>
        <Button
          onClick={handleClearAllData}
          variant="destructive"
          className="shadow-elegant"
          size={isIOS ? "sm" : "default"} // Smaller button on iOS
        >
          <Trash className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
          Clear All Data
        </Button>
      </Card>

      {/* Activity Log Button */}
      <Card className="shadow-card p-3 sm:p-4 bg-background space-y-3 sm:space-y-4"> {/* Adjusted padding and spacing */}
        <h4 className="font-semibold flex items-center gap-1 sm:gap-2 text-base sm:text-lg"> {/* Adjusted font size and gap */}
          <History className="h-3 w-3 sm:h-4 sm:w-4" /> Activity Log
        </h4>
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4"> {/* Adjusted font size and spacing */}
          View a chronological record of all significant actions performed in the application.
        </p>
        <Button
          onClick={() => setShowActivityLogModal(true)}
          variant="outline"
          className="shadow-elegant"
          size={isIOS ? "sm" : "default"} // Smaller button on iOS
        >
          <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
          View Activity Log ({activityLogs.length})
        </Button>
      </Card>
    </Card>
  );

  const renderAccountSettings = () => (
    <Card className="p-4 sm:p-6 shadow-card space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted padding and spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2"> {/* Adjusted spacing */}
        <h3 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2"><UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" /> Account Settings</h3> {/* Adjusted font size and icon size */}
        <Button onClick={() => setActiveSection(null)} variant="outline" size={isIOS ? "sm" : "default"}>Back to Overview</Button> {/* Smaller button on iOS */}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm sm:text-base">Email</Label> {/* Adjusted font size */}
        <Input
          id="email"
          type="email"
          value={currentUser?.email || 'N/A'}
          readOnly
          disabled
          className="bg-muted/50 text-sm sm:text-base" /* Adjusted font size */
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"> {/* Adjusted spacing */}
        <Button onClick={handleChangePassword} variant="outline" size={isIOS ? "sm" : "default"}> {/* Smaller button on iOS */}
          <Key className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
          Change Password
        </Button>
        <Button onClick={logout} variant="destructive" size={isIOS ? "sm" : "default"}> {/* Smaller button on iOS */}
          <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> {/* Adjusted icon size */}
          Logout
        </Button>
      </div>
    </Card>
  );

  if (loadingSettings) {
    return (
      <div 
        className="flex items-center justify-center"
        style={isIOS ? { minHeight: 'calc(var(--vh, 1vh) * 100)' } : { minHeight: '100vh' }} // Apply custom vh for iOS
      >
        <p className="text-lg">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in"> {/* Adjusted spacing */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0"> {/* Adjusted spacing */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Settings</h2> {/* Adjusted font size */}
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your app preferences and data.</p> {/* Adjusted font size */}
        </div>
        {activeSection !== null && (
          <Button onClick={handleSaveSettings} className="shadow-elegant" size={isIOS ? "sm" : "default"}> {/* Smaller button on iOS */}
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        )}
      </div>

      {activeSection === null ? (
        // Main grid of cards
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"> {/* Adjusted spacing */}
          {/* Deleted Invoices Card */}
          <Card
            className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
            onClick={() => setActiveSection('deletedInvoices')}
          >
            <FileX className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" /> {/* Adjusted icon size */}
            <h3 className="text-lg sm:text-xl font-bold">Deleted Invoices</h3> {/* Adjusted font size */}
            <p className="text-xs sm:text-sm text-muted-foreground">View and restore invoices from trash.</p> {/* Adjusted font size */}
          </Card>

          {/* General Settings Card */}
          <Card
            className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
            onClick={() => setActiveSection('general')}
          >
            <SettingsIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> {/* Adjusted icon size */}
            <h3 className="text-lg sm:text-xl font-bold">General Settings</h3> {/* Adjusted font size */}
            <p className="text-xs sm:text-sm text-muted-foreground">Configure basic app preferences.</p> {/* Adjusted font size */}
          </Card>

          {/* Invoice Settings Card */}
          <Card
            className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
            onClick={() => setActiveSection('invoices')}
          >
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" /> {/* Adjusted icon size */}
            <h3 className="text-lg sm:text-xl font-bold">Invoice Settings</h3> {/* Adjusted font size */}
            <p className="text-xs sm:text-sm text-muted-foreground">Manage invoice numbering, tax, and stock rules.</p> {/* Adjusted font size */}
          </Card>

          {/* Inventory Settings Card */}
          <Card
            className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
            onClick={() => setActiveSection('inventory')}
          >
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" /> {/* Adjusted icon size */}
            <h3 className="text-lg sm:text-xl font-bold">Inventory Settings</h3> {/* Adjusted font size */}
            <p className="text-xs sm:text-sm text-muted-foreground">Adjust stock update and tracking options.</p> {/* Adjusted font size */}
          </Card>

          {/* Backup & Restore Card */}
          <Card
            className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
            onClick={() => setActiveSection('backupRestore')}
          >
            <Database className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" /> {/* Adjusted icon size */}
            <h3 className="text-lg sm:text-xl font-bold">Backup & Restore</h3> {/* Adjusted font size */}
            <p className="text-xs sm:text-sm text-muted-foreground">Safely download or restore your complete app data.</p> {/* Adjusted font size */}
          </Card>

          {/* System Diagnostics & Tools Card */}
          <Card
            className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
            onClick={() => setActiveSection('systemDiagnosticsTools')}
          >
            <Wrench className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" /> {/* Adjusted icon size */}
            <h3 className="text-lg sm:text-xl font-bold">System Diagnostics & Tools</h3> {/* Adjusted font size */}
            <p className="text-xs sm:text-sm text-muted-foreground">Access tools for data management and activity logging.</p> {/* Adjusted font size */}
          </Card>

          {/* Account Settings Card */}
          <Card
            className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-300 bg-card shadow-card flex flex-col items-start space-y-2 sm:space-y-3" /* Adjusted padding and spacing */
            onClick={() => setActiveSection('account')}
          >
            <UserIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" /> {/* Adjusted icon size */}
            <h3 className="text-lg sm:text-xl font-bold">Account Settings</h3> {/* Adjusted font size */}
            <p className="text-xs sm:text-sm text-muted-foreground">Manage your user profile and security.</p> {/* Adjusted font size */}
          </Card>
        </div>
      ) : (
        // Display active section content
        <div className="mt-4 sm:mt-6"> {/* Adjusted spacing */}
          {activeSection === 'deletedInvoices' && renderDeletedInvoices()}
          {activeSection === 'general' && renderGeneralSettings()}
          {activeSection === 'invoices' && renderInvoiceSettings()}
          {activeSection === 'inventory' && renderInventorySettings()}
          {activeSection === 'backupRestore' && renderBackupRestore()}
          {activeSection === 'systemDiagnosticsTools' && renderSystemDiagnosticsTools()}
          {activeSection === 'account' && renderAccountSettings()}
        </div>
      )}

      {/* Modals (keep outside conditional rendering) */}
      <ActivityLogModal
        showActivityLogModal={showActivityLogModal}
        setShowActivityLogModal={setShowActivityLogModal}
        activityLogs={activityLogs}
      />
    </div>
  );
};

export default SettingsPage;