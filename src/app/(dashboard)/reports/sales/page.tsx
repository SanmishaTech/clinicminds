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
import { formatIndianCurrency } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { AppSelect } from '@/components/common/app-select';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';

type SaleListItem = {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
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

export default function SalesReportPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 10,
    sort: 'invoiceDate',
    order: 'desc',
    startDate: '',
    endDate: '',
    franchiseId: '',
  });

  const { page, perPage, sort, order, startDate, endDate, franchiseId } = (qp as unknown) as {
    page: number;
    perPage: number;
    sort: string;
    order: 'asc' | 'desc';
    startDate: string;
    endDate: string;
    franchiseId: string;
  };

  const [startDateDraft, setStartDateDraft] = useState(startDate);
  const [endDateDraft, setEndDateDraft] = useState(endDate);
  const [franchiseIdDraft, setFranchiseIdDraft] = useState(franchiseId);

  useEffect(() => {
    setStartDateDraft(startDate);
    setEndDateDraft(endDate);
    setFranchiseIdDraft(franchiseId);
  }, [startDate, endDate, franchiseId]);

  const filtersDirty =
    startDateDraft !== startDate || endDateDraft !== endDate || franchiseIdDraft !== franchiseId;

  function applyFilters() {
    setQp({
      page: 1,
      startDate: startDateDraft,
      endDate: endDateDraft,
      franchiseId: franchiseIdDraft,
    });
  }

  function resetFilters() {
    setStartDateDraft('');
    setEndDateDraft('');
    setFranchiseIdDraft('');
    setQp({
      page: 1,
      startDate: '',
      endDate: '',
      franchiseId: '',
    });
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('perPage', String(perPage));
    if (sort) sp.set('sort', sort);
    if (order) sp.set('order', order);
    if (startDate) sp.set('startDate', startDate);
    if (endDate) sp.set('endDate', endDate);
    if (franchiseId) sp.set('franchiseId', franchiseId);
    return `/api/sales?${sp.toString()}`;
  }, [page, perPage, sort, order, startDate, endDate, franchiseId]);

  const { data, error, isLoading } = useSWR<SalesResponse>(query, apiGet);
  const { can } = usePermissions();
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { data: franchisesResp } = useSWR(
    can(PERMISSIONS.READ_FRANCHISES) ? '/api/franchises?page=1&perPage=100&sort=name&order=asc' : null,
    apiGet
  );

  const franchiseOptions = useMemo(() => {
    return (franchisesResp as any)?.data?.map((f: any) => ({ value: String(f.id), label: f.name })) || [];
  }, [franchisesResp]);

  const selectedFranchiseLabel = useMemo(() => {
    if (!franchiseId) return 'All Franchises';
    const match = franchiseOptions.find((o) => o.value === franchiseId);
    return match?.label || 'Selected Franchise';
  }, [franchiseId, franchiseOptions]);

  const dateRangeLabel = useMemo(() => {
    const from = startDate || 'All';
    const to = endDate || 'All';
    return `${from}-to-${to}`;
  }, [startDate, endDate]);

  const filenameBase = useMemo(() => {
    const safeFranchise = selectedFranchiseLabel.replace(/\s+/g, '-').toLowerCase();
    return `sales-report-${safeFranchise}-${dateRangeLabel}`;
  }, [selectedFranchiseLabel, dateRangeLabel]);

  const generateExcel = () => {
    const rows = data?.data || [];
    if (!rows.length) {
      toast.error('No data to download');
      return;
    }

    setIsGeneratingExcel(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      XLSX.utils.sheet_add_aoa(ws, [['Invoice No', 'Date', 'Franchise', 'Total Amount', 'Items']]);

      const body = rows.map((r) => [
        r.invoiceNo,
        new Date(r.invoiceDate).toLocaleDateString(),
        r.franchise.name,
        r.totalAmount,
        r._count.saleDetails,
      ]);

      XLSX.utils.sheet_add_aoa(ws, body, { origin: -1 });

      const headerRowIndex = 1;
      const headerCells = ['A', 'B', 'C', 'D', 'E'];
      for (const c of headerCells) {
        const addr = `${c}${headerRowIndex}`;
        if ((ws as any)[addr]) {
          (ws as any)[addr].s = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: 'center' },
          };
        }
      }

      ws['!cols'] = [
        { width: 22 },
        { width: 14 },
        { width: 30 },
        { width: 16 },
        { width: 10 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
      XLSX.writeFile(wb, `${filenameBase}-${dateStr}-${timeStr}.xlsx`);
    } catch (e) {
      toast.error('Failed to generate Excel');
      console.error(e);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const generatePDF = () => {
    const rows = data?.data || [];
    if (!rows.length) {
      toast.error('No data to download');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('helvetica', 'normal');

      doc.setFontSize(16);
      doc.text('Sales Report', 14, 16);

      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 14, 24);
      doc.text(`Franchise: ${selectedFranchiseLabel}`, 14, 30);
      const showDateRange = Boolean(startDate) || Boolean(endDate);
      if (showDateRange) {
        doc.text(`From: ${startDate || '-'}    To: ${endDate || '-'}`, 14, 36);
      }

      doc.setTextColor(0);

      const startX = 14;
      let y = showDateRange ? 46 : 40;
      const rowH = 8;
      const colW = [40, 26, 70, 30, 16];
      const headers = ['Invoice No', 'Date', 'Franchise', 'Total', 'Items'];

      const pageW = doc.internal.pageSize.getWidth();
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

      const totalWidth = colW.reduce((s, w) => s + w, 0);
      if (startX + totalWidth > pageW - 6) {
        // keep layout but avoid overflow on very small widths
      }

      drawRow(headers, true);
      y += rowH;

      for (const r of rows) {
        if (y + rowH > maxY) {
          doc.addPage();
          y = 20;
          drawRow(headers, true);
          y += rowH;
        }

        drawRow(
          [
            r.invoiceNo,
            new Date(r.invoiceDate).toLocaleDateString(),
            r.franchise.name,
            formatPdfCurrency(r.totalAmount),
            String(r._count.saleDetails),
          ],
          false
        );
        y += rowH;
      }

      doc.save(`${filenameBase}-${dateStr}-${timeStr}.pdf`);
    } catch (e) {
      toast.error('Failed to generate PDF');
      console.error(e);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (error) {
    toast.error((error as Error).message || 'Failed to load Sales Report');
  }

  function toggleSort(field: string) {
    if (sort === field) {
      setQp({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      setQp({ sort: field, order: 'asc' });
    }
  }

  const columns: Column<SaleListItem>[] = [
    { key: 'invoiceNo', header: 'Invoice No', sortable: true, cellClassName: 'font-medium whitespace-nowrap' },
    {
      key: 'invoiceDate',
      header: 'Date',
      sortable: true,
      className: 'whitespace-nowrap',
      cellClassName: 'whitespace-nowrap',
      accessor: (r) => new Date(r.invoiceDate).toLocaleDateString(),
    },
    { key: 'franchise', header: 'Franchise', sortable: false, accessor: (r) => r.franchise.name },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      sortable: true,
      className: 'whitespace-nowrap',
      accessor: (r) => formatIndianCurrency(r.totalAmount),
    },
    { key: '_count', header: 'Items', sortable: false, accessor: (r) => r._count.saleDetails },
  ];

  const sortState: SortState = { field: sort, order };

  const formatPdfCurrency = (amount: number) => {
    const n = Number(amount) || 0;
    const formatted = n.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `Rs. ${formatted}`;
  };

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title>Sales Report</AppCard.Title>
        <AppCard.Description>View sales by date range and franchise</AppCard.Description>
        <AppCard.Action>
          <div className='flex gap-2'>
            <AppButton
              size='sm'
              onClick={generateExcel}
              disabled={isLoading || isGeneratingExcel || isGeneratingPDF}
              isLoading={isGeneratingExcel}
              iconName='FileSpreadsheet'
            >
              Excel
            </AppButton>
            <AppButton
              size='sm'
              onClick={generatePDF}
              disabled={isLoading || isGeneratingExcel || isGeneratingPDF}
              isLoading={isGeneratingPDF}
              iconName='Download'
            >
              PDF
            </AppButton>
          </div>
        </AppCard.Action>
      </AppCard.Header>
      <AppCard.Content>
        <FilterBar title='Filter'>
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
            aria-label='From date'
            placeholder='From date…'
            value={startDateDraft}
            onChange={(e) => setStartDateDraft(e.target.value)}
            containerClassName='w-full'
          />
          <NonFormTextInput
            type='date'
            aria-label='To date'
            placeholder='To date…'
            value={endDateDraft}
            onChange={(e) => setEndDateDraft(e.target.value)}
            containerClassName='w-full'
          />
          <AppButton
            size='sm'
            onClick={applyFilters}
            disabled={!filtersDirty}
            className='min-w-[84px]'
          >
            Filter
          </AppButton>
          {(startDate || endDate || franchiseId) && (
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
