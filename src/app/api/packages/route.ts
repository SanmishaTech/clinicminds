import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { paginate } from '@/lib/paginate';
import { createPackageSchema, updatePackageSchema, type CreatePackageInput, type UpdatePackageInput } from '@/lib/schemas/backend/packages';
import { z } from 'zod';

const packageModel = (prisma as any).package;

export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'name';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

  const sortable = new Set(['name', 'totalAmount', 'createdAt', 'updatedAt']);
  const orderBy: Record<string, 'asc' | 'desc'> = sortable.has(sort)
    ? { [sort]: order }
    : { name: 'asc' };

  const where = {
    ...(search ? { name: { contains: search } } : {}),
  };

  try {
    const result = await paginate({
      model: packageModel,
      where,
      orderBy,
      page,
      perPage,
      select: {
        id: true,
        name: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return Success(result);
  } catch (e) {
    console.error('Error fetching packages:', e);
    return Error('Failed to fetch packages');
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const data = createPackageSchema.parse(body) as CreatePackageInput;

    const existingByName = await packageModel.findFirst({
      where: { name: data.name },
      select: { id: true },
    });
    if (existingByName) return Error('Package name already exists', 409);

    const created = await (prisma as any).$transaction(async (tx: any) => {
      const pkg = await tx.package.create({
        data: {
          name: data.name,
          totalAmount: data.totalAmount,
        },
        select: {
          id: true,
          name: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.packageDetail.createMany({
        data: data.packageDetails.map((d) => ({
          packageId: pkg.id,
          serviceId: d.serviceId,
          description: d.description || null,
          qty: d.qty,
          rate: d.rate,
          amount: d.amount,
        })),
      });

      await tx.packageMedicine.createMany({
        data: data.packageMedicines.map((m) => ({
          packageId: pkg.id,
          medicineId: m.medicineId,
          qty: m.qty,
          rate: m.rate,
          amount: m.amount,
        })),
      });

      return pkg;
    });

    return Success(created, 201);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as { code?: string };
    if (err?.code === 'P2002') return Error('Package name already exists', 409);
    console.error('Create package error:', e);
    return Error('Failed to create package');
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Error('Invalid JSON body', 400);
  }

  const { id, ...rest } = (body as Partial<{ id: number | string } & UpdatePackageInput>) || {};
  if (!id) return Error('Package id required', 400);

  try {
    const parsed = updatePackageSchema.parse(rest) as UpdatePackageInput;

    if (typeof parsed.name === 'string') {
      const existingByName = await packageModel.findFirst({
        where: { name: parsed.name, NOT: { id: Number(id) } },
        select: { id: true },
      });
      if (existingByName) return Error('Package name already exists', 409);
    }

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const data: any = {};
      if (parsed.name !== undefined) data.name = parsed.name;
      if (parsed.totalAmount !== undefined) data.totalAmount = parsed.totalAmount;

      const pkg = await tx.package.update({
        where: { id: Number(id) },
        data,
        select: {
          id: true,
          name: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (parsed.packageDetails) {
        await tx.packageDetail.deleteMany({ where: { packageId: Number(id) } });
        if (parsed.packageDetails.length) {
          await tx.packageDetail.createMany({
            data: parsed.packageDetails.map((d) => ({
              packageId: Number(id),
              serviceId: d.serviceId!,
              description: d.description || null,
              qty: d.qty!,
              rate: d.rate!,
              amount: d.amount!,
            })),
          });
        }
      }

      if (parsed.packageMedicines) {
        await tx.packageMedicine.deleteMany({ where: { packageId: Number(id) } });
        if (parsed.packageMedicines.length) {
          await tx.packageMedicine.createMany({
            data: parsed.packageMedicines.map((m) => ({
              packageId: Number(id),
              medicineId: m.medicineId!,
              qty: m.qty!,
              rate: m.rate!,
              amount: m.amount!,
            })),
          });
        }
      }

      return pkg;
    });

    return Success(updated);
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return BadRequest(e.errors);
    const err = e as { code?: string };
    if (err?.code === 'P2025') return Error('Package not found', 404);
    if (err?.code === 'P2002') return Error('Package name already exists', 409);
    console.error('Update package error:', e);
    return Error('Failed to update package');
  }
}
