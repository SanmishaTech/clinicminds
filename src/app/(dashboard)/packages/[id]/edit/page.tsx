'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import PackageForm, { PackageFormInitialData } from '../../packages-form';

type PackageApiResponse = {
  id: number;
  name: string;
  duration?: number;
  discountPercent?: number | string;
  totalAmount: number | string;
  packageDetails: {
    serviceId: number;
    description?: string | null;
    qty: number;
    rate: number | string;
    amount: number | string;
  }[];
  packageMedicines: {
    medicineId: number;
    qty: number;
    rate: number | string;
    amount: number | string;
    medicine?: {
      mrp?: number | string;
    } | null;
  }[];
};

export default function EditPackagePage() {
  const params = useParams<{ id?: string }>();
  const id = params?.id;

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<PackageFormInitialData | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<PackageApiResponse>(`/api/packages/${id}`);
        if (!mounted) return;

        setInitial({
          id: data.id,
          name: data.name,
          duration: (() => {
            const v = Number((data as any).duration);
            return Number.isFinite(v) ? v : 0;
          })(),
          discountPercent: Number(data.discountPercent) || 0,
          totalAmount: Number(data.totalAmount) || 0,
          packageDetails: (data.packageDetails || []).map((d) => ({
            serviceId: d.serviceId,
            description: d.description || '',
            qty: Number(d.qty) || 0,
            rate: Number(d.rate) || 0,
            amount: Number(d.amount) || 0,
          })),
          packageMedicines: (data.packageMedicines || []).map((m) => ({
            medicineId: m.medicineId,
            qty: Number(m.qty) || 0,
            rate: Number(m.medicine?.mrp ?? m.rate) || 0,
            amount: ((Number(m.qty) || 0) * (Number(m.medicine?.mrp ?? m.rate) || 0)) || 0,
          })),
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load package');
        router.push('/packages');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, router]);

  if (!id) {
    return <div className='p-6'>Invalid package</div>;
  }

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  return <PackageForm mode='edit' initial={initial} redirectOnSuccess='/packages' />;
}
