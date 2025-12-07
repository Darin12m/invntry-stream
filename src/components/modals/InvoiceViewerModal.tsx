import React, { useContext } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, FileDown, X } from 'lucide-react';
import { Invoice } from '@/types';
import { toast } from "sonner";
import { AppContext } from '@/context/AppContext';
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

interface InvoiceViewerModalProps {
  showInvoiceViewer: boolean;
  setShowInvoiceViewer: (show: boolean) => void;
  viewingInvoice: Invoice | null;
  Capacitor: any;
  html2canvas: any;
  jsPDF: any;
}

const InvoiceViewerModal: React.FC<InvoiceViewerModalProps> = ({
  showInvoiceViewer,
  setShowInvoiceViewer,
  viewingInvoice,
  Capacitor,
  html2canvas,
  jsPDF,
}) => {
  const { settings } = useContext(AppContext);
  const { isIOS } = useDeviceType(); // Use the hook

  const printInvoice = async () => {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        const element = document.querySelector('[data-invoice-content]') as HTMLElement;
        if (!element) {
          toast.error('Invoice content not found');
          return;
        }
        await saveInvoiceAsPDF(); // Fallback to PDF generation for native print
        toast.success('Ready to print via AirPrint');
      } else {
        window.print();
      }
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('Failed to print invoice');
    }
  };

  const saveInvoiceAsPDF = async () => {
    try {
      const element = document.querySelector('[data-invoice-content]') as HTMLElement;
      if (!element) {
        toast.error('Invoice content not found');
        return;
      }

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm';
      tempContainer.style.padding = '10mm';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.innerHTML = element.innerHTML;
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = -(pdfHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${viewingInvoice?.number || 'invoice'}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Failed to save PDF');
    }
  };

  if (!showInvoiceViewer || !viewingInvoice) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-4xl h-full sm:h-5/6 flex flex-col animate-scale-in shadow-glow">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:p-6 border-b print:hidden gap-2 sm:gap-4"> {/* Adjusted padding and spacing */}
          <h3 className="text-lg sm:text-xl font-semibold">Invoice Details</h3> {/* Adjusted font size */}
          <div className="flex flex-wrap gap-1 sm:gap-2"> {/* Adjusted spacing */}
            <Button
              onClick={printInvoice}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Printer className="h-3 w-3 sm:h-4 w-4 mr-0.5 sm:mr-1" /> {/* Adjusted icon size */}
              {Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' ? 'AirPrint' : 'Print'}
            </Button>
            <Button
              onClick={saveInvoiceAsPDF}
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <FileDown className="h-3 w-3 sm:h-4 w-4 mr-0.5 sm:mr-1" /> {/* Adjusted icon size */}
              Download PDF
            </Button>
            <Button
              onClick={() => setShowInvoiceViewer(false)}
              variant="ghost"
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0">
          <div data-invoice-content>
            <style>{`
              /* Print settings - Edge to edge with no grey borders */
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }

                .invoice-container {
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 15mm !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: white !important;
                }

                .invoice-header {
                  flex-wrap: nowrap !important;
                  align-items: flex-start !important;
                }
                
                .company-info {
                  text-align: right !important;
                  margin-top: 0 !important;
                }

                @page {
                  size: A4;
                  margin: 0 !important;
                }

                /* Hide scrollbars and other UI elements */
                *::-webkit-scrollbar {
                  display: none !important;
                }
              }

              /* Normal screen view */
              .invoice-container {
                max-width: 800px;
                margin: auto;
                padding: 20px;
                border: 1px solid #ccc;
                box-shadow: 0 0 5px rgba(0,0,0,0.2);
                background: #fff;
                font-family: Arial, sans-serif;
              }
            `}</style>

            <div className="invoice-container">
              {/* Header */}
              <div className="invoice-header" style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                marginBottom: "30px",
              }}>
                <div style={{ flex: "1" }}>
                  <h1 style={{
                    margin: "0",
                    fontSize: "32px",
                    fontWeight: "bold",
                  }}>WeParty.</h1>
                  <p style={{
                    margin: "0",
                    fontSize: "14px",
                    color: "#666",
                  }}>PARTY DECOR</p>
                </div>
                <div className="company-info" style={{
                  textAlign: "right",
                  fontSize: "12px",
                  flex: "1",
                  lineHeight: "1.6",
                }}>
                  <p style={{ margin: "2px 0" }}>ПАРТИЛАБ увоз-извоз ДОО Скопје</p>
                  <p style={{ margin: "2px 0" }}>Друштво за трговија и услуги</p>
                  <p style={{ margin: "2px 0" }}>ул. Гари 65Б/1-2, Карпош, Скопје</p>
                  <p style={{ margin: "2px 0" }}>Даночен број: 4057025575047</p>
                  <p style={{ margin: "2px 0" }}>Трансакциска сметка: 270078458980186</p>
                  <p style={{ margin: "2px 0" }}>Халк Банка АД Скопје</p>
                </div>
              </div>

              {/* Invoice Number and Customer Info Row */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "30px",
                flexWrap: "wrap", // Allow wrapping on small screens
                gap: "15px", // Add gap for responsiveness
              }}>
                {/* Left - Invoice Number */}
                <div style={{ flex: "1", minWidth: "200px" }}> {/* Added minWidth */}
                  <h2 style={{
                    margin: "0 0 5px 0",
                    fontSize: "22px",
                    fontWeight: "bold",
                    color: "#6366f1",
                  }}>
                    ФАКТУРА Бр. #{viewingInvoice.number}
                  </h2>
                  <p style={{
                    margin: "0",
                    fontSize: "14px",
                    color: "#666",
                  }}>
                    Датум: {new Date(viewingInvoice.date).toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}г.
                  </p>
                  {viewingInvoice.invoiceType && (
                    <p style={{
                      margin: "5px 0 0 0",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: viewingInvoice.invoiceType === 'sale' ? '#22c55e' 
                        : viewingInvoice.invoiceType === 'cash' ? '#ef4444'
                        : viewingInvoice.invoiceType === 'return' ? '#f97316' 
                        : '#eab308',
                      textTransform: 'uppercase',
                    }}>
                      Тип: {viewingInvoice.invoiceType === 'gifted-damaged' ? 'Gifted/Damaged' : viewingInvoice.invoiceType.toUpperCase()}
                    </p>
                  )}
                </div>
                
                {/* Right - Customer Info */}
                <div style={{ textAlign: "right", flex: "1", minWidth: "200px" }}> {/* Added minWidth */}
                  <p style={{
                    margin: "0 0 5px 0",
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#6366f1",
                  }}>
                    Клиент:
                  </p>
                  <p style={{ margin: "2px 0", fontSize: "14px", fontWeight: "bold" }}>
                    {viewingInvoice.customer.name}
                  </p>
                  {viewingInvoice.customer.phone && (
                    <p style={{ margin: "2px 0", fontSize: "14px" }}>
                      Телефон: {viewingInvoice.customer.phone}
                    </p>
                  )}
                  {viewingInvoice.customer.email && (
                    <p style={{ margin: "2px 0", fontSize: "14px" }}>
                      Email: {viewingInvoice.customer.email}
                    </p>
                  )}
                  {viewingInvoice.customer.address && (
                    <p style={{ margin: "2px 0", fontSize: "14px" }}>
                      Адреса: {viewingInvoice.customer.address}
                    </p>
                  )}
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}> {/* Added overflow-x for table responsiveness */}
                <table style={{
                  width: "100%",
                  minWidth: "600px", // Ensure table doesn't get too small
                  borderCollapse: "collapse",
                  marginBottom: "20px",
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "center",
                        fontSize: "12px",
                        backgroundColor: "#f9f9f9",
                        fontWeight: "bold",
                        width: "40px",
                      }}>Бр.</th>
                      <th style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "left",
                        fontSize: "12px",
                        backgroundColor: "#f9f9f9",
                        fontWeight: "bold",
                      }}>Име на производ</th>
                      <th style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "center",
                        fontSize: "12px",
                        backgroundColor: "#f9f9f9",
                        fontWeight: "bold",
                        width: "80px",
                      }}>Количина</th>
                      <th style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "right",
                        fontSize: "12px",
                        backgroundColor: "#f9f9f9",
                        fontWeight: "bold",
                        width: "100px",
                      }}>Цена без ДДВ</th>
                      <th style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "center",
                        fontSize: "12px",
                        backgroundColor: "#f9f9f9",
                        fontWeight: "bold",
                        width: "70px",
                      }}>ДДВ (%)</th>
                      <th style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "center",
                        fontSize: "12px",
                        backgroundColor: "#f9f9f9",
                        fontWeight: "bold",
                        width: "80px",
                      }}>Попуст (%)</th>
                      <th style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        textAlign: "right",
                        fontSize: "12px",
                        backgroundColor: "#f9f9f9",
                        fontWeight: "bold",
                        width: "100px",
                      }}>Вкупно</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingInvoice.items.length > 0 ? (
                      viewingInvoice.items.map((item, i) => (
                        <tr key={i}>
                          <td style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "center",
                            fontSize: "12px",
                          }}>{i + 1}</td>
                          <td style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                            fontSize: "12px",
                          }}>{item.name}</td>
                          <td style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "center",
                            fontSize: "12px",
                            color: item.quantity < 0 ? '#dc2626' : 'inherit',
                            fontWeight: item.quantity < 0 ? 'bold' : 'normal'
                          }}>{item.quantity}</td>
                          <td style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "right",
                            fontSize: "12px",
                          }}>{item.price.toFixed(2)} {settings.currency}</td>
                          <td style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "center",
                            fontSize: "12px",
                          }}>0%</td>
                          <td style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "center",
                            fontSize: "12px",
                          }}>{item.discount > 0 ? `${item.discount}%` : '0%'}</td>
                          <td style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "right",
                            fontSize: "12px",
                          }}>{(item.price * item.quantity * (1 - (item.discount || 0) / 100)).toFixed(2)} {settings.currency}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{
                          border: "1px solid #ddd",
                          padding: "10px",
                          textAlign: "center",
                          fontSize: "12px",
                          color: "#888"
                        }}>
                          Нема внесени ставки
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{
                textAlign: "right",
                fontSize: "14px",
                marginTop: "10px",
                marginBottom: "40px",
              }}>
                <p style={{ margin: "5px 0" }}>
                  Меѓузбир: <span style={{ marginLeft: "20px" }}>{viewingInvoice.subtotal.toFixed(2)} {settings.currency}</span>
                </p>
                {viewingInvoice.discountPercentage > 0 && (
                  <p style={{ margin: "5px 0", color: "#dc2626" }}>
                    Попуст: <span style={{ marginLeft: "20px" }}>-{viewingInvoice.discount.toFixed(2)} {settings.currency}</span>
                  </p>
                )}
                <p style={{ margin: "5px 0" }}>
                  ДДВ (18%): <span style={{ marginLeft: "20px" }}>0.00 {settings.currency}</span>
                </p>
                <p style={{ 
                  margin: "10px 0 0 0",
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#6366f1",
                  borderTop: "2px solid #ddd",
                  paddingTop: "10px"
                }}>
                  ВКУПНО: <span style={{ marginLeft: "20px" }}>{viewingInvoice.total.toFixed(2)} {settings.currency}</span>
                </p>
              </div>

              {/* Signature Section */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "60px",
                marginBottom: "40px",
                flexWrap: "wrap", // Allow wrapping on small screens
                gap: "20px", // Add gap for responsiveness
              }}>
                <div style={{ textAlign: "center", flex: "1", minWidth: "150px" }}> {/* Added minWidth */}
                  <p style={{ margin: "0 0 40px 0", fontSize: "14px" }}>Издал</p>
                  <div style={{ borderBottom: "1px solid #000", width: "200px", maxWidth: "100%", margin: "0 auto" }}></div> {/* Added maxWidth */}
                </div>
                <div style={{ textAlign: "center", flex: "1", minWidth: "150px" }}> {/* Added minWidth */}
                  <p style={{ margin: "0 0 40px 0", fontSize: "14px" }}>Примил</p>
                  <div style={{ borderBottom: "1px solid #000", width: "200px", maxWidth: "100%", margin: "0 auto" }}></div> {/* Added maxWidth */}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                textAlign: "center",
                fontSize: "12px",
                color: "#666",
                marginTop: "20px",
                borderTop: "1px solid #ddd",
                paddingTop: "15px",
              }}>
                <p style={{ margin: "0" }}>
                  Благодариме за вашата доверба!
                </p>
                <p style={{ margin: "5px 0 0 0", fontSize: "11px" }}>
                  Генерирано на: {new Date().toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' })} во {new Date().toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default InvoiceViewerModal;