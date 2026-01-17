'use client';

import { useParams } from 'next/navigation';
import MedicineForm from '../../medicines-form';
import { MedicineFormInitialData } from '../../medicines-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';

export default function EditMedicinesPage() {
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const id = params?.id;

 const [initial, setInitial] = useState<MedicineFormInitialData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const fetchMedicine = async () => {
      setIsLoading(true);
      try {
        const medicineData = await apiGet<MedicineFormInitialData>(`/api/medicines/${id}`);
        setInitial(medicineData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load medicine'));
        setInitial(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedicine();
  }, [id]);

  if (error) {
    toast.error('Failed to load medicine');
  }

  if (isLoading) {return  <div className="flex items-center justify-center  min-h-[700px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>;}
  if (!initial) return <div className='p-6'>Medicine not found</div>;

  return (
    <MedicineForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/medicines'
    />
  );
}
