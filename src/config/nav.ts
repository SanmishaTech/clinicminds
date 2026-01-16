// Application navigation tree definition. Items filtered at runtime based on user permissions.
// Keeps UI structure & required permissions centralized (avoid scattering nav logic).
import { PERMISSIONS } from "@/config/roles";

import {
  LayoutDashboard,
  Users,
  Settings,
  Building2,
  MapPin,
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
      {
        title: "Franchises",
        href: "/franchises",
        icon: Building2,
        permission: PERMISSIONS.VIEW_FRANCHISES,
      },
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
    ],
  },
];
