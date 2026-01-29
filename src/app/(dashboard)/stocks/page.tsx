'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { IconButton } from '@/components/common/icon-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS, ROLES } from '@/config/roles';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminStockRefillDialog } from '@/app/(dashboard)/stocks/components/admin-stock-refill-dialog';

type StockRow = {
  franchiseId: number;
  franchiseName: string;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  rate: string;
  stock: number;
};

type StocksRowsResponse = {
  data: StockRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

type AdminStockRow = {
  medicineId: number;
  medicineName: string;
  brandName: string | null;
  rate: string;
  stock: number;
};

type AdminStocksRowsResponse = {
  data: AdminStockRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function StocksPage() {
  const { can, role } = usePermissions();
  const [refillOpen, setRefillOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'admin' | 'franchise'>(
    role === ROLES.ADMIN ? 'admin' : 'franchise'
  );
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'franchiseName',
    order: 'asc',
  });

  const { page, perPage, search, sort, order } = (qp as unknown) as {
    page: number;
    perPage: number;
    search: string;
    sort: string;
    order: 'asc' | 'desc';
  };

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/stocks/rows?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<StocksRowsResponse>(query, apiGet);

  const adminQuery = useMemo(() => {
    if (role !== ROLES.ADMIN) return null;
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/admin-stocks/rows?${sp.toString()}`;
  }, [role, page, perPage, search, sort, order]);

  const { data: adminData, error: adminError, isLoading: adminLoading, mutate: mutateAdmin } = useSWR<AdminStocksRowsResponse>(
    adminQuery,
    apiGet
  );

  if (error) {
    toast.error((error as Error).message || 'Failed to load Stocks');
  }

  if (role === ROLES.ADMIN && adminError) {
    toast.error((adminError as Error).message || 'Failed to load Admin Stocks');
  }

  const columns: Column<StockRow>[] = [
    { key: 'franchiseName', header: 'Franchise', sortable: true, cellClassName: 'font-medium whitespace-nowrap' },
    { key: 'medicineName', header: 'Medicine', sortable: true, cellClassName: 'whitespace-nowrap' },
    { key: 'batchNumber', header: 'Batch No', sortable: true, cellClassName: 'whitespace-nowrap' },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      sortable: true,
      cellClassName: 'whitespace-nowrap',
      accessor: (row) => {
        if (!row.expiryDate) return '—';
        const d = new Date(row.expiryDate);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toISOString().split('T')[0];
      },
    },
    { key: 'rate', header: 'Rate', sortable: true, className: 'whitespace-nowrap' },
    { key: 'stock', header: 'Stock', sortable: true, className: 'whitespace-nowrap' },
  ];

  const adminColumns: Column<AdminStockRow>[] = [
    { key: 'medicineName', header: 'Medicine', sortable: true, cellClassName: 'font-medium whitespace-nowrap' },
    { key: 'brandName', header: 'Brand', sortable: true, cellClassName: 'whitespace-nowrap' },
    { key: 'rate', header: 'Rate', sortable: true, className: 'whitespace-nowrap' },
    { key: 'stock', header: 'Stock', sortable: true, className: 'whitespace-nowrap' },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleRecall(row: StockRow) {
    try {
      await apiPost('/api/stocks/recall', {
        franchiseId: row.franchiseId,
        medicineId: row.medicineId,
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate,
        quantity: row.stock,
      });
      toast.success('Stock recalled successfully');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Stocks</AppCard.Title>
        <AppCard.Description>Admin stock and franchise medicine stock</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search stocks'
            placeholder={activeTab === 'admin' ? 'Search medicine or brand…' : 'Search franchise, medicine, or batch…'}
            value={search}
            onChange={(e) => setQp({ page: 1, search: e.target.value })}
            containerClassName='w-full'
          />
        </FilterBar>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = (v === 'admin' ? 'admin' : 'franchise') as 'admin' | 'franchise';
            setActiveTab(next);
            if (next === 'admin') {
              setQp({ page: 1, search: '', sort: 'medicineName', order: 'asc' });
            } else {
              setQp({ page: 1, search: '', sort: 'franchiseName', order: 'asc' });
            }
          }}
        >
          <div className='flex items-center justify-between gap-2'>
            <TabsList>
              {role === ROLES.ADMIN && <TabsTrigger value='admin'>Admin</TabsTrigger>}
              <TabsTrigger value='franchise'>Franchise</TabsTrigger>
            </TabsList>

            {role === ROLES.ADMIN && activeTab === 'admin' && can(PERMISSIONS.CREATE_STOCKS) && (
              <AppButton type='button' iconName='Plus' onClick={() => setRefillOpen(true)}>
                Add / Refill
              </AppButton>
            )}
          </div>

          {role === ROLES.ADMIN && (
            <TabsContent value='admin'>
              <DataTable
                columns={adminColumns}
                data={adminData?.data || []}
                loading={adminLoading}
                sort={sortState}
                onSortChange={(s) => toggleSort(s.field)}
                stickyColumns={1}
              />

              <AdminStockRefillDialog
                open={refillOpen}
                onOpenChange={setRefillOpen}
                onSuccess={async () => {
                  await mutateAdmin();
                }}
              />
            </TabsContent>
          )}

          <TabsContent value='franchise'>
            <DataTable
              columns={columns}
              data={data?.data || []}
              loading={isLoading}
              sort={sortState}
              onSortChange={(s) => toggleSort(s.field)}
              getRowClassName={(row) => {
                if (!row.expiryDate) return '';
                const expiry = new Date(row.expiryDate);
                if (Number.isNaN(expiry.getTime())) return '';
                const now = new Date();
                const in45Days = new Date(now);
                in45Days.setDate(in45Days.getDate() + 45);
                if (expiry <= in45Days) {
                  return 'bg-red-50 text-red-900';
                }
                return '';
              }}
              stickyColumns={1}
              renderRowActions={(row) => {
                if (!can(PERMISSIONS.CREATE_STOCKS)) return null;
                if (!row.stock || row.stock <= 0) return null;

                if (!row.expiryDate) return null;
                const expiry = new Date(row.expiryDate);
                if (Number.isNaN(expiry.getTime())) return null;
                const now = new Date();
                const in45Days = new Date(now);
                in45Days.setDate(in45Days.getDate() + 45);
                if (expiry > in45Days) return null;

                return (
                  <ConfirmDialog
                    trigger={<IconButton iconName='Undo2' tooltip='Recall Stock' />}
                    title='Recall stock?'
                    description={`This will deduct ${row.stock} from ${row.franchiseName} for ${row.medicineName} (Batch ${row.batchNumber}).`}
                    confirmText='Recall'
                    onConfirm={() => handleRecall(row)}
                  />
                );
              }}
            />
          </TabsContent>
        </Tabs>
      </AppCard.Content>
      <AppCard.Footer className='justify-end'>
        <Pagination
          page={activeTab === 'admin' ? adminData?.page || page : data?.page || page}
          totalPages={activeTab === 'admin' ? adminData?.totalPages || 1 : data?.totalPages || 1}
          total={activeTab === 'admin' ? adminData?.total : data?.total}
          perPage={perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
          onPageChange={(p) => setQp({ page: p })}
          showPageNumbers
          maxButtons={5}
          disabled={isLoading || adminLoading}
        />
      </AppCard.Footer>
    </AppCard>
  );
}
