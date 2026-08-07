import type { ReactNode } from "react";

import { CustomerHeader } from "@/app/(main)/_components/customer-header";

export default function ShowroomLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
