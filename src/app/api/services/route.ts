// src/app/api/services/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';
import { paginate } from '@/lib/paginate';
import { serviceSchema } from '@/lib/schemas/backend/services';

function toDecimal2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function computeInclusiveRate(baseRate: number, gstPercent: number) {
  const gst = Number.isFinite(gstPercent) ? gstPercent : 0;
  const base = Number.isFinite(baseRate) ? baseRate : 0;
  const rate = base + (base * gst) / 100;
  return {
    baseRate: toDecimal2(base),
    gstPercent: toDecimal2(gst),
    rate: toDecimal2(rate),
  };
}

// GET /api/services
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'name';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as "asc" | "desc";
  const sortable = new Set(["name", "rate", "createdAt", "updatedAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort) 
  ? { [sort]: order } 
  : { name: "asc" };
  const where = {
    OR: [
      { name: { contains: search } },
      { description: { contains: search } },
    ],
  };
  try {
    const result = await paginate({
      model: prisma.service as any,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        name: true,
        rate: true,
        baseRate: true,
        gstPercent: true,
        isProcedure: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(result);
  } catch (error) {
    console.error('Error fetching services:', error);
    return Error('Failed to fetch services');
  }
}

// POST /api/services
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json();
    const data = serviceSchema.parse(body);

    const computed = computeInclusiveRate(data.rate, data.gstPercent ?? 0);
    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        isProcedure: Boolean((data as any).isProcedure),
        rate: computed.rate as any,
        baseRate: computed.baseRate as any,
        gstPercent: computed.gstPercent as any,
      } as any
    });
    return Success(service, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    const err = error as { code?: string };
    if (err?.code === 'P2002') return Error('Service name already exists', 409);
    console.error('Create service error:', error);
    return Error('Failed to create service');
  }
}