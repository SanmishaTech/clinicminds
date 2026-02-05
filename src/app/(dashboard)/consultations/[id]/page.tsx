'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormRow } from '@/components/common/app-form';
import { formatIndianCurrency, formatDateTime } from '@/lib/locales';
import { ConsultationInvoicePDF } from '@/components/consultation/consultation-invoice-pdf';

type ConsultationData = {
  id: number;
  consultationNumber?: string;
  discountPercentage?: number | string;
  totalAmount: string;
  totalReceivedAmount?: string | null;
  complaint?: string;
  diagnosis?: string;
  remarks?: string;
  nextFollowUpDate?: string;
  casePaperUrl?: string;
  createdAt: string;
  updatedAt: string;
  appointment: {
    id: number;
    appointmentDateTime: string;
    type: string;
    patient: {
      patientNo: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      mobile: string;
      gender: string;
    };
    team?: {
      name: string;
    };
  };
  consultationDetails?: Array<{
    id: number;
    serviceId: number;
    description: string | null;
    qty: number;
    rate: number;
    amount: number;
    service: {
      id: number;
      name: string;
    } | null;
  }>;
  consultationMedicines?: Array<{
    id: number;
    medicineId: number;
    medicine?: {
      id: number;
      name: string;
      brand?: {
        id: number;
        name: string;
      };
    };
    qty: number;
    mrp: number;
    amount: number;
    doses?: string;
  }>;
  consultationReceipts?: Array<{
    id: number;
    receiptNumber: string;
    date: string;
    paymentMode: string;
    amount: number;
    payerName?: string;
    contactNumber?: string;
    upiName?: string;
    utrNumber?: string;
    bankName?: string;
    chequeNumber?: string;
    chequeDate?: string;
    notes?: string;
    createdAt: string;
  }>;
};

export default function ConsultationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const consultationId = params?.id ? Number(params.id) : null;
  
  const [consultationData, setConsultationData] = useState<ConsultationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  console.log(consultationData);
  useEffect(() => {
    const fetchConsultationDetails = async () => {
      if (!consultationId) return;

      setIsLoading(true);
      try {
        const response = await apiGet(`/api/consultations/${consultationId}`);
        setConsultationData(response as ConsultationData);
      } catch (error) {
        console.error('Failed to fetch consultation details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsultationDetails();
  }, [consultationId]);

  if (!consultationId) {
    return (
      <div className="container mx-auto p-6">
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-8 text-red-600">
              Invalid consultation ID
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-8">Loading consultation details...</div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  if (!consultationData) {
    return (
      <div className="container mx-auto p-6">
        <AppCard>
          <AppCard.Content>
            <div className="text-center py-8 text-gray-500">
              Consultation not found
            </div>
          </AppCard.Content>
        </AppCard>
      </div>
    );
  }

  const currentBalance = parseFloat(consultationData.totalAmount) - 
    parseFloat(consultationData.totalReceivedAmount || '0');

  // Calculate totals
  const hasServices = consultationData.consultationDetails && consultationData.consultationDetails.length > 0;
  const hasMedicines = consultationData.consultationMedicines && consultationData.consultationMedicines.length > 0;
  
  const servicesSubtotal = hasServices 
    ? consultationData.consultationDetails!.reduce((sum, detail) => sum + parseFloat(detail.amount.toString()), 0)
    : 0;
  
  const medicinesSubtotal = hasMedicines
    ? consultationData.consultationMedicines!.reduce((sum, medicine) => sum + parseFloat(medicine.amount.toString()), 0)
    : 0;
  
  const subtotal = servicesSubtotal + medicinesSubtotal;
  const discountPercentage = parseFloat(consultationData.discountPercentage?.toString() || '0') || 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const generateInvoicePDF = ConsultationInvoicePDF({
    consultationData,
    servicesSubtotal,
    medicinesSubtotal,
    subtotal,
    discountPercentage,
    discountAmount,
    totalAmount
  });

  // Component for totals display
  const TotalsDisplay = ({ 
    showServicesSubtotal = false, 
    showMedicinesSubtotal = false, 
    showSubtotal = true 
  }) => (
    <>
      {showServicesSubtotal && (
        <div className="grid grid-cols-4 gap-0 border-t">
          <div className="col-span-3 px-4 py-2 font-medium text-sm text-right border-r">
            {consultationData.appointment.type === 'PROCEDURE' ? 'Procedures' : 'Services'} Total:
          </div>
          <div className="px-4 py-2 font-medium text-sm">
            {formatIndianCurrency(servicesSubtotal)}
          </div>
        </div>
      )}
      {showMedicinesSubtotal && (
        <div className="grid grid-cols-4 gap-0 border-t">
          <div className="col-span-3 px-4 py-2 font-medium text-sm text-right border-r">Medicines Total:</div>
          <div className="px-4 py-2 font-medium text-sm">
            {formatIndianCurrency(medicinesSubtotal)}
          </div>
        </div>
      )}
      {showSubtotal && (
        <div className="grid grid-cols-4 gap-0 border-t-2">
          <div className="col-span-3 px-4 py-2 font-medium text-sm text-right border-r">Subtotal:</div>
          <div className="px-4 py-2 font-medium text-sm">
            {formatIndianCurrency(subtotal)}
          </div>
        </div>
      )}
      {discountPercentage > 0 && (
        <div className="grid grid-cols-4 gap-0 border-t">
          <div className="col-span-3 px-4 py-2 font-medium text-sm text-right border-r">
            Discount ({discountPercentage}%):
          </div>
          <div className="px-4 py-2 font-medium text-sm">
            {formatIndianCurrency(discountAmount)}
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-0 border-t-2 bg-muted">
        <div className="col-span-3 px-4 py-2 font-bold text-base text-right border-r">Total Amount:</div>
        <div className="px-4 py-2 font-bold text-base">
          {formatIndianCurrency(totalAmount)}
        </div>
      </div>
    </>
  );

  return (
    <div className="container mx-auto p-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Consultation Information</AppCard.Title>
          <AppCard.Description>View detailed information about this consultation</AppCard.Description>
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
          <FormRow cols={4}>
            <div>
              <label className="block text-sm font-medium">Patient No</label>
              <p className="text-sm">{consultationData.appointment.patient.patientNo}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Patient Name</label>
              <p className="text-sm">
                {consultationData.appointment.patient.firstName} 
                {consultationData.appointment.patient.middleName && ` ${consultationData.appointment.patient.middleName}`}
                {consultationData.appointment.patient.lastName && ` ${consultationData.appointment.patient.lastName}`}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Mobile</label>
              <p className="text-sm">{consultationData.appointment.patient.mobile}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Gender</label>
              <p className="text-sm">{consultationData.appointment.patient.gender}</p>
            </div>
          </FormRow>
          <FormRow cols={5}>
            <div>
              <label className="block text-sm font-medium">Appointment Date and Time</label>
              <p className="text-sm">
                {formatDateTime(new Date(consultationData.appointment.appointmentDateTime), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Total Amount</label>
              <p className="text-sm font-medium">
                {formatIndianCurrency(parseFloat(consultationData.totalAmount))}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Received Amount</label>
              <p className="text-sm font-medium text-green-600">
                {formatIndianCurrency(parseFloat(consultationData.totalReceivedAmount || '0'))}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Balance Amount</label>
              <p className="text-sm font-medium text-red-600">
                {formatIndianCurrency(currentBalance)}
              </p>
            </div>
            <AppButton
             type='button'
             iconName='Download'
             size='sm'
             onClick={generateInvoicePDF}
             >
              Download Invoice
            </AppButton>
          </FormRow>

          {/* Additional Consultation Information */}
          <FormRow cols={4}>
            <div>
              <label className="block text-sm font-medium">Complaint</label>
              <p className="text-sm">{consultationData.complaint || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Diagnosis</label>
              <p className="text-sm">{consultationData.diagnosis || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Remarks</label>
              <p className="text-sm">{consultationData.remarks || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Next FollowUp Date</label>
              <p className="text-sm">
                {consultationData.nextFollowUpDate 
                  ? formatDateTime(new Date(consultationData.nextFollowUpDate), { year: 'numeric', month: '2-digit', day: '2-digit' })
                  : '—'
                }
              </p>
            </div>
          </FormRow>
          <FormRow cols={1}>
            <div className="flex justify-end">
              <AppButton
                type='button'
                iconName='FileText'
                size='sm'
                disabled={!consultationData.casePaperUrl}
                onClick={() => {
                  if (consultationData.casePaperUrl) {
                    window.open(consultationData.casePaperUrl, '_blank');
                  }
                }}
              >
                View Casepaper
              </AppButton>
            </div>
          </FormRow>

          {/* Services and Medicines Details */}
          {hasServices && !hasMedicines && (
            <div className="mt-4">
              <h4 className="font-semibold text-base mb-2">{consultationData.appointment.type === 'PROCEDURE' ? 'Procedures' : 'Services'}</h4>
              <div className="border rounded">
                <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                  <div className="px-4 py-2 font-medium text-sm border-r">{consultationData.appointment.type === 'PROCEDURE' ? 'Procedure' : 'Service'}</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Description</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Rate</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Amount</div>
                </div>
                {consultationData.consultationDetails?.map((detail, index) => (
                  <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                    <div className="px-4 py-2 font-medium text-sm border-r">{detail.service?.name || '—'}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{detail.description || '—'}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(detail.rate)}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(detail.amount)}</div>
                  </div>
                ))}
                <TotalsDisplay showServicesSubtotal={false} showSubtotal={true} />
              </div>
            </div>
          )}

          {!hasServices && hasMedicines && (
            <div className="mt-4">
              <h4 className="font-semibold text-base mb-2">Medicines</h4>
              <div className="border rounded">
                <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                  <div className="px-4 py-2 font-medium text-sm border-r">Medicine</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Qty</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">MRP</div>
                  <div className="px-4 py-2 font-medium text-sm border-r">Amount</div>
                </div>
                {consultationData.consultationMedicines?.map((medicine, index) => (
                  <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                    <div className="px-4 py-2 font-medium text-sm border-r">{medicine.medicine?.name || '—'}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{medicine.qty}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(medicine.mrp)}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(medicine.amount)}</div>
                  </div>
                ))}
                <TotalsDisplay showMedicinesSubtotal={false} showSubtotal={true} />
              </div>
            </div>
          )}

          {hasServices && hasMedicines && (
            <>
              {/* Services Section */}
              <div className="mt-4">
                <h4 className="font-semibold text-base mb-2">{consultationData.appointment.type === 'PROCEDURE' ? 'Procedures' : 'Services'}</h4>
                <div className="border rounded">
                  <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                    <div className="px-4 py-2 font-medium text-sm border-r">{consultationData.appointment.type === 'PROCEDURE' ? 'Procedure' : 'Service'}</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">Description</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">Rate</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">Amount</div>
                  </div>
                  {consultationData.consultationDetails?.map((detail, index) => (
                    <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                      <div className="px-4 py-2 font-medium text-sm border-r">{detail.service?.name || '—'}</div>
                      <div className="px-4 py-2 font-medium text-sm border-r">{detail.description || '—'}</div>
                      <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(detail.rate)}</div>
                      <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(detail.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medicines Section */}
              <div className="mt-4">
                <h4 className="font-semibold text-base mb-2">Medicines</h4>
                <div className="border rounded">
                  <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                    <div className="px-4 py-2 font-medium text-sm border-r">Medicine</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">Qty</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">MRP</div>
                    <div className="px-4 py-2 font-medium text-sm border-r">Amount</div>
                  </div>
                  {consultationData.consultationMedicines?.map((medicine, index) => (
                    <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                      <div className="px-4 py-2 font-medium text-sm border-r">{medicine.medicine?.name || '—'}</div>
                      <div className="px-4 py-2 font-medium text-sm border-r">{medicine.qty}</div>
                      <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(medicine.mrp)}</div>
                      <div className="px-4 py-2 font-medium text-sm border-r">{formatIndianCurrency(medicine.amount)}</div>
                    </div>
                  ))}
                  <TotalsDisplay showServicesSubtotal={true} showMedicinesSubtotal={true} showSubtotal={true} />
                </div>
              </div>
            </>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}