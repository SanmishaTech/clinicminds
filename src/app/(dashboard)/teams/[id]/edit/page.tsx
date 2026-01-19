'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import TeamForm, { TeamFormInitialData } from '@/app/(dashboard)/teams/team-form';

export default function EditTeamPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<TeamFormInitialData | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{
          id: number;
          name: string;
          addressLine1: string | null;
          addressLine2: string | null;
          city: string;
          state: string;
          pincode: string;
          userMobile: string;
          joiningDate: string | null;
          leavingDate: string | null;
          user: { id: number; name: string | null; email: string; status: boolean; role: string };
        }>(`/api/teams/${id}`);

        setInitial({
          id: data.id,
          name: data.name,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          userMobile: data.userMobile,
          joiningDate: data.joiningDate?.split('T')[0],
          leavingDate: data.leavingDate?.split('T')[0],
          role: data.user?.role as 'FRANCHISE' | 'DOCTOR' || 'FRANCHISE',
          userName: data.user?.name || '',
          email: data.user?.email || '',
          status: data.user?.status ?? true,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load team');
        router.push('/teams');
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
    <TeamForm mode='edit' initial={initial} />
  );
}
