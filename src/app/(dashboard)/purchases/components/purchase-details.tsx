'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { formatIndianCurrency, formatDate, formatDateTime } from '@/lib/locales';
import jsPDF from 'jspdf';

type SaleDetail = {
  id: number;
  medicine: {
    id: number;
    name: string;
    brand: string | null;
    franchiseRate: number;
  } | null;
  quantity: number;
  mrp: number;
  amount: number;
  batchNumber?: string;
  expiryDate?: string;
};

type SaleDetailsData = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  discountPercent: number;
  transport: {
    id: number;
    status: string;
  } | null;
  franchise: {
    name: string;
  };
  saleDetails: SaleDetail[];
};

export default function PurchaseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params?.id ? Number(params.id) : null;
  
  const [saleData, setSaleData] = useState<SaleDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formatPdfCurrency = (amount: number): string => {
    // Convert to number and then to string with 2 decimal places
    const numAmount = Number(amount);
    const amountStr = numAmount.toFixed(2);
    const [integerPart, decimalPart] = amountStr.split('.');
    
    // Format the integer part according to Indian numbering system
    let formattedInteger = '';
    if (parseInt(integerPart) >= 1000) {
      // Get the last 3 digits
      const lastThree = integerPart.slice(-3);
      // Get the remaining digits
      const remaining = integerPart.slice(0, -3);
      
      // Format remaining digits with commas every 2 digits from right
      if (remaining.length > 0) {
        const remainingFormatted = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
        formattedInteger = remainingFormatted + ',' + lastThree;
      } else {
        formattedInteger = lastThree;
      }
    } else {
      formattedInteger = integerPart;
    }
    
    return `Rs. ${formattedInteger}.${decimalPart}`;
  };

  const generateInvoicePDF = () => {
    if (!saleData) return;

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('helvetica', 'normal');

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      let y = margin;

      // Header with App Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('ClinicMinds', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(16);
      doc.text('PURCHASE INVOICE', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Invoice and Franchise Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      doc.text(`Invoice #: ${saleData.invoiceNo}`, margin, y);
      doc.text(`Date: ${formatDate(saleData.invoiceDate)}`, pageWidth - 60, y);
      y += 8;
      
      doc.text(`Franchise: ${saleData.franchise.name}`, margin, y);
      y += 8;
      y += 5;

      // Table headers
      const headers = ['Medicine', 'Batch', 'Expiry', 'Rate', 'Qty', 'Amount'];
      const colWidths = [100, 35, 30, 25, 30, 40];
      const rowH = 8;

      const drawRow = (rowData: string[], isHeader = false, isBold = false) => {
        let x = margin;
        
        if (isHeader) {
          doc.setFillColor(240, 240, 240);
          doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F');
        }
        
        rowData.forEach((cell, index) => {
          doc.rect(x, y, colWidths[index], rowH);
          doc.setFont('helvetica', isBold ? 'bold' : (isHeader ? 'bold' : 'normal'));
          doc.text(cell, x + 2, y + 5.5);
          x += colWidths[index];
        });
        
        y += rowH;
        return y;
      };

      // Draw table headers
      y = drawRow(headers, true);

      // Medicines
      if (saleData.saleDetails && saleData.saleDetails.length > 0) {
        saleData.saleDetails.forEach((detail) => {
          const medicineName = detail.medicine ? 
            `${detail.medicine.name} - ${detail.medicine.brand || ''}`.trim() : 
            'Medicine';
          y = drawRow([
            medicineName.substring(0, 20),
            detail.batchNumber || '—',
            detail.expiryDate ? formatDate(detail.expiryDate) : '—',
            formatPdfCurrency(detail.medicine?.franchiseRate || 0),
            detail.quantity.toString(),
            formatPdfCurrency(detail.amount)
          ]);
        });
        
        // Medicines subtotal
        const medicinesSubtotal = saleData.saleDetails.reduce((sum, detail) => sum + detail.amount, 0);
        y = drawRow(['', '', '', '', 'Subtotal:', formatPdfCurrency(medicinesSubtotal)], false, true);
        
        // Discount calculation
        const discountAmount = (medicinesSubtotal * saleData.discountPercent) / 100;
        y = drawRow(['', '', '', '', `Discount (${saleData.discountPercent}%)`, `-${formatPdfCurrency(discountAmount)}`], false, true);
        
        // Grand Total
        const grandTotal = medicinesSubtotal - discountAmount;
        y = drawRow(['', '', '', '', 'Grand Total:', formatPdfCurrency(grandTotal)], false, true);
      }

      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('This is a computer-generated invoice.', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save PDF
      const filenameBase = `purchase-invoice-${saleData.invoiceNo}`;
      const dateStr = formatDateTime(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });
      doc.save(`${filenameBase}-${dateStr}.pdf`);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
    }
  };

  useEffect(() => {
    const fetchSaleDetails = async () => {
      if (!saleId) return;

      setIsLoading(true);
      try {
        const response = await apiGet(`/api/sales/${saleId}`);
        setSaleData(response as SaleDetailsData);
      } catch (error) {
        console.error('Failed to fetch purchase details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSaleDetails();
  }, [saleId]);

  if (!saleId) {
    return (
      <div className="container mx-auto p-6">
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-8 text-red-600">
              Invalid purchase ID
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Purchase Details</AppCard.Title>
          <AppCard.Description>
            View detailed information about this purchase
          </AppCard.Description>
          <AppCard.Action>
            <AppButton
              variant="secondary"
              onClick={() => router.back()}
              iconName="ArrowLeft"
            >
              Back
            </AppButton>
          </AppCard.Action>
        </AppCard.Header>
        <AppCard.Content>
          {isLoading ? (
            <div className="text-center py-8">Loading purchase details...</div>
          ) : saleData ? (
            <div className="space-y-6">
              {/* Purchase Information */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <span className="font-semibold text-base">Invoice No:</span>
                  <p className="font-semibold">{saleData.invoiceNo}</p>
                </div>
                <div>
                  <span className="font-semibold text-base">Date:</span>
                  <p>{new Date(saleData.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-semibold text-base">Discount:</span>
                  <p className="font-semibold">{saleData.discountPercent}%</p>
                </div>
                <div>
                  <span className="font-semibold text-base">Total Amount:</span>
                  <p className="font-semibold text-green-600">
                    {formatIndianCurrency(saleData.totalAmount)}
                  </p>
                </div>
                <div className="flex items-end">
                  <AppButton
                    type='button'
                    iconName='Download'
                    size='sm'
                    onClick={generateInvoicePDF}
                  >
                    Download Invoice
                  </AppButton>
                </div>
              </div>

              {/* Purchase Details Table */}
              {saleData.saleDetails.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-3">Medicines</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-7 gap-0 bg-muted border-b">
                      <div className="px-4 py-3 font-medium text-sm border-r">Medicine</div>
                      <div className="px-4 py-3 font-medium text-sm border-r">Brand</div>
                      <div className="px-4 py-3 font-medium text-sm border-r">Batch No</div>
                      <div className="px-4 py-3 font-medium text-sm border-r">Expiry</div>
                      <div className="px-4 py-3 font-medium text-sm border-r">Rate</div>
                      <div className="px-4 py-3 font-medium text-sm border-r">Quantity</div>
                      <div className="px-4 py-3 font-medium text-sm">Amount</div>
                    </div>
                    {saleData.saleDetails.map((detail, index) => (
                      <div key={index} className="grid grid-cols-7 gap-0 border-b last:border-b-0">
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.medicine?.name || '—'}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.medicine?.brand || 'Unknown Brand'}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.batchNumber || '—'}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.expiryDate ? new Date(detail.expiryDate).toLocaleDateString() : '—'}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {formatIndianCurrency(detail.medicine?.franchiseRate || 0)}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.quantity}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm">
                          {formatIndianCurrency(detail.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No purchase details available
            </div>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
