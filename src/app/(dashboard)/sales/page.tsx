'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet, apiDelete } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatIndianCurrency } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { EditButton } from '@/components/common/icon-button';
import { IconButton } from '@/components/common/icon-button';
import { DeleteButton } from '@/components/common/delete-button';
import { StatusBadge } from '@/components/common/status-badge';
import { AppSelect } from '@/components/common/app-select';
import Link from 'next/link';



type SaleListItem = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  transport?: {
    id: number;
    status: string;
  } | null;
  franchise: {
    name: string;
  };
  _count: {
    saleDetails: number;
  };
};

type SalesResponse = {
  data: SaleListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function SalesPage() {
  
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'invoiceDate',
    order: 'desc',
    startDate: '',
    endDate: '',
    franchiseId: '',
  });
  const { page, perPage, search, sort, order, startDate, endDate, franchiseId } =
    (qp as unknown) as {
      page: number;
      perPage: number;
      search: string;
      sort: string;
      order: 'asc' | 'desc';
      startDate: string;
      endDate: string;
      franchiseId: string;
    };

  const [searchDraft, setSearchDraft] = useState(search);
  const [startDateDraft, setStartDateDraft] = useState(startDate);
  const [endDateDraft, setEndDateDraft] = useState(endDate);
  const [franchiseIdDraft, setFranchiseIdDraft] = useState(franchiseId);

  useEffect(() => { 
    setSearchDraft(search);
    setStartDateDraft(startDate);
    setEndDateDraft(endDate);
    setFranchiseIdDraft(franchiseId);
  }, [search, startDate, endDate, franchiseId]);

  const filtersDirty = searchDraft !== search || 
    startDateDraft !== startDate || endDateDraft !== endDate || franchiseIdDraft !== franchiseId;

  function applyFilters() {
    setQp({ 
      page: 1, 
      search: searchDraft.trim(),
      startDate: startDateDraft,
      endDate: endDateDraft,
      franchiseId: franchiseIdDraft,
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setStartDateDraft('');
    setEndDateDraft('');
    setFranchiseIdDraft('');
    setQp({ 
      page: 1, 
      search: '',
      startDate: '',
      endDate: '',
      franchiseId: '',
    });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    if (startDate) sp.set('startDate', startDate);
    if (endDate) sp.set('endDate', endDate);
    if (franchiseId) sp.set('franchiseId', franchiseId);
    return `/api/sales?${sp.toString()}`;
  }, [page, perPage, search, sort, order, startDate, endDate, franchiseId]);

  const { data, error, isLoading, mutate } = useSWR<SalesResponse>(query, apiGet);

  const { can } = usePermissions();

  // Fetch franchises for admin filter
  const { data: franchisesResp } = useSWR(
    can(PERMISSIONS.READ_FRANCHISES) ? '/api/franchises?page=1&perPage=100&sort=name&order=asc' : null,
    apiGet
  );

  const franchiseOptions = useMemo(() => {
    return (franchisesResp as any)?.data?.map((f: any) => ({ value: String(f.id), label: f.name })) || [];
  }, [franchisesResp]);

  if (error) {
    toast.error((error as Error).message || 'Failed to load Sales');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<SaleListItem>[] = [
    { key: 'invoiceNo', header: 'Invoice No', sortable: true, cellClassName: 'font-medium whitespace-nowrap'},
    { key: 'invoiceDate', header: 'Date', sortable: true, className: 'whitespace-nowrap', cellClassName: 'whitespace-nowrap', accessor: (r) => new Date(r.invoiceDate).toLocaleDateString() },
    { key: 'franchise', header: 'Franchise', sortable: false, accessor: (r) => r.franchise.name },
    {
      key: 'transportStatus',
      header: 'Transport',
      sortable: false,
      accessor: (r) => (
        <StatusBadge
          status={(r.transport?.status || 'PENDING').toLowerCase()}
          stylesMap={{
            dispatched: { label: 'Dispatched', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
            delivered: { label: 'Delivered', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
          }}
        />
      ),
    },
    { key: 'totalAmount', header: 'Total Amount', sortable: true, className: 'whitespace-nowrap', accessor: (r) => formatIndianCurrency(r.totalAmount) },
    { key: '_count', header: 'Items', sortable: false, accessor: (r) => r._count.saleDetails },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/sales/${id}`);
      toast.success('Sale has been deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Sales</AppCard.Title>
        <AppCard.Description>Manage Sales</AppCard.Description>
        {can(PERMISSIONS.CREATE_SALES) && (
          <AppCard.Action>
            <Link href='/sales/new'>
            <AppButton 
              size='sm' 
              iconName='Plus' 
              type='button'
            >
              Add
            </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search sales'
            placeholder='Search invoice or franchise…'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          {can(PERMISSIONS.READ_FRANCHISES) && (
            <AppSelect
              value={franchiseIdDraft || '__all'}
              onValueChange={(value) => setFranchiseIdDraft(value === '__all' ? '' : value)}
              placeholder='All Franchises'
            >
              <AppSelect.Item value='__all'>All Franchises</AppSelect.Item>
              {franchiseOptions.map((option) => (
                <AppSelect.Item key={option.value} value={option.value}>
                  {option.label}
                </AppSelect.Item>
              ))}
            </AppSelect>
          )}
          <NonFormTextInput
            type='date'
            aria-label='Start date'
            placeholder='Start date…'
            value={startDateDraft}
            onChange={(e) => setStartDateDraft(e.target.value)}
            containerClassName='w-full'
          />
          <NonFormTextInput
            type='date'
            aria-label='End date'
            placeholder='End date…'
            value={endDateDraft}
            onChange={(e) => setEndDateDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {(search || startDate || endDate || franchiseId) && (
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
            const canTransport = can(PERMISSIONS.CREATE_TRANSPORTS);
            if (!can(PERMISSIONS.EDIT_SALES) && !can(PERMISSIONS.DELETE_SALES) && !canTransport) return null;
            const transportStatus = (row.transport?.status || '').toUpperCase();
            return (
              <div className='flex items-center gap-1'>
                {canTransport && transportStatus !== 'DELIVERED' && (
                  <Link href={`/transports/new?saleId=${row.id}`}>
                    <IconButton
                      iconName='Truck'
                      tooltip='Transport'
                      aria-label='Transport'
                    />
                  </Link>
                )}
                {can(PERMISSIONS.EDIT_SALES) && (
                  <Link href={`/sales/${row.id}/edit`}>
                  <EditButton 
                    tooltip='Edit Sale' 
                    aria-label='Edit Sale' 
                  />
                  </Link>
                )}
                <DeleteButton
                  onDelete={() => handleDelete(row.id)}
                  itemLabel='Sale'
                  title='Delete Sale?'
                  description={`This will permanently remove sale "${row.invoiceNo}". This action cannot be undone.`}
                />
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
