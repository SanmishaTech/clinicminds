'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { FilterBar } from '@/components/common';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { Pagination } from '@/components/common/pagination';
import { DataTable, type Column, type SortState } from '@/components/common/data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS, ROLES } from '@/config/roles';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { AppButton } from '@/components/common/app-button';
import { AppSelect } from '@/components/common/app-select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { formatDate, formatIndianCurrency } from '@/lib/locales';

type TransportListItem = {
  id: number;
  saleId: number;
  status: string;
  dispatchedQuantity?: number | null;
  transporterName?: string | null;
  companyName?: string | null;
  transportFee?: number | string | null;
  receiptNumber?: string | null;
  vehicleNumber?: string | null;
  trackingNumber?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  sale?: {
    invoiceNo: string;
    invoiceDate: string;
    totalAmount: number | string;
    saleDetails?: Array<{
      quantity: number | string;
    }>;
  };
  franchise?: {
    name: string;
  };
};

type TransportsResponse = {
  data: TransportListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function TransportsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    status: '',
    sort: 'createdAt',
    order: 'desc',
  });

  const { page, perPage, search, status, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    status: string;
    sort: string;
    order: 'asc' | 'desc';
  };

  const [searchDraft, setSearchDraft] = useState(search);
  const [statusDraft, setStatusDraft] = useState(status);

  useEffect(() => {
    setSearchDraft(search);
    setStatusDraft(status);
  }, [search, status]);

  const filtersDirty = searchDraft !== search || statusDraft !== status;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim(), status: statusDraft });
  }

  function resetFilters() {
    setSearchDraft('');
    setStatusDraft('');
    setQp({ page: 1, search: '', status: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (status) sp.set('status', status);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/transports?${sp.toString()}`;
  }, [page, perPage, search, status, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<TransportsResponse>(query, apiGet);

  const { can, role } = usePermissions();

  const showFranchiseColumn = role === ROLES.ADMIN;

  const isFranchiseLike = can(PERMISSIONS.EDIT_TRANSPORTS) && !can(PERMISSIONS.CREATE_TRANSPORTS);

  if (error) {
    toast.error((error as Error).message || 'Failed to load Transports');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<TransportListItem>[] = useMemo(() => {
    const base: Column<TransportListItem>[] = [
      {
        key: 'sale',
        header: 'Invoice No',
        sortable: false,
        cellClassName: 'font-medium whitespace-nowrap',
        accessor: (r) => r.sale?.invoiceNo || `#${r.saleId}`,
      },
      {
        key: 'invoiceDate',
        header: 'Invoice Date',
        sortable: false,
        className: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        accessor: (r) => formatDate(r.sale?.invoiceDate || ''),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: false,
        accessor: (r) => {
          const effectiveStatus = r.deliveredAt
            ? 'DELIVERED'
            : r.dispatchedAt
              ? 'DISPATCHED'
              : ((r.status || 'PENDING') as string);

          return (
            <StatusBadge
              status={effectiveStatus.toLowerCase()}
              stylesMap={{
                pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
                dispatched: { label: 'Dispatched', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                delivered: { label: 'Delivered', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
              }}
            />
          );
        },
      },
      {
        key: 'transportFee',
        header: 'Transport Fee',
        sortable: false,
        className: 'whitespace-nowrap',
        accessor: (r) => formatIndianCurrency(Number(r.transportFee) || 0),
      },
      {
        key: 'dispatchedAt',
        header: 'Dispatched',
        sortable: false,
        className: 'whitespace-nowrap',
        accessor: (r) => (r.dispatchedAt ? formatDate(r.dispatchedAt) : '—'),
      },
      {
        key: 'dispatchedStock',
        header: 'Dispatched Stock',
        sortable: false,
        className: 'whitespace-nowrap',
        accessor: (r) => {
          const totalQty = (r.sale?.saleDetails || []).reduce(
            (sum, d) => sum + (Number(d.quantity) || 0),
            0
          );
          const dispatchedQty = Number(r.dispatchedQuantity) || 0;
          return totalQty > 0 ? `${dispatchedQty}/${totalQty}` : '—';
        },
      },
    ];

    if (showFranchiseColumn) {
      base.splice(2, 0, {
        key: 'franchise',
        header: 'Franchise',
        sortable: false,
        accessor: (r) => r.franchise?.name || '—',
      });
    }

    return base;
  }, [showFranchiseColumn]);

  const sortState: SortState = { field: sort, order };

  async function deliverTransport(id: number) {
    try {
      await apiPatch(`/api/transports/${id}`, { status: 'DELIVERED' });
      toast.success('Marked as delivered');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to mark delivered');
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Transports</AppCard.Title>
        <AppCard.Description>Track dispatch and delivery</AppCard.Description>
      </AppCard.Header>

      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search transports'
            placeholder='Search invoice, receipt, tracking…'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppSelect
            value={statusDraft || '__all'}
            onValueChange={(v) => setStatusDraft(v === '__all' ? '' : v)}
            placeholder='Status'
            className='w-full min-w-[160px]'
          >
            <AppSelect.Item value='__all'>All Status</AppSelect.Item>
            <AppSelect.Item value='PENDING'>Pending</AppSelect.Item>
            <AppSelect.Item value='DISPATCHED'>Dispatched</AppSelect.Item>
            <AppSelect.Item value='DELIVERED'>Delivered</AppSelect.Item>
          </AppSelect>
          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {(search || status) && (
            <AppButton
              variant='secondary'
              size='sm'
              onClick={resetFilters}
              className='min-w-[84px]'
            >
              Reset
            </AppButton>
          )}
        </FilterBar>

        <DataTable
          columns={columns}
          data={data?.data || []}
          loading={isLoading}
          sort={sortState}
          onSortChange={(s) => toggleSort(s.field)}
          stickyColumns={1}
          renderRowActions={(row) => {
            const statusUpper = (row.deliveredAt
              ? 'DELIVERED'
              : row.dispatchedAt
                ? 'DISPATCHED'
                : (row.status || 'PENDING')
            ).toUpperCase();

            return (
              <div className='flex items-center gap-1'>
                {can(PERMISSIONS.CREATE_TRANSPORTS) && statusUpper === 'PENDING' && (
                  <Link href={`/transports/new?transportId=${row.id}`}>
                    <AppButton size='sm' variant='secondary' type='button'>
                      Dispatch
                    </AppButton>
                  </Link>
                )}

                {can(PERMISSIONS.CREATE_TRANSPORTS) && statusUpper === 'DISPATCHED' && (
                  <Link href={`/transports/new?transportId=${row.id}`}>
                    <AppButton size='sm' variant='secondary' type='button'>
                      View
                    </AppButton>
                  </Link>
                )}

                {isFranchiseLike && statusUpper === 'DISPATCHED' && (
                  <ConfirmDialog
                    title='Mark as delivered?'
                    description='This will post stock to your franchise.'
                    confirmText='Deliver'
                    onConfirm={() => deliverTransport(row.id)}
                    trigger={
                      <AppButton size='sm' type='button'>
                        Delivered
                      </AppButton>
                    }
                  />
                )}
              </div>
            );
          }}
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
