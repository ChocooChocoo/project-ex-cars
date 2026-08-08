"use client";

import Link from "next/link";

import { Car, MessageSquare, ReceiptText, Sparkles } from "lucide-react";

import { rolePath } from "@/lib/routing/paths";
import { cn } from "@/lib/utils";

interface CustomerHeaderProps {
  readonly userRole: string;
}

export function CustomerHeader({ userRole }: CustomerHeaderProps) {
  const links = [
    { href: rolePath(userRole, "/showroom"), label: "Showroom", icon: Car },
    { href: rolePath(userRole, "/inquiries"), label: "My Inquiries", icon: MessageSquare },
    { href: rolePath(userRole, "/recommendations"), label: "Find Your Car", icon: Sparkles },
    { href: rolePath(userRole, "/my-transactions"), label: "Transactions", icon: ReceiptText },
  ];

  if (userRole === "supplier") {
    links.push({ href: rolePath(userRole, "/supplier-messages"), label: "Supplier Messages", icon: MessageSquare });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
        <Link href={rolePath(userRole, "/showroom")} className="flex items-center gap-2 font-semibold text-sm">
          <Car className="size-4" />
          <span>GCE Auto</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                "text-muted-foreground hover:text-foreground",
              )}
            >
              <link.icon className="size-3.5" />
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
