'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SalesForm } from '../../sales-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function EditSalePage() {
  useProtectPage();
  const params = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const sale = await apiGet(`/api/sales/${params.id}`);
        setInitialData(sale);
      } catch (error) {
        toast.error('Failed to load sale');
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [params.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <SalesForm saleId={parseInt(params.id as string)} initialData={initialData} />;
}
