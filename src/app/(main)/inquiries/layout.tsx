import type { ReactNode } from "react";

import { CustomerHeader } from "@/app/(main)/_components/customer-header";
import { getCurrentRole } from "@/app/(main)/auth/actions";

export default async function InquiriesLayout({ children }: Readonly<{ children: ReactNode }>) {
  const role = (await getCurrentRole()) ?? "customer";

  return (
    <>
      <CustomerHeader userRole={role} />
      {children}
    </>
  );
}
