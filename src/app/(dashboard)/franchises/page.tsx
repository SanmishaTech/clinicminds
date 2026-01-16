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
import { DeleteButton } from '@/components/common/delete-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { StatusBadge } from '@/components/common/status-badge';
import { formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';

type FranchiseListItem = {
  id: number;
  name: string;
  city: string;
  state: string;
  pincode: string;
  contactNo: string;
  contactEmail: string;
  logoUrl: string | null;
  userMobile: string;
  createdAt: string;
  user: { id: number; name: string | null; email: string; status: boolean };
};

type FranchisesResponse = {
  data: FranchiseListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function FranchisesPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    sort: 'createdAt',
    order: 'desc',
  });

  const { page, perPage, search, sort, order } = qp as unknown as {
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
    setQp({
      page: 1,
      search: searchDraft.trim(),
    });
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
    return `/api/franchises?${sp.toString()}`;
  }, [page, perPage, search, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<FranchisesResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load franchises');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<FranchiseListItem>[] = [
    {
      key: 'name',
      header: 'Franchise Name',
      sortable: true,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'city',
      header: 'City',
      sortable: true,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'state',
      header: 'State',
      sortable: true,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'pincode',
      header: 'Pincode',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'contactNo',
      header: 'Contact No',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'contactEmail',
      header: 'Contact Email',
      cellClassName: 'break-words',
    },
    {
      key: 'userEmail',
      header: 'Login Email',
      accessor: (r) => r.user?.email || '—',
      cellClassName: 'break-words',
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => <StatusBadge active={Boolean(r.user?.status)} />,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      accessor: (r) => formatDate(r.createdAt),
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/franchises/${id}`);
      toast.success('Franchise deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Franchises</AppCard.Title>
        <AppCard.Description>Manage franchises.</AppCard.Description>
        {can(PERMISSIONS.EDIT_FRANCHISES) && (
          <AppCard.Action>
            <Link href='/franchises/new'>
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
            aria-label='Search franchises'
            placeholder='Search franchises...'
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
          renderRowActions={(f) => {
            if (!can(PERMISSIONS.EDIT_FRANCHISES) && !can(PERMISSIONS.DELETE_FRANCHISES)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_FRANCHISES) && (
                  <Link href={`/franchises/${f.id}/edit`}>
                    <EditButton tooltip='Edit Franchise' aria-label='Edit Franchise' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_FRANCHISES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(f.id)}
                    itemLabel='franchise'
                    title='Delete franchise?'
                    description={`This will permanently remove franchise #${f.id}. This action cannot be undone.`}
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
