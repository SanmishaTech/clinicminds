'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormSection, FormRow } from '@/components/common/app-form';
import { Form } from '@/components/ui/form';
import { FormMessage } from '@/components/ui/form';
import { ComboboxInput } from '@/components/common/combobox-input';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

export interface MedicineBillFormInitialData {
  id?: number;
  patientId?: number;
  discountPercent?: number;
  totalAmount?: number;
  medicineBillDetails?: {
    medicineId: number;
    qty: number;
    mrp: number;
    amount: number;
  }[];
}

export interface MedicineBillFormProps {
  mode: 'create' | 'edit';
  initial?: MedicineBillFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string;
}

type Medicine = {
  id: number;
  name: string;
  brand: {
    name: true
  },
  mrp: number;
  rate: number;
};

type Patient = {
  id: number;
  patientNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
};

const medicineBillDetailSchema = z.object({
  medicineId: z.string().refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number'),
  qty: z.string(),
  mrp: z.string(),
  amount: z.string(),
});

const medicineBillSchema = z.object({
  patientId: z.string().refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number'),
  discountPercent: z
    .string()
    .trim()
    .refine((v) => v === '' || v === '0' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 100), 'Discount must be 0 to 100'),
  totalAmount: z.number().positive(),
  medicineBillDetails: z.array(medicineBillDetailSchema).min(1, 'At least one medicine is required'),
});

type MedicineBillFormData = z.infer<typeof medicineBillSchema>;

export function MedicineBillForm({ mode, initial, onSuccess, redirectOnSuccess = "/medicine-bills" }: MedicineBillFormProps) {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<MedicineBillFormData>({
    resolver: zodResolver(medicineBillSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      patientId: String(initial?.patientId || ''),
      discountPercent: "0",
      totalAmount: initial?.totalAmount || 0,
      medicineBillDetails: initial?.medicineBillDetails?.length ? initial.medicineBillDetails.map(detail => ({
        medicineId: detail.medicineId.toString(),
        qty: detail.qty.toString(),
        mrp: detail.mrp.toString(),
        amount: detail.amount.toString(),
      })) : [{ medicineId: '', qty: '', mrp: '', amount: '' }],
    },
  });

  const { control, setValue, handleSubmit, trigger } = form;


  const { fields, append, remove } = useFieldArray({
    control,
    name: 'medicineBillDetails',
  });

  const watchedDetails = useWatch({
    control,
    name: 'medicineBillDetails',
  });

  // Calculate total amount whenever details or discount changes
  const watchedDiscountPercent = useWatch({ control, name: 'discountPercent' });

  useEffect(() => {
    // Trigger validation when watched values change
    trigger();
  }, [watchedDetails, watchedDiscountPercent, trigger]);

  const totals = useMemo(() => {
    const subtotal = watchedDetails.reduce((sum, detail) => sum + (parseFloat(detail.amount) || 0), 0);
    const discountPercentNum = Math.min(100, Math.max(0, parseFloat(watchedDiscountPercent || '0') || 0));
    const discountAmount = subtotal * (discountPercentNum / 100);
    const total = Math.max(0, subtotal - discountAmount);

    return { subtotal, discountPercentNum, discountAmount, total };
  }, [watchedDetails, watchedDiscountPercent]);

  useEffect(() => {
    setValue('totalAmount', totals.total);
    // Trigger validation after setting total amount
    trigger();
  }, [totals.total, setValue, trigger]);

  // Load medicines and patients on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [medicinesRes, patientsRes] = await Promise.all([
          apiGet('/api/medicines'),
          apiGet('/api/patients'),
        ]);
        setMedicines((medicinesRes as any)?.data || []);
        setPatients((patientsRes as any)?.data || []);
      } catch (error) {
        toast.error('Failed to load data');
      }
    }
    loadData();
  }, []);

  // Update amount when qty or mrp changes
  const updateDetailAmount = (index: number, field: 'qty' | 'mrp', value: string) => {
    const detail = watchedDetails[index];
    const medicine = medicines.find(m => m.id === parseInt(detail.medicineId || '0'));
    const mrp = field === 'mrp' ? parseFloat(value) || 0 : (parseFloat(detail.mrp) || medicine?.mrp || 0);
    const qty = field === 'qty' ? parseFloat(value) || 0 : (parseFloat(detail.qty) || 0);
    const amount = mrp * qty;
    
    setValue(`medicineBillDetails.${index}.qty`, String(qty));
    setValue(`medicineBillDetails.${index}.mrp`, String(mrp));
    setValue(`medicineBillDetails.${index}.amount`, String(amount));
  };

  // Update medicine details when medicine is selected
  const handleMedicineChange = (index: number, medicineId: number) => {
    const medicine = medicines.find(m => m.id === medicineId);
    if (medicine) {
      setValue(`medicineBillDetails.${index}.medicineId`, String(medicineId));
      setValue(`medicineBillDetails.${index}.mrp`, String(medicine.mrp));
      const qty = parseFloat(watchedDetails[index]?.qty || '0') || 0;
      setValue(`medicineBillDetails.${index}.amount`, String(medicine.mrp * qty));
    }
  };

  const medicineOptions = useMemo(() => 
    medicines.map(med => ({
      value: String(med.id),
      label: `${med.brand.name} ${med.name}`,
    }))
  , [medicines]);

  const patientOptions = useMemo(() =>
    patients.map((patient) => ({
      value: patient.id.toString(),
      label: `${patient.patientNo} | ${patient.firstName} ${patient.middleName} ${patient.lastName} | ${patient.mobile}`,
    }))
  , [patients]);

  async function onSubmit(data: MedicineBillFormData) {
    setSubmitting(true);
    try {
      // Convert string IDs and discount back to numbers for API
      const apiData = {
        ...data,
        patientId: Number(data.patientId),
        discountPercent: Math.min(100, Math.max(0, parseFloat(data.discountPercent || '0') || 0)),
        medicineBillDetails: data.medicineBillDetails.map(detail => ({
          ...detail,
          medicineId: Number(detail.medicineId),
          qty: Number(detail.qty),
          mrp: Number(detail.mrp),
          amount: Number(detail.amount),
        })),
      };
      
      const result = await apiPost('/api/medicine-bills', apiData);
      toast.success('Medicine bill created successfully');
      onSuccess?.(result);
      
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
      }
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create medicine bill');
    } finally {
      setSubmitting(false);
    }
  }

  // Show loading state while data is being fetched
  if (!medicines.length || !patients.length) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>New Medicine Bill</AppCard.Title>
            <AppCard.Description>Create a new medicine bill for patient</AppCard.Description>
          </AppCard.Header>
          <AppCard.Content>
            <FormSection>
              <FormRow>
                <ComboboxInput
                  control={control}
                  name='patientId'
                  label='Patient'
                  placeholder='Select patient'
                  options={patientOptions}
                  required
                />
              </FormRow>
            </FormSection>

            <FormSection legend='Medicine Details'>
              <div className='border rounded-lg overflow-hidden'>
                <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                  <div className='col-span-6 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Medicine
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

                {fields.map((field, index) => (
                  <div key={field.id} className='grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50'>
                    <div className='col-span-6 p-3 border-r'>
                      <ComboboxInput
                        control={control}
                        name={`medicineBillDetails.${index}.medicineId`}
                        options={medicineOptions}
                        placeholder='(Choose One)'
                        onChange={(value) => {
                          if (!value) return;
                          const medicineId = parseInt(value);
                          const medicine = medicines.find((m) => m.id === medicineId);
                          if (!medicine) return;
                          setValue(
                            `medicineBillDetails.${index}.mrp`,
                            String(medicine.mrp)
                          );
                          const qty = parseFloat(watchedDetails?.[index]?.qty || '') || 0;
                          setValue(
                            `medicineBillDetails.${index}.amount`,
                            (qty * Number(medicine.mrp)).toFixed(2)
                          );
                        }}
                      />
                    </div>
                    <div className='col-span-2 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`medicineBillDetails.${index}.qty`}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type='number'
                            min='1'
                            placeholder='0'
                            className='w-full h-10 border'
                            value={field.value || ''}
                            onChange={(e) => updateDetailAmount(index, 'qty', e.target.value)}
                            disabled={!watchedDetails?.[index]?.medicineId}
                          />
                        )}
                      />
                    </div>
                    <div className='col-span-2 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`medicineBillDetails.${index}.mrp`}
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
                                updateDetailAmount(index, 'mrp', e.target.value)
                              }
                              disabled={!watchedDetails?.[index]?.medicineId}
                            />
                          </div>
                        )}
                      />
                    </div>
                    <div className='col-span-2 p-3 flex items-center gap-2'>
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
                      {fields.length > 1 && (
                        <AppButton
                          type='button'
                          variant='destructive'
                          size='sm'
                          onClick={() => remove(index)}
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
                    append({ medicineId: '', qty: '', mrp: '', amount: '' })
                  }
                  className='gap-2'
                >
                  <Plus className='h-4 w-4' />
                  Add Medicine
                </AppButton>
              </div>

              {/* Total Amount */}
              <FormRow className='grid-cols-12'>
                 <div className="col-span-12 flex justify-end">
                    <div className='w-full max-w-[220px] space-y-3'>
                      <div>
                        <div className='text-sm text-muted-foreground'>Discount (%)</div>
                        <Controller
                          control={control}
                          name='discountPercent'
                          render={({ field }) => (
                            <div>
                              <Input
                                {...field}
                                type='number'
                                min='0'
                                max='100'
                                step='0.01'
                                placeholder='Discount %'
                                className='w-full h-10 border'
                                value={field.value || ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    field.onChange('');
                                    return;
                                  }
                                  const num = parseFloat(raw);
                                  if (Number.isNaN(num)) {
                                    field.onChange('');
                                    return;
                                  }
                                  const clamped = Math.min(100, Math.max(0, num));
                                  field.onChange(String(clamped));
                                }}
                                onBlur={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    field.onBlur();
                                    return;
                                  }
                                  const num = parseFloat(raw);
                                  const clamped = Number.isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
                                  field.onChange(String(clamped));
                                  field.onBlur();
                                }}
                              />
                              <FormMessage />
                            </div>
                          )}
                        />
                      </div>
                      <div className='text-right'>
                        <div className='text-sm text-muted-foreground'>Discount ({totals.discountPercentNum}%)</div>
                        <div className='text-base font-semibold text-foreground'>
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                            minimumFractionDigits: 2,
                          }).format(totals.discountAmount)}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='text-sm text-muted-foreground'>Total Amount</div>
                        <div className='text-lg font-bold text-foreground'>
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                            minimumFractionDigits: 2,
                          }).format(totals.total)}
                        </div>
                      </div>
                    </div>
                  </div>
              </FormRow>
            </FormSection>
          </AppCard.Content>
        </AppCard>

        <div className='flex justify-end gap-4'>
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
            iconName={mode === 'create' ? 'Plus' : 'Save'}
            isLoading={submitting}
            disabled={submitting || !form.formState.isValid}
          >
            {mode === 'create' ? 'Create Bill' : 'Update Bill'}
          </AppButton>
        </div>
      </form>
    </Form>
    
  );
}

export default MedicineBillForm;