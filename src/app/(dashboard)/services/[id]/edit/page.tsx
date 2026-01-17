'use client';

import { useParams } from 'next/navigation';
import ServiceForm from '../../services-form';
import { ServiceFormInitialData } from '../../services-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useState, useEffect } from 'react';

export default function EditServicesPage() {
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const id = params?.id;

 const [initial, setInitial] = useState<ServiceFormInitialData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const fetchService = async () => {
      setIsLoading(true);
      try {
        const serviceData = await apiGet<ServiceFormInitialData>(`/api/services/${id}`);
        setInitial(serviceData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load service'));
        setInitial(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchService();
  }, [id]);

  if (error) {
    toast.error('Failed to load service');
  }

  if (isLoading) {return  <div className="flex items-center justify-center  min-h-[700px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>;}
  if (!initial) return <div className='p-6'>Service not found</div>;

  return (
    <ServiceForm
      mode='edit'
      initial={initial}
      redirectOnSuccess='/services'
    />
  );
}
