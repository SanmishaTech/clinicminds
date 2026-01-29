'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet, apiDelete, apiPatch } from '@/lib/api-client';
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
import { useCurrentUser } from '@/hooks/use-current-user';
import { PERMISSIONS, ROLES } from '@/config/roles';
import { MASTER_CONFIG } from '@/config/master';
import { formatDate } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton, IconButton } from '@/components/common/icon-button';

type PatientListItem = {
  id: number;
  patientNo: string;
  team: { id: number; name: string } | null;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  mobile: string;
  createdAt: string;
  state: { id: number; state: string };
  city: { id: number; city: string };
  isReferredToHo: boolean;
  franchise: { id: number; name: string } | null;
};

type PatientsResponse = {
  data: PatientListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const GENDER_LABEL: Record<string, string> = Object.fromEntries(
  MASTER_CONFIG.gender.map((g) => [g.value, g.label])
);

export default function PatientsPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    team: '',
    gender: '',
    sort: 'createdAt',
    order: 'desc',
  });

  const { page, perPage, search, team, gender, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    team: string;
    gender: string;
    sort: string;
    order: 'asc' | 'desc';
  };

  const [searchDraft, setSearchDraft] = useState(search);
  const [teamDraft, setTeamDraft] = useState(team);
  const [genderDraft, setGenderDraft] = useState(gender);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setTeamDraft(team), [team]);
  useEffect(() => setGenderDraft(gender), [gender]);

  const filtersDirty =
    searchDraft !== search ||
    teamDraft !== team ||
    genderDraft !== gender;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      team: teamDraft.trim(),
      gender: genderDraft,
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setTeamDraft('');
    setGenderDraft('');
    setQp({ page: 1, search: '', team: '', gender: '' });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (team) sp.set('team', team);
    if (gender) sp.set('gender', gender);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/patients?${sp.toString()}`;
  }, [page, perPage, search, team, gender, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<PatientsResponse>(query, apiGet);

  const { can, role } = usePermissions();
  const { user } = useCurrentUser();
  const isAdmin = role === ROLES.ADMIN;
  if (error) {
    toast.error((error as Error).message || 'Failed to load patients');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<PatientListItem>[] = useMemo(() => {
    const baseColumns = [
      {
        key: 'patientNo',
        header: 'Patient No',
        sortable: true,
        cellClassName: 'font-medium whitespace-nowrap',
      },
      {
        key: 'firstName',
        header: 'Name',
        sortable: true,
        accessor: (r) => [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' '),
        cellClassName: 'whitespace-nowrap',
      },
      {
        key: 'team',
        header: 'Team',
        sortable: false,
        cellClassName: 'whitespace-nowrap',
        accessor: (r) => r.team?.name || '-',
      },
      {
        key: 'gender',
        header: 'Gender',
        sortable: true,
        accessor: (r) => GENDER_LABEL[r.gender] ?? r.gender,
        cellClassName: 'whitespace-nowrap',
      },
      {
        key: 'mobile',
        header: 'Mobile',
        sortable: true,
        cellClassName: 'whitespace-nowrap',
      },
      {
        key: 'state',
        header: 'State',
        accessor: (r) => r.state?.state || '-',
        cellClassName: 'whitespace-nowrap',
      },
      {
        key: 'city',
        header: 'City',
        accessor: (r) => r.city?.city || '-',
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

    // Add franchise column for Admin users
    if (isAdmin) {
      baseColumns.splice(1, 0, {
        key: 'franchise',
        header: 'Franchise',
        sortable: false,
        accessor: (r) => r.franchise?.name || '-',
        cellClassName: 'whitespace-nowrap',
      });
    }

    return baseColumns;
  }, [isAdmin]);

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/patients/${id}`);
      toast.success('Patient deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleReferral(id: number, patientNo: string) {
    try {
      await apiPatch('/api/patients', {
        id,
        isReferredToHo: true
      });
      toast.success(`Patient ${patientNo} referred to Head Office`);
      await mutate();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to refer patient');
    }
  }

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Patients</AppCard.Title>
        <AppCard.Description>Manage patients.</AppCard.Description>
        {can(PERMISSIONS.EDIT_PATIENTS) && !isAdmin && (
          <AppCard.Action>
            <Link href='/patients/new'>
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
            aria-label='Search patients'
            placeholder='Search patients...'
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
          <AppSelect
            value={genderDraft || '__all'}
            onValueChange={(v) => setGenderDraft(v === '__all' ? '' : v)}
            placeholder='Gender'
          >
            <AppSelect.Item value='__all'>All Genders</AppSelect.Item>
            {MASTER_CONFIG.gender.map((g) => (
              <AppSelect.Item key={g.value} value={g.value}>
                {g.label}
              </AppSelect.Item>
            ))}
          </AppSelect>

          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty && !searchDraft && !teamDraft && !genderDraft}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {(search || team || gender) && (
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
          renderRowActions={(p) => {
            if (!can(PERMISSIONS.EDIT_PATIENTS) && !can(PERMISSIONS.DELETE_PATIENTS)) return null;
            return (
              <div className='flex'>
                {can(PERMISSIONS.EDIT_PATIENTS) && (
                  <Link href={`/patients/${p.id}/medical-history`}>
                    <IconButton iconName='FileText' tooltip='Medical History' aria-label='Medical History' />
                  </Link>
                )}
                {can(PERMISSIONS.EDIT_PATIENTS) && !isAdmin && (
                  <IconButton 
                    iconName='ArrowUp' 
                    tooltip={p.isReferredToHo ? 'Already referred to Head Office' : 'Refer to Head Office'} 
                    aria-label='Refer to Head Office'
                    onClick={() => !p.isReferredToHo && handleReferral(p.id, p.patientNo)}
                    disabled={p.isReferredToHo}
                    className={p.isReferredToHo ? 'opacity-50 cursor-not-allowed' : ''}
                  />
                )}
                {can(PERMISSIONS.EDIT_PATIENTS) && !isAdmin && (
                  <Link href={`/patients/${p.id}/edit`}>
                    <EditButton tooltip='Edit Patient' aria-label='Edit Patient' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_PATIENTS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(p.id)}
                    itemLabel='patient'
                    title='Delete patient?'
                    description={`This will permanently remove patient #${p.patientNo}. This action cannot be undone.`}
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
