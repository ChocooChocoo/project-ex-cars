"use client";

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { TransactionPaper, type TransactionPaperProps } from "./transaction-paper";

export function PrintTransaction({ paper }: { readonly paper: TransactionPaperProps }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div data-print-root>
      <TransactionPaper {...paper} />
    </div>,
    document.body,
  );
}
