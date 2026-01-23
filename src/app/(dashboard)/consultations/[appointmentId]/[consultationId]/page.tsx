'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { ConsultationForm, ConsultationFormInitialData } from '../../consultation-form';

type ConsultationApiResponse = {
  id: number;
  appointmentId: number;
  complaint: string | null;
  diagnosis: string | null;
  remarks: string | null;
  casePaperUrl: string | null;
  nextFollowUpDate: string | null;
  totalAmount: number | string;
  consultationDetails: {
    serviceId: number;
    description?: string | null;
    qty: number;
    rate: number | string;
    amount: number | string;
  }[];
  consultationMedicines: {
    medicineId: number;
    qty: number;
    mrp: number | string;
    amount: number | string;
    doses?: string | null;
  }[];
};

export default function EditConsultationPage() {
  const params = useParams<{ appointmentId?: string; consultationId?: string }>();
  const consultationId = params?.consultationId;

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<ConsultationFormInitialData | null>(null);

  useEffect(() => {
    if (!consultationId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<ConsultationApiResponse>(`/api/consultations/${consultationId}`);
        if (!mounted) return;

        setInitial({
          id: data.id,
          appointmentId: data.appointmentId,
          complaint: data.complaint || '',
          diagnosis: data.diagnosis || '',
          remarks: data.remarks || '',
          casePaperUrl: data.casePaperUrl || '',  
          nextFollowUpDate: data.nextFollowUpDate || undefined,
          totalAmount: Number(data.totalAmount) || 0,
          consultationDetails: (data.consultationDetails || []).map((d) => ({
            serviceId: d.serviceId,
            description: d.description || '',
            qty: Number(d.qty) || 0,
            rate: Number(d.rate) || 0,
            amount: Number(d.amount) || 0,
          })),
          consultationMedicines: (data.consultationMedicines || []).map((m) => ({
            medicineId: m.medicineId,
            qty: Number(m.qty) || 0,
            mrp: Number(m.mrp) || 0,
            amount: Number(m.amount) || 0,
            doses: m.doses || '',
          })),
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load consultation');
        router.push('/appointments');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [consultationId, router]);

  if (!consultationId) {
    return <div className='p-6'>Invalid consultation</div>;
  }

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
    <ConsultationForm 
      mode='edit' 
      initial={initial} 
      redirectOnSuccess='/appointments' 
    />
  );
}
