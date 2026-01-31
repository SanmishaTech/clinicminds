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
import { IconButton } from '@/components/common/icon-button';
import { DeleteButton } from '@/components/common/delete-button';
import { StatusBadge } from '@/components/common/status-badge';
import { AppSelect } from '@/components/common/app-select';
import Link from 'next/link';
import jsPDF from 'jspdf';



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
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<number | null>(null);

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

  const formatPdfCurrency = (amount: number) => {
    const n = Number(amount) || 0;
    const formatted = n.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `Rs. ${formatted}`;
  };

  async function openInvoicePdf(saleId: number) {
    if (typeof window === 'undefined') return;

    const tab = window.open('', '_blank');
    if (!tab) {
      toast.error('Please allow popups to open the invoice');
      return;
    }

    try {
      tab.opener = null;
    } catch {
    }

    try {
      setInvoiceLoadingId(saleId);
      tab.document.open();
      tab.document.write('<!doctype html><html><head><title>Invoice</title></head><body>Loading invoice...</body></html>');
      tab.document.close();

      const sale = (await apiGet(`/api/sales/${saleId}`)) as any;

      const appName = process.env.NEXT_PUBLIC_APP_NAME || 'ClinicMinds';
      const invoiceNo = String(sale?.invoiceNo ?? '');
      const invoiceDate = sale?.invoiceDate ? new Date(sale.invoiceDate) : null;
      const franchiseName = String(sale?.franchise?.name ?? '');
      const items = (sale?.saleDetails || []) as Array<any>;

      const doc = new jsPDF();
      doc.setFont('helvetica', 'normal');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(appName, 14, 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Sale Invoice', 14, 24);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Invoice No: ${invoiceNo}`, 14, 32);
      doc.text(`Date: ${invoiceDate ? invoiceDate.toLocaleDateString() : ''}`, 14, 38);
      doc.text(`Franchise: ${franchiseName}`, 14, 44);
      doc.setTextColor(0);

      const startX = 14;
      let y = 54;
      const rowH = 8;
      const colW = [60, 28, 26, 14, 22, 26];
      const headers = ['Medicine', 'Batch', 'Expiry', 'Qty', 'Rate', 'Amount'];
      const maxY = doc.internal.pageSize.getHeight() - 12;

      const drawRow = (cells: string[], isHeader = false) => {
        let x = startX;
        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
        for (let i = 0; i < cells.length; i++) {
          doc.rect(x, y, colW[i], rowH);
          const text = cells[i] ?? '';
          const clipped = doc.splitTextToSize(text, colW[i] - 4);
          doc.text(clipped[0] || '', x + 2, y + 5.5);
          x += colW[i];
        }
        doc.setFont('helvetica', 'normal');
      };

      drawRow(headers, true);
      y += rowH;

      for (const d of items) {
        if (y + rowH > maxY) {
          doc.addPage();
          y = 20;
          drawRow(headers, true);
          y += rowH;
        }

        const medName = String(d?.medicine?.name ?? '');
        const brand = String(d?.medicine?.brand ?? '');
        const displayMedicine = brand ? `${medName} - ${brand}` : medName;
        const batch = String(d?.batchNumber ?? '');
        const expiry = d?.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : '';
        const qty = String(Number(d?.quantity ?? 0) || 0);
        const rate = formatPdfCurrency(Number(d?.rate ?? 0) || 0);
        const amount = formatPdfCurrency(Number(d?.amount ?? (Number(d?.rate ?? 0) || 0) * (Number(d?.quantity ?? 0) || 0)));

        drawRow([displayMedicine, batch, expiry, qty, rate, amount], false);
        y += rowH;
      }

      const totalAmount = Number(sale?.totalAmount ?? 0) || 0;
      if (y + rowH * 2 > maxY) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`Total: ${formatPdfCurrency(totalAmount)}`, 14, y + 10);
      doc.setFont('helvetica', 'normal');

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      tab.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      try {
        tab.document.open();
        tab.document.write('<!doctype html><html><head><title>Invoice Error</title></head><body>Failed to generate invoice.</body></html>');
        tab.document.close();
      } catch {
        // ignore
      }
      toast.error((e as Error).message || 'Failed to generate invoice');
    } finally {
      setInvoiceLoadingId(null);
    }
  }

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
            return (
              <div className='flex items-center gap-1'>
                <IconButton
                  iconName='Download'
                  tooltip='Download Invoice'
                  aria-label='Download Invoice'
                  onClick={() => void openInvoicePdf(row.id)}
                  disabled={invoiceLoadingId === row.id}
                />

                {can(PERMISSIONS.CREATE_TRANSPORTS) && (
                  <Link
                    href={
                      row.transport?.id
                        ? `/transports/new?transportId=${row.transport.id}`
                        : `/transports/new?saleId=${row.id}`
                    }
                  >
                    <IconButton iconName='Truck' tooltip='Transport' aria-label='Transport' />
                  </Link>
                )}

                {can(PERMISSIONS.DELETE_SALES) && (
                  <DeleteButton
                    onDelete={() => handleDelete(row.id)}
                    itemLabel='Sale'
                    title='Delete Sale?'
                    description={`This will permanently remove sale "${row.invoiceNo}". This action cannot be undone.`}
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
