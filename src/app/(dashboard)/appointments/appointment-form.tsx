'use client';

import { useMemo, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common/app-button';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { TextareaInput } from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { ComboboxInput } from '@/components/common/combobox-input';
import { EmailInput } from '@/components/common/email-input';
import { MASTER_CONFIG } from '@/config/master';
import { formatDateTimeForInput } from '@/lib/locales';

type TeamsResponse = {
  data: { id: number; name: string; user?: { role?: string; status?: boolean } }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type PatientsResponse = {
  data: { id: number; patientNo: string; firstName: string; middleName: string; lastName: string; mobile: string }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export interface AppointmentFormInitialData {
  id?: number;
  appointmentDateTime?: string;
  teamId?: string;
  patientId?: string;
  visitPurpose?: string | null;
  patient?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string | null;
    age?: string;
    gender?: string;
    referedBy?: string | null;
    email?: string | null;
    mobile?: string;
  };
  team?: {
    id: number;
    name: string;
  };
}

export interface AppointmentFormProps {
  mode: 'create' | 'edit';
  initial?: AppointmentFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/appointments'
}

const GENDER_OPTIONS = MASTER_CONFIG.gender.map((g) => ({ value: g.value, label: g.label }));

const createPatientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  age: z
    .string()
    .min(1, 'Age is required')
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) && n > 0;
    }, 'Invalid age'),
  gender: z.string().min(1, 'Gender is required'),
  referedBy: z.string().optional(),
  email: z.string().min(1, 'Email is required').email(),
  mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile number must be 10 digits'),
});

const makeAppointmentFormSchema = (mode: 'create' | 'edit') => {
  if (mode === 'edit') {
    return z.object({
      appointmentDateTime: z.string().min(1, 'Appointment date and time is required'),
      teamId: z.string().min(1, 'Team is required'),
      visitPurpose: z.string().optional(),
      patientId: z.string().optional().transform((v) => (v === '' ? undefined : v)),
      patient: z
        .object({
          firstName: z.string().optional(),
          middleName: z.string().optional(),
          lastName: z.string().optional(),
          dateOfBirth: z.string().optional(),
          age: z.string().optional(),
          gender: z.string().optional(),
          referedBy: z.string().optional(),
          email: z.string().optional(),
          mobile: z.string().optional(),
        })
        .optional(),
    });
  }

  return z
    .object({
      appointmentDateTime: z.string().min(1, 'Appointment date and time is required'),
      teamId: z.string().min(1, 'Team is required'),
      visitPurpose: z.string().optional(),
      patientId: z.string().optional().transform((v) => (v === '' ? undefined : v)),
      patient: createPatientSchema.optional(),
    })
    .superRefine((data, ctx) => {
      const hasPatientId = !!data.patientId;
      const hasPatientData = !!data.patient;

      if (!hasPatientId && !hasPatientData) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Patient is required',
          path: ['patientId'],
        });
      }

      if (hasPatientId && hasPatientData) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select existing patient OR enter new patient details, not both',
          path: ['patientId'],
        });
      }
    });
};

type AppointmentFormData = z.infer<ReturnType<typeof makeAppointmentFormSchema>>;

export function AppointmentForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/appointments',
}: AppointmentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(() => (mode === 'create' ? false : !initial?.patientId));

  function computeAgeFromDateInput(dateStr: string): number | null {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);

    const today = new Date();
    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth() + 1; // 1-12
    const thisDay = today.getDate();

    let age = thisYear - year;
    if (thisMonth < month || (thisMonth === month && thisDay < day)) age -= 1;
    if (age < 0) return null;
    return age;
  }

  const { data: teamsResponse } = useSWR<TeamsResponse>(
    '/api/teams?page=1&perPage=100&sort=name&order=asc&role=DOCTOR&status=true',
    apiGet
  );
  const { data: patientsResponse } = useSWR<PatientsResponse>('/api/patients', apiGet);

  const teams = teamsResponse?.data || [];
  const patients = patientsResponse?.data || [];

  const doctorTeams = useMemo(() => teams.filter((t) => t.user?.role === 'DOCTOR'), [teams]);

  const teamOptions = useMemo(() =>
    doctorTeams.map((team) => ({ value: team.id.toString(), label: team.name })),
    [doctorTeams]
  );

  const patientOptions = useMemo(() =>
    patients.map((patient) => ({
      value: patient.id.toString(),
      label: `${patient.patientNo} | ${patient.firstName} ${patient.middleName} ${patient.lastName} | ${patient.mobile}`,
    })),
    [patients]
  );

  const schema = useMemo(() => makeAppointmentFormSchema(mode), [mode]);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      appointmentDateTime: initial?.appointmentDateTime
        ? formatDateTimeForInput(new Date(initial.appointmentDateTime))
        : '',
      teamId: initial?.teamId || undefined,
      visitPurpose: initial?.visitPurpose || '',
      patientId: initial?.patientId || undefined,
      patient: initial?.patient ? {
        firstName: initial.patient.firstName || '',
        middleName: initial.patient.middleName || '',
        lastName: initial.patient.lastName || '',
        dateOfBirth: initial.patient.dateOfBirth || '',
        age: initial.patient?.age != null ? String(initial.patient.age) : '',
        gender: initial.patient.gender || '',
        referedBy: initial.patient.referedBy || '',
        email: initial.patient.email || '',
        mobile: initial.patient.mobile || '',
      } : mode === 'edit' ? {
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        age: '',
        gender: '',
        referedBy: '',
        email: '',
        mobile: '',
      } : undefined,
    },
  });

  const { control, handleSubmit } = form;
  const watchedDateOfBirth = form.watch('patient.dateOfBirth');

  useEffect(() => {
    if (!watchedDateOfBirth || !isNewPatient) return;
    const computed = computeAgeFromDateInput(watchedDateOfBirth);
    if (computed === null) return;
    (form.setValue as any)('patient.age', computed.toString(), { shouldDirty: true, shouldValidate: true });
  }, [watchedDateOfBirth, form, isNewPatient]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        teamId: Number(data.teamId),
        patientId: !isNewPatient && data.patientId ? Number(data.patientId) : undefined,
        patient: isNewPatient ? {
          ...data.patient,
          age: data.patient.age ? Number(data.patient.age) : undefined
        } : undefined,
      };

      if (mode === 'create') {
        const res = await apiPost('/api/appointments', payload);
        toast.success('Appointment created successfully');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id){
        const res = await apiPatch('/api/appointments',{
          id: initial.id,
          ...payload,
        });
        toast.success('Appointment updated successfully');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${mode} appointment`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePatientTypeChange = (isExisting: boolean) => {
    if (isExisting) {
      form.setValue('patient', undefined);
      form.setValue('patientId', undefined);
    } else {
      form.setValue('patientId', undefined);
      form.setValue('patient', {
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        age: '',
        gender: '',
        referedBy: '',
        email: '',
        mobile: '',
      });
    }
    setIsNewPatient(!isExisting);
  };

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{mode === 'create' ? 'Create Appointment' : 'Edit Appointment'}</AppCard.Title>
          <AppCard.Description>
            {mode === 'create' ? 'Schedule a new appointment.' : 'Update appointment details.'}
          </AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend="Patient Information">
              {mode === 'edit' ? (
                // Edit mode: Show new patient fields with disabled inputs
                <>
                  <FormRow cols={3}>
                    <TextInput
                      control={control}
                      name="patient.firstName"
                      label="First Name"
                      disabled
                    />
                    <TextInput
                      control={control}
                      name="patient.middleName"
                      label="Middle Name"
                      disabled
                    />
                    <TextInput
                      control={control}
                      name="patient.lastName"
                      label="Last Name"
                      disabled
                    />
                  </FormRow>

                  <FormRow cols={3}>
                    <TextInput
                      control={control}
                      name="patient.dateOfBirth"
                      label="Date of Birth"
                      type="date"
                      disabled
                    />
                    <TextInput
                      control={control}
                      name="patient.age"
                      label="Age"
                      type="number"
                      disabled
                    />
                    <ComboboxInput
                      control={control as any}
                      name="patient.gender"
                      label="Gender"
                      options={MASTER_CONFIG.gender.map((g) => ({ value: g.value, label: g.label }))}
                      disabled
                    />
                  </FormRow>

                  <FormRow cols={2}>
                    <TextInput
                      control={control}
                      name="patient.mobile"
                      label="Mobile"
                      disabled
                    />
                    <EmailInput
                      control={control}
                      name="patient.email"
                      label="Email"
                      disabled
                    />
                  </FormRow>

                  <FormRow>
                    <TextInput
                      control={control}
                      name="patient.referedBy"
                      label="Referred By"
                      disabled
                    />
                  </FormRow>
                </>
              ) : (
                // Create mode: Show patient type selection and appropriate fields
                <>
                  <FormRow cols={8}>
                    <AppCheckbox
                      label='Existing Patient'
                      checked={!isNewPatient}
                      onCheckedChange={(v) => handlePatientTypeChange(v === true)}
                    />
                    <AppCheckbox
                      label='New Patient'
                      checked={isNewPatient}
                      onCheckedChange={(v) => handlePatientTypeChange(!(v === true))}
                    />
                  </FormRow>

                  {!isNewPatient ? (
                    <FormRow>
                      <ComboboxInput
                        control={control as any}
                        name="patientId"
                        label="Select Patient"
                        options={patientOptions}
                        required
                        placeholder="Select patient"
                      />
                    </FormRow>
                  ) : (
                    <>
                      <FormRow cols={3}>
                        <TextInput
                          control={control}
                          name="patient.firstName"
                          label="First Name"
                          required
                          placeholder="Enter first name"
                        />
                        <TextInput
                          control={control}
                          name="patient.middleName"
                          label="Middle Name"
                          placeholder="Enter middle name"
                        />
                        <TextInput
                          control={control}
                          name="patient.lastName"
                          label="Last Name"
                          required
                          placeholder="Enter last name"
                        />
                      </FormRow>

                      <FormRow cols={3}>
                        <TextInput
                          control={control}
                          name="patient.dateOfBirth"
                          label="Date of Birth"
                          type="date"
                        />
                        <TextInput
                          control={control}
                          name="patient.age"
                          label="Age"
                          type="number"
                          required
                          placeholder="Enter age"
                        />
                        <ComboboxInput
                          control={control as any}
                          name="patient.gender"
                          label="Gender"
                          options={GENDER_OPTIONS}
                          required
                          placeholder="Select gender"
                        />
                      </FormRow>

                      <FormRow cols={2}>
                        <TextInput
                          control={control}
                          name="patient.mobile"
                          label="Mobile"
                          placeholder="Enter 10-digit mobile number"
                          maxLength={10}
                          onInput={(e) => {
                            e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                          }}
                          required
                        />
                        <EmailInput
                          control={control}
                          name="patient.email"
                          label="Email"
                          placeholder="Enter email address"
                          required
                        />
                      </FormRow>

                      <FormRow>
                        <TextInput
                          control={control}
                          name="patient.referedBy"
                          label="Referred By"
                          placeholder="Enter referral information"
                        />
                      </FormRow>
                    </>
                  )}
                </>
              )}
            </FormSection>

            <FormSection legend="Appointment Details">
              <FormRow cols={2}>
                <TextInput
                  control={control}
                  name="appointmentDateTime"
                  label="Appointment Date & Time"
                  required
                  type="datetime-local"
                />
                <ComboboxInput
                  control={control as any}
                  name="teamId"
                  label="Team"
                  required
                  options={teamOptions}
                  placeholder="Select team"
                />
              </FormRow>

              <FormRow>
                <TextareaInput
                  control={control}
                  name="visitPurpose"
                  label="Visit Purpose"
                  placeholder="Enter visit purpose"
                />
              </FormRow>
            </FormSection>
          </AppCard.Content>

          <AppCard.Footer className='justify-end'>
            <AppButton
              type='button'
              variant='secondary'
              onClick={() => router.back()}
            >
              Cancel
            </AppButton>
            <AppButton
              type='submit'
              disabled={isSubmitting}
              isLoading={isSubmitting}
            >
              {mode === 'create' ? 'Create Appointment' : 'Update Appointment'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default AppointmentForm;