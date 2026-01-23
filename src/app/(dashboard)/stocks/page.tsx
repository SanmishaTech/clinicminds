'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { useQueryParamsState } from '@/hooks/use-query-params-state';

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

export default function StocksPage() {
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

  const { data, error, isLoading } = useSWR<StocksRowsResponse>(query, apiGet);

  if (error) {
    toast.error((error as Error).message || 'Failed to load Stocks');
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

  const sortState: SortState = { field: sort, order };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Stocks</AppCard.Title>
        <AppCard.Description>Franchise medicine stock</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search stocks'
            placeholder='Search franchise or medicine…'
            value={search}
            onChange={(e) => setQp({ page: 1, search: e.target.value })}
            containerClassName='w-full'
          />
        </FilterBar>
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
            const in30Days = new Date(now);
            in30Days.setDate(in30Days.getDate() + 30);
            if (expiry <= in30Days) {
              return 'bg-red-50 text-red-900';
            }
            return '';
          }}
          stickyColumns={1}
        />
      </AppCard.Content>
      <AppCard.Footer className='justify-end'>
        <Pagination
          page={data?.page || page}
          totalPages={data?.totalPages || 1}
          total={data?.total}
          perPage={perPage}
          onPerPageChange={(val) => setQp({ page: 1, perPage: val })}
          onPageChange={(p) => setQp({ page: p })}
          showPageNumbers
          maxButtons={5}
          disabled={isLoading}
        />
      </AppCard.Footer>
    </AppCard>
  );
}
