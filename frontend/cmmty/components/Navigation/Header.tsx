"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Bell, LayoutDashboard, FileText, Upload, Map, Settings, ShieldCheck } from "lucide-react";

interface HeaderProps {
  onNotificationClick?: () => void;
  unreadCount?: number;
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

export default function Header({ onNotificationClick, unreadCount = 0, isAdmin = false }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const links = isAdmin ? [...navLinks, adminLink] : navLinks;

  return (
    <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <span className="text-lg font-bold text-indigo-600">SMALDA</span>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          onClick={onNotificationClick}
          className="relative p-1 text-gray-500 hover:text-gray-700"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-1 text-gray-500 hover:text-gray-700"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <nav className="absolute top-14 left-0 right-0 bg-white border-b border-gray-200 z-50 py-2 shadow-md">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-5 py-3 text-sm font-medium ${
                  active ? "text-indigo-700 bg-indigo-50" : "text-gray-700 hover:bg-gray-50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
