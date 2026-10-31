import type { PaperDocument } from "@/lib/papers/templates";
import { GCE_SELLER } from "@/lib/transactions/buy-flow";
import { cn } from "@/lib/utils";

// One Letter-size sheet. The same component is shown on screen and printed, so the preview is the paper.
export function PaperSheet({ paper, className }: { readonly paper: PaperDocument; readonly className?: string }) {
  return (
    <article
      data-print-paper
      className={cn(
        "flex min-h-[11in] w-[8.5in] flex-col gap-6 bg-white px-12 py-11 font-serif text-[13px] text-neutral-950 leading-relaxed",
        className,
      )}
    >
      <header className="flex flex-col gap-1 border-neutral-300 border-b pb-4">
        <p className="font-sans text-[10px] text-neutral-500 uppercase tracking-[0.18em]">{GCE_SELLER}</p>
        <h2 className="font-semibold text-xl uppercase tracking-wide">{paper.title}</h2>
      </header>
      <div className="flex flex-col gap-4">
        {paper.paragraphs.map((paragraph) => (
          <p key={paragraph} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
