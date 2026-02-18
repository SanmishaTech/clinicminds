'use client';

import { formatDateTime } from '@/lib/locales';
import jsPDF from 'jspdf';
import { ToWords } from 'to-words';

type MedicineBillData = {
  id: number;
  billNumber: string;
  billDate: string;
  discountPercent: number;
  totalAmount: number;
  totalReceivedAmount?: number;
  patient: {
    patientNo: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    mobile: string;
    gender: string;
  };
  medicineDetails: Array<{
    id: number;
    qty: number;
    mrp: number;
    amount: number;
    medicine: {
      id: number;
      name: string;
      brand?: string;
    };
  }>;
  createdAt: string;
  medicineBillReceipts?: Array<{
    id: number;
    receiptNumber: string;
    date: string;
    paymentMode: string;
    amount: number;
    payerName?: string;
    contactNumber?: string;
    utrNumber?: string;
    upiName?: string;
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: string;
    notes?: string;
  }>;
};

interface MedicineBillInvoicePDFProps {
  medicineBillData: MedicineBillData;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
}

export function MedicineBillInvoicePDF({
  medicineBillData,
  subtotal,
  discountAmount,
  totalAmount
}: MedicineBillInvoicePDFProps) {
  
  const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: false,
  }
});

  const formatPdfCurrency = (amount: number): string => {
    // Convert to number and then to string with 2 decimal places
    const numAmount = Number(amount);
    const amountStr = numAmount.toFixed(2);
    const [integerPart, decimalPart] = amountStr.split('.');
    
    // Format integer part according to Indian numbering system
    let formattedInteger = '';
    if (parseInt(integerPart) >= 1000) {
      // Get last 3 digits
      const lastThree = integerPart.slice(-3);
      // Get remaining digits
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
    if (!medicineBillData) return;

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
      doc.text(process.env.NEXT_PUBLIC_APP_NAME || 'ANKURAM', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(16);
      doc.text('TAX INVOICE', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Invoice and Patient Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const billNumber = medicineBillData.billNumber;
      const patientName = `${medicineBillData.patient.firstName} ${medicineBillData.patient.middleName} ${medicineBillData.patient.lastName}`.trim();
      
      doc.text(`Invoice Number: ${billNumber}`, margin, y);
      doc.text(`Date: ${formatDateTime(new Date(medicineBillData.billDate), { year: 'numeric', month: '2-digit', day: '2-digit' })}`, pageWidth - 40, y);
      y += 8;
      
      doc.text(`Patient: ${patientName}`, margin, y);
      y += 8;
      
      doc.text(`Mobile Number: ${medicineBillData.patient.mobile}`, margin, y);
      y += 8;
      
      doc.text(`Gender: ${medicineBillData.patient.gender ? medicineBillData.patient.gender.charAt(0).toUpperCase() + medicineBillData.patient.gender.slice(1).toLowerCase() : 'Unknown'}`, margin, y);
      y += 8;
      y += 5;

      // Table headers
      const headers = ['Description', 'Quantity', 'MRP', 'Amount'];
      const colWidths = [130, 28, 30, 90];
      const rowH = 8;

      const drawRow = (rowData: string[], isHeader = false, isBold = false, skipBorders: boolean[] = []) => {
        let x = margin;
        
        if (isHeader) {
          doc.setFillColor(240, 240, 240);
          doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F');
        }
        
        rowData.forEach((cell, index) => {
          // Draw borders manually for precise control
          if (index === 0) {
            // First cell: draw all borders
            doc.line(x, y, x + colWidths[index], y); // Top
            doc.line(x, y, x, y + rowH); // Left
            doc.line(x + colWidths[index], y, x + colWidths[index], y + rowH); // Right
            doc.line(x, y + rowH, x + colWidths[index], y + rowH); // Bottom
          } else {
            // Other cells: draw top, bottom, and right borders (left border handled by previous cell)
            doc.line(x, y, x + colWidths[index], y); // Top
            if (!skipBorders[index - 1]) {
              doc.line(x, y, x, y + rowH); // Left border (only if previous cell doesn't skip)
            }
            if (!skipBorders[index]) {
              doc.line(x + colWidths[index], y, x + colWidths[index], y + rowH); // Right border
            }
            doc.line(x, y + rowH, x + colWidths[index], y + rowH); // Bottom
          }
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
      if (medicineBillData.medicineDetails && medicineBillData.medicineDetails.length > 0) {
        medicineBillData.medicineDetails.forEach((medicine) => {
          const medicineName = medicine.medicine ? 
            `${medicine.medicine.name} - ${medicine.medicine.brand || ''}`.trim() : 
            'Medicine';
          y = drawRow([
            medicineName.substring(0, 35),
            medicine.qty.toString(),
            formatPdfCurrency(medicine.mrp),
            formatPdfCurrency(medicine.amount)
          ]);
        });
        
        // Medicines subtotal
        const medicinesSubtotal = medicineBillData.medicineDetails.reduce((sum, medicine) => sum + parseFloat(medicine.amount.toString()), 0);
        y = drawRow(['', 'Subtotal:', '', formatPdfCurrency(medicinesSubtotal)], false, true);
      }

      // Grand Total calculation with discount
      const medicinesSubtotal = medicineBillData.medicineDetails?.reduce((sum, medicine) => sum + parseFloat(medicine.amount.toString()), 0) || 0;
      const calculatedSubtotal = medicinesSubtotal;
      
      // Calculate discount
      const discountPercentage = parseFloat(medicineBillData.discountPercent?.toString() || '0') || 0;
      const calculatedDiscountAmount = calculatedSubtotal * (discountPercentage / 100);
      const grandTotal = Math.max(0, calculatedSubtotal - calculatedDiscountAmount);
      
      // Show discount if applicable
      if (discountPercentage > 0) {
        y = drawRow(['', `Discount (${discountPercentage}%):`, '', `-${formatPdfCurrency(calculatedDiscountAmount)}`], false, true);
      }

      // Tax breakup (for TAX INVOICE) - inside the table
      const gstPercentage = 12; // 12% GST (6% CGST + 6% SGST)
      const taxableValue = grandTotal * 100 / (100 + gstPercentage);
      const cgstAmount = taxableValue * 0.06; // 6% CGST
      const sgstAmount = taxableValue * 0.06; // 6% SGST
      const totalGstAmount = cgstAmount + sgstAmount;

      // Show tax breakup inside the table
      y = drawRow(['', 'Taxable Value:', '', formatPdfCurrency(taxableValue)], false, true);
      y = drawRow(['', 'CGST (6%):', '', formatPdfCurrency(cgstAmount)], false, true);
      y = drawRow(['', 'SGST (6%):', '', formatPdfCurrency(sgstAmount)], false, true);
      y = drawRow(['', 'Total GST:', '', formatPdfCurrency(totalGstAmount)], false, true);
      y = drawRow(['', 'Invoice Total:', '', formatPdfCurrency(grandTotal)], false, true);

      // Add amount in words
      const amountInWords = toWords.convert(Math.ceil(grandTotal));
      y = drawRow(['', 'In Words:', amountInWords.substring(0, 50), ''], false, true, [false, false, true, false]);
      if (amountInWords.length > 50) {
        y = drawRow(['', '', amountInWords.substring(50), ''], false, true, [false, false, true, false]);
      }

      // Receipts
      if (medicineBillData.medicineBillReceipts && medicineBillData.medicineBillReceipts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT RECEIPTS', margin, y);
        y += 8;

        medicineBillData.medicineBillReceipts.forEach((receipt) => {
          doc.setFont('helvetica', 'normal');
          doc.text(`Receipt #: ${receipt.receiptNumber} | ${formatDateTime(new Date(receipt.date), { year: 'numeric', month: '2-digit', day: '2-digit' })} | ${receipt.paymentMode} | ${formatPdfCurrency(receipt.amount)}`, margin, y);
          y += 6;
          if (receipt.payerName) {
            doc.text(`Payer: ${receipt.payerName}`, margin + 5, y);
            y += 6;
          }
        });
      }

      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('Medicines once sold will not be taken back.', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save PDF
      const filenameBase = `medicine-bill-invoice-${medicineBillData.billNumber}`;
      const dateStr = formatDateTime(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });
      doc.save(`${filenameBase}-${dateStr}.pdf`);
    } catch (e) {
      console.error('Error generating PDF:', e);
    }
  };

  return generateInvoicePDF;
}
