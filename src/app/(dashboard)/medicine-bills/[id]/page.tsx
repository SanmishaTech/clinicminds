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
    brand: string | null;
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
  const id = (params as any)?.id as string | undefined;

  if (!id) {
    return (
      <div className='space-y-6'>
        <div className='text-center py-12'>
          <h2 className='text-2xl font-semibold text-gray-900'>Medicine Bill Not Found</h2>
          <p className='text-gray-600 mt-2'>The medicine bill you're looking for doesn't exist.</p>
          <AppButton className='mt-4' onClick={() => router.push('/medicine-bills')}>
            Back to Medicine Bills
          </AppButton>
        </div>
      </div>
    );
  }

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
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Medicine Bill Details</AppCard.Title>
          <AppCard.Description>View detailed information about this medicine bill</AppCard.Description>
          <AppCard.Action>
            <AppButton
              variant='outline'
              onClick={() => router.back()}
              iconName='ArrowLeft'
            >
              Back
            </AppButton>
          </AppCard.Action>
        </AppCard.Header>
        <AppCard.Content>
          <div className='space-y-6'>
            {/* Patient Information */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
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

            {/* Bill Information */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <span className="font-semibold text-base">Bill No:</span>
                <p className="font-semibold">{bill.billNumber}</p>
              </div>
              <div>
                <span className="font-semibold text-base">Bill Date:</span>
                <p>{new Date(bill.billDate).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="font-semibold text-base">Discount:</span>
                <p className="font-semibold">{bill.discountPercent}%</p>
              </div>
              <div>
                <span className="font-semibold text-base">Total Amount:</span>
                <p className="font-semibold text-green-600">
                  {formatIndianCurrency(bill.totalAmount)}
                </p>
              </div>
              <div className="flex items-end">
                <AppButton
                  type='button'
                  iconName='Download'
                  size='sm'
                  onClick={() => console.log('Download Invoice')}
                >
                  Download Invoice
                </AppButton>
              </div>
            </div>

            {/* Medicine Details Table */}
            {bill.medicineDetails.length > 0 && (
              <div>
                <h3 className="font-semibold text-base mb-3">Medicines</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                    <div className="px-4 py-3 font-medium text-sm border-r">Medicine</div>
                    <div className="px-4 py-3 font-medium text-sm border-r">Quantity</div>
                    <div className="px-4 py-3 font-medium text-sm border-r">MRP</div>
                    <div className="px-4 py-3 font-medium text-sm border-r">Amount</div>
                  </div>
                  {bill.medicineDetails.map((detail, index) => (
                    <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {`${detail.medicine.name} - ${detail.medicine.brand || 'Unknown Brand'}`}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {detail.qty}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {formatIndianCurrency(detail.mrp)}
                      </div>
                      <div className="px-4 py-3 font-medium text-sm border-r">
                        {formatIndianCurrency(detail.amount)}
                      </div>
                    </div>
                  ))}
                  {/* Financial Summary - Match sales/purchases structure */}
                  <div className="grid grid-cols-4 gap-0 border-t">
                    <div className="col-span-3 px-4 py-2 font-medium text-sm text-right border-r">Subtotal:</div>
                    <div className="px-4 py-2 font-medium text-sm">
                      {formatIndianCurrency(bill.totalAmount / (1 - bill.discountPercent / 100))}
                    </div>
                  </div>
                  {bill.discountPercent > 0 && (
                    <div className="grid grid-cols-4 gap-0 border-t">
                      <div className="col-span-3 px-4 py-2 font-medium text-sm text-right border-r">Discount ({bill.discountPercent}%):</div>
                      <div className="px-4 py-2 font-medium text-sm">
                        -{formatIndianCurrency((bill.totalAmount / (1 - bill.discountPercent / 100)) * bill.discountPercent / 100)}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-0 border-t-2 bg-muted">
                    <div className="col-span-3 px-4 py-2 font-bold text-base text-right border-r">Total Amount:</div>
                    <div className="px-4 py-2 font-bold text-base text-green-600">
                      {formatIndianCurrency(bill.totalAmount)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </AppCard.Content>
      </AppCard>
    </div>
  );
}
