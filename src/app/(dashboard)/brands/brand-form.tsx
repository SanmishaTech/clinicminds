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

export interface BrandFormInitialData {
  id?: number;
  name?: string;
}

export interface FormProps {
  mode: 'create' | 'edit';
  initial?: BrandFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/brands'
}

export const brandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(100, 'Brand name must be less than 100 characters'),
});

export function BrandForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/brands',
}: FormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  type RawFormValues = z.infer<typeof brandSchema>;
  const form = useForm<RawFormValues>({
    resolver: zodResolver(brandSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
    },
  });

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await apiPost('/api/brands', values);
        toast.success('Brand has been added');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/brands', { id: initial.id, ...values });
        toast.success('Brand details have been updated');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save brand');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Brand' : 'Edit Brand'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new brand.' : 'Update brand details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Brand Details'>
              <FormRow cols={1}>
                <TextInput control={control} name='name' label='Brand Name' required placeholder='Brand name' />
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
              {isCreate ? 'Create Brand' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default BrandForm;
