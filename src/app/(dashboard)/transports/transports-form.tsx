'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { apiPost } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { FormSection, FormRow } from '@/components/common/app-form';
import { TextInput } from '@/components/common/text-input';
import { TextareaInput } from '@/components/common/textarea-input';
import { transportFormSchema, type TransportFormValues } from '@/lib/schemas/frontend/transports';
import { StatusBadge } from '@/components/common/status-badge';
import { Input } from '@/components/ui/input';

export type TransportFormInitial = {
  transporterName?: string | null;
  companyName?: string | null;
  dispatchedDetails?: Array<{ saleDetailId: number; quantity: number | string | null }>;
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
  saleDetails?: Array<{
    id: number;
    medicineName?: string | null;
    brandName?: string | null;
    batchNumber?: string | null;
    expiryDate?: string | null;
    quantity: number | string;
  }>;
};

export interface TransportFormProps {
  sale: TransportSaleInfo;
  initial?: TransportFormInitial | null;
  redirectOnSuccess?: string;
}

export default function TransportForm({ sale, initial, redirectOnSuccess = '/transports' }: TransportFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const defaultValues: TransportFormValues = useMemo(() => {
    const initialDetails = initial?.dispatchedDetails || [];
    const hasInitialDetails = initialDetails.length > 0;

    const dispatchedDetails = (sale.saleDetails || []).map((detail) => {
      const matched = initialDetails.find((item) => Number(item.saleDetailId) === Number(detail.id));
      const fallbackQty = hasInitialDetails ? 0 : Number(detail.quantity) || 0;
      const quantity = matched?.quantity ?? fallbackQty;
      return {
        saleDetailId: Number(detail.id),
        quantity: String(quantity ?? 0),
      };
    });

    return {
      transporterName: initial?.transporterName || '',
      companyName: initial?.companyName || '',
      dispatchedDetails,
      transportFee: initial?.transportFee != null ? String(initial.transportFee) : '',
      receiptNumber: initial?.receiptNumber || '',
      vehicleNumber: initial?.vehicleNumber || '',
      trackingNumber: initial?.trackingNumber || '',
      notes: initial?.notes || '',
    };
  }, [initial, sale.saleDetails]);

  const form = useForm<TransportFormValues>({
    resolver: zodResolver(transportFormSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues,
  });

  const { control, handleSubmit } = form;

  const statusLower = (initial?.status || 'PENDING').toString().toLowerCase();
  const isAlreadyDispatched = statusLower === 'dispatched';
  const isDelivered = statusLower === 'delivered';

  async function onSubmit(values: TransportFormValues) {
    setSubmitting(true);
    try {
      const payload = {
        saleId: sale.saleId,
        companyName: values.companyName.trim(),
        dispatchedDetails: values.dispatchedDetails.map((detail) => ({
          saleDetailId: Number(detail.saleDetailId),
          quantity: Number(detail.quantity) || 0,
        })),
        transporterName: values.transporterName?.trim() || undefined,
        transportFee: Number(values.transportFee),
        receiptNumber: values.receiptNumber?.trim() || undefined,
        vehicleNumber: values.vehicleNumber?.trim() || undefined,
        trackingNumber: values.trackingNumber?.trim() || undefined,
        notes: values.notes || undefined,
      };

      await apiPost('/api/transports', payload);
      toast.success(isAlreadyDispatched ? 'Transport updated successfully' : 'Transport dispatched successfully');
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
            {sale.saleDetails && sale.saleDetails.length > 0 && (
              <FormSection legend='Sale Details'>
                <div className='overflow-x-auto rounded-md border'>
                  <table className='w-full text-sm'>
                    <thead className='bg-muted/50 text-muted-foreground'>
                      <tr>
                        <th className='px-3 py-2 text-left font-medium'>Medicine</th>
                        <th className='px-3 py-2 text-left font-medium'>Batch</th>
                        <th className='px-3 py-2 text-left font-medium'>Expiry</th>
                        <th className='px-3 py-2 text-right font-medium'>Qty</th>
                        <th className='px-3 py-2 text-right font-medium'>Dispatched Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.saleDetails.map((d, idx) => {
                        const saleQty = Number(d.quantity) || 0;
                        return (
                          <tr key={d.id ?? idx} className='border-t'>
                            <td className='px-3 py-2'>
                              {(d.medicineName || '—') + (d.brandName ? ` (${d.brandName})` : '')}
                            </td>
                            <td className='px-3 py-2'>{d.batchNumber || '—'}</td>
                            <td className='px-3 py-2'>
                              {d.expiryDate ? d.expiryDate.toString().split('T')[0] : '—'}
                            </td>
                            <td className='px-3 py-2 text-right'>{saleQty}</td>
                            <td className='px-3 py-2 text-right'>
                              <FormField
                                control={control}
                                name={`dispatchedDetails.${idx}.saleDetailId`}
                                render={({ field }) => (
                                  <input type='hidden' {...field} value={field.value ?? d.id} />
                                )}
                              />
                              <FormField
                                control={control}
                                name={`dispatchedDetails.${idx}.quantity`}
                                render={({ field }) => (
                                  <FormItem className='flex flex-col items-end'>
                                    <FormControl>
                                      <Input
                                        type='number'
                                        inputMode='numeric'
                                        min={0}
                                        max={saleQty}
                                        step={1}
                                        className='h-9 w-24 text-right'
                                        {...field}
                                        value={field.value ?? ''}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <FormField
                  control={control}
                  name='dispatchedDetails'
                  render={() => (
                    <FormItem>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
            )}

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
                {isDelivered ? 'Delivered' : isAlreadyDispatched ? 'Update' : 'Dispatch'}
              </AppButton>
            </div>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
