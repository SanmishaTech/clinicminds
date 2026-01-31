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
import { format } from 'date-fns';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';

// Function to check if consultation exists for an appointment
async function checkConsultationExists(appointmentId: number): Promise<{ exists: boolean; consultationId?: number }> {
  try {
    const response = await apiGet(`/api/consultations?appointmentId=${appointmentId}&perPage=1`) as any;
    const consultations = response?.data || [];
    return {
      exists: consultations.length > 0,
      consultationId: consultations[0]?.id
    };
  } catch {
    return { exists: false };
  }
}

// ConsultationAwareEditButton component using checkConsultationExists helper
function ConsultationAwareEditButton({ appointmentId }: { appointmentId: number }) {
  const [consultationStatus, setConsultationStatus] = useState<{ exists: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      setChecking(true);
      try {
        const status = await checkConsultationExists(appointmentId);
        setConsultationStatus({ exists: status.exists });
      } catch {
        setConsultationStatus({ exists: false });
      } finally {
        setChecking(false);
      }
    }
    
    checkStatus();
  }, [appointmentId]);

  if (checking) {
    return <EditButton tooltip='Edit Appointment' aria-label='Edit Appointment' disabled />;
  }

  if (consultationStatus?.exists) {
    return <div className='w-8 h-8'></div>;
  }

  return (
    <Link href={`/appointments/${appointmentId}/edit`}>
      <EditButton tooltip='Edit Appointment' aria-label='Edit Appointment' />
    </Link>
  );
}

// ConsultationButton component to handle consultation/edit logic
function ConsultationButton({ appointmentId }: { appointmentId: number }) {
  const [consultationStatus, setConsultationStatus] = useState<{ exists: boolean; consultationId?: number } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      setChecking(true);
      try {
        const status = await checkConsultationExists(appointmentId);
        setConsultationStatus(status);
      } catch {
        setConsultationStatus({ exists: false });
      } finally {
        setChecking(false);
      }
    }
    
    checkStatus();
  }, [appointmentId]);

  if (checking) {
    return (
      <AppButton size='sm' variant='outline' className='mr-2' disabled>
        Checking...
      </AppButton>
    );
  }

  if (consultationStatus?.exists && consultationStatus.consultationId) {
    return (
      <Link href={`/consultations/${consultationStatus.consultationId}/edit`}>
        <AppButton size='sm' variant='outline' className='mr-2'>
          Edit Consultation
        </AppButton>
      </Link>
    );
  }

  return (
    <Link href={`/consultations/${appointmentId}/new`}>
      <AppButton size='sm' variant='outline' className='mr-2'>
        Consultation
      </AppButton>
    </Link>
  );
}

type AppointmentListItem = {
  id: number;
  appointmentDateTime: string;
  visitPurpose: string | null;
  type: string;
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

type TeamsResponse = {
  data: Array<{ id: number; name: string }>;
  total: number;
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
    gender: '',
    startDate: new Date().toISOString().split('T')[0], // Default to today
    endDate: new Date().toISOString().split('T')[0], // Default to today
    sort: 'appointmentDateTime',
    order: 'desc',
  });

  const { page, perPage, search, team, gender, startDate, endDate, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    team: string;
    gender: string;
    startDate: string;
    endDate: string;
    sort: string;
    order: 'asc' | 'desc';
  };

  const [searchDraft, setSearchDraft] = useState(search);
  const [teamDraft, setTeamDraft] = useState(team);
  const [genderDraft, setGenderDraft] = useState(gender);
  const [startDateDraft, setStartDateDraft] = useState(startDate);
  const [endDateDraft, setEndDateDraft] = useState(endDate);

  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => setTeamDraft(team), [team]);
  useEffect(() => setGenderDraft(gender), [gender]);
  useEffect(() => setStartDateDraft(startDate), [startDate]);
  useEffect(() => setEndDateDraft(endDate), [endDate]);

  const { can } = usePermissions();

  const filtersDirty =
    searchDraft !== search ||
    (can(PERMISSIONS.READ_TEAMS) && teamDraft !== team) ||
    genderDraft !== gender ||
    startDateDraft !== startDate ||
    endDateDraft !== endDate;

  function applyFilters() {
    setQp({
      page: 1,
      search: searchDraft.trim(),
      team: teamDraft.trim(),
      gender: genderDraft,
      startDate: startDateDraft,
      endDate: endDateDraft,
    });
  }

  function resetFilters() {
    setSearchDraft('');
    setTeamDraft('');
    setGenderDraft('');
    const today = new Date().toISOString().split('T')[0];
    setStartDateDraft(today);
    setEndDateDraft(today);
    setQp({ page: 1, search: '', team: '', gender: '', startDate: today, endDate: today });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (team) sp.set('team', team);
    if (gender) sp.set('gender', gender);
    if (startDate) sp.set('startDate', startDate);
    if (endDate) sp.set('endDate', endDate);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/appointments?${sp.toString()}`;
  }, [page, perPage, search, team, gender, startDate, endDate, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<AppointmentsResponse>(query, apiGet);
  const { data: teamsResponse } = useSWR<TeamsResponse>('/api/teams?page=1&perPage=100&sort=name&order=asc&role=DOCTOR', apiGet);
  const teams = teamsResponse?.data || [];

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
      accessor: (r) => format(new Date(r.appointmentDateTime), 'dd/MM/yyyy hh:mm a'),
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'patient',
      header: 'Patient',
      sortable: true,
      accessor: (r) => `${r.patient.firstName} ${r.patient.middleName} ${r.patient.lastName}`,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'gender',
      header: 'Gender',
      sortable: true,
      accessor: (r) => r.patient.gender ? (GENDER_LABEL[r.patient.gender] ?? r.patient.gender) : '-',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'mobile',
      header: 'Mobile',
      sortable: false,
      accessor: (r) => r.patient.mobile,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'team',
      header: 'Team',
      sortable: true,
      accessor: (r) => r.team.name,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      accessor: (r) => r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1).toLowerCase() : '-',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'visitPurpose',
      header: 'Visit Purpose',
      sortable: false,
      accessor: (r) => r.visitPurpose || '-',
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
        <FilterBar title='Search & Filter' className='flex-auto flex-nowrap gap-2'>
          <NonFormTextInput
            aria-label='Search appointments'
            placeholder='Search appointments...'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
          {can(PERMISSIONS.READ_TEAMS) && (
            <AppSelect
              value={teamDraft || '__all'}
              onValueChange={(v) => setTeamDraft(v === '__all' ? '' : v)}
              placeholder='Team'
              className='w-full'
            >
              <AppSelect.Item value='__all'>All Teams</AppSelect.Item>
              {teams.map((team) => (
                <AppSelect.Item key={team.id} value={String(team.id)}>
                  {team.name}
                </AppSelect.Item>
              ))}
            </AppSelect>
          )}
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
            disabled={!filtersDirty && !searchDraft && !teamDraft && !genderDraft && !startDateDraft && !endDateDraft}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {(search || team || gender || startDate || endDate) && (
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
            if (!can(PERMISSIONS.EDIT_APPOINTMENTS) && !can(PERMISSIONS.DELETE_APPOINTMENTS) && !can(PERMISSIONS.CREATE_CONSULTATIONS) && !can(PERMISSIONS.EDIT_CONSULTATIONS)) return null;
            return (
              <div className='flex'>
                {(can(PERMISSIONS.CREATE_CONSULTATIONS) || can(PERMISSIONS.EDIT_CONSULTATIONS)) && (
                  <ConsultationButton appointmentId={appointment.id} />
                )}
                {can(PERMISSIONS.EDIT_APPOINTMENTS) && (
                  <ConsultationAwareEditButton appointmentId={appointment.id} />
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
