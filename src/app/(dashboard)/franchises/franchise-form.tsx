'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton, EmailInput, PasswordInput } from '@/components/common';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { ComboboxInput } from '@/components/common/combobox-input';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

type StatesResponse = {
  data: { id: number; state: string }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type CitiesResponse = {
  data: { id: number; city: string; stateId: number }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

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
  franchiseFeeAmount?: number;
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
    name: z.string().trim().min(1, 'Franchise Name is required'),
    addressLine1: z.string().min(1, 'Address Line 1 is required'),
    addressLine2: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    stateId: z.string().min(1, 'State is required'),
    cityId: z.string().min(1, 'City is required'),
    pincode: z.string().regex(/^[0-9]{6}$/, 'Pincode must be 6 digits'),
    contactNo: z.string().regex(/^[0-9]{10}$/, 'Contact No must be 10 digits'),
    contactEmail: z.string().email('Invalid contact email'),
    franchiseFeeAmount: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .refine((v) => v === undefined || (!isNaN(Number(v)) && Number(v) >= 0), 'Fee must be a valid number'),

    userName: z.string().trim().min(1, 'Name is required'),
    userMobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
    userEmail: z.string().email('Invalid email'),
    password: (mode === 'create'
      ? z.string().min(8, 'Password must be at least 8 characters')
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
      stateId: '',
      cityId: '',
      pincode: initial?.pincode || '',
      contactNo: initial?.contactNo || '',
      contactEmail: initial?.contactEmail || '',
      franchiseFeeAmount: initial?.franchiseFeeAmount?.toString() || '',

      userName: initial?.userName || '',
      userMobile: initial?.userMobile || '',
      userEmail: initial?.userEmail || '',
      password: '',
      status: initial?.status ?? true,
    },
  });

  const { control, handleSubmit, setError, clearErrors } = form;
  const statusValue = form.watch('status');
  const stateIdValue = form.watch('stateId');
  const cityIdValue = form.watch('cityId');
  const isCreate = mode === 'create';

  const { data: statesResp } = useSWR<StatesResponse>(
    '/api/states?page=1&perPage=100&sort=state&order=asc',
    apiGet
  );

  const { data: citiesResp } = useSWR<CitiesResponse>(
    '/api/cities?page=1&perPage=500&sort=city&order=asc',
    apiGet
  );

  const { data: feesResp } = useSWR<{ totalReceived: number }>(
    mode === 'edit' && initial?.id ? `/api/franchises/${initial.id}/fees` : null,
    apiGet
  );

  const stateOptions = useMemo(() => {
    return (statesResp?.data || []).map((s) => ({ value: String(s.id), label: s.state }));
  }, [statesResp]);

  const cityOptions = useMemo(() => {
    const all = citiesResp?.data || [];
    const filtered = stateIdValue ? all.filter((c) => String(c.stateId) === String(stateIdValue)) : [];
    return filtered.map((c) => ({ value: String(c.id), label: c.city }));
  }, [citiesResp, stateIdValue]);

  useEffect(() => {
    if (!stateIdValue) {
      if (cityIdValue) form.setValue('cityId', '');
      return;
    }
    if (!cityIdValue) return;
    const exists = cityOptions.some((c) => c.value === cityIdValue);
    if (!exists) form.setValue('cityId', '');
  }, [stateIdValue, cityIdValue, cityOptions, form]);

  useEffect(() => {
    if (!statesResp?.data?.length) return;
    if (mode === 'create') return;
    if (!initial?.state || !initial?.city) return;
 
    let currentStateId = form.getValues('stateId');
    const currentCityId = form.getValues('cityId');

    // 1) Ensure stateId is set from initial data
    if (!currentStateId) {
      const stateMatch = statesResp.data.find((s) => s.state === initial.state);
      if (!stateMatch) return;
      currentStateId = String(stateMatch.id);
      form.setValue('stateId', currentStateId, { shouldDirty: false, shouldValidate: true });
    }

    // 2) Once cities are loaded, set cityId (do not require a second visit/navigation)
    if (currentCityId) return;
    if (!citiesResp?.data?.length) return;
    const cityMatch = citiesResp.data.find(
      (c) => c.city === initial.city && String(c.stateId) === String(currentStateId)
    );
    if (!cityMatch) return;
    form.setValue('cityId', String(cityMatch.id), { shouldDirty: false, shouldValidate: true });
  }, [mode, initial, statesResp, citiesResp, form]);

  async function onSubmit(values: RawFormValues) {
    clearErrors(['name', 'userEmail']);
    setSubmitting(true);
    try {
      const stateLabel = stateOptions.find((s) => s.value === values.stateId)?.label || '';
      const cityLabel = cityOptions.find((c) => c.value === values.cityId)?.label || '';

      if (mode === 'edit' && values.franchiseFeeAmount !== undefined) {
        const fee = Number(values.franchiseFeeAmount);
        const totalReceived = Number((feesResp as any)?.totalReceived ?? 0);
        if (Number.isFinite(fee) && fee < totalReceived) {
          toast.error('Due to the fee amount the balance will go below zero');
          setError(
            'franchiseFeeAmount',
            { type: 'manual', message: 'Fee amount cannot be less than total received' },
            { shouldFocus: true }
          );
          return;
        }
      }

      if (mode === 'create') {
        const res = await apiPost('/api/franchises', {
          name: values.name,
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2 || null,
          city: cityLabel,
          state: stateLabel,
          pincode: values.pincode,
          contactNo: values.contactNo,
          contactEmail: values.contactEmail,
          franchiseFeeAmount: values.franchiseFeeAmount ? Number(values.franchiseFeeAmount) : undefined,

          userName: values.userName,
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
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2 || null,
          city: cityLabel,
          state: stateLabel,
          pincode: values.pincode,
          contactNo: values.contactNo,
          contactEmail: values.contactEmail,
          franchiseFeeAmount: values.franchiseFeeAmount ? Number(values.franchiseFeeAmount) : undefined,

          userName: values.userName,
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
      const e = err as Error & { status?: number };
      if (e?.status === 409) {
        const msg = e.message || '';
        if (msg.toLowerCase().includes('franchise name')) {
          setError('name', { type: 'server', message: msg || 'Franchise name already exists' }, { shouldFocus: true });
          return;
        }
        if (msg.toLowerCase().includes('email')) {
          setError('userEmail', { type: 'server', message: msg || 'Email already exists' }, { shouldFocus: true });
          return;
        }
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
          <AppCard.Title>{isCreate ? 'Create Franchise' : 'Edit Franchise'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new franchise.' : 'Update franchise details or set a new password.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Franchise Details'>
              <FormRow>
                <TextInput control={control} name='name' label='Franchise Name' required placeholder='Franchise name' />
              </FormRow>
              <FormRow>
                <TextInput
                  control={control}
                  name='franchiseFeeAmount'
                  label='Franchise Fee Amount'
                  placeholder='0'
                  type='number'
                  itemClassName='col-span-12 md:col-span-6'
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='addressLine1' label='Address Line 1' required placeholder='Address line 1' />
                <TextInput control={control} name='addressLine2' label='Address Line 2' placeholder='Address line 2' />
              </FormRow>
              <FormRow cols={3}>
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
                <ComboboxInput
                  control={control}
                  name='cityId'
                  label='City'
                  options={cityOptions}
                  placeholder={stateIdValue ? 'Select city' : 'Select state first'}
                  searchPlaceholder='Search cities...'
                  emptyText={stateIdValue ? 'No city found.' : 'Select state first'}
                  required
                />
                <TextInput
                  control={control}
                  name='pincode'
                  label='Pincode'
                  required
                  placeholder='Pincode'
                  type='tel'
                  inputMode='numeric'
                  maxLength={6}
                  pattern='[0-9]{6}'
                  onInput={(e) => {
                    const input = e.currentTarget;
                    const onlyDigits = (input.value || '').replace(/\D+/g, '').slice(0, 6);
                    if (onlyDigits !== input.value) {
                      input.value = onlyDigits;
                    }
                    form.setValue('pincode', onlyDigits, { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name='contactNo'
                  label='Contact No'
                  required
                  placeholder='Contact number'
                  type='tel'
                  maxLength={10}
                  pattern='[0-9]{10}'
                />
                <EmailInput control={control} name='contactEmail' label='Contact Email' required placeholder='contact@example.com' />
              </FormRow>
            </FormSection>

            <FormSection legend='Login Details'>
              <FormRow>
                <TextInput control={control} name='userName' label='Name' required placeholder='Enter Full name' />
              </FormRow>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name='userMobile'
                  label='Mobile'
                  required
                  placeholder='Enter Mobile number'
                  type='tel'
                  maxLength={10}
                  pattern='[0-9]{10}'
                />
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
