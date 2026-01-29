'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';
import { apiGet, apiPost } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { TextInput } from '@/components/common/text-input';
import { ComboboxInput } from '@/components/common/combobox-input';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { FormSection, FormRow } from '@/components/common/app-form';
import { DataTable, Column } from '@/components/common/data-table';
import { formatIndianCurrency, formatDate } from '@/lib/locales';
import { EditButton, DeleteIconButton } from '@/components/common/icon-button';

const paymentModeOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

const receiptSchema = z.object({
  date: z.string().optional(),
  paymentMode: z.string().optional(),
  payerName: z.string().optional(),
  contactNumber: z.string().optional(),
  utrNumber: z.string().optional(),
  amount: z.string().optional(),
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

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultationId: number;
  consultationData: ConsultationData;
}

export function ReceiptModal({ isOpen, onClose, consultationId, consultationData }: ReceiptModalProps) {
  const [addReceipt, setAddReceipt] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      paymentMode: '',
      payerName: '',
      contactNumber: '',
      utrNumber: '',
      amount: '',
      chequeNumber: '',
      chequeDate: '',
      notes: '',
    },
  });

  const selectedPaymentMode = watch('paymentMode');

  // Fetch receipts for this consultation
  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/api/consultation-receipts?consultationId=${consultationId}`);
      setReceipts(response.data || []);
    } catch (error) {
      toast.error('Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && consultationId) {
      fetchReceipts();
    }
  }, [isOpen, consultationId]);

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
      
      // Reset form and refresh receipts
      reset();
      setAddReceipt(false);
      fetchReceipts();
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
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      accessor: () => '',
      cellClassName: 'whitespace-nowrap',
    },
  ];

  const currentBalance = parseFloat(consultationData.totalAmount) - 
    parseFloat(consultationData.totalReceivedAmount || '0');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <AppCard className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <AppCard.Header>
          <AppCard.Title>Receipt Management</AppCard.Title>
          <AppCard.Description>
            Manage receipts for consultation #{consultationId}
          </AppCard.Description>
        </AppCard.Header>
        
        <AppCard.Content className="space-y-6">
          {/* Patient Information */}
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Patient Information</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              <FormRow cols={4}>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Patient No</label>
                  <p className="text-sm text-gray-900">{consultationData.appointment.patient.patientNo}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Patient Name</label>
                  <p className="text-sm text-gray-900">
                    {consultationData.appointment.patient.firstName} 
                    {consultationData.appointment.patient.middleName && ` ${consultationData.appointment.patient.middleName}`}
                    {consultationData.appointment.patient.lastName && ` ${consultationData.appointment.patient.lastName}`}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mobile</label>
                  <p className="text-sm text-gray-900">{consultationData.appointment.patient.mobile}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Appointment Date</label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(consultationData.appointment.appointmentDateTime), 'dd/MM/yyyy hh:mm a')}
                  </p>
                </div>
              </FormRow>
              <FormRow cols={3}>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="text-sm font-medium text-gray-900">
                    {formatIndianCurrency(parseFloat(consultationData.totalAmount))}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Received Amount</label>
                  <p className="text-sm font-medium text-green-600">
                    {formatIndianCurrency(parseFloat(consultationData.totalReceivedAmount || '0'))}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Balance Amount</label>
                  <p className="text-sm font-medium text-red-600">
                    {formatIndianCurrency(currentBalance)}
                  </p>
                </div>
              </FormRow>
            </AppCard.Content>
          </AppCard>

          {/* Add Receipt Form */}
          <AppCard>
            <AppCard.Header>
              <AppCard.Title>Add New Receipt</AppCard.Title>
            </AppCard.Header>
            <AppCard.Content>
              <div className="mb-4">
                <AppCheckbox
                  checked={addReceipt}
                  onCheckedChange={setAddReceipt}
                  label="Add Receipt"
                />
              </div>
              
              {addReceipt && (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <FormRow cols={3}>
                    <TextInput
                      control={control}
                      name="date"
                      label="Receipt Date"
                      type="date"
                    />
                    <ComboboxInput
                      control={control}
                      name="paymentMode"
                      label="Payment Mode"
                      options={paymentModeOptions}
                      placeholder="Select payment mode"
                    />
                    <TextInput
                      control={control}
                      name="payerName"
                      label="Payer Name"
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
                      onClick={() => {
                        reset();
                        setAddReceipt(false);
                      }}
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
              )}
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
        </AppCard.Content>
        
        <AppCard.Footer>
          <AppButton variant="outline" onClick={onClose}>
            Close
          </AppButton>
        </AppCard.Footer>
      </AppCard>
    </div>
  );
}
