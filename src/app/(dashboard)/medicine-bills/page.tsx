'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Pagination } from '@/components/common/pagination';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatRelativeTime, formatIndianCurrency } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';

type MedicineBillListItem = {
  id: number;
  billNumber: string;
  billDate: string;
  totalAmount: number | string;
  patient?: {
    id: number;
    firstName: string;
    middleName: string;
    lastName: string;
  };
  franchise?: {
    id: number;
    name: string;
  };
  createdAt: string;
};

type MedicineBillsResponse = {
  data: MedicineBillListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function MedicineBillsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'billDate',
    order: 'desc',
  });

  const { page, perPage, search, sort, order } =
    (qp as unknown) as {
      page: number;
      perPage: number;
      search: string;
      sort: string;
      order: 'asc' | 'desc';
    };

  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const filtersDirty = searchDraft !== search;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim() });
  }

  function resetFilters() {
    setSearchDraft('');
    setQp({ page: 1, search: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/medicine-bills?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<MedicineBillsResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load Medicine Bills');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<MedicineBillListItem>[] = [
    {
      key: 'billNumber',
      header: 'Bill Number',
      sortable: true,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'billDate',
      header: 'Bill Date',
      sortable: true,
      className: 'whitespace-nowrap',
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      accessor: (r) => new Date(r.billDate).toLocaleDateString('en-IN'),
    },
    {
      key: 'patient',
      header: 'Patient',
      sortable: false,
      className: 'whitespace-nowrap',
      accessor: (r) => `${r.patient?.firstName} ${r.patient?.middleName} ${r.patient?.lastName}` || '-',
    },
    {
      key: 'franchise',
      header: 'Franchise',
      sortable: false,
      className: 'whitespace-nowrap',
      accessor: (r) => r.franchise?.name || 'N/A',
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      sortable: true,
      className: 'whitespace-nowrap',
      accessor: (r) => formatIndianCurrency(Number(r.totalAmount) || 0),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      className: 'whitespace-nowrap',
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      accessor: (r) => formatRelativeTime(r.createdAt),
    },
  ];

  const sortState: SortState = { field: sort, order };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Medicine Bills</AppCard.Title>
        <AppCard.Description>Manage Medicine Bills</AppCard.Description>
        {can(PERMISSIONS.CREATE_MEDICINE_BILLS) && (
          <AppCard.Action>
            <Link href='/medicine-bills/new'>
              <AppButton size='sm' iconName='Plus' type='button'>
                Add
              </AppButton>
            </Link>
          </AppCard.Action>
        )}
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search medicine bills'
            placeholder='Search by bill number, patient name…'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
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
          {search && (
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
            // No edit or delete actions for medicine bills as per requirements
            return (
              <div className='flex items-center gap-1'>
                <Link href={`/medicine-bills/${row.id}`}>
                  <AppButton
                    size='sm'
                    variant='ghost'
                    iconName='Eye'
                    aria-label='View Bill Details'
                  />
                </Link>
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
