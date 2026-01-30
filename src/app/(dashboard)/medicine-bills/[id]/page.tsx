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
    brand:{
      name:string;
    }
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
    patientNo: string;
    firstName: string;
    middleName: string;
    lastName: string;
    mobile: string;
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
        <AppButton
          variant='outline'
          onClick={() => router.back()}
          iconName='ArrowLeft'
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
               <div className='grid grid-cols-3 gap-4'>
                  <div>
                    <label className='text-sm font-medium'>Patient No</label>
                    <p>{bill.patient?.patientNo || 'N/A'}</p>
                  </div>
                  <div>
                    <label className='text-sm font-medium'>Patient Name</label>
                    <p>{[bill.patient?.firstName, bill.patient?.middleName, bill.patient?.lastName].filter(Boolean).join(' ') || 'N/A'}</p>
                  </div>
                  <div>
                    <label className='text-sm font-medium'>Mobile Number</label>
                    <p>{bill.patient?.mobile || 'N/A'}</p>
                  </div>
                </div>
              
              <div className='border-t pt-4'>
               
                <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='text-sm font-medium'>Bill Number</label>
                  <p className='text-lg font-semibold'>{bill.billNumber}</p>
                </div>
                <div>
                  <label className='text-sm font-medium'>Bill Date</label>
                  <p>{new Date(bill.billDate).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              </div>
              
              <div className='border-t pt-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='text-sm font-medium'>Discount</label>
                    <p>{bill.discountPercent}%</p>
                  </div>
                  <div>
                    <label className='text-sm font-medium'>Total Amount</label>
                    <p className='text-lg font-semibold text-green-600'>
                      {formatIndianCurrency(bill.totalAmount)}
                    </p>
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
                <span>
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
          <div>
            <h3 className="font-semibold text-base mb-3">Medicines</h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                <div className="px-4 py-3 font-medium text-sm border-r">Medicine</div>
                <div className="px-4 py-3 font-medium text-sm border-r">Quantity</div>
                <div className="px-4 py-3 font-medium text-sm border-r">MRP</div>
                <div className="px-4 py-3 font-medium text-sm">Amount</div>
              </div>
              {bill.medicineDetails.map((detail, index) => (
                <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                  <div className="px-4 py-3 font-medium text-sm border-r">
                    {`${detail.medicine.name} - ${detail.medicine.brand.name}`}
                  </div>
                  <div className="px-4 py-3 font-medium text-sm border-r">
                    {detail.qty}
                  </div>
                  <div className="px-4 py-3 font-medium text-sm border-r">
                    {formatIndianCurrency(detail.mrp)}
                  </div>
                  <div className="px-4 py-3 font-medium text-sm">
                    {formatIndianCurrency(detail.amount)}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-0 border-t-2">
                <div className="px-4 py-3 font-semibold text-sm col-span-3 text-right">
                  Subtotal:
                </div>
                <div className="px-4 py-3 font-semibold text-sm">
                  {formatIndianCurrency(bill.totalAmount / (1 - bill.discountPercent / 100))}
                </div>
              </div>
            </div>
          </div>
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
