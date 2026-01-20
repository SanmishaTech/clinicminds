'use client';

import { useMemo, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
import { formatDateForInput, formatDateTimeForInput } from '@/lib/locales';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Info } from 'lucide-react';

type TeamsResponse = {
  data: { id: number; name: string }[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type PatientsResponse = {
  data: { id: number; firstName: string; middleName: string; lastName: string; mobile: string }[];
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

const appointmentFormSchema = z.object({
  appointmentDateTime: z.string().min(1, 'Appointment date and time is required'),
  teamId: z.string().min(1, 'Team is required'),
  visitPurpose: z.string().optional(),
  patientId: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  patient: z.object({
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().optional(),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().optional(),
    age: z.string().transform((v) => v ? Number(v) : 0).refine((v) => v > 0, 'Age must be positive'),
    gender: z.string(),
    referedBy: z.string().optional(),
    email: z.string().email().optional(),
    mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile number must be 10 digits'),
  }).optional(),
}).refine((data) => {
  const hasPatientId = !!data.patientId;
  const hasPatientData = !!data.patient;
  return (hasPatientId && !hasPatientData) || (!hasPatientId && hasPatientData);
}, {
  message: 'Either patient (for existing patients) OR patient data (for new patients) must be provided, but not both',
});

type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

export function AppointmentForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/appointments',
}: AppointmentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(!initial?.patientId);

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

  const { data: teamsResponse } = useSWR<TeamsResponse>('/api/teams', apiGet);
  const { data: patientsResponse } = useSWR<PatientsResponse>('/api/patients', apiGet);

  const teams = teamsResponse?.data || [];
  const patients = patientsResponse?.data || [];

  const teamOptions = useMemo(() => 
    teams.map((team) => ({ value: team.id.toString(), label: team.name })),
    [teams]
  );

  const patientOptions = useMemo(() =>
    patients.map((patient) => ({
      value: patient.id.toString(),
      label: `${patient.firstName} ${patient.middleName} ${patient.lastName} (${patient.mobile})`,
    })),
    [patients]
  );

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema),
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
      } : {
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        age: 0,
        gender: '',
        referedBy: '',
        email: '',
        mobile: '',
      },
    },
  });
  
  const { control, handleSubmit } = form;
  const watchedPatientId = form.watch('patientId');
  const watchedPatient = form.watch('patient');
  const watchedDateOfBirth = form.watch('patient.dateOfBirth');

  // Debug: Log form values
  console.log('Debug - Form initial data:', initial);
  console.log('Debug - Form default values:', form.getValues());
  console.log('Debug - Watched appointmentDateTime:', form.watch('appointmentDateTime'));

  useEffect(() => {
    setIsNewPatient(!watchedPatientId);
  }, [watchedPatientId]);

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
          age: Number(data.patient.age)
        } : undefined,
      };

      let result;
      if (mode === 'create') {
        result = await apiPost('/api/appointments', payload);
        toast.success('Appointment created successfully');
      } else {
        result = await apiPatch(`/api/appointments/${initial?.id}`, payload);
        toast.success('Appointment updated successfully');
      }

      onSuccess?.(result);
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
        age: 0,
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
        <form onSubmit={handleSubmit(onSubmit)}>
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
                      onCheckedChange={(v) => handlePatientTypeChange(v)}
                    />
                    <AppCheckbox
                      label='New Patient'
                      checked={isNewPatient}
                      onCheckedChange={(v) => handlePatientTypeChange(!v)}
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