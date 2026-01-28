'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { ROLES } from '@/config/roles';
import { useRouter } from 'next/navigation';
import PatientForm from '@/app/(dashboard)/patients/patient-form';

export default function NewPatientPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { role } = usePermissions();
  const redirectTo = searchParams?.get('redirectTo');

  useEffect(() => {
    if (role === ROLES.ADMIN) router.replace('/patients');
  }, [role, router]);
  
  // If coming from appointments, redirect back with patient ID
  const handleSuccess = (result: any) => {
    if (redirectTo === 'appointments' && result?.id) {
      window.location.href = `/appointments/new?patientId=${result.id}`;
    }
  };

  if (role === ROLES.ADMIN) return null;

  return (
    <PatientForm 
      mode='create' 
      onSuccess={handleSuccess}
      redirectOnSuccess={redirectTo === 'appointments' ? '#' : '/patients'}
    />
  );
}
