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

export interface TeamFormInitialData {
  id?: number;
  name?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  userName?: string | null;
  userMobile?: string;
  email?: string;
  status?: boolean;
  joiningDate?: string | null;
  leavingDate?: string | null;
  role?: 'FRANCHISE' | 'DOCTOR';
}

export interface TeamFormProps {
  mode: 'create' | 'edit';
  initial?: TeamFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/teams'
}

export function TeamForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/teams',
}: TeamFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({
    name: z.string().min(1, 'Team Name is required').max(255, 'Team Name must be less than 255 characters'),
    addressLine1: z.string().min(1, 'Address Line 1 is required').max(500, 'Address Line 1 must be less than 500 characters'),
    addressLine2: z.string().max(500, 'Address Line 2 must be less than 500 characters').nullable().optional(),
    stateId: z.string().min(1, 'State is required'),
    cityId: z.string().min(1, 'City is required'),
    pincode: z.string().regex(/^[0-9]{6}$/, 'Pincode must be exactly 6 digits'),
    joiningDate: z.string().nullable().optional(),
    leavingDate: z.string().nullable().optional(),
    role: z.enum(['FRANCHISE', 'DOCTOR'], {
      required_error: 'Role is required',
      invalid_type_error: 'Role must be either FRANCHISE or DOCTOR',
    }),
    userMobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
    email: z.string().email('Invalid email').max(255, 'Email must be less than 255 characters'),
    password: (mode === 'create'
      ? z.string().min(8, "Password must be at least 8 characters long").max(255, "Password must be less than 255 characters")
      : z.string().optional().refine(val => !val || val.trim().length === 0 || val.length >= 8, {
          message: "Password must be at least 8 characters long"
        })
    ),

    status: z.boolean().default(true),
  });

  type RawFormValues = z.infer<typeof schema>;

  const form = useForm<RawFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
      addressLine1: initial?.addressLine1 || '',
      addressLine2: initial?.addressLine2 || null,
      stateId: '',
      cityId: '',
      pincode: initial?.pincode || '',
      joiningDate: initial?.joiningDate || null,
      leavingDate: initial?.leavingDate || null,
      role: initial?.role || 'FRANCHISE',
      email: initial?.email || '',
      userMobile: initial?.userMobile || '',
      password: '',
      status: initial?.status ?? true,
    },
  });

  const { control, handleSubmit } = form;
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

  const roleOptions = [
    { value: 'FRANCHISE', label: 'Franchise Admin' },
    { value: 'DOCTOR', label: 'Doctor' },
  ];

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
    if (form.getValues('stateId')) return;

    const stateMatch = statesResp.data.find((s) => s.state === initial.state);
    if (!stateMatch) return;
    form.setValue('stateId', String(stateMatch.id), { shouldDirty: false, shouldValidate: true });

    const cityMatch = (citiesResp?.data || []).find(
      (c) => c.city === initial.city && String(c.stateId) === String(stateMatch.id)
    );
    if (!cityMatch) return;
    form.setValue('cityId', String(cityMatch.id), { shouldDirty: false, shouldValidate: true });
  }, [mode, initial, statesResp, citiesResp, form]);

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    try {
      const stateLabel = stateOptions.find((s) => s.value === values.stateId)?.label || '';
      const cityLabel = cityOptions.find((c) => c.value === values.cityId)?.label || '';

      if (mode === 'create') {
        const res = await apiPost('/api/teams', {
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
          role: values.role,
          status: values.status,
          addressLine1: values.addressLine1.trim(),
          addressLine2: values.addressLine2?.trim() || null,
          city: cityLabel.trim(),
          state: stateLabel.trim(),
          pincode: values.pincode.trim(),
          userMobile: values.userMobile.trim(),
          joiningDate: values.joiningDate ? new Date(values.joiningDate).toISOString() : null,
          leavingDate: values.leavingDate ? new Date(values.leavingDate).toISOString() : null,
        });
        toast.success('Team created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/teams', {
          id: initial.id,
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          role: values.role,
          status: values.status,
          addressLine1: values.addressLine1.trim(),
          addressLine2: values.addressLine2?.trim() || null,
          city: cityLabel.trim(),
          state: stateLabel.trim(),
          pincode: values.pincode.trim(),
          userMobile: values.userMobile.trim(),
          joiningDate: values.joiningDate ? new Date(values.joiningDate).toISOString() : null,
          leavingDate: values.leavingDate ? new Date(values.leavingDate).toISOString() : null,
          password: values.password?.trim() || undefined,
        });
        toast.success('Team updated');
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
          <AppCard.Title>{isCreate ? 'Create Team' : 'Edit Team'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new team.' : 'Update team details or set a new password.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Team Details'>
              <FormRow>
                <TextInput control={control} name='name' label='Name' required placeholder='Team name' />
               
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='addressLine1' label='Address Line 1' required placeholder='Address line 1' />
                <TextInput control={control} name='addressLine2' label='Address Line 2' placeholder='Address line 2' />
              </FormRow>
              <div className='flex flex-col lg:flex-row gap-6'>
                <div className='flex-1'>
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
                </div>
                <div className='flex-1'>
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
                </div>
                <div className='flex-1'>
                  <TextInput control={control} name='pincode' label='Pincode' required placeholder='Pincode' />
                </div>
              </div>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name='joiningDate'
                  label='Joining Date'
                  placeholder='YYYY-MM-DD (optional)'
                  type='date'
                />
                <TextInput
                  control={control}
                  name='leavingDate'
                  label='Leaving Date'
                  placeholder='YYYY-MM-DD (optional)'
                  type='date'
                />
              </FormRow>
            </FormSection>

            <FormSection legend='Login Details'>
              <FormRow cols={2}>
                 <EmailInput control={control} name='email' label='Email' required placeholder='user@example.com' />
                 <ComboboxInput
                  control={control}
                  name='role'
                  label='Role'
                  options={roleOptions}
                  placeholder='Select role'
                  searchPlaceholder='Search roles...'
                  emptyText='No role found.'
                  required
                />
              </FormRow>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name='userMobile'
                  label='Mobile'
                  required
                  placeholder='Mobile number'
                  type='tel'
                  maxLength={10}
                  pattern='[0-9]{10}'
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                  }}
                />
                 <PasswordInput
                  control={control}
                  name='password'
                  label={isCreate ? 'Password' : 'New Password'}
                  placeholder={isCreate ? 'Secret password' : 'Leave blank to keep current'}
                  autoComplete='new-password'
                />
              </FormRow>
              <FormRow cols={2}>
               
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
              {isCreate ? 'Create Team' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default TeamForm;
