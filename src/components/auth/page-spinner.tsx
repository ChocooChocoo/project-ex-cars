import { Spinner } from "@/components/ui/spinner";

/** Full-screen loading state while the session is checked (the static build has no server to wait on). */
export function PageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}
