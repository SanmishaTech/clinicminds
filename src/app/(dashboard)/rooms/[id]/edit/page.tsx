'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import RoomForm, { RoomFormInitialData } from '@/app/(dashboard)/rooms/room-form';

export default function EditRoomPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<RoomFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{
          id: number;
          name: string;
          description: string | null;
        }>(`/api/rooms/${id}`);

        setInitial({
          id: data.id,
          name: data.name,
          description: data.description,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load room');
        router.push('/rooms');
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
    <RoomForm mode='edit' initial={initial} />
  );
}
