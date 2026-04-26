"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Map,
  Settings,
} from "lucide-react";

interface MobileTabBarProps {
  isAdmin?: boolean;
}

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/map", label: "Map", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MobileTabBar({ isAdmin = false }: MobileTabBarProps) {
  const pathname = usePathname();
  const visibleTabs = isAdmin
    ? tabs
    : tabs;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom"
      aria-label="Mobile navigation"
      role="tablist"
    >
      <div className="flex items-center justify-around h-16">
        {visibleTabs.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              role="tab"
              aria-selected={active}
              aria-label={label}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-2 py-1 rounded-lg transition-colors ${
                active
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700 active:text-indigo-500"
              }`}
            >
              <Icon size={22} className="shrink-0" />
              <span className="text-[10px] font-medium mt-0.5 leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
