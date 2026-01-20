'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppointmentForm, AppointmentFormInitialData } from '../../appointment-form';

export default function EditAppointmentPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<AppointmentFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('Debug: Fetching appointment with ID:', id);
        const data = await apiGet<{
          id: number;
          appointmentDateTime: string;
          visitPurpose: string | null;
          patientId: number | null;
          patient?: {
            firstName: string;
            middleName: string;
            lastName: string;
            dateOfBirth: string | null;
            age: number;
            gender: string;
            referedBy: string | null;
            email: string | null;
            mobile: string;
          };
          team?: {
            id: number;
            name: string;
          };
        }>(`/api/appointments/${id}`);
        
        console.log('Debug: Received appointment data:', data);

        setInitial({
          id: data.id,
          appointmentDateTime: data.appointmentDateTime,
          visitPurpose: data.visitPurpose,
          teamId: data.team?.id.toString(),
          patientId: data.patientId ? data.patientId.toString() : undefined,
          patient: data.patient,
          team: data.team,
        });
      } catch (e) {
        console.error('Debug: Error fetching appointment:', e);
        toast.error((e as Error).message || 'Failed to load appointment');
        router.push('/appointments');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
    <AppointmentForm mode='edit' initial={initial} />
  );
}
