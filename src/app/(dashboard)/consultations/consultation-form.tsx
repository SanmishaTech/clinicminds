'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { AppCheckbox } from '@/components/common/app-checkbox';
import { FormSection, FormRow } from '@/components/common/app-form';
import { Form } from '@/components/ui/form';
import { formatIndianCurrency } from '@/lib/locales';
import { TextInput } from '@/components/common/text-input';
import { TextareaInput } from '@/components/common/textarea-input';
import { ComboboxInput } from '@/components/common/combobox-input';
import { ImprovedUploadInput } from '@/components/common';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConsultationHistory } from '@/app/(dashboard)/consultations/components/consultation-history';

export interface ConsultationFormInitialData {
  id?: number;
  appointmentId?: number;
  complaint?: string | null;
  diagnosis?: string | null;
  remarks?: string | null;
  casePaperUrl?: string | null;
  nextFollowUpDate?: string | null;
  totalAmount?: number;
  consultationDetails?: {
    serviceId: number;
    description?: string | null;
    qty: number;
    rate: number;
    amount: number;
  }[];
  consultationMedicines?: {
    medicineId: number;
    qty: number;
    mrp: number;
    amount: number;
    doses?: string | null;
  }[];
}

export interface ConsultationFormProps {
  mode: 'create' | 'edit';
  initial?: ConsultationFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

type Service = {
  id: number;
  name: string;
  rate: number;
  description?: string | null;
};

type Medicine = {
  id: number;
  name: string;
  rate: number;
  brand: {
    name: string;
  };
};

type Appointment = {
  id: number;
  appointmentDateTime: string;
  visitPurpose: string | null;
  patient: {
    id: number;
    patientNo: string;
    firstName: string;
    middleName: string;
    lastName: string;
    mobile: string;
  };
  team: {
    id: number;
    name: string;
  };
};

type PatientInfo = {
  id: number;
  patientNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
};

const consultationFormSchema = z.object({
  complaint: z.string().optional(),
  diagnosis: z.string().optional(),
  remarks: z.string().optional(),
  casePaperUrl: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  consultationDetails: z
    .array(
      z.object({
        serviceId: z
          .string()
          .refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number')
          .refine((v) => {
            // If serviceId is empty, then all other fields must also be empty
            if (!v || v.trim().length === 0) {
              return true; // Allow empty row
            }
            return v && v.trim().length > 0;
          }, 'Service is required'),
        description: z.string().optional(),
        rate: z
          .string()
          .refine((v) => {
            // If serviceId is empty, rate can be empty
            return true; // Skip validation here, will be handled in superRefine
          }),
        amount: z
          .string()
          .refine((v) => {
            // If serviceId is empty, amount can be empty
            return true; // Skip validation here, will be handled in superRefine
          }),
      })
    )
    .refine((details) => {
      // Validate that if serviceId is provided, all other required fields are also provided and not zero
      return details.every((detail) => {
        if (detail.serviceId && detail.serviceId.trim().length > 0) {
          return (
            detail.rate && detail.rate.trim().length > 0 &&
            detail.amount && detail.amount.trim().length > 0 &&
            !isNaN(parseFloat(detail.rate)) && parseFloat(detail.rate) >= 0 &&
            !isNaN(parseFloat(detail.amount)) && parseFloat(detail.amount) > 0
          );
        }
        return true; // Allow empty rows
      });
    }, 'If service is selected, rate and amount are required and must be valid numbers greater than 0')
    .optional(),
  consultationMedicines: z
    .array(
      z.object({
        medicineId: z
          .string()
          .refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number')
          .refine((v) => {
            // If medicineId is empty, then all other fields must also be empty
            if (!v || v.trim().length === 0) {
              return true; // Allow empty row
            }
            return v && v.trim().length > 0;
          }, 'Medicine is required'),
        qty: z
          .string()
          .refine((v) => {
            // If medicineId is empty, qty can be empty
            return true; // Skip validation here, will be handled in superRefine
          }),
        mrp: z
          .string()
          .refine((v) => {
            // If medicineId is empty, mrp can be empty
            return true; // Skip validation here, will be handled in superRefine
          }),
        amount: z
          .string()
          .refine((v) => {
            // If medicineId is empty, amount can be empty
            return true; // Skip validation here, will be handled in superRefine
          }),
        doses: z.string().optional(),
      })
    )
    .refine((medicines) => {
      // Validate that if medicineId is provided, all other required fields are also provided and not zero
      return medicines.every((medicine) => {
        if (medicine.medicineId && medicine.medicineId.trim().length > 0) {
          return (
            medicine.qty && medicine.qty.trim().length > 0 &&
            medicine.mrp && medicine.mrp.trim().length > 0 &&
            medicine.amount && medicine.amount.trim().length > 0 &&
            !isNaN(parseFloat(medicine.qty)) && parseFloat(medicine.qty) > 0 &&
            !isNaN(parseFloat(medicine.mrp)) && parseFloat(medicine.mrp) >= 0 &&
            !isNaN(parseFloat(medicine.amount)) && parseFloat(medicine.amount) > 0
            // doses is optional, so we don't require it
          );
        }
        return true; // Allow empty rows
      });
    }, 'If medicine is selected, qty, mrp, and amount are required and must be valid numbers greater than 0')
    .optional(),
  totalAmount: z
    .string()
    .trim()
    .refine((v) => v && v.trim().length > 0, 'Total amount is required')
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
      'Total must be a valid positive number'
    ),
  addReceipt: z.boolean().optional(),
  receipt: z.object({
    date: z.string().optional(),
    paymentMode: z.string().optional(),
    payerName: z.string().optional(),
    contactNumber: z.string().optional(),
    upiName: z.string().optional(),
    utrNumber: z.string().optional(),
    bankName: z.string().optional(),
    amount: z.string().optional(),
    chequeNumber: z.string().optional(),
    chequeDate: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

export type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

export function ConsultationForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/consultations',
}: ConsultationFormProps) {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [servicesTotal, setServicesTotal] = useState(0);
  const [medicinesTotal, setMedicinesTotal] = useState(0);

  const isCreate = mode === 'create';

  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      complaint: initial?.complaint || '',
      diagnosis: initial?.diagnosis || '',
      remarks: initial?.remarks || '',
      casePaperUrl: initial?.casePaperUrl || '',
      nextFollowUpDate: initial?.nextFollowUpDate 
        ? new Date(initial.nextFollowUpDate).toISOString().split('T')[0]
        : '',
      consultationDetails: initial?.consultationDetails?.map((d) => ({
        serviceId: d.serviceId.toString(),
        description: d.description || '',
        rate: d.rate.toString(),
        amount: d.amount.toString(),
      })) || [{ serviceId: '', description: '', rate: '', amount: '' }],
      consultationMedicines: initial?.consultationMedicines?.map((m) => ({
        medicineId: m.medicineId.toString(),
        qty: m.qty.toString(),
        mrp: m.mrp.toString(),
        amount: m.amount.toString(),
        doses: m.doses || '',
      })) || [{ medicineId: '', qty: '', mrp: '', amount: '', doses: '' }],
      totalAmount: (initial?.totalAmount ?? 0).toString(),
      addReceipt: mode === 'create' ? false : undefined,
      receipt: mode === 'create' ? {
        date: new Date().toISOString().split('T')[0], // Today's date for receipt
      } : undefined,
    },
  });

  const paymentModeOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' }
];

const { control, handleSubmit, setValue, setError, clearErrors, formState, trigger, watch } = form;
  const { errors } = formState;

  const serviceOptions = useMemo(() => {
    return services.map((s) => ({
      value: String(s.id),
      label: s.name,
    }));
  }, [services]);

  const medicineOptions = useMemo(() => {
    return medicines.map((m) => ({
      value: String(m.id),
      label: `${m.name} - ${m.brand.name}`,
    }));
  }, [medicines]);

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray({
    control,
    name: 'consultationDetails',
  });

  const {
    fields: medicineFields,
    append: appendMedicine,
    remove: removeMedicine,
  } = useFieldArray({
    control,
    name: 'consultationMedicines',
  });

  const watchedDetails = useWatch({ control, name: 'consultationDetails' });
  const watchedMedicines = useWatch({ control, name: 'consultationMedicines' });
  const watchedReceiptAmount = useWatch({ control, name: 'receipt.amount' });
  const currentTotalAmount = useWatch({ control, name: 'totalAmount' });

  // Check if total amount is 0 to disable receipt fields
  const isTotalAmountZero = parseFloat(currentTotalAmount || '0') === 0;

  // Trigger validation only when qty/rate/amount fields change to fix submit button state
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      trigger();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [
    // Only watch specific fields that affect validation
    watchedDetails?.map(d => `${d.serviceId}-${d.rate}-${d.amount}`).join('|'),
    watchedMedicines?.map(m => `${m.medicineId}-${m.qty}-${m.mrp}-${m.amount}`).join('|'),
    watchedReceiptAmount,
    trigger
  ]);

  // Check if receipt amount exceeds total amount
  useEffect(() => {
    if (watchedReceiptAmount && currentTotalAmount) {
      const receiptAmount = parseFloat(watchedReceiptAmount);
      const totalAmount = parseFloat(currentTotalAmount);
      if (receiptAmount > totalAmount) {
        toast.error('Receipt amount cannot exceed total amount');
        setValue('receipt.amount', totalAmount.toString());
      }
    }
  }, [watchedReceiptAmount, currentTotalAmount, setValue]);

  useEffect(() => {
    const calculateTotal = () => {
      const details = form.getValues('consultationDetails') || [];
      const medicines = form.getValues('consultationMedicines') || [];
      
      const totalDetails = details.reduce((sum, item) => {
        const amount = parseFloat(item.amount) || 0;
        return sum + amount;
      }, 0);

      const totalMedicines = medicines.reduce((sum, item) => {
        const amount = parseFloat(item.amount) || 0;
        return sum + amount;
      }, 0);

      const total = totalDetails + totalMedicines;
      
      // Update individual totals
      setServicesTotal(totalDetails);
      setMedicinesTotal(totalMedicines);
      setValue('totalAmount', total.toFixed(2));
    };

    calculateTotal();
  }, [watchedDetails, watchedMedicines, setValue, form]);

  function updateDetailAmount(index: number, field: 'rate', value: string) {
    const details = [...(watchedDetails || [])];
    const row = details[index];
    if (!row) return;

    if (field === 'rate') row.rate = value;

    const rate = parseFloat(row.rate) || 0;
    row.amount = rate.toFixed(2);

    setValue(`consultationDetails.${index}.rate`, row.rate);
    setValue(`consultationDetails.${index}.amount`, row.amount);
    
    // Immediately recalculate total
    const allDetails = form.getValues('consultationDetails') || [];
    const allMedicines = form.getValues('consultationMedicines') || [];
    
    const totalDetails = allDetails.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);

    const totalMedicines = allMedicines.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);

    const total = totalDetails + totalMedicines;
    
    // Update individual totals
    setServicesTotal(totalDetails);
    setMedicinesTotal(totalMedicines);
    setValue('totalAmount', total.toFixed(2));
  }

  function updateMedicineAmount(index: number, field: 'qty' | 'mrp', value: string) {
    const rows = [...(watchedMedicines || [])];
    const row = rows[index];
    if (!row) return;

    if (field === 'qty') row.qty = value;
    if (field === 'mrp') row.mrp = value;

    const qty = parseFloat(row.qty) || 0;
    const rate = parseFloat(row.mrp) || 0;
    row.amount = (qty * rate).toFixed(2);

    setValue(`consultationMedicines.${index}.qty`, row.qty);
    setValue(`consultationMedicines.${index}.mrp`, row.mrp);
    setValue(`consultationMedicines.${index}.amount`, row.amount);
    
    // Immediately recalculate total
    const allDetails = form.getValues('consultationDetails') || [];
    const allMedicines = form.getValues('consultationMedicines') || [];
    
    const totalDetails = allDetails.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);

    const totalMedicines = allMedicines.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);

    const total = totalDetails + totalMedicines;
    
    // Update individual totals
    setServicesTotal(totalDetails);
    setMedicinesTotal(totalMedicines);
    setValue('totalAmount', total.toFixed(2));
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [servicesRes, medicinesRes] = await Promise.all([
          apiGet('/api/services?perPage=1000'),
          apiGet('/api/medicines?perPage=1000'),
        ]);

        setServices((servicesRes as any).data || []);
        setMedicines((medicinesRes as any).data || []);

        // Fetch patient info if we have an appointmentId
        if (initial?.appointmentId) {
          try {
            const appointmentRes = await apiGet(`/api/appointments/${initial.appointmentId}`);
            const appointment = appointmentRes as Appointment;
            setPatientInfo(appointment.patient);
          } catch (error) {
            console.error('Failed to fetch patient info:', error);
          }
        }
      } catch (e) {
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [initial?.appointmentId]);

  async function onSubmit(values: ConsultationFormValues) {
    setSubmitting(true);

    try {
      const apiData = {
        appointmentId: initial?.appointmentId,
        complaint: values.complaint || null,
        diagnosis: values.diagnosis || null,
        remarks: values.remarks || null,
        casePaperUrl: values.casePaperUrl || null,
        nextFollowUpDate: values.nextFollowUpDate ? new Date(values.nextFollowUpDate).toISOString() : null,
      };

      const consultationData = {
        appointmentId: initial?.appointmentId,
        complaint: values.complaint || null,
        diagnosis: values.diagnosis || null,
        remarks: values.remarks || null,
        casePaperUrl: values.casePaperUrl || null,
        nextFollowUpDate: values.nextFollowUpDate ? new Date(values.nextFollowUpDate).toISOString() : null,
        totalAmount: parseFloat(values.totalAmount),
        consultationDetails: values.consultationDetails
          ?.filter((d) => d.serviceId && d.serviceId.trim().length > 0)
          ?.map((d) => ({
            serviceId: parseInt(d.serviceId),
            description: d.description || null,
            qty: 1, // Always 1 for services
            rate: parseFloat(d.rate),
            amount: parseFloat(d.amount),
          })) || [],
        consultationMedicines: values.consultationMedicines
          ?.filter((m) => m.medicineId && m.medicineId.trim().length > 0)
          ?.map((m) => ({
            medicineId: parseInt(m.medicineId),
            qty: parseInt(m.qty),
            mrp: parseFloat(m.mrp),
            amount: parseFloat(m.amount),
            doses: m.doses || null,
          })) || [],
      };

      if (mode === 'create') {
        const createData = {
          ...consultationData,
          // Include receipt data if addReceipt is checked
          ...(values.addReceipt && values.receipt ? {
            receipt: {
              date: values.receipt.date ? new Date(values.receipt.date).toISOString() : new Date().toISOString(),
              paymentMode: values.receipt.paymentMode || '',
              payerName: values.receipt.payerName || '',
              contactNumber: values.receipt.contactNumber || '',
              upiName: values.receipt.upiName || '',
              utrNumber: values.receipt.utrNumber || '',
              bankName: values.receipt.bankName || '',
              amount: parseFloat(values.receipt.amount || '0'),
              chequeNumber: values.receipt.chequeNumber || '',
              chequeDate: values.receipt.chequeDate ? new Date(values.receipt.chequeDate).toISOString() : null,
              notes: values.receipt.notes || '',
            }
          } : {}),
        };

        const res = await apiPost('/api/consultations', createData);
        toast.success('Consultation created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/consultations', { id: initial.id, ...consultationData });
        toast.success('Consultation updated');
        onSuccess?.(res);
      }

      router.push(redirectOnSuccess);
    } catch (err) {
      const e = err as Error & { status?: number };
      toast.error((e as Error).message || 'Failed to save consultation');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Patient Info Header */}
      {patientInfo && (
        <AppCard>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Patient Name: {patientInfo.firstName} {patientInfo.middleName} {patientInfo.lastName}
                </h3>
                <p className="text-sm">
                  Patient No.: {patientInfo.patientNo}
                </p>
                <p className="text-sm">
                  Phone No.: {patientInfo.mobile}
                </p>
              </div>
            </div>
          </div>
        </AppCard>
      )}

      <Tabs defaultValue="consultation" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="consultation">Consultation Form</TabsTrigger>
          <TabsTrigger value="history">Consultation History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="consultation">
          <Form {...form}>
            <form noValidate onSubmit={handleSubmit(onSubmit)}>
              <AppCard>
                <AppCard.Header>
                  <AppCard.Title>{isCreate ? 'Create Consultation' : 'Edit Consultation'}</AppCard.Title>
                  <AppCard.Description>
                    {isCreate ? 'Add a new consultation.' : 'Update consultation details.'}
                  </AppCard.Description>
                </AppCard.Header>
                <AppCard.Content className='space-y-6'>
                  <FormSection legend='Consultation Details'>
                    <FormRow cols={1}>
                      <TextareaInput
                        control={control}
                        name='complaint'
                        label='Complaint'
                        placeholder='Enter patient complaint...'
                        rows={3}
                        
                      />
                    </FormRow>
                    <FormRow cols={1}>
                      <TextareaInput
                        control={control}
                        name='diagnosis'
                        label='Diagnosis'
                        placeholder='Enter diagnosis...'
                        rows={3}
                        
                      />
                    </FormRow>
                    <FormRow cols={1}>
                      <TextareaInput
                        control={control}
                        name='remarks'
                        label='Remarks'
                        placeholder='Enter any additional remarks...'
                        rows={3}
                        
                      />
                    </FormRow>
                    <FormRow cols={2}>
                         <ImprovedUploadInput
                        control={control}
                        name='casePaperUrl'
                        label='Case Paper'
                        description='Upload case paper or medical documents (PDF, images)'
                        type='document'
                        prefix='case-papers'
                        showPreview={false}
                        existingUrl={initial?.casePaperUrl}
                      />
                      <TextInput
                        control={control}
                        name='nextFollowUpDate'
                        label='Next Follow-up Date'
                        type='date'
                        
                      />
                    </FormRow>
                
                  </FormSection>

                  {mode === 'edit' ? (
                    <FormSection legend='Services'>
                      <div className='border rounded-lg overflow-hidden'>
                        <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                          <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                            Service
                          </div>
                          <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                            Description
                          </div>
                          <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                            Rate
                          </div>
                          <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground'>
                            Amount
                          </div>
                        </div>
                        {initial?.consultationDetails?.map((detail, index) => {
                          const service = serviceOptions.find(s => s.value === String(detail.serviceId));
                          return (
                          <div key={index} className='grid grid-cols-12 gap-0 border-b last:border-b-0'>
                            <div className='col-span-3 p-2 border-r text-sm'>{service?.label || '-'}</div>
                            <div className='col-span-3 p-2 border-r text-sm'>{detail.description || '-'}</div>
                            <div className='col-span-3 p-2 border-r text-sm'>{formatIndianCurrency(detail.rate)}</div>
                            <div className='col-span-3 p-2 text-sm'>{formatIndianCurrency(detail.amount)}</div>
                          </div>
                          );
                        })}
                        {(!initial?.consultationDetails || initial.consultationDetails.length === 0) && (
                          <div className='px-4 py-8 text-center text-muted-foreground'>
                            No services added
                          </div>
                        )}
                      </div>
                    </FormSection>
                  ) : (
                  <FormSection legend='Services'>
                    <div className='border rounded-lg overflow-hidden'>
                      <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                        <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                          Service
                        </div>
                        <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                          Description
                        </div>
                        <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                          Rate
                        </div>
                        <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground text-center'>
                          Amount
                        </div>
                      </div>

                      {detailFields.map((field, index) => (
                        <div key={field.id} className='grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50'>
                          <div className='col-span-3 p-3 border-r'>
                            <ComboboxInput
                              control={control}
                              name={`consultationDetails.${index}.serviceId`}
                              options={serviceOptions}
                              placeholder='(Choose One)'
                              onChange={(value) => {
                                if (!value) return;
                                const serviceId = parseInt(value);
                                const service = services.find((s) => s.id === serviceId);
                                if (!service) return;
                                setValue(
                                  `consultationDetails.${index}.rate`,
                                  String(service.rate)
                                );
                                setValue(
                                  `consultationDetails.${index}.amount`,
                                  String(service.rate)
                                );
                                const existingDesc = watchedDetails?.[index]?.description || '';
                                if (!existingDesc && service.description) {
                                  setValue(
                                    `consultationDetails.${index}.description`,
                                    service.description
                                  );
                                }
                              }}
                            />
                          </div>
                          <div className='col-span-3 p-3 border-r'>
                            <Controller
                              control={control}
                              name={`consultationDetails.${index}.description`}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  placeholder=''
                                  className='w-full h-10 border'
                                  value={field.value || ''}
                                  disabled={!watchedDetails?.[index]?.serviceId}
                                />
                              )}
                            />
                          </div>
                          <div className='col-span-3 p-3 border-r'>
                            <Controller
                              control={control}
                              name={`consultationDetails.${index}.rate`}
                              render={({ field }) => (
                                <div className='relative w-full'>
                                  <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                                  <Input
                                    {...field}
                                    type='number'
                                    step='0.01'
                                    min='0'
                                    placeholder='0.00'
                                    className='w-full h-10 border pl-5.5'
                                    value={field.value || ''}
                                    onChange={(e) =>
                                      updateDetailAmount(index, 'rate', e.target.value)
                                    }
                                    disabled={!watchedDetails?.[index]?.serviceId}
                                  />
                                </div>
                              )}
                            />
                          </div>
                          <div className='col-span-3 p-3 flex items-center gap-2'>
                            <div className='relative w-full'>
                              <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                              <Input
                                value={watchedDetails?.[index]?.amount || '0'}
                                type='number'
                                step='0.01'
                                min='0'
                                className='w-full h-10 border pl-5.5'
                                disabled
                                readOnly
                              />
                            </div>
                            {detailFields.length > 1 && (
                              <AppButton
                                type='button'
                                variant='destructive'
                                size='sm'
                                onClick={() => removeDetail(index)}
                                className='h-8 w-8 p-0'
                              >
                                <Trash2 className='h-4 w-4' />
                              </AppButton>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className='mt-4'>
                      <AppButton
                        type='button'
                        variant='outline'
                        onClick={() =>
                          appendDetail({
                            serviceId: '',
                            description: '',
                            rate: '',
                            amount: '',
                          })
                        }
                        className='gap-2'
                      >
                        <Plus className='h-4 w-4' />
                        Add
                      </AppButton>
                    </div>
                  </FormSection>
                  )}

                  {mode === 'edit' ? (
                    <FormSection legend='Medicines'>
                      <div className='border rounded-lg overflow-hidden'>
                        <div className='grid grid-cols-4 gap-0 bg-muted border-b'>
                          <div className='col-span-1 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                            Medicine
                          </div>
                          <div className='col-span-1 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                            Qty
                          </div>
                          <div className='col-span-1 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                            MRP
                          </div>
                          <div className='col-span-1 px-4 py-3 font-medium text-sm text-muted-foreground'>
                            Doses
                          </div>
                        </div>
                        {initial?.consultationMedicines?.map((medicine, index) => {
                          const medOption = medicineOptions.find(m => m.value === String(medicine.medicineId));
                          return (
                          <div key={index} className='grid grid-cols-4 gap-0 border-b last:border-b-0'>
                            <div className='col-span-1 p-2 border-r text-sm'>{medOption?.label || '-'}</div>
                            <div className='col-span-1 p-2 border-r text-sm'>{medicine.qty}</div>
                            <div className='col-span-1 p-2 border-r text-sm'>{formatIndianCurrency(medicine.mrp)}</div>
                            <div className='col-span-1 p-2 text-sm'>{medicine.doses || '-'}</div>
                          </div>
                          );
                        })}
                        {(!initial?.consultationMedicines || initial.consultationMedicines.length === 0) && (
                          <div className='px-4 py-8 text-center text-muted-foreground'>
                            No medicines added
                          </div>
                        )}
                      </div>
                    </FormSection>
                  ) : (
                    <FormSection legend='Medicines'>
                      <div className='border rounded-lg overflow-hidden'>
                      <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                        <div className='col-span-4 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                          Medicine
                        </div>
                        <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                          Doses
                        </div>
                        <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                          Qty
                        </div>
                        <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                          MRP
                        </div>
                        <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground text-center'>
                          Amount
                        </div>
                      </div>

                      {medicineFields.map((field, index) => (
                        <div key={field.id} className='grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50'>
                          <div className='col-span-4 p-3 border-r'>
                            <ComboboxInput
                              control={control}
                              name={`consultationMedicines.${index}.medicineId`}
                              options={medicineOptions}
                              placeholder='(Choose One)'
                              onChange={(value) => {
                                if (!value) return;
                                const medicineId = parseInt(value);
                                const medicine = medicines.find((m) => m.id === medicineId);
                                if (!medicine) return;
                                setValue(
                                  `consultationMedicines.${index}.mrp`,
                                  String(medicine.rate)
                                );
                                const qty = parseFloat(watchedMedicines?.[index]?.qty || '') || 0;
                                setValue(
                                  `consultationMedicines.${index}.amount`,
                                  (qty * Number(medicine.rate)).toFixed(2)
                                );
                              }}
                            />
                          </div>
                          <div className='col-span-2 p-3 border-r'>
                            <Controller
                              control={control}
                              name={`consultationMedicines.${index}.doses`}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  placeholder='e.g., 1-1-1'
                                  className='w-full h-10 border'
                                  value={field.value || ''}
                                  disabled={!watchedMedicines?.[index]?.medicineId}
                                />
                              )}
                            />
                          </div>
                          <div className='col-span-2 p-3 border-r'>
                            <Controller
                              control={control}
                              name={`consultationMedicines.${index}.qty`}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  type='number'
                                  min='1'
                                  placeholder='0'
                                  className='w-full h-10 border'
                                  value={field.value || ''}
                                  onChange={(e) => updateMedicineAmount(index, 'qty', e.target.value)}
                                  disabled={!watchedMedicines?.[index]?.medicineId}
                                />
                              )}
                            />
                          </div>
                          <div className='col-span-2 p-3 border-r'>
                            <Controller
                              control={control}
                              name={`consultationMedicines.${index}.mrp`}
                              render={({ field }) => (
                                <div className='relative w-full'>
                                  <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                                  <Input
                                    {...field}
                                    type='number'
                                    step='0.01'
                                    min='0'
                                    placeholder='0.00'
                                    className='w-full h-10 border pl-5.5'
                                    value={field.value || ''}
                                    onChange={(e) =>
                                      updateMedicineAmount(index, 'mrp', e.target.value)
                                    }
                                    disabled={!watchedMedicines?.[index]?.medicineId}
                                  />
                                </div>
                              )}
                            />
                          </div>
                          <div className='col-span-2 p-3 flex items-center gap-2'>
                            <div className='relative w-full'>
                              <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                              <Input
                                value={watchedMedicines?.[index]?.amount || '0'}
                                type='number'
                                step='0.01'
                                min='0'
                                className='w-full h-10 border pl-5.5'
                                disabled
                                readOnly
                              />
                            </div>
                            {medicineFields.length > 1 && (
                              <AppButton
                                type='button'
                                variant='destructive'
                                size='sm'
                                onClick={() => removeMedicine(index)}
                                className='h-8 w-8 p-0'
                              >
                                <Trash2 className='h-4 w-4' />
                              </AppButton>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className='mt-4 flex items-start justify-between gap-4'>
                      <AppButton
                        type='button'
                        variant='outline'
                        onClick={() =>
                          appendMedicine({ medicineId: '', qty: '', mrp: '', amount: '', doses: '' })
                        }
                        className='gap-2'
                      >
                        <Plus className='h-4 w-4' />
                        Add
                      </AppButton>
                    </div>
                  </FormSection>
                  )}

                    {/* Total Amount */}
                    <FormRow cols={12}>
                       <div className="col-span-12 flex justify-end">
                          <div className="text-right space-y-2">
                            <div className="flex justify-between gap-8">
                              <div className="text-sm text-muted-foreground">
                                Services Total
                              </div>
                              <div className="text-sm font-medium">
                                {new Intl.NumberFormat("en-IN", {
                                    style: "currency",
                                    currency: "INR",
                                    minimumFractionDigits: 2,
                                  }).format(servicesTotal)
                                }
                              </div>
                            </div>
                            <div className="flex justify-between gap-8">
                              <div className="text-sm text-muted-foreground">
                                Medicines Total
                              </div>
                              <div className="text-sm font-medium">
                                {new Intl.NumberFormat("en-IN", {
                                    style: "currency",
                                    currency: "INR",
                                    minimumFractionDigits: 2,
                                  }).format(medicinesTotal)
                                }
                              </div>
                            </div>
                            <div className="border-t pt-2">
                              <div className="flex justify-between gap-8">
                                <div className="text-sm text-muted-foreground">
                                  Total Amount
                                </div>
                                <div className="text-lg font-bold text-foreground">
                                  {new Intl.NumberFormat("en-IN", {
                                      style: "currency",
                                      currency: "INR",
                                      minimumFractionDigits: 2,
                                    }).format(
                                      parseFloat(form.getValues('totalAmount')) || 0
                                    )
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </FormRow>

                  {/* Receipt Section - Only show in create mode */}
                  {mode === 'create' && (
                  <FormSection legend='Payment Receipt'>
                    <FormRow cols={1}>
                      <div className="col-span-12">
                        <div className="mb-4">
                          <AppCheckbox
                            id="addReceipt"
                            label="Add payment receipt for this consultation"
                            checked={watch('addReceipt')}
                            onCheckedChange={(checked) => setValue('addReceipt', checked)}
                            disabled={isTotalAmountZero}
                          />
                        </div>
                        
                        {watch('addReceipt') && (
                          <div className="space-y-4">
                            <FormRow cols={1}>
                              <TextInput
                                control={control}
                                name="receipt.amount"
                                label="Receipt Amount"
                                type="number"
                                step="0.01"
                                placeholder="Enter amount received"
                                required
                                max={parseFloat(form.getValues('totalAmount')) || 0}
                                disabled={isTotalAmountZero}
                              />
                            </FormRow>
                            <FormRow cols={3}>
                              <TextInput
                                control={control}
                                name="receipt.date"
                                label="Receipt Date"
                                type="date"
                                required
                                disabled={isTotalAmountZero}
                              />
                              <ComboboxInput
                                control={control as any}
                                name="receipt.paymentMode"
                                label="Payment Mode"
                                options={paymentModeOptions}
                                placeholder="Select payment mode"
                                required
                                disabled={isTotalAmountZero}
                              />
                               <TextInput
                                control={control}
                                name="receipt.payerName"
                                label="Payer Name"
                                placeholder="Enter payer name"
                                disabled={isTotalAmountZero}
                              />
                            </FormRow>
                            
                            {/* Conditional fields based on payment mode */}
                            {watch('receipt.paymentMode') === 'CASH' && (
                              <FormRow cols={1}>
                                <TextInput
                                  control={control}
                                  name="receipt.contactNumber"
                                  label="Contact Number"
                                  maxLength={10}
                                  pattern='[+0-9]*'
                                  onInput={(e) => {
                                  e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                                  }}
                                  placeholder="Enter contact number"
                                  disabled={isTotalAmountZero}
                                />
                              </FormRow>
                            )}
                            
                            {watch('receipt.paymentMode') === 'UPI' && (
                              <FormRow cols={3}>
                                <TextInput
                                  control={control}
                                  name="receipt.upiName"
                                  label="UPI Name"
                                  placeholder="Enter UPI name"
                                  disabled={isTotalAmountZero}
                                />
                                <TextInput
                                  control={control}
                                  name="receipt.utrNumber"
                                  label="UTR Number"
                                  placeholder="Enter UTR number"
                                  disabled={isTotalAmountZero}
                                />
                                 <TextInput
                                  control={control}
                                  name="receipt.contactNumber"
                                  label="Contact Number"
                                  maxLength={10}
                                  pattern='[+0-9]*'
                                  onInput={(e) => {
                                  e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '');
                                  }}
                                  placeholder="Enter contact number"
                                  disabled={isTotalAmountZero}
                                />
                              </FormRow>
                            )}
                            {watch('receipt.paymentMode') === 'CHEQUE' && (
                              <FormRow cols={3}>
                                <TextInput
                                  control={control}
                                  name="receipt.bankName"
                                  label="Bank Name"
                                  placeholder="Enter bank name"
                                  disabled={isTotalAmountZero}
                                />
                                <TextInput
                                  control={control}
                                  name="receipt.chequeNumber"
                                  label="Cheque Number"
                                  placeholder="Enter cheque number"
                                  disabled={isTotalAmountZero}
                                />
                                <TextInput
                                  control={control}
                                  name="receipt.chequeDate"
                                  label="Cheque Date"
                                  type="date"
                                  disabled={isTotalAmountZero}
                                />
                              </FormRow>
                            )}
                            <FormRow cols={1}>
                              <TextareaInput
                                control={control}
                                name="receipt.notes"
                                label="Notes"
                                placeholder="Any additional notes about the payment"
                                disabled={isTotalAmountZero}
                              />
                            </FormRow>
                          </div>
                        )}
                      </div>
                    </FormRow>
                  </FormSection>
                  )}
                </AppCard.Content>
                <AppCard.Footer className='justify-end gap-2'>
                  <AppButton
                    type='button'
                    variant='secondary'
                    onClick={() => router.push(redirectOnSuccess)}
                    disabled={submitting}
                    iconName='X'
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    type='submit'
                    iconName={isCreate ? 'Plus' : 'Save'}
                    isLoading={submitting}
                    disabled={submitting || !form.formState.isValid}
                  >
                    {isCreate ? 'Submit' : 'Save Changes'}
                  </AppButton>
                </AppCard.Footer>
              </AppCard>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="history">
          <ConsultationHistory appointmentId={initial?.appointmentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
