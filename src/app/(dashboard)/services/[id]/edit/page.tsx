'use client';

import { useParams, useRouter } from 'next/navigation';
import ServiceForm from '../../services-form';
import { ServiceFormInitialData } from '../../services-form';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';

export default function EditServicesPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<ServiceFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<ServiceFormInitialData>(`/api/services/${id}`);
        if (!mounted) return;
        setInitial(data);
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load service');
        router.push('/services');
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
    <ServiceForm mode='edit' initial={initial} redirectOnSuccess='/services' />
  );
}
