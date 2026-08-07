import type { ReactNode } from "react";

import { CustomerHeader } from "@/app/(main)/_components/customer-header";

export default function InquiriesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
