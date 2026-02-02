'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';
import { apiGet, apiPost } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { TextInput } from '@/components/common/text-input';
import TextareaInput from '@/components/common/textarea-input';
import { ComboboxInput } from '@/components/common/combobox-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { DataTable, Column } from '@/components/common/data-table';
import { formatIndianCurrency, formatDate } from '@/lib/locales';
import { useParams, useRouter } from 'next/navigation';
import jsPDF from 'jspdf';

const paymentModeOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const receiptSchema = z.object({
  date: z.string(),
  paymentMode: z.enum(['CASH', 'UPI', 'CHEQUE']),
  payerName: z.string().optional(),
  contactNumber: z.string().optional(),
  utrNumber: z.string().optional(),
  upiName: z.string().optional(),
  bankName: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().optional(),
  notes: z.string().optional(),
});

type ReceiptFormData = z.infer<typeof receiptSchema>;

type ConsultationData = {
  id: number;
  consultationNumber?: string;
  totalAmount: string;
  totalReceivedAmount?: string | null;
  complaint?: string;
  diagnosis?: string;
  remarks?: string;
  nextFollowUpDate?: string;
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

type ReceiptItem = {
  id: number;
  receiptNumber: string;
  date: string;
  paymentMode: string;
  payerName: string;
  contactNumber?: string;
  utrNumber?: string;
  amount: string;
  chequeNumber?: string;
  chequeDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const consultationId = parseInt(params.id as string);
  
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consultationData, setConsultationData] = useState<ConsultationData | null>(null);

  const form = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    },
  });

  const { control, handleSubmit, watch, reset, setValue } = form;

  const selectedPaymentMode = watch('paymentMode');
  const receiptAmount = watch('amount');

  // Check if receipt amount exceeds balance
  useEffect(() => {
    if (receiptAmount && currentBalance > 0) {
      const amount = parseFloat(receiptAmount);
      if (amount > currentBalance) {
        toast.error('Receipt amount cannot exceed balance amount');
        setValue('amount', currentBalance.toString());
      }
    }
  }, [receiptAmount, setValue]);

  // Fetch consultation data
  const fetchConsultationData = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/api/consultations/${consultationId}`) as ConsultationData;
      console.log(response);
      setConsultationData(response);
    } catch (error) {
      toast.error('Failed to fetch consultation data');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Fetch receipts for this consultation
  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/api/consultation-receipts?consultationId=${consultationId}&sort=date&order=desc`) as { data: ReceiptItem[] };
      setReceipts(response.data || []);
    } catch (error) {
      toast.error('Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (consultationId) {
      fetchConsultationData();
      fetchReceipts();
    }
  }, [consultationId]);

  const onSubmit = async (values: ReceiptFormData) => {
    try {
      setSubmitting(true);
      
      const receiptAmount = parseFloat(values.amount || '0');
      
      // Forceful check: Ensure receipt amount doesn't exceed balance amount
      if (receiptAmount > currentBalance) {
        toast.error('Receipt amount cannot exceed balance amount');
        return;
      }
      
      const receiptData = {
        consultationId,
        date: values.date ? new Date(values.date).toISOString() : new Date().toISOString(),
        paymentMode: values.paymentMode || '',
        payerName: values.payerName || '',
        contactNumber: values.contactNumber || '',
        utrNumber: values.utrNumber || '',
        upiName: values.upiName || '',
        bankName: values.bankName || '',
        amount: receiptAmount,
        chequeNumber: values.chequeNumber || '',
        chequeDate: values.chequeDate ? new Date(values.chequeDate).toISOString() : null,
        notes: values.notes || '',
      };

      await apiPost('/api/consultation-receipts', receiptData);
      toast.success('Receipt created successfully');
      router.push('/day-book');
    } catch (error) {
      toast.error('Failed to create receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const receiptColumns: Column<ReceiptItem>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt No',
      sortable: false,
      accessor: (r) => r.receiptNumber,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'date',
      header: 'Date',
      sortable: false,
      accessor: (r) => formatDate(r.date),
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'paymentMode',
      header: 'Payment Mode',
      sortable: false,
      accessor: (r) => r.paymentMode,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'payerName',
      header: 'Payer Name',
      sortable: false,
      accessor: (r) => r.payerName,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: false,
      accessor: (r) => formatIndianCurrency(parseFloat(r.amount)),
      cellClassName: 'whitespace-nowrap font-medium',
    },
  ];

  if (loading && !consultationData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading consultation data...</div>
      </div>
    );
  }

  if (!consultationData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Consultation not found</div>
      </div>
    );
  }

  const currentBalance = parseFloat(consultationData.totalAmount) - 
    parseFloat(consultationData.totalReceivedAmount || '0');

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
      doc.text('ClinicMinds', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(16);
      doc.text('CONSULTATION INVOICE', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Invoice and Patient Info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const invoiceNumber = consultationData.consultationNumber || `APT-${consultationData.appointment.id}`;
      const patientName = `${consultationData.appointment.patient.firstName} ${consultationData.appointment.patient.middleName} ${consultationData.appointment.patient.lastName}`.trim();
      
      doc.text(`Patient: ${patientName}`, margin, y);
      doc.text(`Date: ${formatDate(consultationData.appointment.appointmentDateTime)}`, pageWidth - 60, y);
      y += 8;
      
      doc.text(`Mobile: ${consultationData.appointment.patient.mobile}`, margin, y);
      doc.text(`Gender: ${consultationData.appointment.patient.gender}`, pageWidth - 60, y);
      y += 8;
      
      if (consultationData.appointment.team) {
        doc.text(`Team: ${consultationData.appointment.team.name}`, margin, y);
        y += 8;
      }
      y += 5;

      // Table headers
      const headers = ['Type', 'Description', 'Quantity', 'MRP', 'Amount'];
      const colWidths = [25, 100, 25, 30, 40];
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
          const description = detail.service?.name || detail.description || 'Service';
          y = drawRow([
            'Service',
            description.substring(0, 35),
            '-',
            formatPdfCurrency(detail.rate),
            formatPdfCurrency(detail.amount)
          ]);
        });
        
        // Services subtotal
        const servicesSubtotal = consultationData.consultationDetails.reduce((sum, detail) => sum + detail.amount, 0);
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
        const medicinesSubtotal = consultationData.consultationMedicines.reduce((sum, medicine) => sum + medicine.amount, 0);
        y = drawRow(['', '', 'Subtotal:', '', formatPdfCurrency(medicinesSubtotal)], false, true);
      }

      // Grand Total - right after medicines subtotal
      const servicesSubtotal = consultationData.consultationDetails?.reduce((sum, detail) => sum + parseFloat(detail.amount.toString()), 0) || 0;
      const medicinesSubtotal = consultationData.consultationMedicines?.reduce((sum, medicine) => sum + parseFloat(medicine.amount.toString()), 0) || 0;
      const grandTotal = parseFloat(servicesSubtotal.toString()) + parseFloat(medicinesSubtotal.toString());
      
      y = drawRow(['', '', 'Grand Total:', '', formatPdfCurrency(grandTotal)], false, true);

      // Receipts
      if (consultationData.consultationReceipts && consultationData.consultationReceipts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT RECEIPTS', margin, y);
        y += 8;

        consultationData.consultationReceipts.forEach((receipt) => {
          doc.setFont('helvetica', 'normal');
          doc.text(`Receipt #: ${receipt.receiptNumber} | ${formatDate(receipt.date)} | ${receipt.paymentMode} | ${formatPdfCurrency(receipt.amount)}`, margin, y);
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
      const dateStr = format(new Date(), 'dd-MM-yyyy');
      doc.save(`${filenameBase}-${dateStr}.pdf`);
    } catch (e) {
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      
      {/* Consultation Information */}
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Consultation Information</AppCard.Title>
        </AppCard.Header>
        <AppCard.Content>
          <FormRow cols={4}>
            <div>
              <label className="block text-sm font-medium">Patient No</label>
              <p className="text-sm">{consultationData.appointment.patient.patientNo}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Patient Name</label>
              <p className="text-sm">
                {consultationData.appointment.patient.firstName} 
                {consultationData.appointment.patient.middleName && ` ${consultationData.appointment.patient.middleName}`}
                {consultationData.appointment.patient.lastName && ` ${consultationData.appointment.patient.lastName}`}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Mobile</label>
              <p className="text-sm">{consultationData.appointment.patient.mobile}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Gender</label>
              <p className="text-sm">{consultationData.appointment.patient.gender}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Appointment Date and Time</label>
              <p className="text-sm">
                {format(new Date(consultationData.appointment.appointmentDateTime), 'dd/MM/yyyy hh:mm a')}
              </p>
            </div>
          </FormRow>
          <FormRow cols={4}>
            <div>
              <label className="block text-sm font-medium">Total Amount</label>
              <p className="text-sm font-medium">
                {formatIndianCurrency(parseFloat(consultationData.totalAmount))}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Received Amount</label>
              <p className="text-sm font-medium text-green-600">
                {formatIndianCurrency(parseFloat(consultationData.totalReceivedAmount || '0'))}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Balance Amount</label>
              <p className="text-sm font-medium text-red-600">
                {formatIndianCurrency(currentBalance)}
              </p>
            </div>
            <AppButton
             type='button'
            //  disabled={currentBalance !== 0}
             iconName='Download'
             size='sm'
             onClick={generateInvoicePDF}
             >
              Download Invoice
            </AppButton>
          </FormRow>

          {/* Services and Medicines Details */}
          {consultationData.consultationDetails && consultationData.consultationDetails.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-base mb-2">Services</h4>
              <div className="border rounded">
                <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                  <div className="px-4 py-2 font-medium text-sm border-r">Service</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Description</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Rate</div>
                  <div className="px-4 py-2 font-medium text-sm">Amount</div>
                </div>
                {consultationData.consultationDetails.map((detail, index) => (
                  <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                    <div className="px-4 py-2 font-medium text-sm border-r">{detail.service?.name || '—'}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{detail.description || '—'}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(detail.rate)}</div>
                    <div className="px-4 py-2 font-medium text-sm">{formatIndianCurrency(detail.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {consultationData.consultationMedicines && consultationData.consultationMedicines.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-base mb-2">Medicines</h4>
              <div className="border rounded">
                <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                  <div className="px-4 py-2 font-medium text-sm border-r">Medicine</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Qty</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">MRP</div>
                  <div className="px-4 py-2 font-medium text-sm">Amount</div>
                </div>
                {consultationData.consultationMedicines.map((medicine, index) => (
                  <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                    <div className="px-4 py-2 font-medium text-sm border-r">{medicine.medicine?.name || '—'}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{medicine.qty}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(medicine.mrp)}</div>
                    <div className="px-4 py-2 font-medium text-sm">{formatIndianCurrency(medicine.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AppCard.Content>
      </AppCard>

      {/* Add Receipt Form */}
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Add New Receipt</AppCard.Title>
        </AppCard.Header>
        <AppCard.Content>
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Receipt Amount - Move to top */}
              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="amount"
                  label="Receipt Amount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="Enter amount"
                  disabled={currentBalance === 0}
                  max={currentBalance}
                />
              </FormRow>

              <FormRow cols={3}>
                <TextInput
                  control={control}
                  name="date"
                  label="Receipt Date"
                  type="date"
                  required
                  disabled={currentBalance === 0}
                />
                <ComboboxInput
                  control={control}
                  name="paymentMode"
                  label="Payment Mode"
                  options={paymentModeOptions}
                  required
                  placeholder="Select payment mode"
                  disabled={currentBalance === 0}
                />
                <TextInput
                  control={control}
                  name="payerName"
                  label="Payer Name"
                  placeholder="Enter payer name"
                  disabled={currentBalance === 0}
                />
              </FormRow>

              {/* Conditional fields based on payment mode */}
              {selectedPaymentMode === 'CASH' && (
                <FormRow cols={1}>
                  <TextInput
                    control={control}
                    name="contactNumber"
                    label="Contact Number"
                    maxLength={10}
                    pattern='[+0-9]*'
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                    }}
                    placeholder="Enter contact number"
                    disabled={currentBalance === 0}
                  />
                </FormRow>
              )}

              {selectedPaymentMode === 'UPI' && (
                <FormRow cols={3}>
                  <TextInput
                    control={control}
                    name="upiName"
                    label="UPI Name"
                    placeholder="Enter UPI name"
                    disabled={currentBalance === 0}
                  />
                  <TextInput
                    control={control}
                    name="utrNumber"
                    label="UTR Number"
                    placeholder="Enter UTR number"
                    disabled={currentBalance === 0}
                  />
                  <TextInput
                    control={control}
                    name="contactNumber"
                    label="Contact Number"
                    maxLength={10}
                    pattern='[+0-9]*'
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                    }}
                    placeholder="Enter contact number"
                    disabled={currentBalance === 0}
                  />
                </FormRow>
              )}

              {selectedPaymentMode === 'CHEQUE' && (
                <FormRow cols={3}>
                  <TextInput
                    control={control}
                    name="bankName"
                    label="Bank Name"
                    placeholder="Enter bank name"
                    disabled={currentBalance === 0}
                  />
                  <TextInput
                    control={control}
                    name="chequeNumber"
                    label="Cheque Number"
                    placeholder="Enter cheque number"
                    disabled={currentBalance === 0}
                  />
                  <TextInput
                    control={control}
                    name="chequeDate"
                    label="Cheque Date"
                    type="date"
                    disabled={currentBalance === 0}
                  />
                </FormRow>
              )}

              <FormRow cols={1}>
                <TextareaInput
                  control={control}
                  name="notes"
                  label="Notes"
                  placeholder="Enter notes (optional)"
                  disabled={currentBalance === 0}
                />
              </FormRow>

              <div className="flex justify-end space-x-2">
                <AppButton
                  type="button"
                  variant="outline"
                  iconName='X'
                  onClick={() => router.push('/day-book')}
                >
                  Cancel
                </AppButton>
                <AppButton
                  type="submit"
                  isLoading={submitting}
                  disabled={submitting || currentBalance === 0 || !form.formState.isValid}
                >
                  Create Receipt
                </AppButton>
              </div>
            </form>
          </Form>
        </AppCard.Content>
      </AppCard>

      {/* Receipt History */}
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Receipt History</AppCard.Title>
        </AppCard.Header>
        <AppCard.Content>
          {loading ? (
            <div className="text-center py-4">Loading receipts...</div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No receipts found</div>
          ) : (
            <DataTable
              data={receipts}
              columns={receiptColumns}
            />
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
