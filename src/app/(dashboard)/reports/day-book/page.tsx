'use client';

import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { NonFormTextInput } from '@/components/common/non-form-text-input';
import { FilterBar } from '@/components/common';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { formatDate } from '@/lib/locales';
import { formatIndianCurrency } from '@/lib/locales';
import { useQueryParamsState } from '@/hooks/use-query-params-state';
import { AppSelect } from '@/components/common/app-select';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';
import { useCurrentUser } from '@/hooks/use-current-user';

type DayBookReportItem = {
  id: number;
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
    team: {
      name: string;
    };
    franchise: {
      id: number;
      name: string;
    };
    patient: {
      firstName: string;
      middleName: string;
      lastName: string;
      mobile: string;
      gender: string;
    };
  };
};

type DayBookReportResponse = {
  data: DayBookReportItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export default function DayBookReportPage() {
  const [qp, setQp] = useQueryParamsState({
    page: 1,
    perPage: 1000, // Load all data for report
    sort: 'appointment.appointmentDateTime',
    order: 'asc',
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
  const { user } = useCurrentUser();

  useEffect(() => {
    setStartDateDraft(startDate);
    setEndDateDraft(endDate);
    setFranchiseIdDraft(franchiseId);
  }, [startDate, endDate, franchiseId]);

  const filtersDirty = startDateDraft !== startDate || endDateDraft !== endDate || franchiseIdDraft !== franchiseId;

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
    if (startDate) sp.set('startDate', startDate);
    if (endDate) sp.set('endDate', endDate);
    if (franchiseId) sp.set('franchiseId', franchiseId);
    sp.set('sort', sort);
    sp.set('order', order);
    return `/api/consultations?${sp.toString()}`;
  }, [page, perPage, startDate, endDate, franchiseId, sort, order]);

  const { data, error, isLoading } = useSWR<DayBookReportResponse>(query, apiGet);
  const { can } = usePermissions();

  // Fetch franchises for admin users
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

  if (!can(PERMISSIONS.READ_CONSULTATIONS)) {
    return <div>You don't have permission to view this report.</div>;
  }

  if (error) {
    toast.error((error as Error).message || 'Failed to load day book data');
  }

  // Group data by date for subtotals
  const groupedData = useMemo(() => {
    if (!data?.data) return {};
    
    return data.data.reduce((groups, item) => {
      const date = format(new Date(item.appointment.appointmentDateTime), 'dd-MM-yyyy');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
      return groups;
    }, {} as Record<string, DayBookReportItem[]>);
  }, [data?.data]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!data?.data) return { totalAmount: 0, totalReceived: 0, totalBalance: 0 };
    
    return data.data.reduce((acc, item) => {
      const amount = parseFloat(item.totalAmount) || 0;
      const received = parseFloat(item.totalReceivedAmount || '0') || 0;
      const balance = amount - received;
      
      acc.totalAmount += amount;
      acc.totalReceived += received;
      acc.totalBalance += balance;
      
      return acc;
    }, { totalAmount: 0, totalReceived: 0, totalBalance: 0 });
  }, [data?.data]);

  function formatPdfCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      currencyDisplay: 'code',
    }).format(amount).replace('INR', 'Rs.');
  }

  function generatePDF() {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('helvetica', 'normal');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

      // App name from environment or default
      const appName = process.env.NEXT_PUBLIC_APP_NAME || 'ClinicMinds';
      
      // Report date and time
      const reportDateTime = format(now, 'dd/MM/yyyy hh:mm a');
      
      // Date range
      const dateRange = startDate && endDate 
        ? `${formatDate(startDate)} to ${formatDate(endDate)}`
        : formatDate(startDate) 
        ? `From ${formatDate(startDate)}`
        : formatDate(endDate) 
        ? `Up to ${formatDate(endDate)}`
        : 'All Dates';
      
      // Franchise info for admin
      const franchiseInfo = user?.role === 'ADMIN' && franchiseId 
        ? `Franchise: ${selectedFranchiseLabel}`
        : user?.role === 'ADMIN' 
        ? 'Franchise: All Franchises'
        : '';

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(appName, doc.internal.pageSize.getWidth() / 2, 16, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text('Day Book Report', doc.internal.pageSize.getWidth() / 2, 24, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.setFont('helvetica', 'normal');
      
      // Calculate positions for centered alignment with gap
      const pageWidth = doc.internal.pageSize.getWidth();
      const reportDateTimeWidth = doc.getTextWidth(`Report Date & Time: ${reportDateTime}`);
      const periodWidth = doc.getTextWidth(`Period: ${dateRange}`);
      const franchiseWidth = franchiseInfo ? doc.getTextWidth(franchiseInfo) : 0;
      
      // Adjust layout based on whether franchise info is shown
      let startY = 38;
      if (franchiseInfo) {
        doc.text(franchiseInfo, pageWidth / 2, startY, { align: 'center' });
        startY += 8;
      }
      
      const gap = 120; // Gap between the two texts
      const totalWidth = reportDateTimeWidth + gap + periodWidth;
      const startX = (pageWidth - totalWidth) / 2;
      
      doc.text(`Report Date & Time: ${reportDateTime}`, startX, startY);
      doc.text(`Period: ${dateRange}`, startX + reportDateTimeWidth + gap, startY);

      doc.setTextColor(0);

      const tableStartX = 14;
      let y = franchiseInfo ? 54 : 46;
      const rowH = 8;
      const colW = [23, 25, 40, 25, 17, 35, 35, 35, 35];
      const headers = ['Date', 'Team', 'Patient Name', 'Mobile', 'Gender', 'Type', 'Amount', 'Paid', 'Balance'];

      const pageW = doc.internal.pageSize.getWidth();
      const maxY = doc.internal.pageSize.getHeight() - 12;

      const drawRow = (cells: string[], isHeader = false) => {
        let x = tableStartX;
        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
        
        // Calculate required row height based on patient name (index 2)
        let requiredRowHeight = rowH;
        if (!isHeader && cells[2]) {
          const patientNameLines = doc.splitTextToSize(cells[2], colW[2] - 4);
          const linesNeeded = patientNameLines.length;
          if (linesNeeded > 1) {
            requiredRowHeight = rowH + ((linesNeeded - 1) * 4); // Add 4 units per additional line
          }
        }
        
        for (let i = 0; i < cells.length; i++) {
          // Draw the cell border with calculated height
          doc.rect(x, y, colW[i], requiredRowHeight);
          
          const text = cells[i] ?? '';
          
          if (i === 2 && !isHeader) {
            // Patient name column - handle multi-line text
            const lines = doc.splitTextToSize(text, colW[2] - 4);
            lines.forEach((line: string, lineIndex: number) => {
              doc.text(line || '', x + 2, y + 5.5 + (lineIndex * 4));
            });
          } else {
            // Other columns - single line
            const clipped = doc.splitTextToSize(text, colW[i] - 4);
            doc.text(clipped[0] || '', x + 2, y + 5.5);
          }
          x += colW[i];
        }
        doc.setFont('helvetica', 'normal');
        return requiredRowHeight; // Return the actual height used
      };

      const drawDateHeader = (date: string) => {
        let x = tableStartX;
        doc.setFont('helvetica', 'bold');
        // Draw full-width outer border
        const totalWidth = colW.reduce((sum, width) => sum + width, 0);
        doc.rect(x, y, totalWidth, rowH);
        // Draw date text in first cell
        doc.text(date, x + 2, y + 5.5);
      };

      const drawTotalRow = (label: string, amount: number, received: number, balance: number) => {
        let x = tableStartX;
        doc.setFont('helvetica', 'bold');
        
        // Draw full-width outer border
        const totalWidth = colW.reduce((sum, width) => sum + width, 0);
        doc.rect(x, y, totalWidth, rowH);
        
        // Calculate position of Type column (6th column)
        for (let i = 0; i < 5; i++) {
          x += colW[i];
        }
        
        // Draw Type column with border and label
        doc.rect(x, y, colW[5], rowH);
        doc.text(label, x + 2, y + 5.5);
        x += colW[5];
        
        // Draw Amount column with border
        doc.rect(x, y, colW[6], rowH);
        doc.text(formatPdfCurrency(amount), x + 2, y + 5.5);
        x += colW[6];
        
        // Draw Paid column with border
        doc.rect(x, y, colW[7], rowH);
        doc.text(formatPdfCurrency(received), x + 2, y + 5.5);
        x += colW[7];
        
        // Draw Balance column with border
        doc.rect(x, y, colW[8], rowH);
        doc.text(formatPdfCurrency(balance), x + 2, y + 5.5);
      };

      y += drawRow(headers, true);

      Object.entries(groupedData).forEach(([date, items]) => {
        // Date subtotal
        const dateTotal = items.reduce((acc, item) => {
          const amount = parseFloat(item.totalAmount) || 0;
          const received = parseFloat(item.totalReceivedAmount || '0') || 0;
          const balance = amount - received;
          return { amount: acc.amount + amount, received: acc.received + received, balance: acc.balance + balance };
        }, { amount: 0, received: 0, balance: 0 });

        // Date header
        if (y + rowH > maxY) {
          doc.addPage();
          y = 20;
          drawRow(headers, true);
          y += rowH;
        }
        
        drawDateHeader(`${date}`);
        y += rowH;

        // Items for this date
        items.forEach((item) => {
          if (y + rowH > maxY) {
            doc.addPage();
            y = 20;
            y += drawRow(headers, true);
          }

          const patientName = `${item.appointment.patient.firstName} ${item.appointment.patient.middleName || ''} ${item.appointment.patient.lastName}`.trim();
          const amount = parseFloat(item.totalAmount) || 0;
          const received = parseFloat(item.totalReceivedAmount || '0') || 0;
          const balance = amount - received;

          y += drawRow(
            [
              format(new Date(item.appointment.appointmentDateTime), 'dd-MM-yyyy'),
              item.appointment.team.name,
              patientName,
              item.appointment.patient.mobile,
              item.appointment.patient.gender.charAt(0).toUpperCase() + item.appointment.patient.gender.slice(1).toLowerCase(),
              item.appointment.type.charAt(0).toUpperCase() + item.appointment.type.slice(1).toLowerCase(),
              formatPdfCurrency(amount),
              formatPdfCurrency(received),
              formatPdfCurrency(balance),
            ],
            false
          );
        });

        // Date subtotal
        if (y + rowH > maxY) {
          doc.addPage();
          y = 20;
          y += drawRow(headers, true);
        }
        
        drawTotalRow('Subtotal:', dateTotal.amount, dateTotal.received, dateTotal.balance);
        y += rowH;
      });
        y+= 0.5;
      // Grand total
      if (y + rowH > maxY) {
        doc.addPage();
        y = 20;
        y += drawRow(headers, true);
      }
      
      drawTotalRow('GRAND TOTAL:', totals.totalAmount, totals.totalReceived, totals.totalBalance);

      // Save PDF
      const filenameBase = 'day-book-report';
      doc.save(`${filenameBase}-${dateStr}-${timeStr}.pdf`);
    } catch (e) {
      toast.error('Failed to generate PDF');
    }
  }

  function generateExcel() {
    try {
      const wb = XLSX.utils.book_new();
      
      // Prepare data for Excel
      const wsData: any[][] = [];
      
      // Add header info for admin users
      if (user?.role === 'ADMIN') {
        const now = new Date();
        const reportDateTime = format(now, 'dd/MM/yyyy hh:mm a');
        
        // Date range
        const dateRange = startDate && endDate 
          ? `${formatDate(startDate)} to ${formatDate(endDate)}`
          : formatDate(startDate) 
          ? `From ${formatDate(startDate)}`
          : formatDate(endDate) 
          ? `Up to ${formatDate(endDate)}`
          : 'All Dates';
        
        // Franchise info
        const franchiseInfo = franchiseId 
          ? `Franchise: ${selectedFranchiseLabel}`
          : 'Franchise: All Franchises';
        
        wsData.push(['Day Book Report']);
        wsData.push([`Report Date & Time: ${reportDateTime}`]);
        wsData.push([`Period: ${dateRange}`]);
        wsData.push([franchiseInfo]);
        wsData.push([]); // Empty row
      }
      
      // Headers
      const headers = [
        'Date', 'Team', 'Patient Name', 'Mobile', 'Gender', 
        'Type', 'Amount', 'Paid', 'Balance'
      ];
      wsData.push(headers);

      // Data
      Object.entries(groupedData).forEach(([date, items]) => {
        // Date header
        wsData.push([`${date}`, '', '', '', '', '', '', '', '']);
        
        // Items
        items.forEach((item) => {
          const patientName = `${item.appointment.patient.firstName} ${item.appointment.patient.middleName || ''} ${item.appointment.patient.lastName}`.trim();
          const amount = parseFloat(item.totalAmount) || 0;
          const received = parseFloat(item.totalReceivedAmount || '0') || 0;
          const balance = amount - received;

          wsData.push([
            format(new Date(item.appointment.appointmentDateTime), 'dd-MM-yyyy'),
            item.appointment.team.name,
            patientName,
            item.appointment.patient.mobile,
            item.appointment.patient.gender.charAt(0).toUpperCase() + item.appointment.patient.gender.slice(1).toLowerCase(),
            item.appointment.type.charAt(0).toUpperCase() + item.appointment.type.slice(1).toLowerCase(),
            amount,
            received,
            balance,
          ]);
        });

        // Date subtotal
        const dateTotal = items.reduce((acc, item) => {
          const amount = parseFloat(item.totalAmount) || 0;
          const received = parseFloat(item.totalReceivedAmount || '0') || 0;
          const balance = amount - received;
          return { amount: acc.amount + amount, received: acc.received + received, balance: acc.balance + balance };
        }, { amount: 0, received: 0, balance: 0 });

        wsData.push(['', '', '', '', '', 'Subtotal:', dateTotal.amount, dateTotal.received, dateTotal.balance]);
        wsData.push([]); // Empty row
      });

      // Grand total
      wsData.push(['', '', '', '', '', 'GRAND TOTAL:', totals.totalAmount, totals.totalReceived, totals.totalBalance]);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 10 },
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Day Book Report');

      // Save file
      const now = new Date();
      const dateStr = format(now, 'dd-MM-yyyy');
      const timeStr = format(now, 'HH-mm-ss');
      XLSX.writeFile(wb, `day-book-report-${dateStr}-${timeStr}.xlsx`);
    } catch (e) {
      toast.error('Failed to generate Excel');
    }
  }

  return (
    <div className='space-y-6'>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Day Book Report</AppCard.Title>
          <AppCard.Description>
            Generate day book reports with date filtering
          </AppCard.Description>
        </AppCard.Header>
        <AppCard.Content>
          <FilterBar title='Filter by Date'>
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

          <div className='flex gap-2 mt-4'>
            <AppButton
              onClick={generatePDF}
              disabled={!data?.data?.length || isLoading}
            >
              Generate PDF
            </AppButton>
            <AppButton
              onClick={generateExcel}
              disabled={!data?.data?.length || isLoading}
              variant='outline'
            >
              Generate Excel
            </AppButton>
          </div>

          {data?.data && (
            <div className='mt-6 p-4 bg-muted rounded-lg'>
              <h3 className='font-semibold mb-2'>Report Summary</h3>
              <div className='grid grid-cols-3 gap-4 text-sm'>
                <div>
                  <span className='text-muted-foreground'>Total Records:</span>
                  <span className='ml-2 font-medium'>{data.data.length}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Total Amount:</span>
                  <span className='ml-2 font-medium'>{formatIndianCurrency(totals.totalAmount)}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Total Received:</span>
                  <span className='ml-2 font-medium'>{formatIndianCurrency(totals.totalReceived)}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Total Balance:</span>
                  <span className='ml-2 font-medium'>{formatIndianCurrency(totals.totalBalance)}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>Date Range:</span>
                  <span className='ml-2 font-medium'>
                    {startDate && endDate ? `${startDate} to ${endDate}` : 
                     startDate ? `From ${startDate}` : 
                     endDate ? `Up to ${endDate}` : 'All Dates'}
                  </span>
                </div>
                {user?.role === 'ADMIN' && (
                  <div>
                    <span className='text-muted-foreground'>Franchise:</span>
                    <span className='ml-2 font-medium'>{selectedFranchiseLabel}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </AppCard.Content>
      </AppCard>
    </div>
  );
}