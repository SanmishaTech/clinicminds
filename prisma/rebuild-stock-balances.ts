import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Rebuild current stock balances from the ledger.
  // Safe to re-run; it will wipe and recreate balances.

  await prisma.$transaction(async (tx) => {
    await tx.stockBalance.deleteMany({});

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
  });

  const count = await prisma.stockBalance.count();
  // eslint-disable-next-line no-console
  console.log(`Rebuilt stock_balances. Rows: ${count}`);
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
