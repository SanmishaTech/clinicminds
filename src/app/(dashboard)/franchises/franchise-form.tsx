'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton, EmailInput, PasswordInput, ImprovedUploadInput } from '@/components/common';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export interface FranchiseFormInitialData {
  id?: number;
  name?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  contactNo?: string;
  contactEmail?: string;
  logoUrl?: string | null;
  userName?: string | null;
  userMobile?: string;
  userEmail?: string;
  status?: boolean;
}

export interface FranchiseFormProps {
  mode: 'create' | 'edit';
  initial?: FranchiseFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/franchises'
}

export function FranchiseForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/franchises',
}: FranchiseFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    name: z.string().min(1, 'Franchise Name is required'),
    addressLine1: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    addressLine2: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    pincode: z.string().min(1, 'Pincode is required'),
    contactNo: z.string().min(1, 'Contact No is required'),
    contactEmail: z.string().email('Invalid contact email'),
    logoUrl: z.string().nullable().optional(),

    userName: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    userMobile: z.string().min(1, 'Mobile is required'),
    userEmail: z.string().email('Invalid email'),
    password: (mode === 'create'
      ? z.string().min(6, 'Password must be at least 6 characters')
      : z.string().optional()
    ).transform((v) => (v === '' ? undefined : v)),

    status: z.boolean(),
  });

  type RawFormValues = z.infer<typeof schema>;

  const form = useForm<RawFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
      addressLine1: initial?.addressLine1 || '',
      addressLine2: initial?.addressLine2 || '',
      city: initial?.city || '',
      state: initial?.state || '',
      pincode: initial?.pincode || '',
      contactNo: initial?.contactNo || '',
      contactEmail: initial?.contactEmail || '',
      logoUrl: initial?.logoUrl ?? null,

      userName: initial?.userName || '',
      userMobile: initial?.userMobile || '',
      userEmail: initial?.userEmail || '',
      password: '',
      status: initial?.status ?? true,
    },
  });

  const { control, handleSubmit } = form;
  const statusValue = form.watch('status');
  const isCreate = mode === 'create';

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await apiPost('/api/franchises', {
          name: values.name,
          addressLine1: values.addressLine1 || null,
          addressLine2: values.addressLine2 || null,
          city: values.city,
          state: values.state,
          pincode: values.pincode,
          contactNo: values.contactNo,
          contactEmail: values.contactEmail,
          logoUrl: values.logoUrl || null,

          userName: values.userName || null,
          userMobile: values.userMobile,
          userEmail: values.userEmail,
          password: values.password,
          status: values.status,
        });
        toast.success('Franchise created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/franchises', {
          id: initial.id,
          name: values.name,
          addressLine1: values.addressLine1 || null,
          addressLine2: values.addressLine2 || null,
          city: values.city,
          state: values.state,
          pincode: values.pincode,
          contactNo: values.contactNo,
          contactEmail: values.contactEmail,
          logoUrl: values.logoUrl || null,

          userName: values.userName || null,
          userMobile: values.userMobile,
          userEmail: values.userEmail,
          password: values.password || undefined,
          status: values.status,
        });
        toast.success('Franchise updated');
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
          <AppCard.Title>{isCreate ? 'Create Franchise' : 'Edit Franchise'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new franchise.' : 'Update franchise details or set a new password.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Franchise Details'>
              <FormRow cols={2}>
                <TextInput control={control} name='name' label='Franchise Name' required placeholder='Franchise name' />
                <ImprovedUploadInput
                  control={control}
                  name='logoUrl'
                  label='Logo Details'
                  type='image'
                  prefix='franchise'
                  showPreview
                  existingUrl={initial?.logoUrl ?? null}
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='addressLine1' label='Address Line 1' placeholder='Address line 1' />
                <TextInput control={control} name='addressLine2' label='Address Line 2' placeholder='Address line 2' />
              </FormRow>
              <FormRow cols={3}>
                <TextInput control={control} name='city' label='City' required placeholder='City' />
                <TextInput control={control} name='state' label='State' required placeholder='State' />
                <TextInput control={control} name='pincode' label='Pincode' required placeholder='Pincode' />
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='contactNo' label='Contact No' required placeholder='Contact number' />
                <EmailInput control={control} name='contactEmail' label='Contact Email' required placeholder='contact@example.com' />
              </FormRow>
            </FormSection>

            <FormSection legend='Login Details'>
              <FormRow>
                <TextInput control={control} name='userName' label='Name' placeholder='Optional full name' />
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='userMobile' label='Mobile' required placeholder='Mobile number' />
                <EmailInput control={control} name='userEmail' label='Email' required placeholder='user@example.com' />
              </FormRow>
              <FormRow cols={2}>
                <PasswordInput
                  control={control}
                  name='password'
                  label={isCreate ? 'Password' : 'New Password'}
                  placeholder={isCreate ? 'Secret password' : 'Leave blank to keep current'}
                  autoComplete='new-password'
                />
                <AppCheckbox
                  label='Active Status'
                  checked={statusValue}
                  onCheckedChange={(v) => form.setValue('status', v)}
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
              {isCreate ? 'Create Franchise' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default FranchiseForm;
