// src/app/api/rooms/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';
import { paginate } from '@/lib/paginate';
import { roomSchema } from '@/lib/schemas/backend/rooms';

// GET /api/rooms
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const sort = searchParams.get('sort') || 'name';
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as "asc" | "desc";
  const sortable = new Set(["name", "createdAt"]);
  const orderBy: Record<string, "asc" | "desc"> = sortable.has(sort) 
  ? { [sort]: order } 
  : { name: "asc" };
  const where = {
    OR: [
      { name: { contains: search } },
    ],
  };
  try {
    const result = await paginate({
      model: prisma.room as any,
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
    console.error('Error fetching rooms:', error);
    return Error('Failed to fetch rooms');
  }
}

// POST /api/rooms
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const body = await req.json();
    const data = roomSchema.parse(body);
   
    const room = await prisma.room.create({
      data: data as any
    });
    return Success(room, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error('Create room error:', error);
    return Error('Failed to create room');
  }
}

// PATCH /api/rooms
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return BadRequest('Room ID is required');
    }
    
    const parsedData = roomSchema.partial().parse(updateData);
    
    const room = await prisma.room.update({
      where: { id: Number(id) },
      data: parsedData as any
    });
    
    return Success(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    console.error('Update room error:', error);
    return Error('Failed to update room');
  }
}