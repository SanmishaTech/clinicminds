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
            startsWith: `S-${dayMonthYear}`
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
      params.args.data.invoiceNo = `S-${dayMonthYear}-${String(sequence).padStart(4, '0')}`;
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
            startsWith: `S-${dayMonthYear}`
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
          invoiceNo: `S-${dayMonthYear}-${String(sequence++).padStart(4, '0')}`
        }));
      }
    }

    // Handle single create for StockTransaction
    if (params.action === 'create' && params.model === 'StockTransaction') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0'); // DD
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const year = now.getFullYear(); // YYYY
      const dayMonthYear = `${day}${month}${year}`; // DDMMYYYY

      const latestTxn = await prisma.stockTransaction.findFirst({
        where: {
          txnNo: {
            startsWith: `ST-${dayMonthYear}`,
          },
        },
        orderBy: {
          txnNo: 'desc',
        },
        select: {
          txnNo: true,
        },
      });

      const sequence = latestTxn ? parseInt(latestTxn.txnNo.split('-')[2]) + 1 : 1;
      params.args.data.txnNo = `ST-${dayMonthYear}-${String(sequence).padStart(4, '0')}`;
    }

    // Handle batch create for StockTransaction
    if (params.action === 'createMany' && params.model === 'StockTransaction') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0'); // DD
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const year = now.getFullYear(); // YYYY
      const dayMonthYear = `${day}${month}${year}`; // DDMMYYYY

      const latestTxn = await prisma.stockTransaction.findFirst({
        where: {
          txnNo: {
            startsWith: `ST-${dayMonthYear}`,
          },
        },
        orderBy: {
          txnNo: 'desc',
        },
        select: {
          txnNo: true,
        },
      });

      let sequence = latestTxn ? parseInt(latestTxn.txnNo.split('-')[2]) + 1 : 1;

      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((item: any) => ({
          ...item,
          txnNo: `ST-${dayMonthYear}-${String(sequence++).padStart(4, '0')}`,
        }));
      }
    }

    // Handle single create for MedicineBill
    if (params.action === 'create' && params.model === 'MedicineBill') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0'); // DD
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const year = now.getFullYear(); // YYYY
      const dayMonthYear = `${day}${month}${year}`; // DDMMYYYY
      
      // Find latest bill number for today
      const latestBill = await prisma.medicineBill.findFirst({
        where: {
          billNumber: {
            startsWith: `M-${dayMonthYear}`
          }
        },
        orderBy: {
          billNumber: 'desc'
        },
        select: {
          billNumber: true
        }
      });

      const sequence = latestBill ? parseInt(latestBill.billNumber.split('-')[2]) + 1 : 1;
      params.args.data.billNumber = `M-${dayMonthYear}-${String(sequence).padStart(4, '0')}`;
    }

    // Handle single create for ConsultationReceipt
    if (params.action === 'create' && params.model === 'ConsultationReceipt') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0'); // DD
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const year = now.getFullYear(); // YYYY
      const dayMonthYear = `${day}${month}${year}`; // DDMMYYYY
      
      // Find latest receipt number for today
      const latestReceipt = await prisma.consultationReceipt.findFirst({
        where: {
          receiptNumber: {
            startsWith: `R-${dayMonthYear}`
          }
        },
        orderBy: {
          receiptNumber: 'desc'
        },
        select: {
          receiptNumber: true
        }
      });

      const sequence = latestReceipt ? parseInt(latestReceipt.receiptNumber.split('-')[2]) + 1 : 1;
      params.args.data.receiptNumber = `R-${dayMonthYear}-${String(sequence).padStart(4, '0')}`;
    }

    // Handle single create for MedicineBillReceipt
    if (params.action === 'create' && params.model === 'MedicineBillReceipt') {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0'); // DD
      const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
      const year = now.getFullYear(); // YYYY
      const dayMonthYear = `${day}${month}${year}`; // DDMMYYYY
      
      // Find latest receipt number for today
      const latestReceipt = await prisma.medicineBillReceipt.findFirst({
        where: {
          receiptNumber: {
            startsWith: `RM-${dayMonthYear}`
          }
        },
        orderBy: {
          receiptNumber: 'desc'
        },
        select: {
          receiptNumber: true
        }
      });

      const sequence = latestReceipt ? parseInt(latestReceipt.receiptNumber.split('-')[2]) + 1 : 1;
      params.args.data.receiptNumber = `RM-${dayMonthYear}-${String(sequence).padStart(4, '0')}`;
    }

    return next(params);
  });
};
