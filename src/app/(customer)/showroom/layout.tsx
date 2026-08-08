import type { ReactNode } from "react";

import { getCurrentRole } from "@/app/auth/actions";
import { CustomerHeader } from "@/app/(customer)/_components/customer-header";

export default async function ShowroomLayout({ children }: Readonly<{ children: ReactNode }>) {
  const role = (await getCurrentRole()) ?? "customer";

  return (
    <>
      <CustomerHeader userRole={role} />
      {children}
    </>
  );
}
