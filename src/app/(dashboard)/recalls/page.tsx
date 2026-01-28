'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { DataTable, type SortState, type Column } from '@/components/common/data-table';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { formatDate } from '@/lib/locales';

type RecallRow = {
  id: number;
  recalledAt: string;
  franchiseId: number;
  franchiseName: string;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  txnNo: string;
};

type RecallsResponse = {
  data: RecallRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function RecallsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'recalledAt',
    order: 'desc',
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
    return `/api/recalls?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading } = useSWR<RecallsResponse>(query, apiGet);

  if (error) {
    toast.error((error as Error).message || 'Failed to load Recalls');
  }

  const columns: Column<RecallRow>[] = [
    { key: 'recalledAt', header: 'Recalled', sortable: true, cellClassName: 'whitespace-nowrap', accessor: (r) => formatDate(r.recalledAt) || '—' },
    { key: 'txnNo', header: 'Txn No', sortable: true, cellClassName: 'font-medium whitespace-nowrap', accessor: (r) => r.txnNo || '—' },
    { key: 'franchiseName', header: 'Franchise', sortable: true, cellClassName: 'whitespace-nowrap', accessor: (r) => r.franchiseName || '—' },
    { key: 'medicineName', header: 'Medicine', sortable: true, cellClassName: 'whitespace-nowrap', accessor: (r) => r.medicineName || '—' },
    { key: 'batchNumber', header: 'Batch No', sortable: true, cellClassName: 'whitespace-nowrap', accessor: (r) => r.batchNumber || '—' },
    { key: 'expiryDate', header: 'Expiry', sortable: true, cellClassName: 'whitespace-nowrap', accessor: (r) => formatDate(r.expiryDate) || '—' },
    { key: 'quantity', header: 'Qty', sortable: true, className: 'whitespace-nowrap', cellClassName: 'whitespace-nowrap', accessor: (r) => String(r.quantity ?? 0) },
  ];

  const sortState: SortState = { field: sort, order };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Recalls</AppCard.Title>
        <AppCard.Description>Recalled medicines history</AppCard.Description>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search recalls'
            placeholder='Search franchise, medicine, batch, txn…'
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
          stickyColumns={2}
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
