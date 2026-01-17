// src/app/api/medicines/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';
import { paginate } from '@/lib/paginate';
import { medicineSchema } from '@/lib/schemas/backend/medicines';
// GET /api/medicines
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'name';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as "asc" | "desc";
  const sortable = new Set(["name", "brand", "rate", "mrp", "createdAt", "updatedAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort) 
  ? { [sort]: order } 
  : { name: "asc" };
  const where = {
    OR: [
      { name: { contains: search } },
      { brand: { contains: search } },
    ],
  };
  try {
    const result = await paginate({
      model: prisma.medicine as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        name: true,
        brand: true,
        rate: true,
        mrp: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(result);
  } catch (error) {
    console.error('Error fetching medicines:', error);
    return Error('Failed to fetch medicines');
  }
}
// POST /api/medicines
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json();
    const data = medicineSchema.parse(body);
   
    const medicine = await prisma.medicine.create({
      data: data
    });
    return Success(medicine, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error('Create medicine error:', error);
    return Error('Failed to create medicine');
  }
}