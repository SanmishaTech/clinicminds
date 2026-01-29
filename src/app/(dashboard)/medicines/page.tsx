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
import { formatRelativeTime } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { EditButton } from '@/components/common/icon-button';
import { DeleteButton } from '@/components/common/delete-button';
import Link from 'next/link';

type MedicineListItem = {
  id: number;
  name: string;
  brand: {
    name: string;
  };
  baseRate: string;
  gstPercent: string;
  rate: string;
  mrp: string;
  createdAt: string;
};

type MedicinesResponse = {
  data: MedicineListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function MedicinesPage() {
  
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'name',
    order: 'asc',
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

  useEffect(() => { setSearchDraft(search); }, [search]);

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
    return `/api/medicines?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<MedicinesResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load Medicines');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<MedicineListItem>[] = [
    { key: 'name', header: 'Medicine', sortable: true, cellClassName: 'font-medium whitespace-nowrap'},
    { key: 'brand', header: 'Brand', sortable: true, accessor: (r) => r.brand?.name || '-' },
    { key: 'baseRate', header: 'Base Rate', sortable: true, className: 'whitespace-nowrap' },
    { key: 'gstPercent', header: 'GST %', sortable: true, className: 'whitespace-nowrap', accessor: (r) => `${r.gstPercent}%` },
    { key: 'rate', header: 'Rate', sortable: true, className: 'whitespace-nowrap' },
    { key: 'mrp', header: 'MRP', sortable: true, className: 'whitespace-nowrap' },
    { key: 'createdAt', header: 'Created', sortable: true, className: 'whitespace-nowrap', cellClassName: 'text-muted-foreground whitespace-nowrap', accessor: (r) => formatRelativeTime(r.createdAt) },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/medicines/${id}`);
      toast.success('Medicine has been deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Medicines</AppCard.Title>
        <AppCard.Description>Manage Medicines</AppCard.Description>
        {can(PERMISSIONS.CREATE_MEDICINES) && (
          <AppCard.Action>
            <Link href='/medicines/new'>
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
            aria-label='Search medicines'
            placeholder='Search medicines…'
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
            if (!can(PERMISSIONS.EDIT_MEDICINES) && !can(PERMISSIONS.DELETE_MEDICINES)) return null;
            return (
              <div className='flex items-center gap-1'>
                {can(PERMISSIONS.EDIT_MEDICINES) && (
                  <Link href={`/medicines/${row.id}/edit`}>
                    <EditButton tooltip='Edit Medicine' aria-label='Edit Medicine' />
                  </Link>
                )}
                <DeleteButton
                  onDelete={() => handleDelete(row.id)}
                  itemLabel='Medicine'
                  title='Delete Medicine?'
                  description={`This will permanently remove medicine "${row.name}". This action cannot be undone.`}
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
