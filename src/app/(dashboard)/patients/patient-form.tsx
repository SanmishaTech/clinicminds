'use client';

import { useMemo, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common/app-button';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import TextareaInput from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { ComboboxInput } from '@/components/common/combobox-input';
import { SelectInput } from '@/components/common/select-input';
import { EmailInput } from '@/components/common/email-input';
import { MASTER_CONFIG } from '@/config/master';
import { formatDateForInput } from '@/lib/locales';

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

export interface PatientFormInitialData {
  id?: number;
  patientNo?: string;
  team?: string;
  name?: string;
  dateOfBirth?: string | null;
  age?: number | null;
  gender?: string;
  status?: string;
  address?: string | null;
  stateId?: number;
  cityId?: number;
  pincode?: string | null;
  mobile1?: string;
  mobile2?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  contactPersonRelation?: string | null;
  contactPersonMobile1?: string | null;
  contactPersonMobile2?: string | null;
  balanceAmount?: number | null;
}

export interface PatientFormProps {
  mode: 'create' | 'edit';
  initial?: PatientFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/patients'
}

const GENDER_OPTIONS = MASTER_CONFIG.gender.map((g) => ({ value: g.value, label: g.label }));

export function PatientForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/patients',
}: PatientFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  function computeAgeFromDateInput(dateStr: string): number | null {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const today = new Date();
    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth() + 1; // 1-12
    const thisDay = today.getDate();

    let age = thisYear - year;
    if (thisMonth < month || (thisMonth === month && thisDay < day)) age -= 1;
    if (age < 0) return null;
    return age;
  }

  const schema = z.object({
    patientNo: z.string().optional(),
    team: z.string().min(1, 'Team is required'),
    name: z.string().min(1, 'Name is required'),
    dateOfBirth: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    age: z
      .string()
      .min(1, 'Age is required')
      .refine((v) => {
        const n = Number(v);
        return Number.isFinite(n) && !Number.isNaN(n) && n >= 0;
      }, 'Invalid age'),
    gender: z.string().min(1, 'Gender is required'),
    status: z.string().min(1, 'Status is required'),

    address: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    stateId: z.string().min(1, 'State is required'),
    cityId: z.string().min(1, 'City is required'),

    pincode: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    mobile1: z.string().min(1, 'Mobile 1 is required'),
    mobile2: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    email: z
      .string()
      .email('Invalid email')
      .or(z.literal(''))
      .transform((v) => (v === '' ? undefined : v)),

    contactPerson: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    contactPersonRelation: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    contactPersonMobile1: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    contactPersonMobile2: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    balanceAmount: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  });

  type RawFormValues = z.infer<typeof schema>;

  const form = useForm<RawFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      patientNo: initial?.patientNo || '',
      team: initial?.team || '',
      name: initial?.name || '',
      dateOfBirth: initial?.dateOfBirth ? formatDateForInput(initial.dateOfBirth) : '',
      age: initial?.age != null ? String(initial.age) : '',
      gender: initial?.gender || '',
      status: initial?.status || 'Active',
      address: initial?.address || '',
      stateId: initial?.stateId ? String(initial.stateId) : '',
      cityId: initial?.cityId ? String(initial.cityId) : '',
      pincode: initial?.pincode || '',
      mobile1: initial?.mobile1 || '',
      mobile2: initial?.mobile2 || '',
      email: initial?.email || '',
      contactPerson: initial?.contactPerson || '',
      contactPersonRelation: initial?.contactPersonRelation || '',
      contactPersonMobile1: initial?.contactPersonMobile1 || '',
      contactPersonMobile2: initial?.contactPersonMobile2 || '',
      balanceAmount: initial?.balanceAmount != null ? String(initial.balanceAmount) : '',
    },
  });

  const { control, handleSubmit } = form;
  const dateOfBirthValue = form.watch('dateOfBirth');
  const stateIdValue = form.watch('stateId');
  const cityIdValue = form.watch('cityId');
  const isCreate = mode === 'create';

  useEffect(() => {
    if (!dateOfBirthValue) return;
    const computed = computeAgeFromDateInput(dateOfBirthValue);
    if (computed === null) return;
    form.setValue('age', String(computed), { shouldDirty: true, shouldValidate: true });
  }, [dateOfBirthValue, form]);

  const { data: statesResp } = useSWR<StatesResponse>(
    '/api/states?page=1&perPage=100&sort=state&order=asc',
    apiGet
  );

  const { data: citiesResp } = useSWR<CitiesResponse>(
    '/api/cities?page=1&perPage=100&sort=city&order=asc',
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

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    try {
      const payload = {
        team: values.team,
        name: values.name,
        dateOfBirth: values.dateOfBirth || null,
        age: values.age,
        gender: values.gender,
        status: values.status,
        address: values.address || null,
        stateId: Number(values.stateId),
        cityId: Number(values.cityId),
        pincode: values.pincode || null,
        mobile1: values.mobile1,
        mobile2: values.mobile2 || null,
        email: values.email || null,
        contactPerson: values.contactPerson || null,
        contactPersonRelation: values.contactPersonRelation || null,
        contactPersonMobile1: values.contactPersonMobile1 || null,
        contactPersonMobile2: values.contactPersonMobile2 || null,
        balanceAmount: values.balanceAmount || null,
      };

      if (mode === 'create') {
        const res = await apiPost('/api/patients', payload);
        toast.success('Patient created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/patients', {
          id: initial.id,
          ...payload,
        });
        toast.success('Patient updated');
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
          <AppCard.Title>{isCreate ? 'Create Patient' : 'Edit Patient'}</AppCard.Title>
          <AppCard.Description>
            {isCreate ? 'Add a new patient.' : 'Update patient details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Patient Details'>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name='patientNo'
                  label='Patient No'
                  placeholder={isCreate ? 'Auto-generated' : 'Patient number'}
                  disabled
                />
                <TextInput control={control} name='team' label='Team' required placeholder='Team' />
              </FormRow>
              <FormRow cols={3}>
                <TextInput control={control} name='name' label='Name' required placeholder='Patient name' />
                <TextInput control={control} name='dateOfBirth' label='Date of Birth' type='date' />
                <TextInput control={control} name='age' label='Age' required type='number' min={0} />
              </FormRow>
              <FormRow cols={3}>
                <SelectInput
                  control={control}
                  name='gender'
                  label='Gender'
                  placeholder='Select gender'
                  options={GENDER_OPTIONS}
                  required
                />
                <TextInput control={control} name='status' label='Status' required placeholder='Status' />
              </FormRow>
            </FormSection>

            <FormSection legend='Address Details'>
              <FormRow cols={1}>
                <TextareaInput control={control} name='address' label='Address' placeholder='Address' rows={3} />
              </FormRow>
              <FormRow cols={3}>
                <ComboboxInput
                  control={control as any}
                  name={'stateId' as any}
                  label='State'
                  options={stateOptions}
                  placeholder='Select state'
                  searchPlaceholder='Search states...'
                  emptyText='No state found.'
                  required
                />
                <ComboboxInput
                  control={control as any}
                  name={'cityId' as any}
                  label='City'
                  options={cityOptions}
                  placeholder={stateIdValue ? 'Select city' : 'Select state first'}
                  searchPlaceholder='Search cities...'
                  emptyText={stateIdValue ? 'No city found.' : 'Select a state first.'}
                  required
                />
                <TextInput control={control} name='pincode' label='Pincode' placeholder='Pincode' />
              </FormRow>
            </FormSection>

            <FormSection legend='Contact Details'>
              <FormRow cols={3}>
                <TextInput control={control} name='mobile1' label='Mobile 1' required placeholder='Mobile number' />
                <TextInput control={control} name='mobile2' label='Mobile 2' placeholder='Alternate mobile' />
                <EmailInput control={control} name='email' label='Email' placeholder='email@example.com' />
              </FormRow>
            </FormSection>

            <FormSection legend='Contact Person Details'>
              <FormRow cols={3}>
                <TextInput control={control} name='contactPerson' label='Contact Person' placeholder='Contact person' />
                <TextInput control={control} name='contactPersonRelation' label='Relation' placeholder='Relation' />
                <TextInput control={control} name='contactPersonMobile1' label='Mobile 1' placeholder='Mobile number' />
              </FormRow>
              <FormRow cols={3}>
                <TextInput control={control} name='contactPersonMobile2' label='Mobile 2' placeholder='Alternate mobile' />
              </FormRow>
            </FormSection>

            <FormSection legend='Balance'>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name='balanceAmount'
                  label='Balance Amount'
                  type='number'
                  step={0.01}
                  min={0}
                  placeholder='0'
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
              {isCreate ? 'Create Patient' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default PatientForm;
