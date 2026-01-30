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
import { DataTable, SortState, Column } from '@/components/common/data-table';
import { DeleteButton } from '@/components/common/delete-button';
import { DeleteIconButton } from '@/components/common/icon-button';
import { usePermissions } from '@/hooks/use-permissions';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PERMISSIONS } from '@/config/roles';
import { formatDate, formatIndianCurrency } from '@/lib/locales';
import { format } from 'date-fns';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import Link from 'next/link';
import { EditButton } from '@/components/common/icon-button';

type ConsultationListItem = {
  id: number;
  appointmentId: number;
  complaint?: string;
  diagnosis?: string;
  remarks?: string;
  nextFollowUpDate?: string;
  totalAmount: string;
  totalReceivedAmount?: string | null;
  createdAt: string;
  appointment: {
    id: number;
    appointmentDateTime: string;
    type: string;
    patient: {
      id: number;
      patientNo: string;
      firstName: string;
      lastName: string;
      mobile: string;
    };
  };
};

type ConsultationsResponse = {
  data: ConsultationListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function DayBookPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    search: '',
    startDate: new Date().toISOString().split('T')[0], // Default to today
    endDate: new Date().toISOString().split('T')[0], // Default to today
    sort: 'createdAt',
    order: 'desc',
  });

  const { page, perPage, search, startDate, endDate, sort, order } = qp as unknown as {
    page: number;
    perPage: number;
    search: string;
    startDate: string;
    endDate: string;
    sort: string;
    order: 'asc' | 'desc';
  };

  const [searchDraft, setSearchDraft] = useState(search);
  const [startDateDraft, setStartDateDraft] = useState(startDate);
  const [endDateDraft, setEndDateDraft] = useState(endDate);

  useEffect(() => { setSearchDraft(search); }, [search]);
  useEffect(() => { setStartDateDraft(startDate); }, [startDate]);
  useEffect(() => { setEndDateDraft(endDate); }, [endDate]);

  const filtersDirty = searchDraft !== search || startDateDraft !== startDate || endDateDraft !== endDate;

  function applyFilters() {
    setQp({ page: 1, search: searchDraft.trim(), startDate: startDateDraft, endDate: endDateDraft });
  }

  function resetFilters() {
    setSearchDraft('');
    const today = new Date().toISOString().split('T')[0];
    setStartDateDraft(today);
    setEndDateDraft(today);
    setQp({ page: 1, search: '', startDate: today, endDate: today });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (search) sp.set('search', search);
    if (startDate) sp.set('startDate', startDate);
    if (endDate) sp.set('endDate', endDate);
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    return `/api/consultations?${sp.toString()}`;
  }, [page, perPage, search, startDate, endDate, sort, order]);

  const { data, error, isLoading, mutate } = useSWR<ConsultationsResponse>(query, apiGet);
  const { can } = usePermissions();
  const { user } = useCurrentUser();

  if (error) {
    toast.error((error as Error).message || 'Failed to load consultations');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<ConsultationListItem>[] = [
    {
      key: 'patientNo',
      header: 'Patient No',
      sortable: false,
      accessor: (r) => r.appointment.patient.patientNo,
      cellClassName: 'font-medium whitespace-nowrap',
    },
    {
      key: 'patientName',
      header: 'Patient Name',
      sortable: false,
      accessor: (r) => `${r.appointment.patient.firstName} ${r.appointment.patient.lastName}`.trim(),
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'appointmentDateTime',
      header: 'Appointment Date/Time',
      sortable: true,
      accessor: (r) => format(new Date(r.appointment.appointmentDateTime), 'dd/MM/yyyy hh:mm a'),
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'appointmentType',
      header: 'Type',
      sortable: true,
      accessor: (r) => r.appointment.type.charAt(0).toUpperCase() + r.appointment.type.slice(1).toLowerCase(),
      cellClassName: 'whitespace-nowrap font-medium',
    },
    {
      key: 'nextFollowUpDate',
      header: 'Next Followup Date',
      sortable: true,
      accessor: (r) => r.nextFollowUpDate ? formatDate(r.nextFollowUpDate) : '—',
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'mobile',
      header: 'Mobile No',
      sortable: false,
      accessor: (r) => r.appointment.patient.mobile,
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'remarks',
      header: 'Remark',
      sortable: false,
      accessor: (r) => r.remarks || r.diagnosis || '—',
      cellClassName: 'max-w-xs truncate',
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      sortable: true,
      accessor: (r) => formatIndianCurrency(parseFloat(r.totalAmount)),
      cellClassName: 'whitespace-nowrap',
    },
    {
      key: 'balanceAmount',
      header: 'Balance Amount',
      sortable: true,
      accessor: (r) => {
        const total = parseFloat(r.totalAmount) || 0;
        const received = parseFloat(r.totalReceivedAmount || '0') || 0;
        const balance = total - received;
        return formatIndianCurrency(balance);
      },
      cellClassName: 'whitespace-nowrap font-medium',
    },
  ];

  const sortState: SortState = { field: sort, order };

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/consultations/${id}`);
      toast.success('Consultation deleted');
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Day Book</AppCard.Title>
          <AppCard.Description>Consultation Records</AppCard.Description>
        </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Search & Filter'>
          <NonFormTextInput
            aria-label='Search consultations'
            placeholder='Search consultations…'
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            containerClassName='w-full'
          />
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
          {(search || startDate || endDate) && (
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
            if (!can(PERMISSIONS.EDIT_CONSULTATIONS) && !can(PERMISSIONS.DELETE_CONSULTATIONS)) return null;
            return (
              <div className='flex items-center gap-1'>
                <div className="flex space-x-2">
                  <Link href={`/day-book/receipts/${row.id}`}>
                    <AppButton
                      size="sm"
                    >
                      Receipt
                    </AppButton>
                  </Link>
                </div>
                {can(PERMISSIONS.EDIT_CONSULTATIONS) && (
                  <Link href={`/consultations/${row.id}/edit`}>
                    <EditButton tooltip='Edit Consultation' aria-label='Edit Consultation' />
                  </Link>
                )}
                {can(PERMISSIONS.DELETE_CONSULTATIONS) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel='consultation'
                    title='Delete Consultation?'
                    description={`This will permanently remove the consultation for patient ${row.appointment.patient.patientNo}. This action cannot be undone.`}
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

    </>
  );
}
