
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MountainIcon, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type UserStatus = "ADMIN" | "USER" | "UNKNOWN";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  const base64Url = parts[1] ?? "";
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  const json = atob(padded);
  const parsed: unknown = JSON.parse(json);
  if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  return null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function getStatusFromToken(token: string | null): UserStatus {
  if (!token) return "UNKNOWN";

  try {
    const payload = decodeJwtPayload(token);
    const user = getRecord(payload?.user);

    const rawStatus: unknown =
      payload?.status ?? payload?.role ?? user?.status ?? user?.role;

    const normalized = String(rawStatus ?? "").toUpperCase();
    if (normalized === "ADMIN") return "ADMIN";
    if (normalized === "USER") return "USER";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("token");
    Promise.resolve().then(() => setToken(stored));
  }, []);

  const hasToken = !!token;
  const userStatus = useMemo(() => getStatusFromToken(token), [token]);

  const menuItems = useMemo(() => {
    const items = [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/download", label: "Download" },
      { href: "/upload", label: "Upload" },
    ];

    if (userStatus === "ADMIN") {
      items.push({ href: "/user-management", label: "Usermanagement" });
    }

    return items;
  }, [userStatus]);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <MountainIcon className="h-8 w-8 text-gray-800" />
            <span className="ml-2 text-lg font-semibold text-gray-800">
              MTB Cluster Detection
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  pathname === item.href
                    ? "border-indigo-500 text-gray-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {hasToken ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/config">Configuration</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild>
                <Link href="/login">Login</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

