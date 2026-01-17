'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SalesForm } from '../../sales-form';
import { SalesFormValues } from '@/lib/schemas/frontend/sales';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type SaleApiResponse = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  franchiseId: number;
  totalAmount: number;
  saleDetails: {
    medicineId: number;
    quantity: number;
    rate: number;
    amount: number;
    medicine: {
      id: number;
      name: string;
      brand: string;
    };
  }[];
};

export default function EditSalePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [initialData, setInitialData] = useState<SalesFormValues | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const sale = await apiGet(`/api/sales/${params.id}`) as SaleApiResponse;
        // Transform the API response to match the expected form data structure
        const transformedData: SalesFormValues = {
          invoiceNo: sale.invoiceNo,
          invoiceDate: sale.invoiceDate,
          franchiseId: sale.franchiseId?.toString(),
          totalAmount: sale.totalAmount.toString(),
          saleDetails: sale.saleDetails?.map((detail: any) => ({
            medicineId: detail.medicineId.toString(),
            quantity: detail.quantity.toString(),
            rate: detail.rate.toString(),
            amount: detail.amount.toString()
          })) || []
        };
        setInitialData(transformedData);
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

  return <SalesForm mode='edit' saleId={parseInt(params.id as string)} initialData={initialData} />;
}

