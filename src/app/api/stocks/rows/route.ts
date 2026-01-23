import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { ROLES } from "@/config/roles";

type StockRow = {
  franchiseId: number;
  franchiseName: string;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  rate: string;
  stock: number;
};

type StocksRowsResponse = {
  data: StockRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

// GET /api/stocks/rows
// Flattened, table-friendly view:
// franchise / medicine / batch / expiry / rate / stock
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("perPage")) || 10));
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const sort = (searchParams.get("sort") || "franchiseName").trim();
  const order = (searchParams.get("order") === "desc" ? "desc" : "asc") as "asc" | "desc";

  try {
    // Determine target franchise scope
    let franchiseIds: number[] | null = null;

    if (auth.user.role === ROLES.ADMIN) {
      // Admin can see all franchises
      franchiseIds = null;
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
      franchiseIds = [currentFranchiseId];
    } else {
      return Error("Unauthorized role", 403);
    }

    const stockBatchBalanceModel = (prisma as any).stockBatchBalance;

    const whereBalance: any = { quantity: { not: 0 } };
    if (franchiseIds) whereBalance.franchiseId = { in: franchiseIds };

    const searchNumber = Number(search);
    const searchIsNumber = search.length > 0 && !Number.isNaN(searchNumber);

    if (search) {
      whereBalance.OR = [
        { franchise: { name: { contains: search, mode: "insensitive" } } },
        { medicine: { name: { contains: search, mode: "insensitive" } } },
        { batchNumber: { contains: search, mode: "insensitive" } },
      ];
      if (searchIsNumber) {
        whereBalance.OR.push({ franchiseId: searchNumber });
        whereBalance.OR.push({ medicineId: searchNumber });
      }
    }

    const sortable = new Set([
      "franchiseName",
      "medicineName",
      "batchNumber",
      "expiryDate",
      "rate",
      "stock",
      "franchiseId",
      "medicineId",
    ]);
    const sortKey = sortable.has(sort) ? sort : "franchiseName";

    const orderBy: any = (() => {
      switch (sortKey) {
        case "franchiseId":
          return { franchiseId: order };
        case "medicineId":
          return { medicineId: order };
        case "medicineName":
          return { medicine: { name: order } };
        case "batchNumber":
          return { batchNumber: order };
        case "expiryDate":
          return { expiryDate: order };
        case "rate":
          return { medicine: { rate: order } };
        case "stock":
          return { quantity: order };
        case "franchiseName":
        default:
          return { franchise: { name: order } };
      }
    })();

    const total = await stockBatchBalanceModel.count({ where: whereBalance });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const skip = (page - 1) * perPage;

    const balances = await stockBatchBalanceModel.findMany({
      where: whereBalance,
      orderBy,
      skip,
      take: perPage,
      select: {
        franchiseId: true,
        medicineId: true,
        batchNumber: true,
        expiryDate: true,
        quantity: true,
        franchise: { select: { name: true } },
        medicine: { select: { name: true, rate: true } },
      },
    });

    const data: StockRow[] = balances.map((b) => ({
      franchiseId: b.franchiseId,
      franchiseName: b.franchise?.name || `Franchise ${b.franchiseId}`,
      medicineId: b.medicineId,
      medicineName: b.medicine?.name || `Medicine ${b.medicineId}`,
      batchNumber: String(b.batchNumber ?? ''),
      expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : '',
      rate: String(b.medicine?.rate ?? 0),
      stock: b.quantity,
    }));

    const response: StocksRowsResponse = { data, page, perPage, total, totalPages };
    return Success(response);
  } catch (e) {
    console.error("Error fetching stock rows:", e);
    return Error("Failed to fetch stock rows");
  }
}
