'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import StateForm, { StateFormInitialData } from '@/app/(dashboard)/states/state-form';

export default function EditStatePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<StateFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{ id: number; state: string }>(`/api/states/${id}`);
        setInitial({ id: data.id, state: data.state });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load state');
        router.push('/states');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, router]);

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
    <StateForm mode='edit' initial={initial} />
  );
}
