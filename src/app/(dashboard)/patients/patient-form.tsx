'use client';

import { useMemo, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
import { ImprovedUploadInput } from '@/components/common';
import { MASTER_CONFIG } from '@/config/master';
import { formatDateForInput } from '@/lib/locales';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Info, Plus, Trash2 } from 'lucide-react';

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

type TeamsResponse = {
  data: { id: number; name: string }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type LabsResponse = {
  data: { id: number; name: string }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export interface PatientFormInitialData {
  id?: number;
  patientNo?: string;
  franchiseId?: number | null;
  teamId?: number | null;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  age: number;
  gender?: string;
  bloodGroup?: string;
  height?: string | null;
  weight?: string | null;
  bmi?: string | null;
  address?: string;
  stateId?: number | null;
  cityId?: number | null;
  pincode?: string | null;
  mobile?: string;
  mobile2?: string | null;
  email?: string | null;
  aadharNo?: string;
  occupation?: string | null;
  maritalStatus?: string | null;
  contactPersonName?: string | null;
  contactPersonRelation?: string | null;
  contactPersonAddress?: string | null;
  contactPersonMobile?: string | null;
  contactPersonEmail?: string | null;
  medicalInsurance?: boolean;
  primaryInsuranceName?: string | null;
  primaryInsuranceHolderName?: string | null;
  primaryInsuranceId?: string | null;
  secondaryInsuranceName?: string | null;
  secondaryInsuranceHolderName?: string | null;
  secondaryInsuranceId?: string | null;
  balanceAmount?: number | null;
  labId?: number | null;
  referredBy?: string | null;
  patientReports?: {
    id?: number;
    name?: string | null;
    url?: string | null;
  }[];
}

export interface PatientFormProps {
  mode: 'create' | 'edit';
  initial?: PatientFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/patients'
}

const GENDER_OPTIONS = MASTER_CONFIG.gender.map((g) => ({ value: g.value, label: g.label }));
const BLOOD_GROUP_OPTIONS = MASTER_CONFIG.bloodGroup.map((b) => ({ value: b.value, label: b.label }));
const MARITAL_STATUS_OPTIONS = MASTER_CONFIG.maritalStatus.map((m) => ({ value: m.value, label: m.label }));

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

  function computeBmiFromInputs(heightStr: string | undefined, weightStr: string | undefined): string | null {
    const hRaw = (heightStr || '').trim();
    const wRaw = (weightStr || '').trim();
    if (!hRaw || !wRaw) return null;

    const h = Number(String(hRaw).replace(/[^0-9.]/g, ''));
    const w = Number(String(wRaw).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return null;

    // Height is expected in centimeters; convert to meters for BMI.
    const hMeters = h / 100;
    if (hMeters <= 0) return null;

    const bmi = w / (hMeters * hMeters);
    if (!Number.isFinite(bmi) || Number.isNaN(bmi)) return null;
    return bmi.toFixed(2);
  }

  const schema = z.object({
    patientNo: z.string().optional(),
    teamId: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().min(1, 'Middle name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    age: z
      .string()
      .min(1, 'Age is required')
      .refine(
        (v) => {
          const n = Number(v);
          return Number.isFinite(n) && !Number.isNaN(n) && n >= 0;
        },
        'Invalid age'
      ),
    gender: z.string().min(1, 'Gender is required'),
    bloodGroup: z.string().min(1, 'Blood group is required'),

    height: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    weight: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    bmi: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    address: z.string().min(1, 'Address is required'),

    stateId: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    cityId: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    pincode: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .refine(
        (v) => {
          if (!v) return true;
          return /^[0-9]{6}$/.test(v);
        },
        'Pincode must be exactly 6 digits'
      ),
    mobile: z
      .string()
      .min(1, 'Mobile is required')
      .regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),

    mobile2: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .refine(
        (v) => {
          if (!v) return true;
          return /^[0-9]{10}$/.test(v);
        },
        'Mobile2 must be 10 digits'
      ),

    email: z
      .string()
      .email('Invalid email')
      .or(z.literal(''))
      .transform((v) => (v === '' ? undefined : v)),

    aadharNo: z
      .string()
      .min(1, 'Aadhar No is required')
      .regex(/^[0-9]{12}$/, 'Aadhar No must be 12 digits'),

    occupation: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    maritalStatus: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    contactPersonName: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    contactPersonRelation: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    contactPersonAddress: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    contactPersonMobile: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v))
      .refine((v) => !v || /^[0-9]{10}$/.test(v), 'Contact Person Mobile must be 10 digits'),
    contactPersonEmail: z
      .string()
      .email('Invalid email')
      .or(z.literal(''))
      .transform((v) => (v === '' ? undefined : v)),

    medicalInsurance: z.boolean().optional(),
    primaryInsuranceName: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    primaryInsuranceHolderName: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    primaryInsuranceId: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    secondaryInsuranceName: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    secondaryInsuranceHolderName: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    secondaryInsuranceId: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    balanceAmount: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    labId: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    referredBy: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    patientReports: z
      .array(
        z.object({
          name: z.string().optional().transform((v) => (v === '' ? undefined : v)),
          url: z.string().optional().transform((v) => (v === '' ? undefined : v)),
        })
      )
      .optional(),
  });

  type RawFormValues = z.infer<typeof schema>;

  const form = useForm<RawFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      patientNo: initial?.patientNo || '',
      teamId: initial?.teamId != null ? String(initial.teamId) : '',
      firstName: initial?.firstName || '',
      middleName: initial?.middleName || '',
      lastName: initial?.lastName || '',
      dateOfBirth: initial?.dateOfBirth ? formatDateForInput(initial.dateOfBirth) : '',
      age: initial?.age != null ? String(initial.age) : '',
      gender: initial?.gender || '',
      bloodGroup: initial?.bloodGroup || undefined,
      height: initial?.height || '',
      weight: initial?.weight || '',
      bmi: initial?.bmi || '',
      address: initial?.address || '',
      stateId: initial?.stateId ? String(initial.stateId) : '',
      cityId: initial?.cityId ? String(initial.cityId) : '',
      pincode: initial?.pincode || '',
      mobile: initial?.mobile || '',
      mobile2: initial?.mobile2 || '',
      email: initial?.email || '',
      aadharNo: initial?.aadharNo || '',
      occupation: initial?.occupation || '',
      maritalStatus: initial?.maritalStatus || undefined,
      contactPersonName: initial?.contactPersonName || '',
      contactPersonRelation: initial?.contactPersonRelation || '',
      contactPersonAddress: initial?.contactPersonAddress || '',
      contactPersonMobile: initial?.contactPersonMobile || '',
      contactPersonEmail: initial?.contactPersonEmail || '',
      medicalInsurance: initial?.medicalInsurance ?? false,
      primaryInsuranceName: initial?.primaryInsuranceName || '',
      primaryInsuranceHolderName: initial?.primaryInsuranceHolderName || '',
      primaryInsuranceId: initial?.primaryInsuranceId || '',
      secondaryInsuranceName: initial?.secondaryInsuranceName || '',
      secondaryInsuranceHolderName: initial?.secondaryInsuranceHolderName || '',
      secondaryInsuranceId: initial?.secondaryInsuranceId || '',
      balanceAmount: initial?.balanceAmount != null ? String(initial.balanceAmount) : '',
      labId: initial?.labId != null ? String(initial.labId) : '',
      referredBy: initial?.referredBy || '',
      patientReports: initial?.patientReports?.map((report) => ({
        name: report.name || '',
        url: report.url || '',
      })) || [{ name: '', url: '' }],
    },
  });

  const { control, handleSubmit } = form;
  const dateOfBirthValue = form.watch('dateOfBirth');
  const heightValue = form.watch('height');
  const weightValue = form.watch('weight');
  const stateIdValue = form.watch('stateId');
  const cityIdValue = form.watch('cityId');
  const medicalInsuranceValue = form.watch('medicalInsurance');
  const isCreate = mode === 'create';

  const {
    fields: reportFields,
    append: appendReport,
    remove: removeReport,
  } = useFieldArray({
    control,
    name: 'patientReports',
  });

  useEffect(() => {
    if (!dateOfBirthValue) return;
    const computed = computeAgeFromDateInput(dateOfBirthValue);
    if (computed === null) return;
    form.setValue('age', String(computed), { shouldDirty: true, shouldValidate: true });
  }, [dateOfBirthValue, form]);

  useEffect(() => {
    const computed = computeBmiFromInputs(heightValue, weightValue);
    const current = String(form.getValues('bmi') ?? '');
    const next = computed ?? '';
    if (current === next) return;
    form.setValue('bmi', next, { shouldDirty: true, shouldValidate: true });
  }, [heightValue, weightValue, form]);

  const { data: statesResp } = useSWR<StatesResponse>(
    '/api/states?page=1&perPage=100&sort=state&order=asc',
    apiGet
  );

  const { data: citiesResp } = useSWR<CitiesResponse>(
    '/api/cities?page=1&perPage=100&sort=city&order=asc',
    apiGet
  );

  const { data: teamsResp } = useSWR<TeamsResponse>(
    '/api/teams?page=1&perPage=100&sort=name&order=asc',
    apiGet
  );

  const { data: labsResp } = useSWR<LabsResponse>(
    '/api/labs?page=1&perPage=100&sort=name&order=asc',
    apiGet
  );

  const stateOptions = useMemo(() => {
    return (statesResp?.data || []).map((s) => ({ value: String(s.id), label: s.state }));
  }, [statesResp]);

  const cityOptions = useMemo(() => {
    return (citiesResp?.data || []).map((c) => ({ value: String(c.id), label: c.city }));
  }, [citiesResp]);

  const teamOptions = useMemo(() => {
    return (teamsResp?.data || []).map((t) => ({ value: String(t.id), label: t.name }));
  }, [teamsResp]);

  const labOptions = useMemo(() => {
    return (labsResp?.data || []).map((l) => ({ value: String(l.id), label: l.name }));
  }, [labsResp]);

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
    if (medicalInsuranceValue) return;
    form.setValue('primaryInsuranceName', '');
    form.setValue('primaryInsuranceHolderName', '');
    form.setValue('primaryInsuranceId', '');
    form.setValue('secondaryInsuranceName', '');
    form.setValue('secondaryInsuranceHolderName', '');
    form.setValue('secondaryInsuranceId', '');
  }, [medicalInsuranceValue, form]);

  async function onSubmit(values: RawFormValues) {
    setSubmitting(true);
    try {
      const hasInsurance = values.medicalInsurance ?? false;
      const payload = {
        teamId: values.teamId ? Number(values.teamId) : null,
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        dateOfBirth: values.dateOfBirth || null,
        age: Number(values.age),
        gender: values.gender,
        bloodGroup: values.bloodGroup,
        height: values.height || null,
        weight: values.weight || null,
        bmi: values.bmi || null,
        referredBy: values.referredBy || null,
        address: values.address,
        stateId: values.stateId ? Number(values.stateId) : undefined,
        cityId: values.cityId ? Number(values.cityId) : undefined,
        pincode: values.pincode || null,
        mobile: values.mobile,
        mobile2: values.mobile2 || null,
        email: values.email || null,
        aadharNo: values.aadharNo,
        occupation: values.occupation || null,
        maritalStatus: values.maritalStatus || null,
        contactPersonName: values.contactPersonName || null,
        contactPersonRelation: values.contactPersonRelation || null,
        contactPersonAddress: values.contactPersonAddress || null,
        contactPersonMobile: values.contactPersonMobile || null,
        contactPersonEmail: values.contactPersonEmail || null,
        medicalInsurance: hasInsurance,
        primaryInsuranceName: hasInsurance ? values.primaryInsuranceName || null : null,
        primaryInsuranceHolderName: hasInsurance ? values.primaryInsuranceHolderName || null : null,
        primaryInsuranceId: hasInsurance ? values.primaryInsuranceId || null : null,
        secondaryInsuranceName: hasInsurance ? values.secondaryInsuranceName || null : null,
        secondaryInsuranceHolderName: hasInsurance ? values.secondaryInsuranceHolderName || null : null,
        secondaryInsuranceId: hasInsurance ? values.secondaryInsuranceId || null : null,
        balanceAmount: values.balanceAmount || null,
        labId: values.labId ? Number(values.labId) : null,
        patientReports: values.patientReports || [],
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
              <FormRow cols={3}>
                <TextInput
                  control={control}
                  name='patientNo'
                  label='Patient Number'
                  placeholder={isCreate ? 'Auto-generated' : 'Patient number'}
                  disabled
                />
                <ComboboxInput
                  control={control as any}
                  name={'teamId' as any}
                  label='Team'
                  options={teamOptions}
                  placeholder='Select team'
                  searchPlaceholder='Search teams...'
                  emptyText='No team found.'
                />
                <ComboboxInput
                  control={control as any}
                  name={'labId' as any}
                  label='Lab'
                  options={labOptions}
                  placeholder='Select lab'
                  searchPlaceholder='Search labs...'
                  emptyText='No lab found.'
                />
              </FormRow> 
              <FormRow cols={3}>
                <TextInput control={control} name='firstName' label='First Name' required placeholder='First name' />
                <TextInput control={control} name='middleName' label='Middle Name' required placeholder='Middle name' />
                <TextInput control={control} name='lastName' label='Last Name' required placeholder='Last name' />
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='dateOfBirth' label='Date of Birth' type='date' />
                <TextInput control={control} name='age' label='Age' type='number' min={0} placeholder='Enter Age' required />
              </FormRow>
              <FormRow cols={2}>
                <SelectInput
                  control={control}
                  name='gender'
                  label='Gender'
                  placeholder='Select gender'
                  options={GENDER_OPTIONS}
                  required
                />
                <SelectInput
                  control={control}
                  name='bloodGroup'
                  label='Blood Group'
                  placeholder='Select blood group'
                  options={BLOOD_GROUP_OPTIONS}
                  required
                />
              </FormRow>
              <FormRow cols={3}>
                <TextInput control={control} name='height' label='Height (cm)' placeholder='Height (cm)' />
                <TextInput control={control} name='weight' label='Weight (kg)' placeholder='Weight (kg)' />
                <FormField
                  control={control}
                  name='bmi'
                  render={({ field }) => (
                    <FormItem className='w-full min-w-0'>
                      <div className='flex items-center gap-2'>
                        <FormLabel className='mb-0'>BMI</FormLabel>
                        <div className='relative inline-flex items-center group'>
                          <button
                            type='button'
                            className='text-muted-foreground hover:text-foreground inline-flex items-center'
                          >
                            <Info className='h-4 w-4' />
                          </button>
                          <div className='pointer-events-none absolute left-0 top-full mt-1 z-50 w-max max-w-[320px] rounded-md border bg-background px-2 py-1 text-xs text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-none whitespace-normal'>
                            BMI = weight (kg) / (height (m) × height (m)). Height is taken in cm and converted to meters.
                          </div>
                        </div>
                      </div>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder='Auto-calculated'
                          readOnly
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>
               <FormRow cols={1}>
                <TextInput
                  control={control}
                  name='referredBy'
                  label='Referred By'
                  placeholder='Name of person who referred'
                />
              </FormRow>
            </FormSection>

            <FormSection legend='Address Details'>
              <FormRow cols={1}>
                <TextareaInput control={control} name='address' label='Address' placeholder='Address' rows={3} required />
              </FormRow>
              <FormRow cols={3}>
                <ComboboxInput
                  control={control as any}
                  name={'stateId' as any}
                  label='State'
                  options={stateOptions}
                  placeholder='Select state (optional)'
                  searchPlaceholder='Search states...'
                  emptyText='No state found.'
                />
                <ComboboxInput
                  control={control as any}
                  name={'cityId' as any}
                  label='City'
                  options={cityOptions}
                  placeholder={stateIdValue ? 'Select city (optional)' : 'Select state first'}
                  searchPlaceholder='Search cities...'
                  emptyText={stateIdValue ? 'No city found.' : 'Select a state first.'}
                />
                <TextInput control={control} maxLength={6} name='pincode' label='Pincode' placeholder='Pincode'
                 onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                  }}
                 />
              </FormRow>
            </FormSection>

            <FormSection legend='Contact Details'>
              <FormRow cols={3}>
                <TextInput
                  control={control}
                  name='mobile'
                  label='Mobile Number 1'
                  required
                  placeholder='Primary Mobile number'
                  type='tel'
                  maxLength={10}
                  pattern='[0-9]{10}'
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                  }}
                />
                <TextInput
                  control={control}
                  name='mobile2'
                  label='Mobile Number 2'
                  placeholder='Secondary mobile number'
                  type='tel'
                  maxLength={10}
                  pattern='[0-9]{10}'
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                  }}
                />
                <EmailInput control={control} name='email' label='Email' placeholder='email@example.com' />
              </FormRow>
              <FormRow cols={3}>
                <TextInput control={control} name='occupation' label='Occupation' placeholder='Occupation' />
                <SelectInput
                  control={control}
                  name='maritalStatus'
                  label='Marital Status'
                  placeholder='Select marital status'
                  options={MARITAL_STATUS_OPTIONS}
                />
                <TextInput
                  control={control}
                  name='aadharNo'
                  label='Aadhar Number'
                  required
                  placeholder='12-digit Aadhar'
                  maxLength={12}
                  pattern='[0-9]{12}'
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                  }}
                />
              </FormRow>
            </FormSection>

            <FormSection legend='Contact Person Details'>
              <FormRow cols={2}>
                <TextInput control={control} name='contactPersonName' label='Contact Person Name' placeholder='Contact person' />
                <TextInput control={control} name='contactPersonRelation' label='Contact Person Relation' placeholder='Relation' />
              </FormRow>
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name='contactPersonMobile'
                  label='Contact Person Mobile Number'
                  placeholder='Mobile number'
                  type='tel'
                  maxLength={10}
                  pattern='[0-9]{10}'
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                  }}
                />
                <EmailInput
                  control={control}
                  name='contactPersonEmail'
                  label='Contact Person Email'
                  placeholder='email@example.com'
                />
              </FormRow>
              <FormRow cols={1}>
                <TextareaInput
                  control={control}
                  name='contactPersonAddress'
                  label='Contact Person Address'
                  placeholder='Address'
                  rows={2}
                />
              </FormRow>
            </FormSection>

            <FormSection legend='Insurance Details'>
              <FormRow cols={1}>
                <FormField
                  control={control}
                  name='medicalInsurance'
                  render={({ field }) => (
                    <FormItem>
                      <div className='flex items-center gap-4'>
                        <FormLabel className='mb-0'>Medical Insurance:</FormLabel>
                        <div className='flex items-center gap-6'>
                          <div className='flex items-center space-x-2'>
                            <FormControl>
                              <Checkbox
                                checked={field.value === true}
                                onCheckedChange={(checked) => {
                                  if (checked) field.onChange(true);
                                }}
                              />
                            </FormControl>
                            <FormLabel className='text-sm font-normal cursor-pointer'>Yes</FormLabel>
                          </div>
                          <div className='flex items-center space-x-2'>
                            <FormControl>
                              <Checkbox
                                checked={field.value === false}
                                onCheckedChange={(checked) => {
                                  if (checked) field.onChange(false);
                                }}
                              />
                            </FormControl>
                            <FormLabel className='text-sm font-normal cursor-pointer'>No</FormLabel>
                          </div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>
              {medicalInsuranceValue ? (
                <>
                  <FormRow cols={3}>
                    <TextInput
                      control={control}
                      name='primaryInsuranceName'
                      label='Primary Insurance Name'
                      placeholder='Insurance name'
                    />
                    <TextInput
                      control={control}
                      name='primaryInsuranceHolderName'
                      label='Primary Insurance Holder'
                      placeholder='Holder name'
                    />
                    <TextInput control={control} name='primaryInsuranceId' label='Primary Insurance ID' placeholder='ID' />
                  </FormRow>
                  <FormRow cols={3}>
                    <TextInput
                      control={control}
                      name='secondaryInsuranceName'
                      label='Secondary Insurance Name'
                      placeholder='Insurance name'
                    />
                    <TextInput
                      control={control}
                      name='secondaryInsuranceHolderName'
                      label='Secondary Insurance Holder'
                      placeholder='Holder name'
                    />
                    <TextInput control={control} name='secondaryInsuranceId' label='Secondary Insurance ID' placeholder='ID' />
                  </FormRow>
                </>
              ) : null}
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

            <FormSection legend='Patient Reports'>
              <div className='border rounded-lg overflow-hidden'>
                <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                  <div className='col-span-6 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Report Name
                  </div>
                  <div className='col-span-6 px-4 py-3 font-medium text-sm text-muted-foreground'>
                    Attach Report
                  </div>
                </div>

                {reportFields.map((field, index) => (
                  <div key={field.id} className='grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50'>
                    <div className='col-span-6 p-3 border-r'>
                      <TextInput
                        control={control}
                        name={`patientReports.${index}.name`}
                        placeholder='Enter report name'
                      />
                    </div>
                    <div className='col-span-6 p-3 flex items-center gap-2'>
                      <div className='flex-1'>
                        <ImprovedUploadInput
                          control={control}
                          name={`patientReports.${index}.url`}
                          label=''
                          description=''
                          type='document'
                          prefix='patient-reports'
                          showPreview={false}
                          existingUrl={field.url}
                        />
                      </div>
                      {reportFields.length > 1 && (
                        <AppButton
                          type='button'
                          variant='destructive'
                          size='sm'
                          onClick={() => removeReport(index)}
                          className='h-8 w-8 p-0'
                        >
                          <Trash2 className='h-4 w-4' />
                        </AppButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className='mt-4 flex items-start justify-between gap-4'>
                <AppButton
                  type='button'
                  variant='outline'
                  onClick={() =>
                    appendReport({ name: '', url: '' })
                  }
                  className='gap-2'
                >
                  <Plus className='h-4 w-4' />
                  Add Report
                </AppButton>
              </div>
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
