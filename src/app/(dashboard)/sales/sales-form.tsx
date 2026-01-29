'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useWatch, Controller } from 'react-hook-form';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
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
import { salesFormSchema, SalesFormValues } from '@/lib/schemas/frontend/sales';

type SaleDetail = {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  rate: string;
  amount: string;
};

type Sale = {
  id?: number;
  invoiceNo: string;
  invoiceDate: string;
  franchiseId: string;
  discountPercent?: string;
  totalAmount: string;
  saleDetails: SaleDetail[];
};

export type SaleFormInitialData = {
  id?: number;
  invoiceNo?: string;
  invoiceDate?: string;
  franchiseId?: string;
  totalAmount?: number;
  saleDetails?: {
    medicineId: number;
    quantity: number;
    rate: number;
    amount: number;
  }[];
};

type Medicine = {
  id: number;
  name: string;
  brand: {
    name: string
  };
  rate: number;
  mrp: number;
};

type Franchise = {
  id: number;
  name: string;
};

interface SalesFormProps {
  mode: 'create' | 'edit';
  saleId?: number;
  initialData?: SalesFormValues;
}

export function SalesForm({ mode, saleId, initialData }: SalesFormProps) {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const schema = salesFormSchema;
  
  const form = useForm<SalesFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoiceNo: initialData?.invoiceNo || '',
      invoiceDate: initialData?.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      franchiseId: initialData?.franchiseId?.toString() || '',
      discountPercent: (initialData as any)?.discountPercent?.toString?.() ?? (initialData as any)?.discountPercent ?? '0',
      totalAmount: (initialData?.totalAmount ?? 0).toString(),
      saleDetails: initialData?.saleDetails?.map(detail => ({
        medicineId: detail.medicineId.toString(),
        batchNumber: (detail as any).batchNumber?.toString?.() ?? (detail as any).batchNumber ?? '',
        expiryDate: (detail as any).expiryDate?.toString?.()?.split?.('T')?.[0] ?? (detail as any).expiryDate ?? '',
        quantity: detail.quantity.toString(),
        rate: detail.rate.toString(),
        amount: detail.amount.toString()
      })) || [
        {
          medicineId: '',
          batchNumber: '',
          expiryDate: '',
          quantity: '1',
          rate: '0',
          amount: '0',
        }
      ]
    } as SalesFormValues,
  });

  const { control, handleSubmit, setValue } = form;
  const isCreate = mode === 'create';

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'saleDetails'
  });

  const watchedSaleDetails = useWatch({
    control,
    name: 'saleDetails'
  });

  const watchedDiscountPercent = useWatch({
    control,
    name: 'discountPercent' as any,
  });

  // Create options for ComboBoxInput
  const medicineOptions = useMemo(() => {
    return medicines.map((medicine) => ({
      value: String(medicine.id),
      label: `${medicine.brand.name} ${medicine.name}`
    }));
  }, [medicines]);

  const franchiseOptions = useMemo(() => {
    return franchises.map((franchise) => ({
      value: String(franchise.id),
      label: franchise.name
    }));
  }, [franchises]);

  const totals = useMemo(() => {
    const details = watchedSaleDetails || [];
    const subtotal = details.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const discountPercentNum = Math.min(
      100,
      Math.max(0, parseFloat((watchedDiscountPercent as any) || '0') || 0)
    );
    const discountAmount = subtotal * (discountPercentNum / 100);
    const total = Math.max(0, subtotal - discountAmount);
    return { subtotal, discountPercentNum, discountAmount, total };
  }, [watchedSaleDetails, watchedDiscountPercent]);

  useEffect(() => {
    setValue('totalAmount', totals.total.toFixed(2));
  }, [setValue, totals.total]);

  // Update amount when quantity or rate changes
  const updateDetailAmount = (index: number, field: 'quantity' | 'rate', value: string) => {
    const details = [...watchedSaleDetails];
    const detail = details[index];
    
    if (field === 'quantity') {
      detail.quantity = value;
    } else {
      detail.rate = value;
    }
    
    const quantity = parseFloat(detail.quantity) || 0;
    const rate = parseFloat(detail.rate) || 0;
    detail.amount = (quantity * rate).toString();
    
    setValue(`saleDetails.${index}.quantity`, detail.quantity);
    setValue(`saleDetails.${index}.rate`, detail.rate);
    setValue(`saleDetails.${index}.amount`, detail.amount);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [medicinesRes, franchisesRes] = await Promise.all([
          apiGet('/api/medicines?perPage=1000'),
          apiGet('/api/franchises?perPage=1000')
        ]);
        
        setMedicines((medicinesRes as any).data || []);
        setFranchises((franchisesRes as any).data || []);
      } catch (error) {
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const onSubmit = async (data: SalesFormValues) => {
    setSubmitting(true);
    try {
      // Convert string values to numbers for API
      const apiData = {
        invoiceDate: new Date(data.invoiceDate).toISOString(), // Convert to datetime
        franchiseId: parseInt(data.franchiseId),
        discountPercent: Math.min(100, Math.max(0, parseFloat((data as any).discountPercent || '0') || 0)),
        totalAmount: parseFloat(data.totalAmount),
        saleDetails: data.saleDetails.map(detail => ({
          medicineId: parseInt(detail.medicineId),
          batchNumber: detail.batchNumber,
          expiryDate: new Date(detail.expiryDate).toISOString(),
          quantity: parseFloat(detail.quantity),
          rate: parseFloat(detail.rate),
          amount: parseFloat(detail.amount)
        }))
      };
      
      if (!isCreate) {
        const response = await apiPatch(`/api/sales/${saleId}`, apiData);
        toast.success('Sale updated successfully');
      } else {
        const response = await apiPost('/api/sales', apiData);
        toast.success('Sale created successfully');
      }
      router.push('/sales');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <AppCard>
        <AppCard.Header>
          <AppCard.Title>{!isCreate ? 'Edit Sale' : 'Create Sale'}</AppCard.Title>
          <AppCard.Description>
            {!isCreate ? 'Update sale information' : 'Enter sale details'}
          </AppCard.Description>
        </AppCard.Header>
        <AppCard.Content className="space-y-6">
          {/* Basic Information */}
          <FormSection legend="Basic Information">
            <FormRow>
              <TextInput
                control={control}
                name="invoiceNo"
                label="Invoice Number"
                placeholder="Auto-generated"
                disabled
                itemClassName="col-span-12 md:col-span-6"
              />
              <TextInput
                control={control}
                name="invoiceDate"
                label="Invoice Date"
                type="date"
                required
                itemClassName="col-span-12 md:col-span-6"
              />
            </FormRow>
            <FormRow>
              <div className="col-span-12 md:col-span-6">
                <ComboboxInput
                  control={control}
                  name="franchiseId"
                  label="Franchise"
                  options={franchiseOptions}
                  required
                  placeholder="Select franchise"
                />
              </div>
            </FormRow>
          </FormSection>

          {/* Sale Details Table */}
          <FormSection legend="Sale Details">
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-0 bg-muted border-b">
                <div className="col-span-3 md:col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground border-r">
                  Medicine
                </div>
                <div className="col-span-2 md:col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r">
                  Batch No.
                </div>
                <div className="col-span-2 md:col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r">
                  Expiry Date
                </div>
                <div className="col-span-1 md:col-span-1 px-4 py-3 font-medium text-sm text-muted-foreground border-r">
                  Quantity
                </div>
                <div className="col-span-2 md:col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r">
                  Rate
                </div>
                <div className="col-span-2 md:col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground">
                  Amount
                </div>
              </div>

              {/* Table Rows */}
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50"
                >
                  <div className="col-span-3 md:col-span-3 p-3 border-r">
                    <ComboboxInput
                      control={control}
                      name={`saleDetails.${index}.medicineId`}
                      options={medicineOptions}
                      placeholder="Select medicine"
                      required
                      onChange={(value) => {
                        // When medicine is selected, override rate for this specific index
                        if (value) {
                          const medicineId = parseInt(value);
                          const medicine = medicines.find(m => m.id === medicineId);
                          if (medicine) {
                            setValue(`saleDetails.${index}.rate`, medicine.rate.toString());
                            const quantity = parseFloat(watchedSaleDetails[index]?.quantity || '1');
                            setValue(`saleDetails.${index}.amount`, (quantity * medicine.rate).toString());
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-2 p-3 border-r">
                    <Controller
                      control={control}
                      name={`saleDetails.${index}.batchNumber`}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="text"
                          placeholder="Batch"
                          className="w-full h-10 border"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-2 p-3 border-r">
                    <Controller
                      control={control}
                      name={`saleDetails.${index}.expiryDate`}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="date"
                          className="w-full h-10 border"
                          value={field.value || ''}
                        />
                      )}
                    />
                  </div>
                  <div className="col-span-1 md:col-span-1 p-3 border-r">
                    <Controller
                      control={control}
                      name={`saleDetails.${index}.quantity`}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          placeholder="0"
                          className="w-full h-10 border"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateDetailAmount(index, 'quantity', value);
                          }}
                        />
                      )}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-2 p-3 border-r">
                    <Controller
                      control={control}
                      name={`saleDetails.${index}.rate`}
                      render={({ field }) => (
                        <div className='relative w-full'>
                          <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full h-10 border pl-5.5"
                            value={field.value || ''}
                            disabled
                            readOnly
                          />
                        </div>
                      )}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-2 p-3 flex items-center gap-2">
                    <div className='relative w-full'>
                      <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                      <Input
                        value={watchedSaleDetails[index]?.amount || 0}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-full h-10 border pl-5.5"
                        disabled
                        readOnly
                      />
                    </div>
                    {fields.length > 1 && (
                      <AppButton
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </AppButton>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Row Button */}
            <div className="mt-4">
              <AppButton
                type="button"
                variant="outline"
                onClick={() => {
                  append({ medicineId: '', batchNumber: '', expiryDate: '', quantity: '1', rate: '0', amount: '0' });
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Sale Detail
              </AppButton>
            </div>
          </FormSection>

          {/* Total Amount */}
          <FormRow className='grid-cols-12'>
            <div className="col-span-12 flex justify-end">
              <div className='w-full max-w-[220px] space-y-3'>
                <div>
                  <div className='text-sm text-muted-foreground'>Discount (%)</div>
                  <Controller
                    control={control}
                    name={'discountPercent' as any}
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
        </AppCard.Content>
        <AppCard.Footer className="justify-end gap-2">
          <AppButton
            type="button"
            variant="outline"
            onClick={() => router.push('/sales')}
          >
            Cancel
          </AppButton>
         <AppButton
              type='submit'
              iconName={isCreate ? 'Plus' : 'Save'}
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              {isCreate ? 'Create Sale' : 'Update Sale'}
            </AppButton>
        </AppCard.Footer>
      </AppCard>
    </form>
    </Form>
  );
}
