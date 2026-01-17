'use client';

import { useParams } from 'next/navigation';
import ServiceForm from '../../services-form';
import { ServiceFormInitialData } from '../../services-form';
import { useProtectPage } from '@/hooks/use-protect-page';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import useSWR from 'swr';

export default function EditServicesPage() {
  useProtectPage();

  const params = useParams<{ id?: string }>();
  const id = params?.id;

 const { data: initial, error, isLoading } = useSWR<ServiceFormInitialData>(
  id ? `/api/services/${id}` : null,
  apiGet,
  {
    dedupingInterval: 1000, // 1 second
    revalidateOnFocus: false, // Optional: prevents refetching when window regains focus
    revalidateOnReconnect: false, // Optional: prevents refetching on network reconnect
  }
);

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
