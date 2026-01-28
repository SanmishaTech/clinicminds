'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { formatIndianCurrency, formatRelativeTime } from '@/lib/locales';

type MedicineBillDetail = {
  id: number;
  medicine: {
    id: number;
    name: string;
  };
  qty: number;
  mrp: number;
  amount: number;
};

type MedicineBill = {
  id: number;
  billNumber: string;
  billDate: string;
  totalAmount: number;
  discountPercent: number;
  patient?: {
    id: number;
    name: string;
  };
  franchise?: {
    id: number;
    name: string;
  };
  medicineDetails: MedicineBillDetail[];
  createdAt: string;
  updatedAt: string;
};

export default function MedicineBillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: bill, error, isLoading } = useSWR<MedicineBill>(
    `/api/medicine-bills/${id}`,
    apiGet
  );

  useEffect(() => {
    if (error) {
      toast.error('Failed to load medicine bill');
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded w-1/3 mb-2'></div>
          <div className='h-4 bg-gray-200 rounded w-1/2'></div>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='animate-pulse space-y-4'>
            <div className='h-6 bg-gray-200 rounded'></div>
            <div className='h-4 bg-gray-200 rounded'></div>
          </div>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className='space-y-6'>
        <div className='text-center py-12'>
          <h2 className='text-2xl font-semibold text-gray-900'>Medicine Bill Not Found</h2>
          <p className='text-gray-600 mt-2'>The medicine bill you're looking for doesn't exist.</p>
          <AppButton
            className='mt-4'
            onClick={() => router.push('/medicine-bills')}
          >
            Back to Medicine Bills
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Medicine Bill Details</h1>
          <p className='text-muted-foreground'>View medicine bill information</p>
        </div>
        <AppButton
          variant='outline'
          onClick={() => router.back()}
        >
          Back
        </AppButton>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <AppCard className='md:col-span-2'>
          <AppCard.Header>
            <AppCard.Title>Bill Information</AppCard.Title>
          </AppCard.Header>
          <AppCard.Content>
            <div className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-sm font-medium text-gray-500'>Bill Number</label>
                  <p className='text-lg font-semibold'>{bill.billNumber}</p>
                </div>
                <div>
                  <label className='text-sm font-medium text-gray-500'>Bill Date</label>
                  <p>{new Date(bill.billDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <label className='text-sm font-medium text-gray-500'>Patient</label>
                  <p>{bill.patient?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className='text-sm font-medium text-gray-500'>Franchise</label>
                  <p>{bill.franchise?.name || 'N/A'}</p>
                </div>
              </div>
              
              <div className='border-t pt-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>Discount</label>
                    <p>{bill.discountPercent}%</p>
                  </div>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>Total Amount</label>
                    <p className='text-lg font-semibold text-green-600'>
                      {formatIndianCurrency(bill.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className='border-t pt-4'>
                <div className='grid grid-cols-2 gap-4 text-sm text-gray-500'>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>Created</label>
                    <p>{formatRelativeTime(bill.createdAt)}</p>
                  </div>
                  <div>
                    <label className='text-sm font-medium text-gray-500'>Last Updated</label>
                    <p>{formatRelativeTime(bill.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </AppCard.Content>
        </AppCard>

        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Summary</AppCard.Title>
          </AppCard.Header>
          <AppCard.Content>
            <div className='space-y-3'>
              <div className='flex justify-between'>
                <span>Subtotal:</span>
                <span>{formatIndianCurrency(bill.totalAmount / (1 - bill.discountPercent / 100))}</span>
              </div>
              <div className='flex justify-between'>
                <span>Discount ({bill.discountPercent}%):</span>
                <span className='text-red-600'>
                  -{formatIndianCurrency((bill.totalAmount / (1 - bill.discountPercent / 100)) * (bill.discountPercent / 100))}
                </span>
              </div>
              <div className='flex justify-between font-semibold text-lg border-t pt-3'>
                <span>Total:</span>
                <span className='text-green-600'>{formatIndianCurrency(bill.totalAmount)}</span>
              </div>
            </div>
          </AppCard.Content>
        </AppCard>
      </div>

      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Medicine Details</AppCard.Title>
          <AppCard.Description>Medicines included in this bill</AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='border-b'>
                  <th className='text-left py-2 px-4 font-medium'>Medicine</th>
                  <th className='text-right py-2 px-4 font-medium'>Quantity</th>
                  <th className='text-right py-2 px-4 font-medium'>MRP</th>
                  <th className='text-right py-2 px-4 font-medium'>Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.medicineDetails.map((detail) => (
                  <tr key={detail.id} className='border-b'>
                    <td className='py-3 px-4'>{detail.medicine.name}</td>
                    <td className='text-right py-3 px-4'>{detail.qty}</td>
                    <td className='text-right py-3 px-4'>{formatIndianCurrency(detail.mrp)}</td>
                    <td className='text-right py-3 px-4 font-medium'>
                      {formatIndianCurrency(detail.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className='border-t-2'>
                  <td colSpan={3} className='py-3 px-4 font-semibold text-right'>
                    Total:
                  </td>
                  <td className='py-3 px-4 text-right font-semibold text-green-600'>
                    {formatIndianCurrency(bill.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
