'use client';

import { useSearchParams } from 'next/navigation';
import PatientForm from '@/app/(dashboard)/patients/patient-form';

export default function NewPatientPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  
  // If coming from appointments, redirect back with patient ID
  const handleSuccess = (result: any) => {
    if (redirectTo === 'appointments' && result?.id) {
      window.location.href = `/appointments/new?patientId=${result.id}`;
    }
  };

  return (
    <PatientForm 
      mode='create' 
      onSuccess={handleSuccess}
      redirectOnSuccess={redirectTo === 'appointments' ? '#' : '/patients'}
    />
  );
}
