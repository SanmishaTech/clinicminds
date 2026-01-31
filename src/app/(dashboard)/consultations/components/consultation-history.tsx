'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { AppCard } from '@/components/common/app-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Appointment = {
  id: number;
  appointmentDateTime: string;
  visitPurpose: string | null;
  patient: {
    id: number;
    firstName: string;
    lastName: string;
    mobile: string;
  };
  team: {
    id: number;
    name: string;
  };
};

type ConsultationHistory = {
  id: number;
  appointmentDateTime: string;
  complaint: string | null;
  diagnosis: string | null;
  remarks: string | null;
  consultationDetails: Array<{
    service: { id: number; name: string } | null;
    description: string | null;
    qty: number;
  }>;
  consultationMedicines: Array<{
    medicine: { id: number; name: string; brand: string | null } | null;
    qty: number;
    doses: string | null;
  }>;
};

interface ConsultationHistoryProps {
  appointmentId?: number;
}

export function ConsultationHistory({ appointmentId }: ConsultationHistoryProps) {
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchConsultationHistory = async () => {
      if (!appointmentId) return;

      setIsLoading(true);
      try {
        // First get the appointment to get patient ID
        const appointmentRes = await apiGet(`/api/appointments/${appointmentId}`);
        const appointment = appointmentRes as Appointment;

        // Fetch all consultations for this patient
        const historyRes = await apiGet(`/api/consultations?patientId=${appointment.patient.id}`);
        const historyData = historyRes as any;
        
        // Transform the data to match our history format
        const transformedHistory = (historyData.data || []).map((consultation: any) => ({
          id: consultation.id,
          appointmentDateTime: consultation.appointment.appointmentDateTime,
          complaint: consultation.complaint,
          diagnosis: consultation.diagnosis,
          remarks: consultation.remarks,
          consultationDetails: consultation.consultationDetails.map((detail: any) => ({
            service: detail.service,
            description: detail.description,
            qty: detail.qty,
          })),
          consultationMedicines: consultation.consultationMedicines.map((medicine: any) => ({
            medicine: medicine.medicine,
            qty: medicine.qty,
            doses: medicine.doses,
          })),
        }));
        
        setConsultationHistory(transformedHistory);
      } catch (error) {
        console.error('Failed to fetch consultation history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsultationHistory();
  }, [appointmentId]);

  if (isLoading) {
    return (
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Consultation History</AppCard.Title>
          <AppCard.Description>
            View all previous consultations for this patient
          </AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <div className="text-center py-8">Loading consultation history...</div>
        </AppCard.Content>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Consultation History</AppCard.Title>
        <AppCard.Description>
          View all previous consultations for this patient
        </AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        {consultationHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No consultation history available
          </div>
        ) : (
          <Accordion type="single" className="space-y-4" collapsible>
            {consultationHistory.map((consultation) => (
              <AccordionItem key={consultation.id} value={`consultation-${consultation.id}`} className="border rounded-lg">
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <div className="flex items-center text-left">
                    <div className="font-medium text-base">
                      {new Date(consultation.appointmentDateTime).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit'
                      }).replace(/\//g, '/')} {new Date(consultation.appointmentDateTime).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="font-medium">Complaint:</span>
                        <p>{consultation.complaint || '—'}</p>
                      </div>
                      <div>
                        <span className="font-medium">Diagnosis:</span>
                        <p>{consultation.diagnosis || '—'}</p>
                      </div>
                      <div>
                        <span className="font-medium">Remarks:</span>
                        <p>{consultation.remarks || '—'}</p>
                      </div>
                    </div>

                    {consultation.consultationDetails.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Services</h4>
                        <div className="border rounded">
                          <div className="grid grid-cols-2 gap-0 bg-muted border-b">
                            <div className="px-4 py-2 font-medium text-sm border-r">Service</div>
                            <div className="px-4 py-2 font-medium text-sm">Description</div>
                          </div>
                          {consultation.consultationDetails.map((detail, index) => (
                            <div key={index} className="grid grid-cols-2 gap-0 border-b last:border-b-0">
                              <div className="px-4 py-2 border-r">{detail.service?.name || '—'}</div>
                              <div className="px-4 py-2">{detail.description || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {consultation.consultationMedicines.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Medicines</h4>
                        <div className="border rounded">
                          <div className="grid grid-cols-4 gap-0 bg-muted border-b">
                            <div className="px-4 py-2 font-medium text-sm border-r">Medicine</div>
                            <div className="px-4 py-2 font-medium text-sm border-r">Brand</div>
                            <div className="px-4 py-2 font-medium text-sm border-r">Qty</div>
                            <div className="px-4 py-2 font-medium text-sm text-center">Doses</div>
                          </div>
                          {consultation.consultationMedicines.map((medicine, index) => (
                            <div key={index} className="grid grid-cols-4 gap-0 border-b last:border-b-0">
                              <div className="px-4 py-2 border-r">{medicine.medicine?.name || '—'}</div>
                              <div className="px-4 py-2 border-r">{medicine.medicine?.brand || 'Unknown Brand'}</div>
                              <div className="px-4 py-2 border-r">{medicine.qty}</div>
                              <div className="px-4 py-2 text-center">{medicine.doses || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </AppCard.Content>
    </AppCard>
  );
}
