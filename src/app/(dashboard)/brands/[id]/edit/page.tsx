'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrandForm, BrandFormInitialData } from '@/app/(dashboard)/brands/brand-form';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export default function EditBrandPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [initial, setInitial] = useState<BrandFormInitialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{ id: number; name: string }>(`/api/brands/${id}`);
        setInitial({
          id: data.id,
          name: data.name,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load brand');
        router.push('/brands');
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
    <BrandForm mode='edit' initial={initial} />
  );
}
