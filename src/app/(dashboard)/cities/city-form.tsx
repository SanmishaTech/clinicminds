'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common/app-button';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { ComboboxInput } from '@/components/common/combobox-input';

type StatesResponse = {
  data: { id: number; state: string }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export interface CityFormInitialData {
  id?: number;
  city?: string;
  stateId?: number;
}

export interface CityFormProps {
  mode: 'create' | 'edit';
  initial?: CityFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/cities'
}

export function CityForm({ mode, initial, onSuccess, redirectOnSuccess = '/cities' }: CityFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    stateId: z.string().min(1, 'State is required'),
    city: z.string().min(1, 'City is required'),
  });

  type RawFormValues = z.infer<typeof schema>;

  const form = useForm<RawFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      stateId: initial?.stateId ? String(initial.stateId) : '',
      city: initial?.city || '',
    },
  });

  const { data: statesResp } = useSWR<StatesResponse>(
    '/api/states?page=1&perPage=100&sort=state&order=asc',
    apiGet
  );

  const stateOptions = useMemo(() => {
    return (statesResp?.data || []).map((s) => ({ value: String(s.id), label: s.state }));
  }, [statesResp]);

  const { control, handleSubmit } = form;
  const isCreate = mode === 'create';

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await apiPost('/api/cities', {
          city: values.city,
          stateId: Number(values.stateId),
        });
        toast.success('City created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/cities', {
          id: initial.id,
          city: values.city,
          stateId: Number(values.stateId),
        });
        toast.success('City updated');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create City' : 'Edit City'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new city.' : 'Update city details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='City Details'>
              <FormRow cols={2}>
                <ComboboxInput
                  control={control}
                  name='stateId'
                  label='State'
                  options={stateOptions}
                  placeholder='Select state'
                  searchPlaceholder='Search states...'
                  emptyText='No state found.'
                  required
                />
                <TextInput control={control} name='city' label='City' required placeholder='City name' />
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
              {isCreate ? 'Create City' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default CityForm;
