'use client';

import { useParams, useRouter } from 'next/navigation';
import MedicineForm from '../../medicines-form';
import { MedicineFormInitialData } from '../../medicines-form';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';

export default function EditMedicinesPage() {

  const params = useParams<{ id?: string }>();
  const id = params?.id;

 const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<MedicineFormInitialData | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<MedicineFormInitialData>(`/api/medicines/${id}`);
        if (!mounted) return;
        setInitial(data);
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load medicine');
        router.push('/medicines');
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
    <MedicineForm mode='edit' initial={initial} redirectOnSuccess='/medicines' />
  );
}