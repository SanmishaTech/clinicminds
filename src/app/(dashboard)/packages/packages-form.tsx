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
import { FormSection, FormRow } from '@/components/common/app-form';
import { Form } from '@/components/ui/form';
import { TextInput } from '@/components/common/text-input';
import { ComboboxInput } from '@/components/common/combobox-input';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

export interface PackageFormInitialData {
  id?: number;
  name?: string;
  duration?: number;
  discountPercent?: number;
  totalAmount?: number;
  packageDetails?: {
    serviceId: number;
    description?: string | null;
    qty: number;
    rate: number;
    amount: number;
  }[];
  packageMedicines?: {
    medicineId: number;
    qty: number;
    rate: number;
    amount: number;
  }[];
}

export interface PackageFormProps {
  mode: 'create' | 'edit';
  initial?: PackageFormInitialData | null;
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
  mrp: number;
  brand?: {
    name: string;
  } | null;
};

const packagesFormSchema = z.object({
  name: z.string().trim().min(1, 'Package is required'),
  duration: z
    .string()
    .trim()
    .refine((v) => v && v.trim().length > 0, 'Duration is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Duration must be a valid number (0 or more)')
    .refine((v) => {
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n < 0) return false;
      const scaled = n * 4;
      return Math.abs(scaled - Math.round(scaled)) < 1e-9;
    }, 'Duration must be in steps of 0.25 days'),
  discountPercent: z
    .string()
    .trim()
    .refine((v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 100), 'Discount must be 0 to 100'),
  packageDetails: z
    .array(
      z.object({
        serviceId: z
          .string()
          .refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number')
          .refine((v) => v && v.trim().length > 0, 'Service is required'),
        description: z.string().optional(),
        qty: z
          .string()
          .refine((v) => v && v.trim().length > 0, 'Qty is required')
          .refine(
            (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
            'Qty must be a valid positive number'
          ),
        rate: z
          .string()
          .refine((v) => v && v.trim().length > 0, 'Rate is required')
          .refine(
            (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
            'Rate must be a valid positive number'
          ),
        amount: z
          .string()
          .refine((v) => v && v.trim().length > 0, 'Amount is required')
          .refine(
            (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
            'Amount must be a valid positive number'
          ),
      })
    )
    .min(1, 'At least one package detail is required'),
  packageMedicines: z
    .array(
      z.object({
        medicineId: z
          .string()
          .refine((v) => !v || /^\d+$/.test(v), 'Must be a valid number')
          .refine((v) => v && v.trim().length > 0, 'Medicine is required'),
        qty: z
          .string()
          .refine((v) => v && v.trim().length > 0, 'Qty is required')
          .refine(
            (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
            'Qty must be a valid positive number'
          ),
        rate: z
          .string()
          .refine((v) => v && v.trim().length > 0, 'Rate is required')
          .refine(
            (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
            'Rate must be a valid positive number'
          ),
        amount: z
          .string()
          .refine((v) => v && v.trim().length > 0, 'Amount is required')
          .refine(
            (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
            'Amount must be a valid positive number'
          ),
      })
    )
    .min(1, 'At least one package medicine is required'),
  totalAmount: z
    .string()
    .trim()
    .refine((v) => v && v.trim().length > 0, 'Total amount is required')
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
      'Total must be a valid positive number'
    ),
});

export type PackagesFormValues = z.infer<typeof packagesFormSchema>;

export function PackageForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/packages',
}: PackageFormProps) {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isCreate = mode === 'create';

  const form = useForm<PackagesFormValues>({
    resolver: zodResolver(packagesFormSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
      duration: String(initial?.duration ?? 0),
      discountPercent: String(initial?.discountPercent ?? 0),
      totalAmount: (initial?.totalAmount ?? 0).toString(),
      packageDetails:
        initial?.packageDetails?.map((d) => ({
          serviceId: d.serviceId.toString(),
          description: d.description || '',
          qty: d.qty.toString(),
          rate: d.rate.toString(),
          amount: d.amount.toString(),
        })) || [
          { serviceId: '', description: '', qty: '1', rate: '0', amount: '0' },
        ],
      packageMedicines:
        initial?.packageMedicines?.map((m) => ({
          medicineId: m.medicineId.toString(),
          qty: m.qty.toString(),
          rate: m.rate.toString(),
          amount: m.amount.toString(),
        })) || [{ medicineId: '', qty: '1', rate: '0', amount: '0' }],
    },
  });

  const { control, handleSubmit, setValue, setError, clearErrors } = form;

  const serviceOptions = useMemo(() => {
    return services.map((s) => ({
      value: String(s.id),
      label: s.name,
    }));
  }, [services]);

  const medicineOptions = useMemo(() => {
    return medicines.map((m) => ({
      value: String(m.id),
      label: `${m.name} - ${m.brand?.name || ''}`,
    }));
  }, [medicines]);

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray({
    control,
    name: 'packageDetails',
  });

  const {
    fields: medicineFields,
    append: appendMedicine,
    remove: removeMedicine,
  } = useFieldArray({
    control,
    name: 'packageMedicines',
  });

  const watchedDetails = useWatch({ control, name: 'packageDetails' });
  const watchedMedicines = useWatch({ control, name: 'packageMedicines' });
  const watchedDiscountPercent = useWatch({ control, name: 'discountPercent' });

  const totals = useMemo(() => {
    const details = watchedDetails || [];
    const medicinesRows = watchedMedicines || [];

    const subtotalDetails = details.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const subtotalMedicines = medicinesRows.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const subtotal = subtotalDetails + subtotalMedicines;

    const discountPercentNum = Math.min(100, Math.max(0, parseFloat(watchedDiscountPercent || '0') || 0));
    const discountAmount = subtotal * (discountPercentNum / 100);
    const total = Math.max(0, subtotal - discountAmount);

    return { subtotal, discountPercentNum, discountAmount, total };
  }, [watchedDetails, watchedMedicines, watchedDiscountPercent]);

  useEffect(() => {
    setValue('totalAmount', totals.total.toFixed(2));
  }, [totals.total, setValue]);

  function updateDetailAmount(index: number, field: 'qty' | 'rate', value: string) {
    const details = [...(watchedDetails || [])];
    const row = details[index];
    if (!row) return;

    if (field === 'qty') row.qty = value;
    if (field === 'rate') row.rate = value;

    const qty = parseFloat(row.qty) || 0;
    const rate = parseFloat(row.rate) || 0;
    row.amount = (qty * rate).toFixed(2);

    setValue(`packageDetails.${index}.qty`, row.qty);
    setValue(`packageDetails.${index}.rate`, row.rate);
    setValue(`packageDetails.${index}.amount`, row.amount);
  }

  function updateMedicineAmount(index: number, field: 'qty' | 'rate', value: string) {
    const rows = [...(watchedMedicines || [])];
    const row = rows[index];
    if (!row) return;

    if (field === 'qty') row.qty = value;
    if (field === 'rate') row.rate = value;

    const qty = parseFloat(row.qty) || 0;
    const rate = parseFloat(row.rate) || 0;
    row.amount = (qty * rate).toFixed(2);

    setValue(`packageMedicines.${index}.qty`, row.qty);
    setValue(`packageMedicines.${index}.rate`, row.rate);
    setValue(`packageMedicines.${index}.amount`, row.amount);
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [servicesRes, medicinesRes] = await Promise.all([
          apiGet('/api/services?perPage=1000&isProcedure=false'),
          apiGet('/api/medicines?perPage=1000'),
        ]);

        setServices((servicesRes as any).data || []);
        setMedicines((medicinesRes as any).data || []);
      } catch (e) {
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  async function onSubmit(values: PackagesFormValues) {
    clearErrors('name');
    setSubmitting(true);

    try {
      const apiData = {
        name: values.name.trim(),
        duration: parseFloat(values.duration),
        discountPercent: Math.min(100, Math.max(0, parseFloat(values.discountPercent || '0') || 0)),
        totalAmount: parseFloat(values.totalAmount),
        packageDetails: values.packageDetails.map((d) => ({
          serviceId: parseInt(d.serviceId),
          description: d.description || undefined,
          qty: parseInt(d.qty),
          rate: parseFloat(d.rate),
          amount: parseFloat(d.amount),
        })),
        packageMedicines: values.packageMedicines.map((m) => ({
          medicineId: parseInt(m.medicineId),
          qty: parseInt(m.qty),
          rate: parseFloat(m.rate),
          amount: parseFloat(m.amount),
        })),
      };

      if (mode === 'create') {
        const res = await apiPost('/api/packages', apiData);
        toast.success('Package created');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch('/api/packages', { id: initial.id, ...apiData });
        toast.success('Package updated');
        onSuccess?.(res);
      }

      router.push(redirectOnSuccess);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e?.status === 409) {
        setError('name', { type: 'server', message: e.message || 'Package name already exists' }, { shouldFocus: true });
        return;
      }
      toast.error((err as Error).message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>{isCreate ? 'Create Package' : 'Edit Package'}</AppCard.Title>
            <AppCard.Description>
              {isCreate ? 'Add a new package.' : 'Update package details.'}
            </AppCard.Description>
          </AppCard.Header>
          <AppCard.Content className='space-y-6'>
            <FormSection legend='Packages'>
              <FormRow className='grid-cols-12 gap-6'>
                <TextInput
                  control={control}
                  name='name'
                  label='Package name'
                  placeholder='Package name'
                  required
                  itemClassName='col-span-12 md:col-span-8'
                />

                <TextInput
                  control={control}
                  name='duration'
                  label='Duration (days)'
                  placeholder='Days'
                  type='number'
                  min={0}
                  step={0.25}
                  required
                  itemClassName='col-span-12 md:col-span-4'
                />
              </FormRow>
            </FormSection>

            <div className='space-y-2'>
              <div className='flex items-center gap-3'>
                <div className='text-base font-semibold shrink-0 px-0'>Package Details</div>
                <div className='h-px bg-border flex-1' />
              </div>
            </div>

            <FormSection legend='Services'>
              <div className='border rounded-lg overflow-hidden'>
                <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                  <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Service
                  </div>
                  <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Description
                  </div>
                  <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Qty
                  </div>
                  <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Rate
                  </div>
                  <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground text-center'>
                    Amount
                  </div>
                </div>

                {detailFields.map((field, index) => (
                  <div key={field.id} className='grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50'>
                    <div className='col-span-3 p-3 border-r'>
                      <ComboboxInput
                        control={control}
                        name={`packageDetails.${index}.serviceId`}
                        options={serviceOptions}
                        placeholder='(Choose One)'
                        required
                        onChange={(value) => {
                          if (!value) return;
                          const serviceId = parseInt(value);
                          const service = services.find((s) => s.id === serviceId);
                          if (!service) return;
                          setValue(
                            `packageDetails.${index}.rate`,
                            String(service.rate)
                          );
                          const qty = parseFloat(watchedDetails?.[index]?.qty || '1') || 0;
                          setValue(
                            `packageDetails.${index}.amount`,
                            (qty * Number(service.rate)).toFixed(2)
                          );
                          const existingDesc = watchedDetails?.[index]?.description || '';
                          if (!existingDesc && service.description) {
                            setValue(
                              `packageDetails.${index}.description`,
                              service.description
                            );
                          }
                        }}
                      />
                    </div>
                    <div className='col-span-3 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`packageDetails.${index}.description`}
                        render={({ field }) => (
                          <Input
                            {...field}
                            placeholder=''
                            className='w-full h-10 border'
                            value={field.value || ''}
                          />
                        )}
                      />
                    </div>
                    <div className='col-span-2 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`packageDetails.${index}.qty`}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type='number'
                            min='1'
                            placeholder='0'
                            className='w-full h-10 border'
                            value={field.value || ''}
                            onChange={(e) => updateDetailAmount(index, 'qty', e.target.value)}
                          />
                        )}
                      />
                    </div>
                    <div className='col-span-2 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`packageDetails.${index}.rate`}
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
                              disabled
                              readOnly
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
                      qty: '1',
                      rate: '0',
                      amount: '0',
                    })
                  }
                  className='gap-2'
                >
                  <Plus className='h-4 w-4' />
                  Add
                </AppButton>
              </div>
            </FormSection>

            <FormSection legend='Medicines'>
              <div className='border rounded-lg overflow-hidden'>
                <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                  <div className='col-span-5 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Medicine
                  </div>
                  <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Qty
                  </div>
                  <div className='col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    MRP
                  </div>
                  <div className='col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground text-center'>
                    Amount
                  </div>
                </div>

                {medicineFields.map((field, index) => (
                  <div key={field.id} className='grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50'>
                    <div className='col-span-5 p-3 border-r'>
                      <ComboboxInput
                        control={control}
                        name={`packageMedicines.${index}.medicineId`}
                        options={medicineOptions}
                        placeholder='(Choose One)'
                        required
                        onChange={(value) => {
                          if (!value) return;
                          const medicineId = parseInt(value);
                          const medicine = medicines.find((m) => m.id === medicineId);
                          if (!medicine) return;
                          setValue(
                            `packageMedicines.${index}.rate`,
                            String(medicine.mrp)
                          );
                          const qty = parseFloat(watchedMedicines?.[index]?.qty || '1') || 0;
                          setValue(
                            `packageMedicines.${index}.amount`,
                            (qty * Number(medicine.mrp)).toFixed(2)
                          );
                        }}
                      />
                    </div>
                    <div className='col-span-2 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`packageMedicines.${index}.qty`}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type='number'
                            min='1'
                            placeholder='0'
                            className='w-full h-10 border'
                            value={field.value || ''}
                            onChange={(e) => updateMedicineAmount(index, 'qty', e.target.value)}
                          />
                        )}
                      />
                    </div>
                    <div className='col-span-3 p-3 border-r'>
                      <div className='relative w-full'>
                        <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                        <Input
                          value={(() => {
                            const medicineIdStr = watchedMedicines?.[index]?.medicineId;
                            const medicineId = medicineIdStr ? parseInt(medicineIdStr) : NaN;
                            const medicine = medicines.find((m) => m.id === medicineId);
                            return String(medicine?.mrp ?? 0);
                          })()}
                          type='number'
                          step='0.01'
                          min='0'
                          className='w-full h-10 border pl-5.5'
                          disabled
                          readOnly
                        />
                      </div>
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
                    appendMedicine({ medicineId: '', qty: '1', rate: '0', amount: '0' })
                  }
                  className='gap-2'
                >
                  <Plus className='h-4 w-4' />
                  Add
                </AppButton>
              </div>
              <FormRow className='grid-cols-12'>
                <div className='col-span-12 flex justify-end'>
                  <div className='w-full max-w-[220px] space-y-3'>
                    <div>
                      <div className='text-sm text-muted-foreground'>Discount (%)</div>
                      <Controller
                        control={control}
                        name='discountPercent'
                        render={({ field }) => (
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
                                field.onChange(raw);
                                return;
                              }
                              const num = Number(raw);
                              if (Number.isNaN(num)) return;
                              const clamped = Math.min(100, Math.max(0, num));
                              field.onChange(String(clamped));
                            }}
                          />
                        )}
                      />
                    </div>
                    <div className='text-right'>
                      <div className='text-sm text-muted-foreground'>Subtotal</div>
                      <div className='text-base font-semibold text-foreground'>
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          minimumFractionDigits: 2,
                        }).format(totals.subtotal)}
                      </div>
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
  );
}

export default PackageForm;
