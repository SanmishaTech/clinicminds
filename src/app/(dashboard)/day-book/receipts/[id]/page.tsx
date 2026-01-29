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
import { ComboboxInput } from '@/components/common/combobox-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { DataTable, Column } from '@/components/common/data-table';
import { formatIndianCurrency, formatDate } from '@/lib/locales';
import { useParams, useRouter } from 'next/navigation';

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
  amount: z.string().min(1),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().optional(),
  notes: z.string().optional(),
});

type ReceiptFormData = z.infer<typeof receiptSchema>;

type ConsultationData = {
  id: number;
  totalAmount: string;
  totalReceivedAmount?: string | null;
  appointment: {
    appointmentDateTime: string;
    patient: {
      patientNo: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      mobile: string;
    };
  };
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
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    },
  });

  const { control, handleSubmit, watch, reset } = form;

  const selectedPaymentMode = watch('paymentMode');
  const payerNameLabel =
    selectedPaymentMode === 'UPI'
      ? 'UPI App Name'
      : selectedPaymentMode === 'CHEQUE'
        ? 'Cheque Bank Name'
        : 'Name';

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
      const response = await apiGet(`/api/consultation-receipts?consultationId=${consultationId}`) as { data: ReceiptItem[] };
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
      
      const receiptData = {
        consultationId,
        date: values.date ? new Date(values.date).toISOString() : new Date().toISOString(),
        paymentMode: values.paymentMode || '',
        payerName: values.payerName || '',
        contactNumber: values.contactNumber || '',
        utrNumber: values.utrNumber || '',
        amount: parseFloat(values.amount || '0'),
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
      sortable: true,
      accessor: (r) => r.receiptNumber,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      accessor: (r) => formatDate(r.date),
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'paymentMode',
      header: 'Payment Mode',
      sortable: true,
      accessor: (r) => r.paymentMode,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'payerName',
      header: 'Payer Name',
      sortable: true,
      accessor: (r) => r.payerName,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      
      {/* Patient Information */}
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Patient Information</AppCard.Title>
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
              <label className="block text-sm font-medium">Appointment Date</label>
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
             disabled={currentBalance !== 0}
             iconName='Download'
             size='sm'
             >
              Download Invoice
            </AppButton>
          </FormRow>
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
              <FormRow cols={3}>
                <TextInput
                  control={control}
                  name="date"
                  label="Receipt Date"
                  type="date"
                  required
                />
                <ComboboxInput
                  control={control}
                  name="paymentMode"
                  label="Payment Mode"
                  options={paymentModeOptions}
                  required
                  placeholder="Select payment mode"
                />
                <TextInput
                  control={control}
                  name="payerName"
                  label={payerNameLabel}
                  placeholder="Enter payer name"
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
                  />
                </FormRow>
              )}

              {selectedPaymentMode === 'UPI' && (
                <FormRow cols={2}>
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
                  />
                  <TextInput
                    control={control}
                    name="utrNumber"
                    label="UTR Number"
                    placeholder="Enter UTR number"
                  />
                </FormRow>
              )}

              {selectedPaymentMode === 'CHEQUE' && (
                <FormRow cols={2}>
                  <TextInput
                    control={control}
                    name="chequeNumber"
                    label="Cheque Number"
                    placeholder="Enter cheque number"
                  />
                  <TextInput
                    control={control}
                    name="chequeDate"
                    label="Cheque Date"
                    type="date"
                  />
                </FormRow>
              )}

              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="amount"
                  label="Receipt Amount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="Enter amount"
                />
                <TextInput
                  control={control}
                  name="notes"
                  label="Notes"
                  placeholder="Enter notes (optional)"
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
