import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';

// GET /api/day-book
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'date';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const franchiseIdParam = searchParams.get('franchiseId');

  // Check if user is admin first to avoid unnecessary database queries
  let franchiseId: number | undefined;
  let currentUser: any = null;
  
  if (auth.user.role === 'Admin') {
    // Admin can optionally filter by specific franchise
    if (franchiseIdParam) {
      franchiseId = parseInt(franchiseIdParam);
      if (isNaN(franchiseId)) {
        return Error("Invalid franchiseId parameter", 400);
      }
    }
    // Admin without franchise filter - franchiseId remains undefined (all franchises)
  } else {
    // For non-admin users, get their franchise info and filter accordingly
    currentUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { 
        id: true,
        role: true,
        franchise: {
          select: { id: true }
        },
        team: {
          select: { 
            id: true,
            franchise: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!currentUser) {
      return Error("Current user not found", 404);
    }

    franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
    
    if (!franchiseId) {
      return Error("Current user is not associated with any franchise", 400);
    }
  }

  try {
    // Fetch consultations
    const consultations = await fetchConsultations({
      franchiseId,
      currentUser,
      search,
      startDate,
      endDate,
      sort,
      order,
      page,
      perPage
    });

    // Fetch medicine bills
    const medicineBills = await fetchMedicineBills({
      franchiseId,
      search,
      startDate,
      endDate,
      sort,
      order,
      page,
      perPage
    });

    // Combine and normalize data
    const combinedData = [
      ...consultations.data.map(c => normalizeConsultation(c)),
      ...medicineBills.data.map(b => normalizeMedicineBill(b))
    ];

    // Sort combined data
    const sortedData = sortCombinedData(combinedData, sort, order);

    // Apply pagination to combined data
    const total = sortedData.length;
    const totalPages = Math.ceil(total / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedData = sortedData.slice(startIndex, endIndex);

    return Success({
      data: paginatedData,
      page,
      perPage,
      total,
      totalPages
    });
  } catch (e) {
    console.error('Error fetching day book data:', e);
    return Error('Failed to fetch day book data');
  }
}

async function fetchConsultations(params: {
  franchiseId?: number;
  currentUser?: any;
  search: string;
  startDate?: string;
  endDate?: string;
  sort: string;
  order: 'asc' | 'desc';
  page: number;
  perPage: number;
}) {
  const { franchiseId, currentUser, search, startDate, endDate, sort, order, page, perPage } = params;

  const where: any = {};
  
  // Only add franchise filter if we have a specific franchiseId (for non-admin or admin with filter)
  if (franchiseId !== undefined) {
    where.appointment = {
      franchiseId,
    };
  }
  
  // Role-based filtering: DOCTOR can only see consultations from their team
  if (currentUser && currentUser.role === 'DOCTOR' && currentUser.team) {
    where.appointment.teamId = currentUser.team.id;
  }
  
  if (search) {
    where.OR = [
      { complaint: { contains: search } },
      { diagnosis: { contains: search } },
      { remarks: { contains: search } },
    ];
  }

  // Date filtering based on appointment date
  if (startDate || endDate) {
    where.appointment = {
      ...where.appointment,
      appointmentDateTime: {},
    };
    
    if (startDate) {
      where.appointment.appointmentDateTime.gte = new Date(startDate + 'T00:00:00.000Z');
    }
    
    if (endDate) {
      where.appointment.appointmentDateTime.lte = new Date(endDate + 'T23:59:59.999Z');
    }
  }

  const consultations = await prisma.consultation.findMany({
    where,
    select: {
      id: true,
      appointmentId: true,
      complaint: true,
      diagnosis: true,
      remarks: true,
      nextFollowUpDate: true,
      totalAmount: true,
      totalReceivedAmount: true,
      createdAt: true,
      appointment: {
        select: {
          id: true,
          appointmentDateTime: true,
          type: true,
          team: {
            select: {
              name: true,
            },
          },
          patient: {
            select: {
              id: true,
              patientNo: true,
              firstName: true,
              middleName: true,
              lastName: true,
              mobile: true,
              gender: true,
            },
          },
        },
      },
    },
    orderBy: {
      appointment: {
        appointmentDateTime: order
      }
    }
  });

  return { data: consultations };
}

async function fetchMedicineBills(params: {
  franchiseId?: number;
  search: string;
  startDate?: string;
  endDate?: string;
  sort: string;
  order: 'asc' | 'desc';
  page: number;
  perPage: number;
}) {
  const { franchiseId, search, startDate, endDate, sort, order, page, perPage } = params;

  const where: any = {};
  
  // Non-admin users can only see their franchise bills
  if (franchiseId !== undefined) {
    where.franchiseId = franchiseId;
  }

  if (search) {
    where.OR = [
      { billNumber: { contains: search } },
      { patient: { 
        firstName: { contains: search }, 
        middleName: { contains: search }, 
        lastName: { contains: search } 
      } },
    ];
  }

  // Date filtering based on bill date
  if (startDate || endDate) {
    where.billDate = {};
    
    if (startDate) {
      where.billDate.gte = new Date(startDate + 'T00:00:00.000Z');
    }
    
    if (endDate) {
      where.billDate.lte = new Date(endDate + 'T23:59:59.999Z');
    }
  }

  const medicineBills = await prisma.medicineBill.findMany({
    where,
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      totalAmount: true,
      discountPercent: true,
      totalReceivedAmount: true,
      patient: { 
        select: { 
          id: true,
          patientNo: true,
          firstName: true, 
          middleName: true, 
          lastName: true,
          mobile: true,
          gender: true
        } 
      },
    },
    orderBy: {
      billDate: order
    }
  });

  return { data: medicineBills };
}

function normalizeConsultation(consultation: any) {
  return {
    id: `consultation_${consultation.id}`, // Prefix to ensure uniqueness
    originalId: consultation.id,
    transactionType: 'CONSULTATION',
    date: consultation.appointment.appointmentDateTime,
    patientNo: consultation.appointment.patient.patientNo,
    patientName: `${consultation.appointment.patient.firstName} ${consultation.appointment.patient.middleName} ${consultation.appointment.patient.lastName}`.trim(),
    mobile: consultation.appointment.patient.mobile,
    gender: consultation.appointment.patient.gender,
    teamName: consultation.appointment.team?.name || '',
    referenceNumber: `APT-${consultation.appointmentId}`,
    totalAmount: consultation.totalAmount.toString(),
    receivedAmount: (consultation.totalReceivedAmount || '0').toString(),
    balanceAmount: (parseFloat(consultation.totalAmount) - parseFloat(consultation.totalReceivedAmount || '0')).toString(),
    remarks: consultation.remarks || consultation.diagnosis || '',
    consultationData: {
      appointmentId: consultation.appointmentId,
      type: consultation.appointment.type,
      nextFollowUpDate: consultation.nextFollowUpDate,
      complaint: consultation.complaint,
      diagnosis: consultation.diagnosis
    }
  };
}

function normalizeMedicineBill(medicineBill: any) {
  return {
    id: `medicine_bill_${medicineBill.id}`, // Prefix to ensure uniqueness
    originalId: medicineBill.id,
    transactionType: 'MEDICINE_BILL',
    date: medicineBill.billDate,
    patientNo: medicineBill.patient?.patientNo || '',
    patientName: medicineBill.patient ? 
      `${medicineBill.patient.firstName} ${medicineBill.patient.middleName} ${medicineBill.patient.lastName}`.trim() : 
      'Unknown Patient',
    mobile: medicineBill.patient?.mobile || '',
    gender: medicineBill.patient?.gender || '',
    teamName: '', // Medicine bills don't have team info
    referenceNumber: medicineBill.billNumber,
    totalAmount: medicineBill.totalAmount.toString(),
    receivedAmount: (medicineBill.totalReceivedAmount || '0').toString(),
    balanceAmount: (parseFloat(medicineBill.totalAmount.toString()) - parseFloat(medicineBill.totalReceivedAmount?.toString() || '0')).toString(),
    remarks: '—', // Medicine bills don't have remarks field
    medicineBillData: {
      billNumber: medicineBill.billNumber,
      discountPercent: medicineBill.discountPercent
    }
  };
}

function sortCombinedData(data: any[], sort: string, order: 'asc' | 'desc') {
  const sorted = [...data].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sort) {
      case 'date':
        aValue = new Date(a.date);
        bValue = new Date(b.date);
        break;
      case 'patientName':
        aValue = a.patientName.toLowerCase();
        bValue = b.patientName.toLowerCase();
        break;
      case 'referenceNumber':
        aValue = a.referenceNumber;
        bValue = b.referenceNumber;
        break;
      case 'totalAmount':
        aValue = parseFloat(a.totalAmount);
        bValue = parseFloat(b.totalAmount);
        break;
      case 'balanceAmount':
        aValue = parseFloat(a.balanceAmount);
        bValue = parseFloat(b.balanceAmount);
        break;
      case 'transactionType':
        aValue = a.transactionType;
        bValue = b.transactionType;
        break;
      default:
        aValue = new Date(a.date);
        bValue = new Date(b.date);
    }

    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}
