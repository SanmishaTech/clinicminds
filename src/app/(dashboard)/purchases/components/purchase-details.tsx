'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { formatIndianCurrency } from '@/lib/locales';

type SaleDetail = {
  id: number;
  medicine: {
    id: number;
    name: string;
    brand: string | null;
  } | null;
  quantity: number;
  mrp: number;
  amount: number;
};

type SaleDetailsData = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  discountPercent: number;
  transport: {
    id: number;
    status: string;
  } | null;
  saleDetails: SaleDetail[];
};

export default function PurchaseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params?.id ? Number(params.id) : null;
  
  const [saleData, setSaleData] = useState<SaleDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSaleDetails = async () => {
      if (!saleId) return;

      setIsLoading(true);
      try {
        const response = await apiGet(`/api/sales/${saleId}`);
        setSaleData(response as SaleDetailsData);
      } catch (error) {
        console.error('Failed to fetch purchase details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSaleDetails();
  }, [saleId]);

  if (!saleId) {
    return (
      <div className="container mx-auto p-6">
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-8 text-red-600">
              Invalid purchase ID
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Purchase Details</AppCard.Title>
          <AppCard.Description>
            View detailed information about this purchase
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
            <div className="text-center py-8">Loading purchase details...</div>
          ) : saleData ? (
            <div className="space-y-6">
              {/* Purchase Information */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-semibold text-base">Invoice No:</span>
                  <p className="font-semibold">{saleData.invoiceNo}</p>
                </div>
                <div>
                  <span className="font-semibold text-base">Date:</span>
                  <p>{new Date(saleData.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-semibold text-base">Discount:</span>
                  <p className="font-semibold">{saleData.discountPercent}%</p>
                </div>
                <div>
                  <span className="font-semibold text-base">Total Amount:</span>
                  <p className="font-semibold text-green-600">
                    {formatIndianCurrency(saleData.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Purchase Details Table */}
              {saleData.saleDetails.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base mb-3">Medicines</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                      <div className="px-4 py-3 font-medium text-sm border-r">Medicine</div>
                      <div className="px-4 py-3 font-medium text-sm border-r">Brand</div>
                      <div className="px-4 py-3 font-medium text-sm border-r">Quantity</div>
                      <div className="px-4 py-3 font-medium text-sm">Amount</div>
                    </div>
                    {saleData.saleDetails.map((detail, index) => (
                      <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.medicine?.name || '—'}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.medicine?.brand || 'Unknown Brand'}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm border-r">
                          {detail.quantity}
                        </div>
                        <div className="px-4 py-3 font-medium text-sm">
                          {formatIndianCurrency(detail.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No purchase details available
            </div>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
