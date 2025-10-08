import React from 'react';
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, FileText, TrendingDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface DashboardMetrics {
  totalSales: number;
  totalCosts: number;
  totalProfit: number;
  numberOfInvoices: number;
  totalNegativeQuantity: number;
  totalNegativeValue: number;
  filteredInvoices: Invoice[];
}

interface DashboardTabProps {
  dateFilter: { from: string; to: string };
  setDateFilter: (filter: { from: string; to: string }) => void;
  calculateDashboardMetrics: () => DashboardMetrics;
  handleViewInvoice: (invoice: Invoice) => void;
  products: Product[]; // Needed for calculating invoice costs
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  dateFilter,
  setDateFilter,
  calculateDashboardMetrics,
  handleViewInvoice,
  products,
}) => {
  const metrics = calculateDashboardMetrics();
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Контролна табла</h2>
          <p className="text-muted-foreground mt-1">Перформанси на продажба и анализа на профит</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Label className="whitespace-nowrap">Период на датум:</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
              className="w-auto"
            />
            <span className="text-muted-foreground">до</span>
            <Input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
              className="w-auto"
            />
          </div>
          <Button 
            onClick={() => setDateFilter({ 
              from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], 
              to: new Date().toISOString().split('T')[0] 
            })}
            variant="outline"
            size="sm"
          >
            Ресетирај на година
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 shadow-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Вкупна продажба</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{metrics.totalSales.toFixed(2)} ден.</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-full">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Вкупни трошоци</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{metrics.totalCosts.toFixed(2)} ден.</p>
            </div>
            <div className="p-3 bg-red-500 rounded-full">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Вкупен профит</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{metrics.totalProfit.toFixed(2)} ден.</p>
            </div>
            <div className="p-3 bg-green-500 rounded-full">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Фактури</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{metrics.numberOfInvoices}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-full">
              <FileText className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Негативни ставки</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{metrics.totalNegativeQuantity}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Враќања/Оштетено/Бесплатно</p>
            </div>
            <div className="p-3 bg-orange-500 rounded-full">
              <TrendingDown className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Негативна вредност</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{metrics.totalNegativeValue.toFixed(2)} ден.</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Вкупна загубена/вратена вредност</p>
            </div>
            <div className="p-3 bg-amber-500 rounded-full">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Invoice Table */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Детали за фактури</h3>
          <p className="text-muted-foreground text-sm">
            {metrics.filteredInvoices.length} фактури од {new Date(dateFilter.from).toLocaleDateString()} до {new Date(dateFilter.to).toLocaleDateString()}
          </p>
        </div>
        <div className="overflow-x-auto">
          {metrics.filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Нема фактури во избраниот период</h3>
              <p className="text-muted-foreground mb-4">Прилагодете го периодот за да видите податоци</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 font-medium">Број на фактура</th>
                  <th className="text-left p-4 font-medium">Датум</th>
                  <th className="text-left p-4 font-medium">Клиент</th>
                  <th className="text-right p-4 font-medium">Продажба</th>
                  <th className="text-right p-4 font-medium">Трошоци</th>
                  <th className="text-right p-4 font-medium">Профит</th>
                  <th className="text-center p-4 font-medium">Акции</th>
                </tr>
              </thead>
              <tbody>
                {metrics.filteredInvoices.map(invoice => {
                  const invoiceCosts = invoice.items.reduce((sum, item) => {
                    const product = products.find(p => p.id === item.productId);
                    const purchasePrice = product?.purchasePrice || item.purchasePrice || 0;
                    return sum + (purchasePrice * item.quantity);
                  }, 0);
                  const invoiceProfit = invoice.total - invoiceCosts;
                  
                  return (
                    <tr key={invoice.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-medium">{invoice.number}</td>
                      <td className="p-4 text-muted-foreground">{new Date(invoice.date).toLocaleDateString()}</td>
                      <td className="p-4">{invoice.customer.name}</td>
                      <td className="p-4 text-right font-medium text-blue-600">{invoice.total.toFixed(2)} ден.</td>
                      <td className="p-4 text-right font-medium text-red-600">{invoiceCosts.toFixed(2)} ден.</td>
                      <td className={`p-4 text-right font-medium ${invoiceProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {invoiceProfit.toFixed(2)} ден.
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          onClick={() => handleViewInvoice(invoice)}
                          variant="outline"
                          size="sm"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DashboardTab;