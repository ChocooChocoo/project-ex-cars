import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getInitials = (str: string): string => {
  if (typeof str !== "string" || !str.trim()) return "?";

  return (
    str
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
};

export function formatCurrency(
  amount: number,
  opts?: {
    currency?: string;
    locale?: string;
    currencyDisplay?: "code" | "symbol" | "narrowSymbol" | "name";
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    noDecimals?: boolean;
  },
) {
  const {
    currency = "PHP",
    locale = "en-PH",
    currencyDisplay = "symbol",
    minimumFractionDigits,
    maximumFractionDigits,
    noDecimals,
  } = opts ?? {};

  const formatOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    currencyDisplay,
    minimumFractionDigits: noDecimals ? 0 : minimumFractionDigits,
    maximumFractionDigits: noDecimals ? 0 : maximumFractionDigits,
  };

  return new Intl.NumberFormat(locale, formatOptions).format(amount);
}

// Amount fields are entered in pesos and stored in centavos (tables divide by 100 to display).
export function toCents(pesos: string): string {
  const value = Number(pesos);
  return Number.isFinite(value) ? String(Math.round(value * 100)) : pesos;
}
