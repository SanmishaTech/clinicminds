'use client';

import { formatIndianCurrency, formatDateTime } from '@/lib/locales';
import jsPDF from 'jspdf';

type ConsultationData = {
  id: number;
  consultationNumber?: string;
  discountPercentage?: number | string;
  totalAmount: string;
  totalReceivedAmount?: string | null;
  complaint?: string;
  diagnosis?: string;
  remarks?: string;
  nextFollowUpDate?: string;
  casePaper?: string;
  createdAt: string;
  updatedAt: string;
  appointment: {
    id: number;
    appointmentDateTime: string;
    type: string;
    patient: {
      patientNo: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      mobile: string;
      gender: string;
    };
    team?: {
      name: string;
    };
  };
  consultationDetails?: Array<{
    id: number;
    serviceId: number;
    description: string | null;
    qty: number;
    rate: number;
    amount: number;
    service: {
      id: number;
      name: string;
    } | null;
  }>;
  consultationMedicines?: Array<{
    id: number;
    medicineId: number;
    medicine?: {
      id: number;
      name: string;
      brand?: {
        id: number;
        name: string;
      };
    };
    qty: number;
    mrp: number;
    amount: number;
    doses?: string;
  }>;
  consultationReceipts?: Array<{
    id: number;
    receiptNumber: string;
    date: string;
    paymentMode: string;
    amount: number;
    payerName?: string;
    contactNumber?: string;
    upiName?: string;
    utrNumber?: string;
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: string;
    notes?: string;
  }>;
};

interface ConsultationInvoicePDFProps {
  consultationData: ConsultationData;
  servicesSubtotal: number;
  medicinesSubtotal: number;
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  totalAmount: number;
}

export function ConsultationInvoicePDF({
  consultationData,
  servicesSubtotal,
  medicinesSubtotal,
  subtotal,
  discountPercentage,
  discountAmount,
  totalAmount
}: ConsultationInvoicePDFProps) {

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
    if (!consultationData) return;

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
      doc.text('INVOICE', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Invoice and Patient Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const invoiceNumber = consultationData.consultationNumber || `APT-${consultationData.appointment.id}`;
      const patientName = `${consultationData.appointment.patient.firstName} ${consultationData.appointment.patient.middleName} ${consultationData.appointment.patient.lastName}`.trim();
      
      doc.text(`Invoice Number: ${invoiceNumber}`, margin, y);
      doc.text(`Date: ${formatDateTime(new Date(consultationData.appointment.appointmentDateTime), { year: 'numeric', month: '2-digit', day: '2-digit' })}`, pageWidth - 60, y);
      y += 8;
      
      doc.text(`Patient: ${patientName}`, margin, y);
      y += 8;
      
      doc.text(`Mobile Number: ${consultationData.appointment.patient.mobile}`, margin, y);
      y += 8;
      
      doc.text(`Gender: ${consultationData.appointment.patient.gender}`, margin, y);
      y += 8;
      
      if (consultationData.appointment.team) {
        doc.text(`Team: ${consultationData.appointment.team.name}`, margin, y);
        y += 8;
      }
      y += 5;

      // Table headers
      const headers = [
        consultationData.appointment.type === 'PROCEDURE' ? 'Procedure' : 'Service', 
        'Description', 
        'Quantity', 
        'MRP', 
        'Amount'
      ];
      const colWidths = [25, 90, 35, 30, 40];
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

      // Services
      if (consultationData.consultationDetails && consultationData.consultationDetails.length > 0) {
        consultationData.consultationDetails.forEach((detail) => {
          const serviceName = detail.service?.name || (consultationData.appointment.type === 'PROCEDURE' ? 'Procedure' : 'Service');
          const description = detail.description || '';
          y = drawRow([
            serviceName,
            description.substring(0, 35),
            '-',
            formatPdfCurrency(detail.rate),
            formatPdfCurrency(detail.amount)
          ]);
        });
        
        // Services subtotal
        const servicesSubtotal = consultationData.consultationDetails.reduce((sum, detail) => sum + parseFloat(detail.amount.toString()), 0);
        y = drawRow(['', '', 'Subtotal:', '', formatPdfCurrency(servicesSubtotal)], false, true);
      }

      // Medicines
      if (consultationData.consultationMedicines && consultationData.consultationMedicines.length > 0) {
        consultationData.consultationMedicines.forEach((medicine) => {
          const medicineName = medicine.medicine ? 
            `${medicine.medicine.name} ${medicine.medicine.brand?.name || ''}`.trim() : 
            'Medicine';
          y = drawRow([
            'Medicine',
            medicineName.substring(0, 35),
            medicine.qty.toString(),
            formatPdfCurrency(medicine.mrp),
            formatPdfCurrency(medicine.amount)
          ]);
        });
        
        // Medicines subtotal
        const medicinesSubtotal = consultationData.consultationMedicines.reduce((sum, medicine) => sum + parseFloat(medicine.amount.toString()), 0);
        y = drawRow(['', '', 'Subtotal:', '', formatPdfCurrency(medicinesSubtotal)], false, true);
      }

      // Grand Total calculation with discount
      const servicesSubtotal = consultationData.consultationDetails?.reduce((sum, detail) => sum + parseFloat(detail.amount.toString()), 0) || 0;
      const medicinesSubtotal = consultationData.consultationMedicines?.reduce((sum, medicine) => sum + parseFloat(medicine.amount.toString()), 0) || 0;
      const subtotal = servicesSubtotal + medicinesSubtotal;
      
      // Calculate discount
      const discountPercentage = parseFloat(consultationData.discountPercentage?.toString() || '0') || 0;
      const discountAmount = subtotal * (discountPercentage / 100);
      const grandTotal = Math.max(0, subtotal - discountAmount);
      
      // Show subtotal
      y = drawRow(['', '', 'Subtotal:', '', formatPdfCurrency(subtotal)], false, true);
      
      // Show discount if applicable
      if (discountPercentage > 0) {
        y = drawRow(['', '', `Discount (${discountPercentage}%):`, '', `-${formatPdfCurrency(discountAmount)}`], false, true);
      }
      
      // Show grand total
      y = drawRow(['', '', 'Grand Total:', '', formatPdfCurrency(grandTotal)], false, true);

      // Receipts
      if (consultationData.consultationReceipts && consultationData.consultationReceipts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT RECEIPTS', margin, y);
        y += 8;

        consultationData.consultationReceipts.forEach((receipt) => {
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
      doc.text('This is a computer-generated invoice.', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save PDF
      const filenameBase = `consultation-invoice-${consultationData.consultationNumber || consultationData.appointment.id}`;
      const dateStr = formatDateTime(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });
      doc.save(`${filenameBase}-${dateStr}.pdf`);
    } catch (e) {
      console.error('Error generating PDF:', e);
    }
  };

  return generateInvoicePDF;
}
