"use client";

import React from "react";
import { Sidebar, Header } from "../components/Navigation";
import { ThemeProvider } from "../components/ThemeToggle";
import MobileTabBar from "./MobileTabBar";

interface AppShellProps {
  children: React.ReactNode;
  userName?: string;
  userInitials?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  onNotificationClick?: () => void;
  unreadCount?: number;
}

export default function AppShell({
  children,
  userName = "User",
  userInitials = "U",
  avatarUrl,
  isAdmin = false,
  onNotificationClick,
  unreadCount = 0,
}: AppShellProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <Sidebar
          userName={userName}
          userInitials={userInitials}
          avatarUrl={avatarUrl}
          isAdmin={isAdmin}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header */}
          <Header
            onNotificationClick={onNotificationClick}
            unreadCount={unreadCount}
            isAdmin={isAdmin}
          />

          {/* Scrollable page content */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar */}
        <MobileTabBar isAdmin={isAdmin} />
      </div>
    </ThemeProvider>
  );
}
