"use client";

import * as React from "react";

import { createPortal } from "react-dom";

// The printed copy only. Outside print the root is hidden by `[data-print-root]` in globals.css, and in
// print every other child of <body> is hidden, so the sheet is all that reaches the printer.
export function PrintPaper({ children }: { readonly children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(<div data-print-root>{children}</div>, document.body);
}
