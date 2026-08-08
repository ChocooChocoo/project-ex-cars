import { SellVehicleForm } from "./_components/sell-vehicle-form";

export default async function SellVehiclePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Sell Your Vehicle</h1>
        <p className="text-muted-foreground text-sm">
          Submit your vehicle for evaluation. A mechanic will inspect it and a Sales Manager will review.
        </p>
      </div>
      <div className="max-w-xl">
        <SellVehicleForm />
      </div>
    </div>
  );
}
