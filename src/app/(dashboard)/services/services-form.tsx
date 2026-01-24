'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import NonFormTextInput from '@/components/common/non-form-text-input';
import TextareaInput from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface ServiceFormInitialData {
  id?: number;
  name?: string;
  rate?: string;
  baseRate?: string;
  gstPercent?: string;
  description?: string | null;
}

export interface FormProps {
  mode: 'create' | 'edit';
  initial?: ServiceFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/franchises'
}

export const serviceSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    rate: z.string().trim()
      .refine((val) => val && val.trim().length > 0, "Base rate is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Base rate must be a valid positive number"),
    gstPercent: z.string().trim()
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "GST must be a valid positive number"),
    description: z.preprocess((v) => (v === "" || v === null ? "" : v),
    z.string()
      .trim()
      .max(1000, 'Description must be less than 1000 characters').optional()),
});


export function ServiceForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/services',
}: FormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  type RawFormValues = z.infer<typeof serviceSchema>;
  const form = useForm<RawFormValues>({
    resolver: zodResolver(serviceSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
      rate: initial?.baseRate || initial?.rate || '',
      gstPercent: initial?.gstPercent || '0',
      description: initial?.description || '',
    },
  });

  const { control, handleSubmit, setError, clearErrors, watch } = form;
  const isCreate = mode === 'create';

  const baseRateRaw = watch('rate');
  const gstPercentRaw = watch('gstPercent');
  const actualRate = useMemo(() => {
    const base = parseFloat(String(baseRateRaw ?? '0'));
    const gst = parseFloat(String(gstPercentRaw ?? '0'));
    const safeBase = Number.isFinite(base) ? base : 0;
    const safeGst = Number.isFinite(gst) ? gst : 0;
    const rate = safeBase + (safeBase * safeGst) / 100;
    return rate.toFixed(2);
  }, [baseRateRaw, gstPercentRaw]);

  async function onSubmit(values: RawFormValues) {
    clearErrors('name');
    setSubmitting(true);
    const apiData = {
      ...values,
      rate: parseFloat(String(values.rate)),
      gstPercent: parseFloat(String(values.gstPercent)),
    };
    try {
      if (mode === 'create') {
        const res = await apiPost('/api/services', apiData);
        toast.success('Service has been added');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch(`/api/services/${initial.id}`, apiData);
        toast.success('Service details have been updated');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e?.status === 409) {
        setError('name', { type: 'server', message: e.message || 'Service name already exists' }, { shouldFocus: true });
        return;
      }
      console.log(err);
      toast.error((err as Error).message || 'Failed to save service');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Service' : 'Edit Service'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new service.' : 'Update service details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Service Details'>
              <FormRow cols={4} from='md'>
                <TextInput control={control} name='name' label='Service Name' required placeholder='Service name' span={1} spanFrom='md' />
                <TextInput control={control} name='rate' label='Base Rate' required placeholder='Base rate' type='number' step='0.01' span={1} spanFrom='md' />
                <TextInput control={control} name='gstPercent' label='GST %' required placeholder='GST %' type='number' step='0.01' span={1} spanFrom='md' />
                <NonFormTextInput
                  label='Actual Rate'
                  value={actualRate}
                  disabled
                  readOnly
                  type='number'
                  step='0.01'
                  containerClassName='md:col-span-1'
                />
              </FormRow>
              <FormRow cols={1}>
                <TextareaInput control={control} name='description' label='Description' placeholder='Description' rows={3} />
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className='justify-end'>
            <AppButton
              type='button'
              variant='secondary'
              onClick={() => router.push(redirectOnSuccess)}
              disabled={submitting}
              iconName='X'
            >
              Cancel
            </AppButton>
            <AppButton
              type='submit'
              iconName={isCreate ? 'Plus' : 'Save'}
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              {isCreate ? 'Create Service' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default ServiceForm;
