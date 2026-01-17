'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import CityForm, { CityFormInitialData } from '@/app/(dashboard)/cities/city-form';

export default function EditCityPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<CityFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{
          id: number;
          city: string;
          stateId: number;
          state: { id: number; state: string };
        }>(`/api/cities/${id}`);
        setInitial({ id: data.id, city: data.city, stateId: data.stateId });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load city');
        router.push('/cities');
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
    <CityForm mode='edit' initial={initial} />
  );
}
