'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import FranchiseForm, { FranchiseFormInitialData } from '@/app/(dashboard)/franchises/franchise-form';

export default function EditFranchisePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<FranchiseFormInitialData | null>(null);

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
          contactNo: string;
          contactEmail: string;
          userMobile: string;
          user: { id: number; name: string | null; email: string; status: boolean };
        }>(`/api/franchises/${id}`);

        setInitial({
          id: data.id,
          name: data.name,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          contactNo: data.contactNo,
          contactEmail: data.contactEmail,
          userMobile: data.userMobile,
          userName: data.user?.name || '',
          userEmail: data.user?.email || '',
          status: data.user?.status ?? true,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load franchise');
        router.push('/franchises');
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
    <FranchiseForm mode='edit' initial={initial} />
  );
}
