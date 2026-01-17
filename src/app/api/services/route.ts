// src/app/api/services/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';
import { paginate } from '@/lib/paginate';
import { serviceSchema } from '@/lib/schemas/backend/services';
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
  const sortable = new Set(["name", "unit", "rate", "createdAt", "updatedAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort) 
  ? { [sort]: order } 
  : { name: "asc" };
  const where = {
    OR: [
      { name: { contains: search } },
      { unit: { contains: search } },
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
        unit: true,
        rate: true,
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
     console.log("body:", body);
    const data = serviceSchema.parse(body);
   
    const service = await prisma.service.create({
      data: data
    });
    return Success(service, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error('Create service error:', error);
    return Error('Failed to create service');
  }
}