// Access control configuration: declarative page + API prefix -> required permission mapping
// Provides longest-prefix rule resolution via findAccessRule for client guards (and future middleware).
// No side effects; consumed by hooks (useProtectPage) & guardApiAccess.
import { PERMISSIONS } from "@/config/roles";

// Page (app router) path prefix -> required permissions (ALL must pass)
// Order no longer matters once longest-prefix logic below is applied, but keep specific before general for readability.
export const PAGE_ACCESS_RULES: { prefix: string; permissions: string[] }[] = [
  // Dashboard
  { prefix: "/dashboard", permissions: [PERMISSIONS.VIEW_DASHBOARD] },
  { prefix: "/users/new", permissions: [PERMISSIONS.EDIT_USERS] }, // create user page
  { prefix: "/users/", permissions: [PERMISSIONS.EDIT_USERS] }, // edit user pages (/users/:id/...)
  { prefix: "/users", permissions: [PERMISSIONS.READ_USERS] }, // users list (view only)

  { prefix: "/patients/new", permissions: [PERMISSIONS.EDIT_PATIENTS] },
  { prefix: "/patients/", permissions: [PERMISSIONS.EDIT_PATIENTS] },
  { prefix: "/patients", permissions: [PERMISSIONS.READ_PATIENTS] },

  { prefix: "/franchises/new", permissions: [PERMISSIONS.EDIT_FRANCHISES] },
  { prefix: "/franchises/", permissions: [PERMISSIONS.EDIT_FRANCHISES] },
  { prefix: "/franchises", permissions: [PERMISSIONS.READ_FRANCHISES] },

  { prefix: "/states/new", permissions: [PERMISSIONS.EDIT_STATES] },
  { prefix: "/states/", permissions: [PERMISSIONS.EDIT_STATES] },
  { prefix: "/states", permissions: [PERMISSIONS.READ_STATES] },

  { prefix: "/cities/new", permissions: [PERMISSIONS.EDIT_CITIES] },
  { prefix: "/cities/", permissions: [PERMISSIONS.EDIT_CITIES] },
  { prefix: "/cities", permissions: [PERMISSIONS.READ_CITIES] },

  { prefix: "/sales/new", permissions: [PERMISSIONS.CREATE_SALES] },
  { prefix: "/sales/", permissions: [PERMISSIONS.EDIT_SALES] },
  { prefix: "/sales", permissions: [PERMISSIONS.READ_SALES] },

  { prefix: "/transports/new", permissions: [PERMISSIONS.CREATE_TRANSPORTS] },
  { prefix: "/transports/", permissions: [PERMISSIONS.EDIT_TRANSPORTS] },
  { prefix: "/transports", permissions: [PERMISSIONS.READ_TRANSPORTS] },

  { prefix: "/recalls", permissions: [PERMISSIONS.CREATE_STOCKS] },

  { prefix: "/stocks", permissions: [PERMISSIONS.READ_STOCKS] },

  { prefix: "/medicines/new", permissions: [PERMISSIONS.CREATE_MEDICINES] },
  { prefix: "/medicines/", permissions: [PERMISSIONS.EDIT_MEDICINES] },
  { prefix: "/medicines", permissions: [PERMISSIONS.READ_MEDICINES] },
  { prefix: "/services/new", permissions: [PERMISSIONS.CREATE_SERVICES] },
  { prefix: "/services/", permissions: [PERMISSIONS.EDIT_SERVICES] },
  { prefix: "/services", permissions: [PERMISSIONS.READ_SERVICES] },

  { prefix: "/brands/new", permissions: [PERMISSIONS.CREATE_BRANDS] },
  { prefix: "/brands/", permissions: [PERMISSIONS.EDIT_BRANDS] },
  { prefix: "/brands", permissions: [PERMISSIONS.READ_BRANDS] },

  { prefix: "/packages/new", permissions: [PERMISSIONS.CREATE_PACKAGES] },
  { prefix: "/packages/", permissions: [PERMISSIONS.EDIT_PACKAGES] },
  { prefix: "/packages", permissions: [PERMISSIONS.READ_PACKAGES] },

  { prefix: "/appointments/new", permissions: [PERMISSIONS.CREATE_APPOINTMENTS] },
  { prefix: "/appointments/", permissions: [PERMISSIONS.EDIT_APPOINTMENTS] },
  { prefix: "/appointments", permissions: [PERMISSIONS.READ_APPOINTMENTS] },

  // Consultations (nested under appointments)
  { prefix: "/consultations/", permissions: [PERMISSIONS.CREATE_CONSULTATIONS, PERMISSIONS.EDIT_CONSULTATIONS] },
  { prefix: "/consultations", permissions: [PERMISSIONS.READ_CONSULTATIONS] },
  { prefix: "/reports/closing-stock", permissions: [PERMISSIONS.READ_CLOSING_STOCK] },

  { prefix: "/medicine-bills", permissions: [PERMISSIONS.READ_MEDICINE_BILLS] },
  { prefix: "/medicine-bills/new", permissions: [PERMISSIONS.CREATE_MEDICINE_BILLS] },

  { prefix: "/labs/new", permissions: [PERMISSIONS.CREATE_LABS] },
  { prefix: "/labs/", permissions: [PERMISSIONS.EDIT_LABS] },
  { prefix: "/labs", permissions: [PERMISSIONS.READ_LABS] },
  
];

// API route path prefix -> required permissions (ALL must pass)
// NOTE: '/api/users' will also match '/api/users/...'
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Method-aware API rules. If methods map present, use per-method permissions; else fall back to permissions.
export type ApiAccessRule = {
  prefix: string; // path prefix
  permissions?: Permission[]; // fallback permissions (ALL must pass)
  methods?: Partial<Record<string, Permission[]>>; // e.g. { GET: [...], POST: [...] }
};

export const API_ACCESS_RULES: ApiAccessRule[] = [
  // Current user profile (auth only)
  {
    prefix: "/api/me",
    methods: {
      GET: [],
      PATCH: [],
    },
  },
  {
    prefix: "/api/patients",
    methods: {
      GET: [PERMISSIONS.READ_PATIENTS],
      POST: [PERMISSIONS.EDIT_PATIENTS],
      PATCH: [PERMISSIONS.EDIT_PATIENTS],
      DELETE: [PERMISSIONS.DELETE_PATIENTS],
    },
  },
  {
    prefix: "/api/users",
    methods: {
      GET: [PERMISSIONS.READ_USERS],
      POST: [PERMISSIONS.EDIT_USERS],
      PATCH: [PERMISSIONS.EDIT_USERS],
      DELETE: [PERMISSIONS.DELETE_USERS],
    },
  },
  {
    prefix: "/api/franchises",
    methods: {
      GET: [PERMISSIONS.READ_FRANCHISES],
      POST: [PERMISSIONS.EDIT_FRANCHISES],
      PATCH: [PERMISSIONS.EDIT_FRANCHISES],
      DELETE: [PERMISSIONS.DELETE_FRANCHISES],
    },
  },
  {
    prefix: "/api/states",
    methods: {
      GET: [PERMISSIONS.READ_STATES],
      POST: [PERMISSIONS.EDIT_STATES],
      PATCH: [PERMISSIONS.EDIT_STATES],
      DELETE: [PERMISSIONS.DELETE_STATES],
    },
  },
  {
    prefix: "/api/cities",
    methods: {
      GET: [PERMISSIONS.READ_CITIES],
      POST: [PERMISSIONS.EDIT_CITIES],
      PATCH: [PERMISSIONS.EDIT_CITIES],
      DELETE: [PERMISSIONS.DELETE_CITIES],
    },
  },
  {
    prefix: "/api/sales",
    methods: {
      GET: [PERMISSIONS.READ_SALES],
      POST: [PERMISSIONS.CREATE_SALES],
      PATCH: [PERMISSIONS.EDIT_SALES],
      DELETE: [PERMISSIONS.DELETE_SALES],
    },
  },
  {
    prefix: "/api/transports",
    methods: {
      GET: [PERMISSIONS.READ_TRANSPORTS],
      POST: [PERMISSIONS.CREATE_TRANSPORTS],
      PATCH: [PERMISSIONS.EDIT_TRANSPORTS],
      DELETE: [PERMISSIONS.DELETE_TRANSPORTS],
    },
  },
  {
    prefix: "/api/admin-stocks/rows",
    methods: {
      GET: [PERMISSIONS.READ_STOCKS],
    },
  },
  {
    prefix: "/api/admin-stocks/refill",
    methods: {
      POST: [PERMISSIONS.CREATE_STOCKS],
    },
  },
  {
    prefix: "/api/stocks",
    methods: {
      GET: [PERMISSIONS.READ_STOCKS],
      POST: [PERMISSIONS.CREATE_STOCKS],
    },
  },
  {
    prefix: "/api/recalls",
    methods: {
      GET: [PERMISSIONS.CREATE_STOCKS],
    },
  },
  {
    prefix: "/api/medicines",
    methods: {
      GET: [PERMISSIONS.READ_MEDICINES],
      POST: [PERMISSIONS.CREATE_MEDICINES],
      PATCH: [PERMISSIONS.EDIT_MEDICINES],
      DELETE: [PERMISSIONS.DELETE_MEDICINES],
    },
  },
  {
    prefix: "/api/services",
    methods: {
      GET: [PERMISSIONS.READ_SERVICES],
      POST: [PERMISSIONS.CREATE_SERVICES],
      PATCH: [PERMISSIONS.EDIT_SERVICES],
      DELETE: [PERMISSIONS.DELETE_SERVICES],
    },
  },
  {
    prefix: "/api/brands",
    methods: {
      GET: [PERMISSIONS.READ_BRANDS],
      POST: [PERMISSIONS.CREATE_BRANDS],
      PATCH: [PERMISSIONS.EDIT_BRANDS],
      DELETE: [PERMISSIONS.DELETE_BRANDS],
    },
  },
  {
    prefix: "/api/rooms",
    methods: {
      GET: [PERMISSIONS.READ_ROOMS],
      POST: [PERMISSIONS.CREATE_ROOMS],
      PATCH: [PERMISSIONS.EDIT_ROOMS],
      DELETE: [PERMISSIONS.DELETE_ROOMS],
    },
  },
  {
    prefix: "/api/teams",
    methods: {
      GET: [PERMISSIONS.READ_TEAMS],
      POST: [PERMISSIONS.CREATE_TEAMS],
      PATCH: [PERMISSIONS.EDIT_TEAMS],
      DELETE: [PERMISSIONS.DELETE_TEAMS],
    },
  },
  {
    prefix: "/api/packages",
    methods: {
      GET: [PERMISSIONS.READ_PACKAGES],
      POST: [PERMISSIONS.CREATE_PACKAGES],
      PATCH: [PERMISSIONS.EDIT_PACKAGES],
      DELETE: [PERMISSIONS.DELETE_PACKAGES],
    },
  },
  {
    prefix: "/api/appointments",
    methods: {
      GET: [PERMISSIONS.READ_APPOINTMENTS],
      POST: [PERMISSIONS.CREATE_APPOINTMENTS],
      PATCH: [PERMISSIONS.EDIT_APPOINTMENTS],
      DELETE: [PERMISSIONS.DELETE_APPOINTMENTS],
    },
  },
  {
    prefix: "/api/consultations",
    methods: {
      GET: [PERMISSIONS.READ_CONSULTATIONS],
      POST: [PERMISSIONS.CREATE_CONSULTATIONS],
      PATCH: [PERMISSIONS.EDIT_CONSULTATIONS],
      DELETE: [PERMISSIONS.DELETE_CONSULTATIONS],
    },
  },
  {
    prefix: "/api/reports/closing-stock",
    methods: {
      GET: [PERMISSIONS.READ_CLOSING_STOCK],
    },
  },
  {
    prefix: "/api/medicine-bills",
    methods:{
      GET: [PERMISSIONS.READ_MEDICINE_BILLS],
      POST: [PERMISSIONS.CREATE_MEDICINE_BILLS],
    }
  },
  {
    prefix: "/api/labs",
    methods:{
      GET: [PERMISSIONS.READ_LABS],
      POST: [PERMISSIONS.CREATE_LABS],
      PATCH: [PERMISSIONS.EDIT_LABS],
      DELETE: [PERMISSIONS.DELETE_LABS],
    }
  }
];

export type AccessRuleMatch = {
  permissions: Permission[];
  type: "page" | "api";
};

// Cache for access rule lookups to avoid repeated computation
const accessRuleCache = new Map<string, AccessRuleMatch | null>();

// Longest-prefix matcher so that more specific rules override broader ones automatically.
export function findAccessRule(pathname: string): AccessRuleMatch | null {
  // Check cache first
  if (accessRuleCache.has(pathname)) {
    return accessRuleCache.get(pathname) || null;
  }

  let result: AccessRuleMatch | null = null;

  if (pathname.startsWith("/api/")) {
    let match: ApiAccessRule | undefined;
    for (const r of API_ACCESS_RULES) {
      if (pathname.startsWith(r.prefix)) {
        if (!match || r.prefix.length > match.prefix.length) match = r;
      }
    }
    if (match) {
      const perms = match.methods?.["GET"] || match.permissions || [];
      result = { permissions: perms, type: "api" };
    }
  } else {
    let match: { prefix: string; permissions: string[] } | undefined;
    for (const r of PAGE_ACCESS_RULES) {
      if (pathname.startsWith(r.prefix)) {
        if (!match || r.prefix.length > match.prefix.length) match = r;
      }
    }
    if (match)
      result = { permissions: match.permissions as Permission[], type: "page" };
  }

  // Cache the result
  accessRuleCache.set(pathname, result);
  return result;
}

// Guard functions live in lib/access-guard.ts – this file is purely declarative configuration + rule lookup.
