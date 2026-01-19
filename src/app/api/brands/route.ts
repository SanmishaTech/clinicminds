// src/app/api/brands/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';

const brandModel = (prisma as any).brand;

// GET /api/brands
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'name';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as "asc" | "desc";
  
  const sortable = new Set(["name", "createdAt", "updatedAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort) 
    ? { [sort]: order } 
    : { name: "asc" };
  
  const where = {
    ...(search ? { name: { contains: search } } : {}),
  };
  
  try {
    const result = await paginate({
      model: brandModel,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return Success(result);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return Error('Failed to fetch brands');
  }
}

// POST /api/brands
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error('Invalid JSON body', 400);
  }

  const { name } = (body as Partial<{ name: string }>) || {};
  if (!name || String(name).trim() === '') return Error('Brand name is required', 400);
  if (String(name).trim().length > 100) return Error('Brand name must be less than 100 characters', 400);

  try {
    const created = await brandModel.create({
      data: { name: String(name).trim() },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return Success(created, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Brand already exists', 409);
    console.error('Create brand error:', e);
    return Error('Failed to create brand');
  }
}

// PATCH /api/brands  { id, name? }
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error('Invalid JSON body', 400);
  }

  const { id, name } =
    (body as Partial<{ id: number | string; name?: string }>) || {};
  if (!id) return Error('Brand id required', 400);

  const data: Record<string, unknown> = {};
  if (typeof name === 'string' || name === null) {
    if (!name || name.trim() === '') return Error('Brand name is required', 400);
    if (name.trim().length > 100) return Error('Brand name must be less than 100 characters', 400);
    data.name = name.trim();
  }

  if (Object.keys(data).length === 0) return Error('Nothing to update', 400);

  try {
    const updated = await brandModel.update({
      where: { id: Number(id) },
      data,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return Success(updated);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Brand not found', 404);
    if (err?.code === 'P2002') return Error('Brand already exists', 409);
    console.error('Update brand error:', e);
    return Error('Failed to update brand');
  }
}
