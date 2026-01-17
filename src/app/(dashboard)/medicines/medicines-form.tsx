'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';


export interface MedicineFormInitialData {
  id?: number;
  name?: string;
  brand?: string;
  rate?: string;
  mrp?: string;
}

export interface FormProps {
  mode: 'create' | 'edit';
  initial?: MedicineFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/medicines'
}

export const medicineSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    brand: z.string().trim().min(1, 'Brand is required').max(255, 'Brand must be less than 255 characters'),
    rate: z.string().trim()
      .refine((val) => val && val.trim().length > 0, "Rate is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Rate must be a valid positive number"),
    mrp: z.string().trim()
      .refine((val) => val && val.trim().length > 0, "MRP is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "MRP must be a valid positive number"),
});


export function MedicineForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/medicines',
}: FormProps) {
 
  const router = useRouter();
  
  const [submitting, setSubmitting] = useState(false);
 type RawFormValues = z.infer<typeof medicineSchema>;
  const form = useForm<RawFormValues>({
    resolver: zodResolver(medicineSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
      brand: initial?.brand || '',
      rate: initial?.rate || '',
      mrp: initial?.mrp || '',
    } 
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    const apiData = {
      ...values,
      rate: parseFloat(values.rate),
      mrp: parseFloat(values.mrp),
    };
    try {
      if (mode === 'create') {
        const res = await apiPost('/api/medicines', apiData);
        toast.success('Medicine has been added');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch(`/api/medicines/${initial.id}`, apiData);
        toast.success('Medicine details have been updated');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      console.log(err);
      toast.error((err as Error).message || 'Failed to save medicine');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Medicine' : 'Edit Medicine'}</AppCard.Title>
          <AppCard.Description>{isCreate ? 'Create a new medicine' : 'Edit medicine details'}</AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Medicine details'>
              <FormRow className='grid-cols-12 gap-6'>
                <TextInput
                  control={control}
                  name='name'
                  label='Medicine Name'
                  placeholder='Medicine name'
                  required
                  itemClassName='col-span-12 md:col-span-6'
                />
                 <TextInput
                  control={control}
                  name='brand'
                  label='Brand'
                  placeholder='Brand'
                  required
                  type='text'
                  itemClassName='col-span-12 md:col-span-6'
                />
              </FormRow>
              <FormRow className='grid-cols-12'>
                <TextInput
                  control={control}
                  name='rate'
                  label='Rate'
                  placeholder='Rate'
                  type='number'
                  step='1'
                  required
                  itemClassName='col-span-12 md:col-span-6' 
                  />
                  <TextInput
                  control={control}
                  name='mrp'
                  label='MRP'
                  placeholder='MRP'
                  type='number'
                  step='1'
                  required
                  itemClassName='col-span-12 md:col-span-6'
                />
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
              {isCreate ? 'Create Medicine' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default MedicineForm;
