'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { formatIndianCurrency, formatDate, formatDateTime } from '@/lib/locales';
import { StatusBadge } from '@/components/common/status-badge';

type TransportDetail = {
  id: number;
  saleDetailId: number;
  quantity: number;
  saleDetail?: {
    id: number;
    medicine?: {
      id: number;
      name: string;
      brand: string | null;
      franchiseRate: number;
    } | null;
    batchNumber?: string;
    expiryDate?: string;
    mrp?: number;
    amount?: number;
  };
};

type TransportDetailsData = {
  id: number;
  saleId: number;
  franchiseId: number;
  status: string;
  dispatchedQuantity: number;
  transporterName?: string | null;
  companyName?: string | null;
  transportFee?: number | string | null;
  receiptNumber?: string | null;
  vehicleNumber?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  stockPostedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  transportDetails: TransportDetail[];
  sale?: {
    invoiceNo: string;
    invoiceDate: string;
    totalAmount: number | string;
    discountPercent?: number | string;
  };
  franchise?: {
    name: string;
  };
};

export default function TransportDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const transportId = params?.id ? Number(params.id) : null;
  
  const [transportData, setTransportData] = useState<TransportDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch sale detail information
  const fetchSaleDetail = async (saleDetailId: number) => {
    try {
      // First get the transport data to find the sale ID
      const transportResponse = await apiGet(`/api/transports/${transportId}`) as any;
      if (!transportResponse?.saleId) return null;
      
      // Get the full sale with all details
      const saleResponse = await apiGet(`/api/sales/${transportResponse.saleId}`) as any;
      if (!saleResponse?.saleDetails) return null;
      
      // Find the specific sale detail
      const saleDetail = saleResponse.saleDetails.find((detail: any) => detail.id === saleDetailId);
      return saleDetail || null;
    } catch (err) {
      console.error(`Failed to fetch sale detail ${saleDetailId}:`, err);
      return null;
    }
  };

  useEffect(() => {
    if (!transportId) return;
    
    const fetchTransportDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching transport details for ID:', transportId);
        const response = await apiGet(`/api/transports/${transportId}`) as any;
        console.log('API Response:', response);
        
        if (response && response.transportDetails) {
          // Fetch detailed sale information for each transport detail
          const transportDetailsWithSaleInfo = await Promise.all(
            response.transportDetails.map(async (detail: any) => {
              const saleDetail = await fetchSaleDetail(detail.saleDetailId);
              return {
                ...detail,
                saleDetail: saleDetail
              };
            })
          );
          
          setTransportData({
            ...response,
            transportDetails: transportDetailsWithSaleInfo
          });
        } else {
          console.error('No data received');
          setError('Failed to fetch transport details');
        }
      } catch (err) {
        console.error('Error fetching transport details:', err);
        setError('An error occurred while fetching transport details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransportDetails();
  }, [transportId]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
          
          {/* Transport info card skeleton */}
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-4 bg-muted rounded w-32"></div>
                <div className="h-4 bg-muted rounded w-28"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-4 bg-muted rounded w-36"></div>
                <div className="h-4 bg-muted rounded w-30"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-22"></div>
                <div className="h-4 bg-muted rounded w-34"></div>
                <div className="h-4 bg-muted rounded w-26"></div>
              </div>
            </div>
          </div>
          
          {/* Table skeleton */}
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
            <div className="border rounded-lg overflow-hidden">
              <div className="h-12 bg-muted/80 border-b"></div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/60 border-b last:border-b-0"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !transportData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error || 'Transport not found'}</p>
          <AppButton onClick={() => router.back()}>Go Back</AppButton>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Transport Details</AppCard.Title>
          <AppCard.Description>
            View detailed information about this transport
          </AppCard.Description>
          <AppCard.Action>
            <AppButton
              variant="secondary"
              onClick={() => router.back()}
              iconName="ArrowLeft"
            >
              Back
            </AppButton>
          </AppCard.Action>
        </AppCard.Header>
        <AppCard.Content>
          {isLoading ? (
            <div className="text-center py-8">Loading transport details...</div>
          ) : transportData ? (
            <div className="space-y-6">

      {/* Transport Information */}
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Transport Information</AppCard.Title>
          <AppCard.Description>Details about the transport and shipment</AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <StatusBadge
                    status={transportData.status.toLowerCase()}
                    stylesMap={{
                      pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
                      dispatched: { label: 'Dispatched', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                      delivered: { label: 'Delivered', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                    }}
                  />
                </div>
                <div className="flex justify-between">
                  <span>Franchise:</span>
                  <span className="font-medium">{transportData.franchise?.name || '—'}</span>
                </div>
              </div>
            </div>

            {/* Transporter Info */}
            <div className="space-y-4">
              <h3 className="font-semibold">Transporter Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Transporter Name:</span>
                  <span className="font-medium">{transportData.transporterName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Company Name:</span>
                  <span className="font-medium">{transportData.companyName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vehicle Number:</span>
                  <span className="font-medium">{transportData.vehicleNumber || '—'}</span>
                </div>
              </div>
            </div>

            {/* Tracking Info */}
            <div className="space-y-4">
              <h3 className="font-semibold">Tracking Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Receipt Number:</span>
                  <span className="font-medium">{transportData.receiptNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tracking Number:</span>
                  <span className="font-medium">{transportData.trackingNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport Fee:</span>
                  <span className="font-medium">
                    {transportData.transportFee ? formatIndianCurrency(Number(transportData.transportFee)) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-sm">Created</p>
              <p className="font-medium">{transportData.createdAt ? formatDateTime(new Date(transportData.createdAt), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</p>
            </div>
            <div>
              <p className="text-sm">Dispatched</p>
              <p className="font-medium">{transportData.dispatchedAt ? formatDateTime(new Date(transportData.dispatchedAt), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Not dispatched'}</p>
            </div>
            <div>
              <p className="text-sm">Delivered</p>
              <p className="font-medium">{transportData.deliveredAt ? formatDateTime(new Date(transportData.deliveredAt), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Not delivered'}</p>
            </div>
            <div>
              <p className="text-sm">Stock Posted</p>
              <p className="font-medium">{transportData.stockPostedAt ? formatDateTime(new Date(transportData.stockPostedAt), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Not posted'}</p>
            </div>
          </div>

          {/* Notes */}
          {transportData.notes && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p>{transportData.notes}</p>
            </div>
          )}
        </AppCard.Content>
      </AppCard>

      {/* Sale Information */}
      {transportData.sale && (
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Sale Information</AppCard.Title>
            <AppCard.Description>Related sale details</AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm">Invoice Number</p>
                <p className="font-medium">{transportData.sale.invoiceNo}</p>
              </div>
              <div>
                <p className="text-sm">Invoice Date</p>
                <p className="font-medium">{formatDate(transportData.sale.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-sm">Discount</p>
                <p className="font-medium">{transportData.sale.discountPercent ? `${transportData.sale.discountPercent}%` : '—'}</p>
              </div>
              <div>
                <p className="text-sm">Total Amount</p>
                <p className="font-medium">{formatIndianCurrency(Number(transportData.sale.totalAmount))}</p>
              </div>
            </div>
          </AppCard.Content>
        </AppCard>
      )}

      {/* Dispatched Medicines */}
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Dispatched Medicines</AppCard.Title>
          <AppCard.Description>
            Total dispatched quantity: {transportData.dispatchedQuantity} units
          </AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          {transportData.transportDetails && transportData.transportDetails.length > 0 ? (
            <div>
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-8 gap-0 bg-muted border-b">
                  <div className="px-4 py-3 font-medium text-sm border-r">Medicine</div>
                  <div className="px-4 py-3 font-medium text-sm border-r">Brand</div>
                  <div className="px-4 py-3 font-medium text-sm border-r">Batch No</div>
                  <div className="px-4 py-3 font-medium text-sm border-r">Expiry</div>
                  <div className="px-4 py-3 font-medium text-sm border-r">Rate</div>
                  <div className="px-4 py-3 font-medium text-sm border-r">Dispatched Qty</div>
                  <div className="px-4 py-3 font-medium text-sm border-r">Discount %</div>
                  <div className="px-4 py-3 font-medium text-sm">Amount</div>
                </div>
                {transportData.transportDetails.map((detail, index) => {
                  const rate = detail.saleDetail?.medicine?.franchiseRate || 0;
                  const quantity = detail.quantity || 0;
                  const discountPercent = transportData.sale?.discountPercent ? Number(transportData.sale.discountPercent) : 0;
                  const grossAmount = rate * quantity;
                  const discountAmount = grossAmount * (discountPercent / 100);
                  const amount = grossAmount - discountAmount;
                  
                  return (
                    <div key={detail.id || index} className="grid grid-cols-8 gap-0 border-b last:border-b-0">
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {detail.saleDetail?.medicine?.name || 'Unknown Medicine'}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {detail.saleDetail?.medicine?.brand || 'N/A'}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {detail.saleDetail?.batchNumber || '—'}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {detail.saleDetail?.expiryDate ? new Date(detail.saleDetail.expiryDate).toLocaleDateString() : '—'}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {formatIndianCurrency(rate)}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {quantity}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {discountPercent > 0 ? `${discountPercent}%` : '—'}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm">
                        {formatIndianCurrency(amount)}
                      </div>
                    </div>
                  );
                })}
                
                {/* Total Amount Row */}
                <div className="grid grid-cols-8 gap-0 bg-muted border-t">
                  <div className="px-4 py-3 font-medium text-sm border-r" style={{ gridColumn: 'span 7' }}>
                    <span className="font-semibold">Total Amount</span>
                  </div>
                  <div className="px-4 py-3 font-semibold text-sm">
                    {formatIndianCurrency(
                      transportData.transportDetails.reduce((total, detail) => {
                        const rate = detail.saleDetail?.medicine?.franchiseRate || 0;
                        const quantity = detail.quantity || 0;
                        const discountPercent = transportData.sale?.discountPercent ? Number(transportData.sale.discountPercent) : 0;
                        const grossAmount = rate * quantity;
                        const discountAmount = grossAmount * (discountPercent / 100);
                        const amount = grossAmount - discountAmount;
                        return total + amount;
                      }, 0)
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p>No medicines dispatched in this transport</p>
            </div>
          )}
        </AppCard.Content>
      </AppCard>
            </div>
          ) : (
            <div className="text-center py-8">
              <p>No transport data found</p>
            </div>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
