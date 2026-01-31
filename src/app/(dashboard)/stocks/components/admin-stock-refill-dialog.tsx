'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppButton } from '@/components/common/app-button';
import { DeleteIconButton } from '@/components/common/icon-button';
import { AppCombobox } from '@/components/common/app-combobox';
import { Input } from '@/components/ui/input';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type Medicine = {
  id: number;
  name: string;
  brand: string | null;
};

type Line = {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
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
  const [lines, setLines] = useState<Line[]>([{ medicineId: '', batchNumber: '', expiryDate: '', quantity: '1' }]);

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
        label: `${m.name} - ${m.brand || 'Unknown Brand'}`,
      })),
    [medicines]
  );

  function setLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { medicineId: '', batchNumber: '', expiryDate: '', quantity: '1' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const items = lines
      .map((l) => {
        const medicineId = Number(l.medicineId);
        const quantity = Number(l.quantity);
        const batchNumber = String(l.batchNumber || '').trim();
        const expiryDateRaw = String(l.expiryDate || '').trim();
        return { medicineId, quantity, batchNumber, expiryDateRaw };
      })
      .filter(
        (x) =>
          Number.isFinite(x.medicineId) &&
          x.medicineId > 0 &&
          Number.isFinite(x.quantity) &&
          x.quantity > 0 &&
          x.batchNumber.length > 0 &&
          x.expiryDateRaw.length > 0
      );

    if (!items.length) {
      toast.error('Add at least one valid item');
      return;
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 90);
    for (const it of items) {
      const expiry = new Date(it.expiryDateRaw);
      if (Number.isNaN(expiry.getTime())) {
        toast.error('Invalid expiry date');
        return;
      }
      if (expiry <= threshold) {
        toast.error('This batch expiry should be above 90 days');
        return;
      }
    }

    setSubmitting(true);
    try {
      await apiPost('/api/admin-stocks/refill', {
        items: items.map((it) => ({
          medicineId: it.medicineId,
          quantity: it.quantity,
          batchNumber: it.batchNumber,
          expiryDate: new Date(it.expiryDateRaw).toISOString(),
        })),
      });
      toast.success('Admin stock refilled');
      await onSuccess?.();
      onOpenChange(false);
      setLines([{ medicineId: '', batchNumber: '', expiryDate: '', quantity: '1' }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Add / Refill Admin Stock</DialogTitle>
          <DialogDescription>Increase admin stock quantities for selected medicines.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='py-6 text-sm text-muted-foreground'>Loading…</div>
        ) : (
          <div className='space-y-3'>
            <div className='hidden sm:grid grid-cols-[minmax(0,2.6fr)_minmax(0,1.4fr)_minmax(0,1.35fr)_minmax(0,0.9fr)_auto] gap-4 rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground'>
              <div>Medicine</div>
              <div>Batch No</div>
              <div>Expiry</div>
              <div className='sm:pl-3'>Qty</div>
              <div className='justify-self-end' />
            </div>

            <div className='max-h-[55vh] overflow-y-auto pr-1 space-y-3'>
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className='grid grid-cols-1 sm:grid-cols-[minmax(0,2.6fr)_minmax(0,1.4fr)_minmax(0,1.35fr)_minmax(0,0.9fr)_auto] gap-4 items-end rounded-lg border bg-background p-3 shadow-sm transition-colors hover:bg-accent/30'
                >
                  <div className='min-w-0'>
                    <div className='sm:hidden text-xs font-medium text-muted-foreground mb-1'>Medicine</div>
                    <AppCombobox
                      value={line.medicineId}
                      onValueChange={(value) => setLine(idx, { medicineId: value || '' })}
                      options={medicineOptions}
                      placeholder='Select medicine'
                      className='h-10 bg-background'
                    />
                  </div>

                  <div className='min-w-0'>
                    <div className='sm:hidden text-xs font-medium text-muted-foreground mb-1'>Batch No</div>
                    <Input
                      value={line.batchNumber}
                      onChange={(e) => setLine(idx, { batchNumber: e.target.value })}
                      placeholder='Batch'
                      className='h-10 bg-background'
                    />
                  </div>

                  <div className='min-w-0'>
                    <div className='sm:hidden text-xs font-medium text-muted-foreground mb-1'>Expiry</div>
                    <Input
                      type='date'
                      value={line.expiryDate}
                      onChange={(e) => setLine(idx, { expiryDate: e.target.value })}
                      className='h-10 bg-background min-w-[150px]'
                    />
                  </div>

                  <div className='min-w-0 sm:pl-3'>
                    <div className='sm:hidden text-xs font-medium text-muted-foreground mb-1'>Qty</div>
                    <Input
                      type='number'
                      min='1'
                      value={line.quantity}
                      onChange={(e) => setLine(idx, { quantity: e.target.value })}
                      className='h-10 bg-background'
                    />
                  </div>

                  <div className='flex justify-end'>
                    {lines.length > 1 && (
                      <DeleteIconButton
                        tooltip='Remove'
                        aria-label='Remove'
                        onClick={() => removeLine(idx)}
                        className='bg-background hover:bg-destructive/10'
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className='flex items-center justify-between gap-2 pt-1'>
              <div className='text-xs text-muted-foreground'>Tip: You can add multiple medicines and save once.</div>
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
