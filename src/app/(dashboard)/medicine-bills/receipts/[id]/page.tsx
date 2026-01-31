'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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

type MedicineBillData = {
  id: number;
  billNumber: string;
  billDate: string;
  totalAmount: number;
  totalReceivedAmount?: number;
  patient: {
    patientNo: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    mobile: string;
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
    amount: number;
  }>;
};

type ReceiptItem = {
  id: number;
  receiptNumber: string;
  date: string;
  amount: string;
  paymentMode: string;
  payerName?: string;
  contactNumber?: string;
  utrNumber?: string;
  upiName?: string;
  bankName?: string;
  chequeNumber?: string;
  chequeDate?: string;
  notes?: string;
  createdAt: string;
};

export default function MedicineBillReceiptsPage() {
  const params = useParams();
  const router = useRouter();
  const medicineBillId = parseInt(params.id as string);
  
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [medicineBillData, setMedicineBillData] = useState<MedicineBillData | null>(null);

  const form = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'CASH',
    },
  });

  const { control, handleSubmit, reset, watch, setValue } = form;
  const watchedPaymentMode = watch('paymentMode');
  const receiptAmount = watch('amount');

  // Use totalReceivedAmount from medicine bill data
  const totalReceivedAmount = medicineBillData?.totalReceivedAmount || 0;

  const currentBalance = medicineBillData ? medicineBillData.totalAmount - totalReceivedAmount : 0;

  // Check if receipt amount exceeds balance
  useEffect(() => {
    if (receiptAmount && currentBalance > 0) {
      const amount = parseFloat(receiptAmount);
      if (amount > currentBalance) {
        toast.error('Receipt amount cannot exceed balance amount');
        setValue('amount', currentBalance.toString());
      }
    }
  }, [receiptAmount, currentBalance, setValue]);

  const fetchMedicineBillData = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/api/medicine-bills/${medicineBillId}`) as MedicineBillData;
      setMedicineBillData(response);
    } catch (error) {
      toast.error('Failed to fetch medicine bill details');
      router.push('/medicine-bills');
    } finally {
      setLoading(false);
    }
  };

  // Fetch receipts for this medicine bill
  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/api/medicine-bill-receipts?medicineBillId=${medicineBillId}&sort=date&order=desc`) as { data: ReceiptItem[] };
      setReceipts(response.data || []);
    } catch (error) {
      toast.error('Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (medicineBillId) {
      fetchMedicineBillData();
      fetchReceipts();
    }
  }, [medicineBillId]);

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
        medicineBillId,
        date: new Date(values.date).toISOString(),
        paymentMode: values.paymentMode,
        amount: parseFloat(values.amount),
        payerName: values.payerName || '',
        contactNumber: values.contactNumber || '',
        utrNumber: values.utrNumber || '',
        upiName: values.upiName || '',
        bankName: values.bankName || '',
        chequeNumber: values.chequeNumber || '',
        chequeDate: values.chequeDate ? new Date(values.chequeDate).toISOString() : null,
        notes: values.notes || '',
      };

      await apiPost('/api/medicine-bill-receipts', receiptData);
      toast.success('Receipt created successfully');
      reset();
      fetchReceipts();
      fetchMedicineBillData(); // Refresh to update total received amount
      router.back(); // Go back to previous page
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

  if (loading && !medicineBillData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading medicine bill data...</div>
      </div>
    );
  }

  if (!medicineBillData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Medicine bill not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      
      {/* Medicine Bill Information */}
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Medicine Bill Information</AppCard.Title>
        </AppCard.Header>
        <AppCard.Content>
          <FormRow cols={4}>
            <div>
              <label className="block text-sm font-medium">Patient No</label>
              <p className="text-sm">{medicineBillData.patient.patientNo}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Patient Name</label>
              <p className="text-sm">
                {medicineBillData.patient.firstName} 
                {medicineBillData.patient.middleName && ` ${medicineBillData.patient.middleName}`}
                {medicineBillData.patient.lastName && ` ${medicineBillData.patient.lastName}`}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Mobile</label>
              <p className="text-sm">{medicineBillData.patient.mobile}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Bill Date</label>
              <p className="text-sm">
                {format(new Date(medicineBillData.billDate), 'dd/MM/yyyy')}
              </p>
            </div>
          </FormRow>
          <FormRow cols={4}>
            <div>
              <label className="block text-sm font-medium">Total Amount</label>
              <p className="text-sm font-medium">
                {formatIndianCurrency(medicineBillData.totalAmount)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Received Amount</label>
              <p className="text-sm font-medium text-green-600">
                {formatIndianCurrency(totalReceivedAmount)}
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

          {/* Medicines Details */}
          {medicineBillData.medicineDetails && medicineBillData.medicineDetails.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-base mb-2">Medicines</h4>
              <div className="border rounded">
                <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                  <div className="px-4 py-2 font-medium text-sm border-r">Medicine</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Qty</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">MRP</div>
                  <div className="px-4 py-2 font-medium text-sm">Amount</div>
                </div>
                {medicineBillData.medicineDetails.map((medicine, index) => (
                  <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                    <div className="px-4 py-2 font-medium text-sm border-r">
                      {medicine.medicine?.name || '—'}
                      {medicine.medicine?.brand && ` - ${medicine.medicine.brand}`}
                    </div>
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
                  placeholder="Select payment mode"
                  required
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

              {watchedPaymentMode === 'UPI' && (
                <FormRow cols={2}>
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
                </FormRow>
              )}

              {watchedPaymentMode === 'CHEQUE' && (
                <>
                  <FormRow cols={2}>
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
                  <FormRow cols={1}>
                    <TextInput
                      control={control}
                      name="bankName"
                      label="Bank Name"
                      placeholder="Enter bank name"
                      disabled={currentBalance === 0}
                    />
                  </FormRow>
                </>
              )}

              <FormRow cols={1}>
                <TextInput
                  control={control}
                  name="contactNumber"
                  label="Contact Number"
                  placeholder="Enter contact number"
                  maxLength={10}
                  pattern='[+0-9]*'
                  disabled={currentBalance === 0}
                />
              </FormRow>

              <FormRow cols={1}>
                <TextareaInput
                  control={control}
                  name="notes"
                  label="Notes"
                  placeholder="Enter any additional notes"
                  disabled={currentBalance === 0}
                />
              </FormRow>

              <div className="flex justify-end gap-2">
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={submitting}
                  iconName="X"
                >
                  Cancel
                </AppButton>
                <AppButton
                  type="submit"
                  disabled={submitting || currentBalance === 0 || !form.formState.isValid}
                >
                  {submitting ? 'Creating...' : 'Create Receipt'}
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