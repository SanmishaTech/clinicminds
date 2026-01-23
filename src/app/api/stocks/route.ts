import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

// GET /api/stocks
// - Admin: pass ?franchiseId=123 to see that franchise stock.
// - Franchise: always returns their own franchise stock (ignores franchiseId).
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const franchiseIdParam = searchParams.get("franchiseId");
  const franchiseId = franchiseIdParam ? Number(franchiseIdParam) : undefined;

  try {
    let targetFranchiseId: number | null = null;

    if (auth.user.role === ROLES.ADMIN) {
      if (typeof franchiseId !== "number" || Number.isNaN(franchiseId)) {
        return Error("franchiseId is required for admin", 400);
      }
      targetFranchiseId = franchiseId;
    } else if (auth.user.role === ROLES.FRANCHISE) {
      const currentUser = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: {
          franchise: { select: { id: true } },
          team: { select: { franchise: { select: { id: true } } } },
        },
      });
      const currentFranchiseId =
        currentUser?.franchise?.id || currentUser?.team?.franchise?.id;
      if (!currentFranchiseId) {
        return Error("Current user is not associated with any franchise", 400);
      }

      targetFranchiseId = currentFranchiseId;
    } else {
      return Error("Unauthorized role", 403);
    }

    const franchise = await prisma.franchise.findUnique({
      where: { id: Number(targetFranchiseId) },
      select: { id: true, name: true },
    });
    if (!franchise) return Error("Franchise not found", 404);

    const balances = await prisma.stockBalance.findMany({
      where: { franchiseId: franchise.id, quantity: { not: 0 } },
      orderBy: { medicine: { name: "asc" } },
      select: {
        medicineId: true,
        quantity: true,
        medicine: {
          select: {
            name: true,
            rate: true,
            mrp: true,
            brand: { select: { name: true } },
          },
        },
      },
    });

    const result = balances.map((b) => ({
      medicineId: b.medicineId,
      medicineName: b.medicine?.name,
      brandName: b.medicine?.brand?.name ?? null,
      rate: b.medicine?.rate,
      mrp: b.medicine?.mrp,
      quantity: b.quantity,
    }));

    return Success({ franchiseId: franchise.id, franchiseName: franchise.name, items: result });
  } catch (e) {
    console.error("Error fetching stock:", e);
    return Error("Failed to fetch stock");
  }
}
