'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { TextInput } from '@/components/common/text-input';
import { ComboboxInput } from '@/components/common/combobox-input';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FormSection, FormRow } from '@/components/common/app-form';
import { apiPost, apiPatch, apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';


export interface MedicineFormInitialData {
  id?: number;
  name?: string;
  brandId?: string;
  brand?: string;
  rate?: string;
  baseRate?: string;
  gstPercent?: string;
  mrp?: string;
}

export interface FormProps {
  mode: 'create' | 'edit';
  initial?: MedicineFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/medicines'
}

export const medicineSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
    brandId: z.string().refine(
    (v) => !v || /^\d+$/.test(v), "Must be a valid number"
  ).refine((v) => v && v.trim().length > 0, "Brand is required"),
    rate: z.string().trim()
      .refine((val) => val && val.trim().length > 0, "Rate is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Rate must be a valid positive number"),
    gstPercent: z.string().trim()
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "GST must be a valid positive number"),
    mrp: z.string().trim()
      .refine((val) => val && val.trim().length > 0, "MRP is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "MRP must be a valid positive number"),
});


export function MedicineForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = '/medicines',
}: FormProps) {
 
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);
  
  const brandOptions = useMemo(() => {
    return brands.map((brand) => ({
      value: brand.id.toString(),
      label: brand.name
    }));
  }, [brands]);
  
  type RawFormValues = z.infer<typeof medicineSchema>;
  const form = useForm<RawFormValues>({
    resolver: zodResolver(medicineSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name || '',
      brandId: initial?.brandId?.toString() || '',
      rate: initial?.baseRate || initial?.rate || '',
      gstPercent: initial?.gstPercent || '0',
      mrp: initial?.mrp || '',
    } 
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const brandsRes = await apiGet('/api/brands?perPage=1000');
        setBrands((brandsRes as any).data || []);
      } catch (error) {
        console.error('Failed to load brands:', error);
      }
    };

    fetchData();
  }, []);

  const { control, handleSubmit, setError, clearErrors, watch, setValue, getValues } = form;
  const isCreate = mode === 'create';

  const baseRateRaw = watch('rate');
  const gstPercentRaw = watch('gstPercent');
  const computedFranchiseRate = useMemo(() => {
    const base = parseFloat(String(baseRateRaw ?? '0'));
    const gst = parseFloat(String(gstPercentRaw ?? '0'));
    const safeBase = Number.isFinite(base) ? base : 0;
    const safeGst = Number.isFinite(gst) ? gst : 0;
    const rate = safeBase + (safeBase * safeGst) / 100;
    return rate.toFixed(2);
  }, [baseRateRaw, gstPercentRaw]);

  async function onSubmit(values: RawFormValues) {
    clearErrors('name');
    setSubmitting(true);
    const apiData = {
      ...values,
      brandId: parseInt(values.brandId),
      rate: parseFloat(values.rate),
      gstPercent: parseFloat((values as any).gstPercent),
      mrp: parseFloat(values.mrp),
    };
    try {
      if (mode === 'create') {
        const res = await apiPost('/api/medicines', apiData);
        toast.success('Medicine has been added');
        onSuccess?.(res);
      } else if (mode === 'edit' && initial?.id) {
        const res = await apiPatch(`/api/medicines/${initial.id}`, apiData);
        toast.success('Medicine details have been updated');
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e?.status === 409) {
        setError('name', { type: 'server', message: e.message || 'Medicine name already exists' }, { shouldFocus: true });
        return;
      }
      console.log(err);
      toast.error((err as Error).message || 'Failed to save medicine');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>{isCreate ? 'Create Medicine' : 'Edit Medicine'}</AppCard.Title>
          <AppCard.Description>{isCreate ? 'Create a new medicine' : 'Edit medicine details'}</AppCard.Description>
        </AppCard.Header>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Medicine details'>
              <FormRow className='grid-cols-12 gap-6'>
                <TextInput
                  control={control}
                  name='name'
                  label='Medicine Name'
                  placeholder='Medicine name'
                  required
                  itemClassName='col-span-12 md:col-span-6'
                />
                 <ComboboxInput
                  control={control}
                  name='brandId'
                  label='Brand'
                  placeholder='Select brand'
                  searchPlaceholder='Search brands...'
                  emptyText='No brand found.'
                  options={brandOptions}
                  required
                  className='col-span-12 md:col-span-6'
                />
              </FormRow>
              <FormRow cols={4} from='md'>
                <TextInput
                  control={control}
                  name='rate'
                  label='Base Rate'
                  placeholder='Base rate'
                  type='number'
                  step='0.01'
                  required
                />
                <TextInput
                  control={control}
                  name='gstPercent'
                  label='GST %'
                  placeholder='GST %'
                  type='number'
                  step='0.01'
                  required
                />
                <NonFormTextInput
                  label='Franchise Rate'
                  value={computedFranchiseRate}
                  readOnly
                  disabled
                />
                <TextInput
                  control={control}
                  name='mrp'
                  label='MRP'
                  placeholder='MRP'
                  type='number'
                  step='0.01'
                  required
                />
              </FormRow>
            </FormSection>
          </AppCard.Content>
          <AppCard.Footer className='justify-end'>
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
              {isCreate ? 'Create Medicine' : 'Save Changes'}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default MedicineForm;
