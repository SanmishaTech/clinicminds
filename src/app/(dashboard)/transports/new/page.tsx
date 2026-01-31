'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import TransportForm, { type TransportFormInitial, type TransportSaleInfo } from '../transports-form';

type TransportApiResponse = {
  id: number;
  saleId: number;
  status?: string | null;
  transporterName?: string | null;
  companyName?: string | null;
  transportFee?: number | string | null;
  receiptNumber?: string | null;
  vehicleNumber?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  transportDetails?: Array<{
    saleDetailId: number;
    quantity: number | string | null;
  }>;
};

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
    remainingQuantity?: number | string;
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
  const transportIdParam = searchParams?.get('transportId');
  const transportId = transportIdParam ? Number(transportIdParam) : NaN;
  const saleIdParam = searchParams?.get('saleId');
  const saleId = saleIdParam ? Number(saleIdParam) : NaN;

  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<TransportSaleInfo | null>(null);
  const [initial, setInitial] = useState<TransportFormInitial | null>(null);
  const [resolvedTransportId, setResolvedTransportId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;

        let resolvedSaleId = saleId;
        let transport: TransportApiResponse | null = null;

        if (!Number.isNaN(transportId) && transportId > 0) {
          transport = await apiGet<TransportApiResponse>(`/api/transports/${transportId}`);
          resolvedSaleId = Number(transport.saleId);
          setResolvedTransportId(Number(transport.id));
        }

        if (Number.isNaN(resolvedSaleId) || resolvedSaleId <= 0) {
          throw new Error('Invalid sale');
        }

        const saleUrl = !Number.isNaN(transportId) && transportId > 0
          ? `/api/sales/${resolvedSaleId}?transportId=${transportId}`
          : `/api/sales/${resolvedSaleId}`;
        const data = await apiGet<SaleApiResponse>(saleUrl);
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
            remainingQuantity: d.remainingQuantity ?? d.quantity,
          })),
        });

        const transportDetails = data.transport?.transportDetails || [];
        if (resolvedTransportId == null && data.transport && (data.transport as any).id) {
          setResolvedTransportId(Number((data.transport as any).id));
        }

        const effectiveTransportDetails = transport?.transportDetails || transportDetails;
        const effectiveHasTransportDetails = effectiveTransportDetails.length > 0;
        const effectiveStatus = transport?.status ?? data.transport?.status ?? 'PENDING';
        const effectiveCompanyName = transport?.companyName ?? data.transport?.companyName ?? '';
        const effectiveTransporterName = transport?.transporterName ?? data.transport?.transporterName ?? '';
        const effectiveTransportFee = transport?.transportFee ?? data.transport?.transportFee ?? '';
        const effectiveReceiptNumber = transport?.receiptNumber ?? data.transport?.receiptNumber ?? '';
        const effectiveVehicleNumber = transport?.vehicleNumber ?? data.transport?.vehicleNumber ?? '';
        const effectiveTrackingNumber = transport?.trackingNumber ?? data.transport?.trackingNumber ?? '';
        const effectiveNotes = transport?.notes ?? data.transport?.notes ?? '';

        setInitial({
          transporterName: effectiveTransporterName,
          companyName: effectiveCompanyName,
          dispatchedDetails: saleDetails.map((detail) => {
            const matched = effectiveTransportDetails.find((item) => Number(item.saleDetailId) === Number(detail.id));
            const fallbackQty = effectiveHasTransportDetails
              ? 0
              : Number(detail.remainingQuantity ?? detail.quantity) || 0;
            return {
              saleDetailId: Number(detail.id),
              quantity: matched?.quantity ?? fallbackQty,
            };
          }),
          transportFee: effectiveTransportFee,
          receiptNumber: effectiveReceiptNumber,
          vehicleNumber: effectiveVehicleNumber,
          trackingNumber: effectiveTrackingNumber,
          notes: effectiveNotes,
          status: effectiveStatus,
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
  }, [saleId, transportId, router]);

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  if (!sale) {
    return <div className='p-6'>Sale not found</div>;
  }

  return (
    <TransportForm
      sale={sale}
      initial={initial}
      transportId={resolvedTransportId}
      redirectOnSuccess='/sales'
    />
  );
}
