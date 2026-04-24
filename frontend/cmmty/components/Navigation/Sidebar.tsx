"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Map,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  userName?: string;
  userInitials?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/map", label: "Map", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminLink = { href: "/admin", label: "Admin", icon: ShieldCheck };

export default function Sidebar({
  userName = "User",
  userInitials = "U",
  avatarUrl,
  isAdmin = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const links = isAdmin ? [...navLinks, adminLink] : navLinks;

  return (
    <aside
      className={`hidden md:flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        {!collapsed && (
          <span className="text-lg font-bold text-indigo-600">SMALDA</span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md mx-2 transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName}
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {userInitials}
          </div>
        )}
        {!collapsed && (
          <span className="text-sm text-gray-700 truncate">{userName}</span>
        )}
      </div>
    </aside>
  );
}
