'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, Column } from '@/components/common/data-table';
import { FormSection, FormRow } from '@/components/common/app-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { TextInput } from '@/components/common/text-input';
import { ComboboxInput } from '@/components/common/combobox-input';
import { TextareaInput } from '@/components/common/textarea-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type FeePaymentRow = {
  id: number;
  paymentDate: string;
  amount: string;
  paymentMode: string;
  payerName: string | null;
  contactNumber: string | null;
  utrNumber: string | null;
  chequeDate: string | null;
  chequeNumber: string | null;
  notes: string | null;
  createdAt: string;
};

type FranchiseFeesResponse = {
  franchiseId: number;
  franchiseName: string;
  totalFeeAmount: number;
  totalReceived: number;
  balance: number;
  payments: FeePaymentRow[];
};

const formSchema = z.object({
  paymentDate: z.string().min(1, 'Payment date is required'),
  amount: z.string().trim().min(1, 'Amount is required'),
  paymentMode: z.enum(['CASH', 'UPI', 'CHEQUE']),
  payerName: z.string().trim().min(1, 'Name is required'),
  contactNumber: z.string().trim().optional(),
  utrNumber: z.string().trim().optional(),
  chequeDate: z.string().trim().optional(),
  chequeNumber: z.string().trim().optional(),
  notes: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.paymentMode === 'CASH') {
    if (!val.contactNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contactNumber'], message: 'Contact number is required' });
    } else if (!/^[0-9]{10}$/.test(val.contactNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contactNumber'], message: 'Contact number must be 10 digits' });
    }
  }

  if (val.paymentMode === 'UPI') {
    if (!val.utrNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['utrNumber'], message: 'UTR number is required' });
    }
  }

  if (val.paymentMode === 'CHEQUE') {
    if (!val.chequeDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chequeDate'], message: 'Cheque date is required' });
    }
    if (!val.chequeNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chequeNumber'], message: 'Cheque number is required' });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

export default function FranchiseFeesPage() {
  const params = useParams<{ id: string }>();
  const franchiseId = params?.id;

  const query = useMemo(() => {
    if (!franchiseId) return null;
    return `/api/franchises/${franchiseId}/fees`;
  }, [franchiseId]);

  const { data, error, isLoading, mutate } = useSWR<FranchiseFeesResponse>(query, apiGet);

  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      amount: '',
      paymentMode: 'CASH',
      payerName: '',
      contactNumber: '',
      utrNumber: '',
      chequeDate: '',
      chequeNumber: '',
      notes: '',
    },
  });

  const { control, handleSubmit, reset } = form;

  const paymentModeOptions = useMemo(
    () => [
      { value: 'CASH', label: 'Cash' },
      { value: 'UPI', label: 'UPI' },
      { value: 'CHEQUE', label: 'Cheque' },
    ],
    []
  );

  const paymentMode = form.watch('paymentMode');

  const columns: Column<FeePaymentRow>[] = [
    {
      key: 'paymentDate',
      header: 'Date',
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => (r.paymentDate ? r.paymentDate.split('T')[0] : '—'),
    },
    {
      key: 'amount',
      header: 'Amount',
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => {
        const num = Number(r.amount ?? 0);
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
      },
    },
    { key: 'paymentMode', header: 'Mode', cellClassName: 'whitespace-nowrap' },
    {
      key: 'payerName',
      header: 'Name',
      accessor: (r) => r.payerName || '—',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'reference',
      header: 'Reference',
      accessor: (r) => {
        if (r.paymentMode === 'CASH') return r.contactNumber || '—';
        if (r.paymentMode === 'UPI') return r.utrNumber || '—';
        if (r.paymentMode === 'CHEQUE') return r.chequeNumber || '—';
        return '—';
      },
      cellClassName: 'whitespace-nowrap',
    },
    { key: 'notes', header: 'Notes' },
  ];

  async function onSubmit(values: FormValues) {
    if (!franchiseId) return;
    setSubmitting(true);
    try {
      const amt = Number(values.amount);
      if (Number.isNaN(amt) || amt <= 0) {
        toast.error('Amount must be a positive number');
        return;
      }

      await apiPost(`/api/franchises/${franchiseId}/fees`, {
        paymentDate: new Date(values.paymentDate).toISOString(),
        amount: amt,
        paymentMode: values.paymentMode,
        payerName: values.payerName,
        contactNumber: values.paymentMode === 'CASH' ? values.contactNumber : null,
        utrNumber: values.paymentMode === 'UPI' ? values.utrNumber : null,
        chequeDate: values.paymentMode === 'CHEQUE' ? new Date(values.chequeDate || '').toISOString() : null,
        chequeNumber: values.paymentMode === 'CHEQUE' ? values.chequeNumber : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      });

      toast.success('Payment added');
      reset({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMode: 'CASH',
        payerName: '',
        contactNumber: '',
        utrNumber: '',
        chequeDate: '',
        chequeNumber: '',
        notes: '',
      });
      await mutate();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add payment');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    toast.error((error as Error).message || 'Failed to load franchise fees');
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Franchise Fee</AppCard.Title>
        <AppCard.Description>
          {data?.franchiseName ? `Payments for ${data.franchiseName}` : 'Manage franchise fee payments'}
        </AppCard.Description>
      </AppCard.Header>

      <AppCard.Content className='space-y-6'>
        <div className='grid grid-cols-12 gap-4'>
          <div className='col-span-12 md:col-span-4 rounded-lg border p-4'>
            <div className='text-sm text-muted-foreground'>Total Fee</div>
            <div className='text-lg font-bold'>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                data?.totalFeeAmount ?? 0
              )}
            </div>
          </div>
          <div className='col-span-12 md:col-span-4 rounded-lg border p-4'>
            <div className='text-sm text-muted-foreground'>Received</div>
            <div className='text-lg font-bold'>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                data?.totalReceived ?? 0
              )}
            </div>
          </div>
          <div className='col-span-12 md:col-span-4 rounded-lg border p-4'>
            <div className='text-sm text-muted-foreground'>Balance</div>
            <div className='text-lg font-bold'>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                data?.balance ?? 0
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue='add'>
          <TabsList>
            <TabsTrigger value='add'>Add Transaction</TabsTrigger>
            <TabsTrigger value='history'>Transaction History</TabsTrigger>
          </TabsList>

          <TabsContent value='add'>
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)}>
                <FormSection legend='Add Payment'>
                  <FormRow cols={2}>
                    <TextInput control={control} name='paymentDate' label='Payment Date' type='date' required />
                    <TextInput control={control} name='amount' label='Amount' type='number' required placeholder='0' />
                  </FormRow>
                  <FormRow>
                    <div className='col-span-12 md:col-span-4'>
                      <ComboboxInput
                        control={control as any}
                        name='paymentMode'
                        label='Payment Mode'
                        options={paymentModeOptions}
                        required
                        placeholder='Select mode'
                      />
                    </div>
                  </FormRow>
                  {paymentMode === 'CHEQUE' ? (
                    <>
                      <FormRow cols={3}>
                        <TextInput control={control} name='payerName' label='Name' required placeholder='Name' />
                        <TextInput control={control} name='chequeDate' label='Cheque Date' type='date' required />
                        <TextInput
                          control={control}
                          name='chequeNumber'
                          label='Cheque Number'
                          required
                          placeholder='Cheque number'
                        />
                      </FormRow>
                    </>
                  ) : (
                    <FormRow cols={2}>
                      <TextInput control={control} name='payerName' label='Name' required placeholder='Name' />
                      {paymentMode === 'CASH' && (
                        <TextInput
                          control={control}
                          name='contactNumber'
                          label='Contact Number'
                          required
                          placeholder='10 digit mobile'
                        />
                      )}
                      {paymentMode === 'UPI' && (
                        <TextInput
                          control={control}
                          name='utrNumber'
                          label='UTR Number'
                          required
                          placeholder='UTR number'
                        />
                      )}
                    </FormRow>
                  )}
                  <FormRow>
                    <TextareaInput
                      control={control as any}
                      name='notes'
                      label='Notes'
                      placeholder='Optional'
                      rows={2}
                      itemClassName='col-span-12'
                    />
                  </FormRow>
                  <div className='flex justify-end'>
                    <AppButton type='submit' isLoading={submitting} disabled={submitting || !form.formState.isValid}>
                      Add Payment
                    </AppButton>
                  </div>
                </FormSection>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value='history'>
            <div>
              <div className='text-sm font-medium mb-2'>Payments</div>
              <DataTable columns={columns} data={data?.payments || []} loading={isLoading} stickyColumns={1} />
            </div>
          </TabsContent>
        </Tabs>
      </AppCard.Content>
    </AppCard>
  );
}
