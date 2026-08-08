import { getProfileAutoFill } from "@/lib/autofill";

import { RequestCarForm } from "./_components/request-car-form";

export default async function RequestCarPage() {
  const autofill = await getProfileAutoFill();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Request a Car</h1>
        <p className="text-muted-foreground text-sm">Tell us what you are looking for and we will find it for you.</p>
      </div>
      <div className="max-w-xl">
        <RequestCarForm autofill={autofill} />
      </div>
    </div>
  );
}
