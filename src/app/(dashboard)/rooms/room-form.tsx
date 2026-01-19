'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common/app-button';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import TextareaInput from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';


export interface RoomFormInitialData {
  id?: number;
  name?: string;
  description?: string | null;
}

export interface RoomFormProps {
  mode: 'create' | 'edit';
  initial?: RoomFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/rooms'
}


export function RoomForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/rooms',
}: RoomFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(1, 'Room name is required').max(255, 'Room name must be less than 255 characters'),
    description: z.string().optional().nullable().transform((v) => v === '' ? null : v),
  });

  type RawFormValues = z.infer<typeof schema>;

  const form = useForm<RawFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
      description: initial?.description || '',
    },
  });

  const { control, handleSubmit, setError, clearErrors } = form;
  const isCreate = mode === 'create';

  async function onSubmit(values: RawFormValues) {
    clearErrors('name');
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || null,
      };

      if (mode === 'create') {
        const res = await apiPost('/api/rooms', payload);
        toast.success('Room created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/rooms', {
          id: initial.id,
          ...payload,
        });
        toast.success('Room updated');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e?.status === 409) {
        setError('name', { type: 'server', message: e.message || 'Room name already exists' }, { shouldFocus: true });
        return;
      }
      toast.error((err as Error).message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Room' : 'Edit Room'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new room.' : 'Update room details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Room Details'>
              <FormRow cols={1}>
                <TextInput 
                  control={control} 
                  name='name' 
                  label='Room Name' 
                  required 
                  placeholder='Enter room name' 
                />
              </FormRow>
              <FormRow cols={1}>
                <TextareaInput 
                  control={control} 
                  name='description' 
                  label='Description' 
                  placeholder='Enter room description (optional)' 
                  rows={3} 
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
              {isCreate ? 'Create Room' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default RoomForm;
