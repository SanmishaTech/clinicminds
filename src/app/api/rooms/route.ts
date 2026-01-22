// src/app/api/rooms/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Success, Error as ApiError, BadRequest } from '@/lib/api-response';
import { guardApiAccess } from '@/lib/access-guard';
import { z } from 'zod';
import { paginate } from '@/lib/paginate';
import { roomSchema } from '@/lib/schemas/backend/rooms';

// GET /api/rooms
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  
  // Get current user's franchise ID, role, and team
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    return ApiError("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return ApiError("Current user is not associated with any franchise", 400);
  }

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
    franchiseId,
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
    return ApiError('Failed to fetch rooms');
  }
}

// POST /api/rooms
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  
  // Get current user's franchise ID, role, and team
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    return ApiError("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return ApiError("Current user is not associated with any franchise", 400);
  }

  try {
    const body = await req.json();
    const data = roomSchema.parse(body);

    const existingRoomByName = await prisma.room.findFirst({
      where: { name: data.name, franchiseId },
      select: { id: true },
    });
    if (existingRoomByName) return ApiError('Room name already exists', 409);
   
    const room = await prisma.room.create({
      data: {
        ...data,
        franchiseId
      }
    });
    return Success(room, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    const err = error as { code?: string };
    if (err?.code === 'P2002') return ApiError('Room name already exists', 409);
    console.error('Create room error:', error);
    return ApiError('Failed to create room');
  }
}

// PATCH /api/rooms
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  
  // Get current user's franchise ID, role, and team
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { 
      id: true,
      role: true,
      franchise: {
        select: { id: true }
      },
      team: {
        select: { 
          id: true,
          franchise: {
            select: { id: true }
          }
        }
      }
    }
  });

  if (!currentUser) {
    return ApiError("Current user not found", 404);
  }

  // Get franchise ID from either direct assignment or through team
  const franchiseId = currentUser.franchise?.id || currentUser.team?.franchise?.id;
  
  if (!franchiseId) {
    return ApiError("Current user is not associated with any franchise", 400);
  }
  
  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return BadRequest('Room ID is required');
    }
    
    // Verify the room belongs to the user's franchise
    const existingRoom = await prisma.room.findUnique({
      where: { id: Number(id) },
      select: { franchiseId: true }
    });

    if (!existingRoom) {
      return ApiError("Room not found", 404);
    }

    if (existingRoom.franchiseId !== franchiseId) {
      return ApiError("Room does not belong to your franchise", 403);
    }
    
    const parsedData = roomSchema.partial().parse(updateData);

    if (typeof parsedData.name === 'string') {
      const existingRoomByName = await prisma.room.findFirst({
        where: { name: parsedData.name, franchiseId, NOT: { id: Number(id) } },
        select: { id: true },
      });
      if (existingRoomByName) return ApiError('Room name already exists', 409);
    }
    
    const room = await prisma.room.update({
      where: { id: Number(id) },
      data: parsedData as any
    });
    
    return Success(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return BadRequest(error.errors);
    }
    const err = error as { code?: string };
    if (err?.code === 'P2025') return ApiError('Room not found', 404);
    if (err?.code === 'P2002') return ApiError('Room name already exists', 409);
    console.error('Update room error:', error);
    return ApiError('Failed to update room');
  }
}