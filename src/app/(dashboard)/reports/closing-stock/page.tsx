'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormSection, FormRow } from '@/components/common/app-form';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { ComboboxInput } from '@/components/common/combobox-input';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';


// Types
type Franchise = {
  id: number;
  name: string;
};

type Medicine = {
  id: number;
  name: string;
  brand: string | null;
};

type StockReportData = {
  franchiseId: number;
  medicineId: number;
  quantity: number;
  franchise: Franchise;
  medicine: Medicine;
  message?: string;
};

// Form schema
const closingStockSchema = z.object({
  franchiseId: z.string().min(1, 'Please select a franchise'),
  medicineId: z.string().min(1, 'Please select a medicine'),
});

type ClosingStockFormData = z.infer<typeof closingStockSchema>;

export default function ClosingStockReportPage() {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stockData, setStockData] = useState<StockReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const form = useForm<ClosingStockFormData>({
    resolver: zodResolver(closingStockSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      franchiseId: '',
      medicineId: '',
    },
  });

  const { control, handleSubmit } = form;

  // Prepare options for dropdowns
  const franchiseOptions = franchises.map(franchise => ({
    value: franchise.id.toString(),
    label: franchise.name
  }));

  const medicineOptions = medicines.map(medicine => ({
    value: medicine.id.toString(),
    label: `${medicine.name} - ${medicine.brand || 'Unknown Brand'}`
  }));

  // Fetch franchises and medicines on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [franchisesRes, medicinesRes] = await Promise.all([
          apiGet('/api/franchises?page=1&perPage=1000'),
          apiGet('/api/medicines?page=1&perPage=1000')
        ]);

        setFranchises((franchisesRes as any).data || []);
        setMedicines((medicinesRes as any).data || []);
      } catch (error) {
        toast.error('Failed to load data');
      }
    };

    fetchData();
  }, []);

  // Generate Excel file
  const generateExcel = (data: StockReportData) => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
      const franchiseName = data.franchise.name.replace(/\s+/g, '-').toLowerCase();
      const medicineFullName = `${data.medicine.brand || 'unknown-brand'}-${data.medicine.name}`.replace(/\s+/g, '-').toLowerCase();

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Add metadata rows
      const time12hr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
      });
      
      XLSX.utils.sheet_add_aoa(ws, [
        ['Closing Stock Report'],
        [`Report Date: ${now.toLocaleDateString()} ${time12hr}`],
        [],
        ['Franchise', 'Medicine', 'Stock Quantity', 'Status'],
        [data.franchise.name, `${data.medicine.brand || 'Unknown Brand'} ${data.medicine.name}`.trim(), data.quantity, data.quantity > 0 ? 'In Stock' : 'Out of Stock']
      ]);

      // Apply bold formatting to header cells using xlsx-js-style syntax
      ws['A4'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: 'center' }
      };
      ws['B4'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: 'center' }
      };
      ws['C4'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: 'center' }
      };
      ws['D4'].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: 'center' }
      };

      // Make title cells bold
      ws['A1'].s = {
        font: { bold: true, sz: 14 }
      };
      ws['A2'].s = {
        font: { bold: true, sz: 11 }
      };

      // Center align data cells
      ws['A5'].s = { alignment: { horizontal: 'center' } };
      ws['B5'].s = { alignment: { horizontal: 'center' } };
      ws['C5'].s = { alignment: { horizontal: 'center' } };
      ws['D5'].s = { alignment: { horizontal: 'center' } };

      // Set column widths
      ws['!cols'] = [
        { width: 35 }, // Franchise
        { width: 40 }, // Medicine
        { width: 15 }, // Stock Quantity
        { width: 15 }  // Status
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');

      // Save file
      XLSX.writeFile(wb, `stock-report-${franchiseName}-${medicineFullName}-${dateStr}-${timeStr}.xlsx`);
      
    } catch (error) {
      toast.error('Failed to generate Excel file');
      console.error('Excel generation error:', error);
    }
  };
  const generatePDF = (data: StockReportData) => {
    setIsGeneratingPDF(true);
    
    try {
      const doc = new jsPDF();
      
      // Set font to match web application (Geist Sans is sans-serif)
      doc.setFont('helvetica', 'normal');
      
      // Letter Header
      doc.setFontSize(16);
      doc.setTextColor(0, 102, 204); // Blue color
      doc.text('ClinicMinds Healthcare', 20, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('123 Medical Center Road, Healthcare City', 20, 26);
      doc.text('Phone: +91 98765 43210 | Email: info@clinicminds.com', 20, 32);
      doc.text('GSTIN: 27AAAPL1234C1ZV | License: MH/PH/2023/12345', 20, 38);
      
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 42, 190, 42);
      
      // Report Title
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.text('Closing Stock Report', 105, 55, { align: 'center' });
      
      // Date and Report ID
      doc.setFontSize(10);
      const now = new Date();
      const time12hr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
      });
      doc.text(`Report Date: ${now.toLocaleDateString()} ${time12hr}`, 20, 65);
      
      // Horizontal Table Header with rounded corners
      const tableTop = 80;
      const columnWidth = 56.67; // 170 / 3 columns
      const rowHeight = 10;
      const cornerRadius = 2;
      const tableLeft = 20;
      const tableWidth = 170;
      const tableHeight = rowHeight * 2;
      
      // Helper function to draw rounded rectangle
      const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number, fill: boolean = false) => {
        doc.setDrawColor(150, 150, 150);
        if (!fill) {
          doc.roundedRect(x, y, width, height, radius, radius, 'D');
        } else {
          doc.setFillColor(240, 240, 240);
          doc.roundedRect(x, y, width, height, radius, radius, 'FD');
        }
      };
      
      // Fill header background as regular rectangle (will be clipped by outer border)
      doc.setFillColor(240, 240, 240);
      doc.rect(tableLeft, tableTop, tableWidth, rowHeight, 'F');
      
      // Draw separator line between header and content (full width)
      doc.setDrawColor(150, 150, 150);
      doc.line(tableLeft, tableTop + rowHeight, tableLeft + tableWidth, tableTop + rowHeight);
      
      // Header text
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Franchise', 25, tableTop + 7);
      doc.text('Medicine', 25 + columnWidth, tableTop + 7);
      doc.text('Stock Quantity', 25 + (columnWidth * 2), tableTop + 7);
      
      // Row content
      const contentY = tableTop + rowHeight;
      
      // Row content
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(data.franchise.name, 25, contentY + 7);
      doc.text(`${data.medicine.brand || 'Unknown Brand'} ${data.medicine.name}`.trim(), 25 + columnWidth, contentY + 7);
      
      // Stock quantity with color
      if (data.quantity > 0) {
        doc.setTextColor(0, 100, 0); // Green
      } else {
        doc.setTextColor(200, 0, 0); // Red
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${data.quantity} units`, 25 + (columnWidth * 2), contentY + 7);
      
      // Reset font
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      
      // Draw single rounded table border LAST so it appears on top
      drawRoundedRect(tableLeft, tableTop, tableWidth, tableHeight, cornerRadius, false);
      
      // Footer
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Page 1 of 1 | ClinicMinds Healthcare Management System', 105, 285, { align: 'center' });
      doc.text(`${now.toLocaleDateString()} ${time12hr}`, 190, 285, { align: 'right' });
      
      // Save PDF
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
      const franchiseName = data.franchise.name.replace(/\s+/g, '-').toLowerCase();
      const medicineFullName = `${data.medicine.brand || 'unknown-brand'}-${data.medicine.name}`.replace(/\s+/g, '-').toLowerCase();
      doc.save(`stock-report-${franchiseName}-${medicineFullName}-${dateStr}-${timeStr}.pdf`);
      
    } catch (error) {
      toast.error('Failed to generate PDF');
      console.error('PDF generation error:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Form submission
  const onSubmit = async (data: ClosingStockFormData) => {
    setIsLoading(true);
    
    try {
      const response = await apiGet(
        `/api/closing-stock-report?franchiseId=${data.franchiseId}&medicineId=${data.medicineId}`
      );
      
      setStockData(response as StockReportData);
    } catch (error) {
      toast.error('Failed to fetch stock data');
      setStockData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Closing Stock Report</AppCard.Title>
            <AppCard.Description>Generate stock reports for specific franchise and medicine combinations</AppCard.Description>
          </AppCard.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend='Report Parameters'>
                <FormRow cols={2}>
                  <ComboboxInput
                    control={control}
                    name="franchiseId"
                    label="Franchise"
                    options={franchiseOptions}
                    placeholder="Select Franchise"
                    searchPlaceholder="Search franchise..."
                    required
                    disabled={isLoading}
                  />
                  <ComboboxInput
                    control={control}
                    name="medicineId"
                    label="Medicine"
                    options={medicineOptions}
                    placeholder="Select Medicine"
                    searchPlaceholder="Search medicine..."
                    required
                    disabled={isLoading}
                  />
                </FormRow>
              </FormSection>
            </AppCard.Content>
            <AppCard.Footer className='justify-end'>
              <AppButton
                type="submit"
                disabled={isLoading || !form.formState.isValid}
                isLoading={isLoading}
                iconName="Search"
              >
                Get Stock Data
              </AppButton>
            </AppCard.Footer>
          </form>
        </AppCard>
      </Form>

      {/* Stock Data Display */}
      {stockData && (
        <AppCard>
          <AppCard.Header>
            <AppCard.Title>Stock Information</AppCard.Title>
            <AppCard.Description>Current stock status for selected franchise and medicine</AppCard.Description>
            <AppCard.Action>
              <div className="flex gap-2">
                <AppButton
                  onClick={() => generateExcel(stockData)}
                  iconName="FileSpreadsheet"
                  size="sm"
                >
                  Export to Excel
                </AppButton>
                <AppButton
                  onClick={() => generatePDF(stockData)}
                  disabled={isGeneratingPDF}
                  isLoading={isGeneratingPDF}
                  iconName="Download"
                  size="sm"
                >
                  Export to PDF
                </AppButton>
              </div>
            </AppCard.Action>
          </AppCard.Header>
          <AppCard.Content>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider">
                      Franchise
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider">
                      Medicine
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider">
                      Stock Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-3 whitespace-nowrap text-xs">
                      {stockData.franchise.name}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs">
                      {`${stockData.medicine.brand || 'Unknown Brand'} ${stockData.medicine.name}`.trim()}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        stockData.quantity > 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {stockData.quantity} units
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {stockData.message && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-yellow-800">{stockData.message}</p>
                </div>
              </div>
            )}
          </AppCard.Content>
        </AppCard>
      )}
    </div>
  );
}
