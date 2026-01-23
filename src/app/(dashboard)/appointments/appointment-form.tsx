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
import { useRouter, useSearchParams } from 'next/navigation';
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

const appointmentFormSchema = z.object({
  appointmentDateTime: z.string().min(1, 'Appointment date and time is required'),
  teamId: z.string().min(1, 'Team is required'),
  visitPurpose: z.string().optional(),
  patientId: z.string().min(1, 'Patient is required'),
});

type AppointmentFormData = z.infer<ReturnType<typeof makeAppointmentFormSchema>>;

export function AppointmentForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/appointments',
}: AppointmentFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPatientId = searchParams.get('patientId');
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
      patientId: initial?.patientId || urlPatientId || undefined,
    },
  });

  const { control, handleSubmit } = form;

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        teamId: Number(data.teamId),
        patientId: data.patientId ? Number(data.patientId) : undefined,
      };

      if (mode === 'create') {
        const res = await apiPost('/api/appointments', payload);
        toast.success('Appointment created successfully');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/appointments', {
          id: initial.id,
          ...payload,
        });
        toast.success('Appointment updated successfully');
        onSuccess?.(res);
      }

      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save appointment');
    } finally {
      setIsSubmitting(false);
    }
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
              <FormRow>
                <ComboboxInput
                  control={control as any}
                  name="patientId"
                  label="Select Patient"
                  options={patientOptions}
                  required
                  placeholder="Select patient"
                  stickyActionButton={{
                    label: "Create New Patient",
                    href: "/patients/new?redirectTo=appointments"
                  }}
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