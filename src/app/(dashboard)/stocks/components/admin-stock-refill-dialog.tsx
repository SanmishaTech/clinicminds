'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppButton } from '@/components/common/app-button';
import { AppCombobox } from '@/components/common/app-combobox';
import { Input } from '@/components/ui/input';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type Medicine = {
  id: number;
  name: string;
  brand: { name: string };
};

type Line = {
  medicineId: string;
  quantity: string;
};

export type AdminStockRefillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
};

export function AdminStockRefillDialog({ open, onOpenChange, onSuccess }: AdminStockRefillDialogProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ medicineId: '', quantity: '1' }]);

  useEffect(() => {
    if (!open) return;
    const fetchMedicines = async () => {
      setLoading(true);
      try {
        const res = await apiGet('/api/medicines?perPage=1000');
        setMedicines((res as any)?.data || []);
      } catch {
        toast.error('Failed to load medicines');
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, [open]);

  const medicineOptions = useMemo(
    () =>
      medicines.map((m) => ({
        value: String(m.id),
        label: `${m.brand?.name ?? ''} ${m.name}`.trim(),
      })),
    [medicines]
  );

  function setLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { medicineId: '', quantity: '1' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const items = lines
      .map((l) => ({
        medicineId: Number(l.medicineId),
        quantity: Number(l.quantity),
      }))
      .filter((x) => Number.isFinite(x.medicineId) && x.medicineId > 0 && Number.isFinite(x.quantity) && x.quantity > 0);

    if (!items.length) {
      toast.error('Add at least one valid item');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/api/admin-stocks/refill', { items });
      toast.success('Admin stock refilled');
      await onSuccess?.();
      onOpenChange(false);
      setLines([{ medicineId: '', quantity: '1' }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Add / Refill Admin Stock</DialogTitle>
          <DialogDescription>Increase admin stock quantities for selected medicines.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className='space-y-4'>
            {lines.map((line, idx) => (
              <div key={idx} className='grid grid-cols-12 gap-2 items-center'>
                <div className='col-span-8'>
                  {idx === 0 && <div className='text-sm font-medium mb-2'>Medicine</div>}
                  <AppCombobox
                    value={line.medicineId}
                    onValueChange={(value) => setLine(idx, { medicineId: value || '' })}
                    options={medicineOptions}
                    placeholder='Select medicine'
                  />
                </div>
                <div className='col-span-3'>
                  {idx === 0 && <div className='text-sm font-medium mb-2'>Quantity</div>}
                  <Input
                    type='number'
                    min='1'
                    value={line.quantity}
                    onChange={(e) => setLine(idx, { quantity: e.target.value })}
                  />
                </div>
                <div className='col-span-1 flex justify-end'>
                  {lines.length > 1 && (
                    <AppButton type='button' variant='destructive' size='sm' onClick={() => removeLine(idx)}>
                      Remove
                    </AppButton>
                  )}
                </div>
              </div>
            ))}

            <div className='flex justify-end'>
              <AppButton type='button' variant='outline' onClick={addLine}>
                Add Item
              </AppButton>
            </div>
          </div>
        )}

        <DialogFooter>
          <AppButton type='button' variant='secondary' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </AppButton>
          <AppButton type='button' onClick={handleSubmit} isLoading={submitting} disabled={submitting || loading}>
            Save
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
