import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Rebuild current stock balances from the ledger.
  // Safe to re-run; it will wipe and recreate balances.

  await prisma.$transaction(async (tx) => {
    await tx.stockBalance.deleteMany({});

    await (tx as any).stockBatchBalance.deleteMany({});

    const grouped = await tx.stockLedger.groupBy({
      by: ['franchiseId', 'medicineId'],
      _sum: { qtyChange: true },
    });

    const rows = grouped
      .map((g) => ({
        franchiseId: g.franchiseId,
        medicineId: g.medicineId,
        quantity: Number(g._sum.qtyChange ?? 0),
      }))
      .filter((r) => r.quantity !== 0);

    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await tx.stockBalance.createMany({
        data: batch,
      });
    }

    const groupedBatches = (await (tx as any).stockLedger.groupBy({
      by: ['franchiseId', 'medicineId', 'batchNumber', 'expiryDate'],
      where: { batchNumber: { not: null }, expiryDate: { not: null } },
      _sum: { qtyChange: true },
    })) as any[];

    const batchRows = groupedBatches
      .map((g) => ({
        franchiseId: g.franchiseId,
        medicineId: g.medicineId,
        batchNumber: g.batchNumber as string,
        expiryDate: g.expiryDate as Date,
        quantity: Number(g?._sum?.qtyChange ?? 0),
      }))
      .filter((r) => r.quantity !== 0);

    for (let i = 0; i < batchRows.length; i += BATCH_SIZE) {
      const batch = batchRows.slice(i, i + BATCH_SIZE);
      await (tx as any).stockBatchBalance.createMany({
        data: batch,
      });
    }
  });

  const count = await prisma.stockBalance.count();
  const batchCount = await (prisma as any).stockBatchBalance.count();
  // eslint-disable-next-line no-console
  console.log(`Rebuilt stock_balances. Rows: ${count}`);
  // eslint-disable-next-line no-console
  console.log(`Rebuilt stock_batch_balances. Rows: ${batchCount}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
