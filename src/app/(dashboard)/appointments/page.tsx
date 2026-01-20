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
import { AppSelect } from '@/components/common/app-select';
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { MASTER_CONFIG } from '@/config/master';
import { formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';

type AppointmentListItem = {
  id: number;
  appointmentDateTime: string;
  visitPurpose: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: number;
    firstName: string;
    middleName: string;
    lastName: string;
    mobile: string;
    email: string | null;
    age: number | null;
    gender: string | null;
  };
  team: {
    id: number;
    name: string;
  };
};

type AppointmentsResponse = {
  data: AppointmentListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const GENDER_LABEL: Record<string, string> = Object.fromEntries(
  MASTER_CONFIG.gender.map((g) => [g.value, g.label])
);

export default function AppointmentsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    team: '',
    sort: 'appointmentDateTime',
    order: 'desc',
  });

  const { page, perPage, search, team, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    team: string;
    sort: string;
    order: 'asc' | 'desc';
  };

  const [searchDraft, setSearchDraft] = useState(search);
  const [teamDraft, setTeamDraft] = useState(team);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setTeamDraft(team), [team]);

  const filtersDirty =
    searchDraft !== search ||
    teamDraft !== team;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      team: teamDraft.trim(),
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setTeamDraft('');
    setQp({ page: 1, search: '', team: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (team) sp.set('team', team);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/appointments?${sp.toString()}`;
  }, [page, perPage, search, team, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<AppointmentsResponse>(query, apiGet);

  const { can } = usePermissions();

  if (error) {
    toast.error((error as Error).message || 'Failed to load appointments');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/appointments/${id}`);
      toast.success('Appointment deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const columns: Column<AppointmentListItem>[] = [
    {
      key: 'appointmentDateTime',
      header: 'Date & Time',
      sortable: true,
      accessor: (r) => formatDate(new Date(r.appointmentDateTime)),
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'patient',
      header: 'Patient',
      sortable: false,
      accessor: (r) => `${r.patient.firstName} ${r.patient.middleName} ${r.patient.lastName}`,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'team',
      header: 'Team',
      sortable: false,
      accessor: (r) => r.team.name,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'visitPurpose',
      header: 'Visit Purpose',
      sortable: false,
      accessor: (r) => r.visitPurpose || '—',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      accessor: (r) => formatDate(r.createdAt),
      cellClassName: 'text-muted-foreground whitespace-nowrap',
    },
  ];

  const sortState: SortState = { field: sort, order };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Appointments</AppCard.Title>
        <AppCard.Description>Manage appointments.</AppCard.Description>
        {can(PERMISSIONS.EDIT_APPOINTMENTS) && (
          <AppCard.Action>
            <Link href='/appointments/new'>
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
            aria-label='Search appointments'
            placeholder='Search appointments...'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          <NonFormTextInput
            aria-label='Filter by team'
            placeholder='Team'
            value={teamDraft}
            onChange={(e) => setTeamDraft(e.target.value)}
            containerClassName='w-full'
          />

          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !teamDraft}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {(search || team) && (
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
          renderRowActions={(appointment) => {
            if (!can(PERMISSIONS.EDIT_APPOINTMENTS) && !can(PERMISSIONS.DELETE_APPOINTMENTS)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_APPOINTMENTS) && (
                  <Link href={`/appointments/${appointment.id}/edit`}>
                    <EditButton tooltip='Edit Appointment' aria-label='Edit Appointment' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_APPOINTMENTS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(appointment.id)}
                    itemLabel='appointment'
                    title='Delete appointment?'
                    description={`This will permanently remove appointment #${appointment.id}. This action cannot be undone.`}
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
