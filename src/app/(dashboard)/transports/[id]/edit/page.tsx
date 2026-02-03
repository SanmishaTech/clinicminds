'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import TransportForm, { type TransportFormInitial, type TransportSaleInfo } from '../../transports-form';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { PERMISSIONS } from '@/config/roles';
import { usePermissions } from '@/hooks/use-permissions';

export default function EditTransportPage() {
  const params = useParams();
  const router = useRouter();
  const permissions = usePermissions();
  const transportId = params?.id ? Number(params.id) : null;

  // Memoize permission check to prevent re-renders
  const canEdit = useMemo(() => {
    return permissions.can(PERMISSIONS.EDIT_TRANSPORTS);
  }, [permissions]);

  const [transportData, setTransportData] = useState<any>(null);
  const [saleData, setSaleData] = useState<TransportSaleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transportId) {
      setError('Invalid transport ID');
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check permissions first
        if (!canEdit) {
          setError('You do not have permission to edit transports');
          return;
        }

        // Fetch transport data
        const transportResponse = await apiGet(`/api/transports/${transportId}`) as any;
        if (!transportResponse) {
          setError('Transport not found');
          return;
        }

        // Check if transport can be edited (only DISPATCHED status can be edited)
        const statusUpper = String(transportResponse.status || '').toUpperCase();
        if (statusUpper !== 'DISPATCHED') {
          setError('Only transports with DISPATCHED status can be edited');
          return;
        }

        setTransportData(transportResponse);

        // Fetch sale data and calculate remaining quantities
        if (transportResponse.saleId) {
          const saleResponse = await apiGet(`/api/sales/${transportResponse.saleId}`) as any;
          
          if (saleResponse) {
            // Calculate total dispatched quantities from all DISPATCHED transports
            const dispatchedQuantities = new Map<number, number>();
            
            if (saleResponse.transports?.length > 0) {
              saleResponse.transports
                .filter((transport: any) => String(transport.status || '').toUpperCase() === 'DISPATCHED')
                .forEach((transport: any) => {
                  (transport.transportDetails || []).forEach((detail: any) => {
                    const saleDetailId = Number(detail.saleDetailId);
                    const quantity = Number(detail.quantity) || 0;
                    dispatchedQuantities.set(saleDetailId, (dispatchedQuantities.get(saleDetailId) || 0) + quantity);
                  });
                });
            }
            
            setSaleData({
              saleId: saleResponse.id,
              invoiceNo: saleResponse.invoiceNo,
              invoiceDate: saleResponse.invoiceDate,
              franchiseName: saleResponse.franchise?.name || 'Unknown',
              saleDetails: saleResponse.saleDetails?.map((detail: any) => {
                const saleDetailId = Number(detail.id);
                const totalQuantity = Number(detail.quantity) || 0;
                const dispatchedQuantity = dispatchedQuantities.get(saleDetailId) || 0;
                const remainingQuantity = Math.max(0, totalQuantity - dispatchedQuantity);
                
                return {
                  id: detail.id,
                  medicineName: detail.medicine?.name || 'Unknown',
                  brandName: detail.medicine?.brand || 'N/A',
                  batchNumber: detail.batchNumber || 'N/A',
                  expiryDate: detail.expiryDate || 'N/A',
                  quantity: detail.quantity,
                  remainingQuantity,
                };
              }) || []
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch transport data:', err);
        setError('Failed to load transport data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [transportId, canEdit]);

  const handleSubmit = async (data: any) => {
    if (!transportId) return;

    try {
      // Prepare data for PATCH API
      const patchData = {
        transporterName: data.transporterName || null,
        companyName: data.companyName || null,
        transportFee: data.transportFee || null,
        receiptNumber: data.receiptNumber || null,
        vehicleNumber: data.vehicleNumber || null,
        trackingNumber: data.trackingNumber || null,
        notes: data.notes || null,
        dispatchedDetails: data.dispatchedDetails || null,
        dispatchedQuantity: data.dispatchedQuantity || null,
      };

      const response = await apiPatch(`/api/transports/${transportId}`, patchData) as any;
      
      if (response) {
        toast.success('Transport updated successfully!');
        router.push('/transports');
      }
    } catch (err: any) {
      console.error('Failed to update transport:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to update transport';
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    router.push('/transports');
  };

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <AppButton onClick={handleCancel}>Back to Transports</AppButton>
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (isLoading || !transportData || !saleData) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
          
          {/* Form card skeleton */}
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-16"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
            <div className="flex gap-4">
              <div className="h-10 bg-muted rounded w-24"></div>
              <div className="h-10 bg-muted rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prepare initial data for the form
  const initialData: TransportFormInitial = {
    transporterName: transportData.transporterName,
    companyName: transportData.companyName,
    transportFee: transportData.transportFee,
    receiptNumber: transportData.receiptNumber,
    vehicleNumber: transportData.vehicleNumber,
    trackingNumber: transportData.trackingNumber,
    notes: transportData.notes,
    status: transportData.status,
    dispatchedDetails: transportData.transportDetails?.map((detail: any) => ({
      saleDetailId: detail.saleDetailId,
      quantity: detail.quantity,
    })) || [],
  };

  return (
    <div className="container mx-auto py-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Edit Transport</AppCard.Title>
          <AppCard.Description>
            Edit transport details for Invoice {saleData.invoiceNo}
          </AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <TransportForm
            sale={saleData}
            initial={initialData}
            transportId={transportId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEdit={true}
          />
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
