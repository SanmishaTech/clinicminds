'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { ConsultationForm, ConsultationFormInitialData } from '../../consultation-form';

type AppointmentApiResponse = {
  id: number;
  appointmentDateTime: string;
  visitPurpose: string | null;
  patient: {
    id: number;
    firstName: string;
    lastName: string;
    mobile: string;
  };
  team: {
    id: number;
    name: string;
  };
};

export default function NewConsultationPage() {
  const params = useParams<{ appointmentId?: string }>();
  const appointmentId = params?.appointmentId;

  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<ConsultationFormInitialData | null>(null);

  useEffect(() => {
    if (!appointmentId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<AppointmentApiResponse>(`/api/appointments/${appointmentId}`);
        if (!mounted) return;

        setInitial({
          appointmentId: Number(appointmentId),
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load appointment');
        // Navigate back or to appointments list
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [appointmentId]);

  if (!appointmentId) {
    return <div className='p-6'>Invalid appointment</div>;
  }

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
    <ConsultationForm 
      mode='create' 
      initial={initial} 
      redirectOnSuccess='/appointments' 
    />
  );
}
