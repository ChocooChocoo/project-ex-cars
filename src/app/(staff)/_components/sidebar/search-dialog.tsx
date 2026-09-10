"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type GceRole, ROLE_NAV_ACCESS } from "@/lib/auth/roles";
import { rolePath } from "@/lib/routing/paths";
import type { NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

export type SearchItem = {
  id: string;
  group: string;
  label: string;
  url: string;
  icon?: NavMainItem["icon"];
  disabled?: boolean;
  newTab?: boolean;
};

const sidebarGroupLabels = new Set(sidebarItems.flatMap((group) => (group.label ? [group.label] : [])));

function getSubItemGroup(groupLabel: string | undefined, itemTitle: string) {
  return sidebarGroupLabels.has(itemTitle) ? (groupLabel ?? "Other") : itemTitle;
}

export function getSearchItems(userRole?: string | null): SearchItem[] {
  // Strict by default: a missing or unknown role gets no results rather than the
  // full catalog, so role-restricted routes (e.g. the Account Manager-only
  // Create Walk-In deep link) can never leak through search.
  const access: Set<string> | "all" = userRole
    ? (ROLE_NAV_ACCESS[userRole as GceRole] ?? new Set<string>())
    : new Set<string>();

  if (access !== "all" && access.size === 0) return [];

  return sidebarItems.flatMap((group) =>
    group.items.flatMap((item) => {
      if (item.subItems) {
        const subItems =
          access === "all" || access.has(item.id)
            ? item.subItems
            : item.subItems.filter((subItem) => access.has(subItem.id));

        return subItems.map((sub) => ({
          id: sub.id,
          group: getSubItemGroup(group.label, item.title),
          label: sub.title,
          url: userRole ? rolePath(userRole, sub.url) : sub.url,
          icon: item.icon,
          disabled: sub.disabled,
          newTab: sub.newTab,
        }));
      }

      if (access !== "all" && !access.has(item.id)) return [];

      return [
        {
          id: item.id,
          group: group.label ?? "Other",
          label: item.title,
          url: userRole ? rolePath(userRole, item.url) : item.url,
          icon: item.icon,
          disabled: item.disabled,
          newTab: item.newTab,
        },
      ];
    }),
  );
}

function getAvailableItems(items: SearchItem[]) {
  return items.filter((item) => !item.disabled && !item.url.includes("coming-soon"));
}

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((item) => item.group))];
  return groups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));
}

export function SearchDialog({ userRole }: { readonly userRole?: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const searchItems = React.useMemo(() => getSearchItems(userRole), [userRole]);
  const recommendations = React.useMemo(() => getAvailableItems(searchItems), [searchItems]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  };

  const handleSelect = (item: SearchItem) => {
    if (item.disabled) return;
    handleOpenChange(false);
    if (item.newTab) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.url);
    }
  };

  const renderGroups = (items: SearchItem[]) =>
    groupBy(items).map(({ group, items: groupItems }, index) => (
      <React.Fragment key={group}>
        {index > 0 && <CommandSeparator />}
        <CommandGroup heading={group}>
          {groupItems.map((item) => (
            <CommandItem
              disabled={item.disabled}
              key={`${group}-${item.id}`}
              value={`${item.group} ${item.label}`}
              onSelect={() => handleSelect(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && <item.icon />}
                <span className="truncate">{item.label}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </React.Fragment>
    ));

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        variant="link"
        className="px-0! font-normal text-muted-foreground hover:no-underline"
      >
        <Search data-icon="inline-start" />
        Search
        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <Command>
          <CommandInput placeholder="Search dashboards, users, and more…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {query ? renderGroups(searchItems) : renderGroups(recommendations)}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
