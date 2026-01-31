'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useWatch, Controller } from 'react-hook-form';
import { apiGet, apiPost } from '@/lib/api-client';
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
import { stockFormSchema, StockFormValues } from '@/lib/schemas/frontend/stocks';
import { TextareaInput } from '@/components/common/textarea-input';

type StockLine = {
  medicineId: string;
  quantity: string;
  rate: string;
  amount: string;
};

type Medicine = {
  id: number;
  name: string;
  brand: string | null;
  rate: number;
  mrp: number;
};

type Franchise = {
  id: number;
  name: string;
};

interface StocksFormProps {
  mode: 'create';
}

export function StocksForm({ mode }: StocksFormProps) {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<StockFormValues>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      txnNo: '',
      txnDate: new Date().toISOString().split('T')[0],
      franchiseId: '',
      notes: '',
      items: [
        {
          medicineId: '',
          quantity: '1',
          rate: '0',
          amount: '0',
        },
      ],
    } as StockFormValues,
  });

  const { control, handleSubmit, setValue } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = useWatch({
    control,
    name: 'items',
  });

  const totalAmount = useMemo(() => {
    const items = watchedItems || [];
    return items.reduce((sum, item) => {
      const amt = parseFloat((item as any).amount) || 0;
      return sum + amt;
    }, 0);
  }, [watchedItems]);

  const medicineOptions = useMemo(() => {
    return medicines.map((medicine) => ({
      value: String(medicine.id),
      label: `${medicine.brand || 'Unknown Brand'} ${medicine.name}`.trim(),
    }));
  }, [medicines]);

  const franchiseOptions = useMemo(() => {
    return franchises.map((franchise) => ({
      value: String(franchise.id),
      label: franchise.name,
    }));
  }, [franchises]);

  const updateLineAmount = (index: number, field: 'quantity' | 'rate', value: string) => {
    const lines = [...(watchedItems || [])];
    const line = lines[index];
    if (!line) return;

    if (field === 'quantity') line.quantity = value;
    else line.rate = value;

    const quantity = parseFloat(line.quantity) || 0;
    const rate = parseFloat(line.rate) || 0;
    line.amount = (quantity * rate).toString();

    setValue(`items.${index}.quantity`, line.quantity);
    setValue(`items.${index}.rate`, line.rate);
    setValue(`items.${index}.amount`, line.amount);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [medicinesRes, franchisesRes] = await Promise.all([
          apiGet('/api/medicines?perPage=1000'),
          apiGet('/api/franchises?perPage=1000'),
        ]);

        setMedicines((medicinesRes as any).data || []);
        setFranchises((franchisesRes as any).data || []);
      } catch {
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const onSubmit = async (data: StockFormValues) => {
    setSubmitting(true);
    try {
      const apiData = {
        txnDate: new Date(data.txnDate).toISOString(),
        franchiseId: parseInt(data.franchiseId),
        notes: data.notes?.trim() ? data.notes.trim() : null,
        items: data.items.map((it: StockLine) => ({
          medicineId: parseInt(it.medicineId),
          quantity: parseFloat(it.quantity),
          rate: parseFloat(it.rate),
          amount: parseFloat(it.amount),
        })),
      };

      await apiPost('/api/stocks', apiData);
      toast.success('Stock transaction created successfully');
      router.push('/stocks');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Create Stock Transaction</AppCard.Title>
            <AppCard.Description>Dispatch medicines to a franchise</AppCard.Description>
          </AppCard.Header>
          <AppCard.Content className='space-y-6'>
            <FormSection legend='Basic Information'>
              <FormRow>
                <TextInput
                  control={control}
                  name='txnNo'
                  label='Transaction Number'
                  placeholder='Auto-generated'
                  disabled
                  itemClassName='col-span-12 md:col-span-6'
                />
                <TextInput
                  control={control}
                  name='txnDate'
                  label='Date'
                  type='date'
                  required
                  itemClassName='col-span-12 md:col-span-6'
                />
              </FormRow>
              <FormRow>
                <div className='col-span-12 md:col-span-6'>
                  <ComboboxInput
                    control={control}
                    name='franchiseId'
                    label='Franchise'
                    options={franchiseOptions}
                    required
                    placeholder='Select franchise'
                  />
                </div>
              </FormRow>
              <FormRow>
                <TextareaInput
                  control={control as any}
                  name='notes'
                  label='Notes'
                  placeholder='Optional'
                  rows={3}
                  itemClassName='col-span-12'
                />
              </FormRow>
            </FormSection>

            <FormSection legend='Items'>
              <div className='border rounded-lg overflow-hidden'>
                <div className='grid grid-cols-12 gap-0 bg-muted border-b'>
                  <div className='col-span-5 md:col-span-5 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Medicine
                  </div>
                  <div className='col-span-2 md:col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Quantity
                  </div>
                  <div className='col-span-2 md:col-span-2 px-4 py-3 font-medium text-sm text-muted-foreground border-r'>
                    Rate
                  </div>
                  <div className='col-span-3 md:col-span-3 px-4 py-3 font-medium text-sm text-muted-foreground'>
                    Amount
                  </div>
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className='grid grid-cols-12 gap-0 border-b last:border-b-0 hover:bg-accent/50'
                  >
                    <div className='col-span-5 md:col-span-5 p-3 border-r'>
                      <ComboboxInput
                        control={control}
                        name={`items.${index}.medicineId`}
                        options={medicineOptions}
                        placeholder='Select medicine'
                        required
                        onChange={(value) => {
                          if (value) {
                            const medicineId = parseInt(value);
                            const medicine = medicines.find((m) => m.id === medicineId);
                            if (medicine) {
                              setValue(`items.${index}.rate`, medicine.rate.toString());
                              const quantity = parseFloat(watchedItems?.[index]?.quantity || '1');
                              setValue(`items.${index}.amount`, (quantity * medicine.rate).toString());
                            }
                          }
                        }}
                      />
                    </div>
                    <div className='col-span-2 md:col-span-2 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type='number'
                            min='1'
                            placeholder='0'
                            className='w-full h-10 border'
                            value={field.value || ''}
                            onChange={(e) => updateLineAmount(index, 'quantity', e.target.value)}
                          />
                        )}
                      />
                    </div>
                    <div className='col-span-2 md:col-span-2 p-3 border-r'>
                      <Controller
                        control={control}
                        name={`items.${index}.rate`}
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
                              onChange={(e) => updateLineAmount(index, 'rate', e.target.value)}
                            />
                          </div>
                        )}
                      />
                    </div>
                    <div className='col-span-3 md:col-span-3 p-3 flex items-center gap-2'>
                      <div className='relative w-full'>
                        <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground'>₹</span>
                        <Input
                          value={watchedItems?.[index]?.amount || 0}
                          type='number'
                          step='0.01'
                          min='0'
                          placeholder='0.00'
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

              <div className='mt-4'>
                <AppButton
                  type='button'
                  variant='outline'
                  onClick={() => append({ medicineId: '', quantity: '1', rate: '0', amount: '0' })}
                  className='gap-2'
                >
                  <Plus className='h-4 w-4' />
                  Add Item
                </AppButton>
              </div>
            </FormSection>

            <FormRow className='grid-cols-12'>
              <div className='col-span-12 flex justify-end'>
                <div className='text-right'>
                  <div className='text-sm text-muted-foreground'>Total Amount</div>
                  <div className='text-lg font-bold text-foreground'>
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      minimumFractionDigits: 2,
                    }).format(totalAmount)}
                  </div>
                </div>
              </div>
            </FormRow>
          </AppCard.Content>
          <AppCard.Footer className='justify-end gap-2'>
            <AppButton type='button' variant='outline' onClick={() => router.push('/stocks')}>
              Cancel
            </AppButton>
            <AppButton
              type='submit'
              iconName='Plus'
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              Create Transaction
            </AppButton>
          </AppCard.Footer>
        </AppCard>
      </form>
    </Form>
  );
}
