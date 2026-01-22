// Standardized API JSON response helpers to keep consistent shapes & status codes.
// Prefer these over ad-hoc NextResponse constructions inside route handlers.
import { NextResponse } from "next/server";
import { ZodIssue } from "zod";

function sanitizeErrorMessage(message: string): string {
  const msg = String(message || "");
  const lowered = msg.toLowerCase();
  if (
    msg.includes("Invalid `prisma.") ||
    lowered.includes("does not exist in the current database") ||
    lowered.includes("database not migrated")
  ) {
    return "Database schema is out of date. Please run Prisma migrations and restart the server.";
  }
  return msg;
}

export function Success<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function Error(message: string, status: number = 500) {
  const safe = sanitizeErrorMessage(message);
  return NextResponse.json({ message: safe }, { status });
}

export function BadRequest(errors: ZodIssue[] | string) {
  if (typeof errors === 'string') {
    return NextResponse.json({ message: errors }, { status: 400 });
  }
  return NextResponse.json({ message: "Bad Request", errors }, { status: 400 });
}

export function Unauthorized(message: string = "Invalid credentials") {
  return NextResponse.json({ message }, { status: 401 });
}

export function Forbidden(message: string = "Forbidden") {
  return NextResponse.json({ message }, { status: 403 });
}

export function NotFound(message: string = "Not Found") {
  return NextResponse.json({ message }, { status: 404 });
}
