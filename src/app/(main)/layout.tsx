"use client";

import { usePathname } from "next/navigation";

import { CustomerHeader } from "./_components/customer-header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/auth") ||
    path.startsWith("/chat") ||
    path.startsWith("/mail")
  ) {
    return <>{children}</>;
  }

  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
