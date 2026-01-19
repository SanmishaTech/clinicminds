'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import TextareaInput from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface ServiceFormInitialData {
  id?: number;
  name?: string;
  unit?: string;
  rate?: string;
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
    unit: z.string().trim().min(1, 'Unit is required').max(255, 'Unit must be less than 255 characters'),
    rate: z.string().trim()
      .refine((val) => val && val.trim().length > 0, "Rate is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Rate must be a valid positive number"),
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
      unit: initial?.unit || '',
      rate: initial?.rate || '',
      description: initial?.description || '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    const apiData = {
      ...values,
      rate: parseFloat(String(values.rate)),
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
              <FormRow cols={1}>
                <TextInput control={control} name='name' label='Service Name' required placeholder='Service name' />
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='unit' label='Unit' required placeholder='Unit' />
                <TextInput control={control} name='rate' label='Rate' required placeholder='Rate' type='number' step='1' />
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
