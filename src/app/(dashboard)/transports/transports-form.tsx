'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { apiPost } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { Form } from '@/components/ui/form';
import { FormSection, FormRow } from '@/components/common/app-form';
import { TextInput } from '@/components/common/text-input';
import { TextareaInput } from '@/components/common/textarea-input';
import { transportFormSchema, type TransportFormValues } from '@/lib/schemas/frontend/transports';
import { StatusBadge } from '@/components/common/status-badge';

export type TransportFormInitial = {
  transporterName?: string | null;
  companyName?: string | null;
  transportFee?: number | string | null;
  receiptNumber?: string | null;
  vehicleNumber?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  status?: string | null;
};

export type TransportSaleInfo = {
  saleId: number;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  franchiseName?: string | null;
};

export interface TransportFormProps {
  sale: TransportSaleInfo;
  initial?: TransportFormInitial | null;
  redirectOnSuccess?: string;
}

export default function TransportForm({ sale, initial, redirectOnSuccess = '/transports' }: TransportFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const defaultValues: TransportFormValues = useMemo(
    () => ({
      transporterName: initial?.transporterName || '',
      companyName: initial?.companyName || '',
      transportFee: initial?.transportFee != null ? String(initial.transportFee) : '',
      receiptNumber: initial?.receiptNumber || '',
      vehicleNumber: initial?.vehicleNumber || '',
      trackingNumber: initial?.trackingNumber || '',
      notes: initial?.notes || '',
    }),
    [initial]
  );

  const form = useForm<TransportFormValues>({
    resolver: zodResolver(transportFormSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues,
  });

  const { control, handleSubmit } = form;

  const statusLower = (initial?.status || 'PENDING').toString().toLowerCase();

  async function onSubmit(values: TransportFormValues) {
    setSubmitting(true);
    try {
      const payload = {
        saleId: sale.saleId,
        companyName: values.companyName.trim(),
        transporterName: values.transporterName?.trim() || undefined,
        transportFee: Number(values.transportFee),
        receiptNumber: values.receiptNumber?.trim() || undefined,
        vehicleNumber: values.vehicleNumber?.trim() || undefined,
        trackingNumber: values.trackingNumber?.trim() || undefined,
        notes: values.notes || undefined,
      };

      await apiPost('/api/transports', payload);
      toast.success('Transport dispatched successfully');
      router.push(redirectOnSuccess);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to dispatch transport');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Transport</AppCard.Title>
          <AppCard.Description>
            Dispatch sale {sale.invoiceNo ? `"${sale.invoiceNo}"` : ''} {sale.franchiseName ? `to ${sale.franchiseName}` : ''}
          </AppCard.Description>
          <div className='flex items-center gap-2 text-sm'>
            <span className='text-muted-foreground'>Status:</span>
            <StatusBadge
              status={statusLower}
              stylesMap={{
                dispatched: { label: 'Dispatched', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                delivered: { label: 'Delivered', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
              }}
            />
          </div>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Transport Details'>
              <FormRow cols={3}>
                <TextInput control={control} name='companyName' label='Company Name' placeholder='Enter company name' required />
                <TextInput control={control} name='transporterName' label='Transporter Name' placeholder='Enter transporter name' />
                <TextInput control={control} name='transportFee' label='Transport Fee' placeholder='0' type='number' step='0.01' required />
              </FormRow>

              <FormRow cols={3}>
                <TextInput control={control} name='receiptNumber' label='Receipt Number' placeholder='Enter receipt number' />
                <TextInput control={control} name='vehicleNumber' label='Vehicle Number' placeholder='Enter vehicle number' />
                <TextInput control={control} name='trackingNumber' label='Tracking Number' placeholder='Enter tracking number' />
              </FormRow>

              <FormRow>
                <TextareaInput control={control} name='notes' label='Notes' placeholder='Any notes' />
              </FormRow>
            </FormSection>
          </AppCard.Content>

          <AppCard.Footer className='justify-end'>
            <div className='flex items-end gap-2'>
              <AppButton type='button' variant='secondary' onClick={() => router.back()}>
                Cancel
              </AppButton>

              <AppButton type='submit' disabled={submitting} isLoading={submitting}>
                Dispatch
              </AppButton>
            </div>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
