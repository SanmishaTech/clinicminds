'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import PatientForm, { PatientFormInitialData } from '@/app/(dashboard)/patients/patient-form';

export default function EditPatientPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<PatientFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{
          id: number;
          patientNo: string;
          team: string;
          name: string;
          dateOfBirth: string | null;
          age: number | null;
          gender: string;
          status: string;
          address: string | null;
          stateId: number;
          cityId: number;
          pincode: string | null;
          mobile1: string;
          mobile2: string | null;
          email: string | null;
          contactPerson: string | null;
          contactPersonRelation: string | null;
          contactPersonMobile1: string | null;
          contactPersonMobile2: string | null;
          balanceAmount: number;
        }>(`/api/patients/${id}`);

        setInitial({
          id: data.id,
          patientNo: data.patientNo,
          team: data.team,
          name: data.name,
          dateOfBirth: data.dateOfBirth,
          age: data.age,
          gender: data.gender,
          status: data.status,
          address: data.address,
          stateId: data.stateId,
          cityId: data.cityId,
          pincode: data.pincode,
          mobile1: data.mobile1,
          mobile2: data.mobile2,
          email: data.email,
          contactPerson: data.contactPerson,
          contactPersonRelation: data.contactPersonRelation,
          contactPersonMobile1: data.contactPersonMobile1,
          contactPersonMobile2: data.contactPersonMobile2,
          balanceAmount: data.balanceAmount,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load patient');
        router.push('/patients');
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
    <PatientForm mode='edit' initial={initial} />
  );
}
