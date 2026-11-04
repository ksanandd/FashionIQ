"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      } else if (requireAdmin && !isAdmin) {
        router.replace("/");
      }
    }
  }, [loading, isAuthenticated, isAdmin, requireAdmin, router, pathname]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
        <p className="mt-4 text-xs font-medium text-gray-500">Checking credentials...</p>
      </main>
    );
  }

  if (!isAuthenticated || (requireAdmin && !isAdmin)) {
    return null;
  }

  return <>{children}</>;
}
