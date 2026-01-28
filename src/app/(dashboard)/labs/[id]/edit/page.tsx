'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LabForm, LabFormInitialData } from '@/app/(dashboard)/labs/lab-form';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export default function EditLabPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [initial, setInitial] = useState<LabFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{ id: number; name: string }>(`/api/labs/${id}`);
        setInitial({
          id: data.id,
          name: data.name,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load lab');
        router.push('/labs');
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
    <LabForm mode='edit' initial={initial} />
  );
}
