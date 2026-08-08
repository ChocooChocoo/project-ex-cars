"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { LogOut, User } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/client";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/v1/login");
    router.refresh();
  }

  if (!user) return null;

  const initials =
    user.user_metadata?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ??
    user.email?.slice(0, 2).toUpperCase() ??
    "??";

  const displayName = user.user_metadata?.full_name ?? user.email ?? "User";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-medium text-sidebar-primary-foreground text-xs">
                {initials}
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">{displayName}</span>
                <span className="text-muted-foreground text-xs">{user.email}</span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="right" sideOffset={8}>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
              <User className="mr-2 size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
