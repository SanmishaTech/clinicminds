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
        const data = await apiGet<{
          id: number;
          appointmentDateTime: string;
          visitPurpose: string | null;
          patientId: number | null;
          teamId: number | null;
          team?: {
            id: number;
            name: string;
          };
        }>(`/api/appointments/${id}`);
        
        setInitial({
          id: data.id,
          appointmentDateTime: data.appointmentDateTime,
          visitPurpose: data.visitPurpose,
          teamId: data.teamId?.toString(),
          patientId: data.patientId ? data.patientId.toString() : undefined,
          team: data.team,
        });
      } catch (e) {
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
