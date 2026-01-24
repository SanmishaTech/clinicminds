// Application navigation tree definition. Items filtered at runtime based on user permissions.
// Keeps UI structure & required permissions centralized (avoid scattering nav logic).
import { PERMISSIONS } from "@/config/roles";

import {
  LayoutDashboard,
  Users,
  Settings,
  Building2,
  MapPin,
  Stethoscope,
  Pill,
  Receipt,
  Landmark,
  Package,
  Calendar,
  Truck,
  FileText,
  Archive,
} from "lucide-react";
import type { ComponentType } from "react";

export type NavLeafItem = {
  type?: "item";
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission: string; // permission required to view
};

export type NavGroupItem = {
  type: "group";
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: (NavLeafItem | NavGroupItem)[]; // support nested groups
};

export type NavItem = NavLeafItem | NavGroupItem;

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: PERMISSIONS.VIEW_DASHBOARD,
  },
  {
    title: "Appointments",
    href: "/appointments",
    icon: Calendar,
    permission: PERMISSIONS.VIEW_APPOINTMENTS,
  },
  {
    type: "group",
    title: "Master",
    icon: Building2,
    children: [
      {
        title: "States",
        href: "/states",
        icon: MapPin,
        permission: PERMISSIONS.VIEW_STATES,
      },
         {
        title: "Cities",
        href: "/cities",
        icon: MapPin,
        permission: PERMISSIONS.VIEW_CITIES,
      },
        {
        title: "Franchises",
        href: "/franchises",
        icon: Building2,
        permission: PERMISSIONS.VIEW_FRANCHISES,
      },
      {
        title: "Patients",
        href: "/patients",
        icon: Users,
        permission: PERMISSIONS.VIEW_PATIENTS,
      },
      {
        title: "Services",
        href: "/services",
        icon: Stethoscope,
        permission: PERMISSIONS.VIEW_SERVICES,
      },
      {
        title: "Brands",
        href: "/brands",
        icon: Package,
        permission: PERMISSIONS.VIEW_BRANDS,
      },
        {
        title: "Medicines",
        href: "/medicines",
        icon: Pill,
        permission: PERMISSIONS.VIEW_MEDICINES,
      },
      {
        title: "Rooms",
        href: "/rooms",
        icon: Package,
        permission: PERMISSIONS.VIEW_ROOMS,
      },
      {
        title: "Teams",
        href: "/teams",
        icon: Users,
        permission: PERMISSIONS.VIEW_TEAMS,
      },
      {
        title: "Packages",
        href: "/packages",
        icon: Package,
        permission: PERMISSIONS.VIEW_PACKAGES,
      },
    ],
  },
    {
    type: "group",
    title: "Transactions",
    icon: Landmark,
    children: [
        {   
        title: "Sales",
        href: "/sales",
        icon: Receipt,
        permission: PERMISSIONS.VIEW_SALES,
        },
        {
        title: "Transports",
        href: "/transports",
        icon: Truck,
        permission: PERMISSIONS.VIEW_TRANSPORTS,
        },
        {
        title: "Stocks",
        href: "/stocks",
        icon: Package,
        permission: PERMISSIONS.VIEW_STOCKS,
        },
    ],
  },
  {
    type: "group",
    title: "Reports",
    icon: FileText,
    children:[
      {
        title:"Closing Stock",
        icon: Archive,
        href:"/reports/closing-stock",
        permission: PERMISSIONS.VIEW_CLOSING_STOCK,
      }
    ]
  },
  {
    type: "group",
    title: "Settings",

    icon: Settings,
    children: [
      // {
      //   title: "Roles",
      //   href: "/roles",
      //   icon: Users,
      //   permission: PERMISSIONS.VIEW_ROLES,
      // },
      {
        title: "Users",
        href: "/users",
        icon: Users,
        permission: PERMISSIONS.VIEW_USERS,
      },
    ],
  },

  
];
