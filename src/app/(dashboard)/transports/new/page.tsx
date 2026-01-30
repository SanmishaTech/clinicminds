'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import TransportForm, { type TransportFormInitial, type TransportSaleInfo } from '../transports-form';

type SaleApiResponse = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  franchise: { name: string };
  saleDetails?: Array<{
    id: number;
    batchNumber?: string | null;
    expiryDate?: string | null;
    quantity: number | string;
    medicine?: {
      name?: string | null;
      brand?: string | null;
    } | null;
  }>;
  transport?: {
    transporterName?: string | null;
    companyName?: string | null;
    transportDetails?: Array<{
      saleDetailId: number;
      quantity: number | string | null;
    }>;
    transportFee?: number | string | null;
    receiptNumber?: string | null;
    vehicleNumber?: string | null;
    trackingNumber?: string | null;
    notes?: string | null;
    status?: string | null;
  } | null;
};

export default function NewTransportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleIdParam = searchParams?.get('saleId');
  const saleId = saleIdParam ? Number(saleIdParam) : NaN;

  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<TransportSaleInfo | null>(null);
  const [initial, setInitial] = useState<TransportFormInitial | null>(null);

  useEffect(() => {
    if (Number.isNaN(saleId) || saleId <= 0) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<SaleApiResponse>(`/api/sales/${saleId}`);
        if (!mounted) return;

        const saleDetails = data.saleDetails || [];

        setSale({
          saleId: data.id,
          invoiceNo: data.invoiceNo,
          invoiceDate: data.invoiceDate,
          franchiseName: data.franchise?.name,
          saleDetails: saleDetails.map((d) => ({
            id: d.id,
            medicineName: d.medicine?.name ?? null,
            brandName: d.medicine?.brand ?? null,
            batchNumber: d.batchNumber ?? null,
            expiryDate: d.expiryDate ?? null,
            quantity: d.quantity,
          })),
        });

        const transportDetails = data.transport?.transportDetails || [];
        const hasTransportDetails = transportDetails.length > 0;

        setInitial({
          transporterName: data.transport?.transporterName ?? '',
          companyName: data.transport?.companyName ?? '',
          dispatchedDetails: saleDetails.map((detail) => {
            const matched = transportDetails.find((item) => Number(item.saleDetailId) === Number(detail.id));
            const fallbackQty = hasTransportDetails ? 0 : Number(detail.quantity) || 0;
            return {
              saleDetailId: Number(detail.id),
              quantity: matched?.quantity ?? fallbackQty,
            };
          }),
          transportFee: data.transport?.transportFee ?? '',
          receiptNumber: data.transport?.receiptNumber ?? '',
          vehicleNumber: data.transport?.vehicleNumber ?? '',
          trackingNumber: data.transport?.trackingNumber ?? '',
          notes: data.transport?.notes ?? '',
          status: data.transport?.status ?? 'PENDING',
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load sale');
        router.push('/sales');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [saleId, router]);

  if (Number.isNaN(saleId) || saleId <= 0) {
    return <div className='p-6'>Invalid sale</div>;
  }

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  if (!sale) {
    return <div className='p-6'>Sale not found</div>;
  }

  return <TransportForm sale={sale} initial={initial} redirectOnSuccess='/sales' />;
}
