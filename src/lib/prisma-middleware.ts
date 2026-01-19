import { PrismaClient, Prisma } from '@prisma/client';

export const generateEntityCode = (prisma: PrismaClient) => {
  prisma.$use(async (params, next) => {
    // Skip if not a create operation
    if (!['create', 'createMany'].includes(params.action)) {
      return next(params);
    }

    // Handle single create for Sale
    if (params.action === 'create' && params.model === 'Sale') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0'); // DD
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const year = now.getFullYear(); // YYYY
      const dayMonthYear = `${day}${month}${year}`; // DDMMYYYY
      
      // Find latest invoice number for today
      const latestInvoice = await prisma.sale.findFirst({
        where: {
          invoiceNo: {
            startsWith: `I-${dayMonthYear}`
          }
        },
        orderBy: {
          invoiceNo: 'desc'
        },
        select: {
          invoiceNo: true
        }
      });
      
      const sequence = latestInvoice ? parseInt(latestInvoice.invoiceNo.split('-')[2]) + 1 : 1;
      
      // Set new invoice number (format: "I-DDMMYYYY-XXXX")
      params.args.data.invoiceNo = `I-${dayMonthYear}-${String(sequence).padStart(4, '0')}`;
    }

    // Handle batch create for Sale
    if (params.action === 'createMany' && params.model === 'Sale') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0'); // DD
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const year = now.getFullYear(); // YYYY
      const dayMonthYear = `${day}${month}${year}`; // DDMMYYYY
      
      // Find the latest invoice number for today
      const latestInvoice = await prisma.sale.findFirst({
        where: {
          invoiceNo: {
            startsWith: `I-${dayMonthYear}`
          }
        },
        orderBy: {
          invoiceNo: 'desc'
        },
        select: {
          invoiceNo: true
        }
      });
      
      let sequence = latestInvoice ? parseInt(latestInvoice.invoiceNo.split('-')[2]) + 1 : 1;

      // Update each record with a unique invoice number
      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((item: any) => ({
          ...item,
          invoiceNo: `I-${dayMonthYear}-${String(sequence++).padStart(4, '0')}`
        }));
      }
    }

    return next(params);
  });
};
