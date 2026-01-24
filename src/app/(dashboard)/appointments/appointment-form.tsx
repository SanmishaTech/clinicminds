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
import { TextareaInput } from '@/components/common/textarea-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComboboxInput } from '@/components/common/combobox-input';
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
  type?: 'CONSULTATION' | 'PROCEDURE';
  visitPurpose?: string | null;
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

const appointmentFormSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  appointmentDateTime: z.string().min(1, 'Appointment date and time is required'),
  teamId: z.string().min(1, 'Team is required'),
  type: z.enum(['CONSULTATION', 'PROCEDURE']),
  visitPurpose: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

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
  const isCreate = mode === 'create';
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

  const typeOptions = useMemo(() =>
    [{ value: 'CONSULTATION', label: 'Consultation' }, 
     { value: 'PROCEDURE', label: 'Procedure' }],
    []
  );

  const schema = useMemo(() => appointmentFormSchema, []);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      patientId: initial?.patientId || urlPatientId || undefined,
      appointmentDateTime: initial?.appointmentDateTime
        ? formatDateTimeForInput(new Date(initial.appointmentDateTime))
        : '',
      teamId: initial?.teamId || undefined,
      type: initial?.type || undefined,
      visitPurpose: initial?.visitPurpose || '',
    },
  });

  const { control, handleSubmit, formState } = form;

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        teamId: Number(data.teamId),
        patientId: data.patientId ? Number(data.patientId) : undefined,
      };

      if (isCreate) {
        const res = await apiPost('/api/appointments', payload);
        toast.success('Appointment created successfully');
        onSuccess?.(res);
      } else if (!isCreate && initial?.id) {
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
                  disabled={!isCreate}
                  stickyActionButton={isCreate ? {
                    label: "Create New Patient",
                    href: "/patients/new?redirectTo=appointments"
                  } : undefined}
                />
              </FormRow>
            </FormSection>

            <FormSection legend="Appointment Details">
              <FormRow cols={3}>
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
                <ComboboxInput
                  control={control as any}
                  name="type"
                  label="Type"
                  required
                  options={typeOptions}
                  placeholder="Select type"
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

          <AppCard.Footer className='justify-end gap-2'>
            <AppButton
              type='button'
              variant='secondary'
              onClick={() => router.push(redirectOnSuccess)}
              disabled={isSubmitting}
              iconName='X'
            >
              Cancel
            </AppButton>
            <AppButton
              type='submit'
              disabled={isSubmitting || !formState.isValid}
              isLoading={isSubmitting}
              iconName={isCreate ? 'Plus' : 'Save'}
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