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
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<ConsultationFormInitialData | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<AppointmentApiResponse>(`/api/appointments/${id}`);
        if (!mounted) return;

        setInitial({
          appointmentId: Number(id),
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
  }, [id]);

  if (!id) {
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
