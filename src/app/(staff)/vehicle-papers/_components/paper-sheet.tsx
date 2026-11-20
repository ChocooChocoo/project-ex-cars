import type { PaperDocument } from "@/lib/papers/templates";
import { GCE_SELLER } from "@/lib/transactions/buy-flow";
import { cn } from "@/lib/utils";

// One Letter-size sheet. The same component is shown on screen and printed, so the preview is the paper.
// BC-2: each signature image sits on the sheet, over the line and the printed name; a paper signed with a pen
// keeps the empty line.
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
      {paper.signatures?.length ? (
        <div className="mt-6 grid grid-cols-2 gap-10">
          {paper.signatures.map((block) => (
            <div key={block.party} className="flex flex-col gap-1">
              <p className="font-semibold">{block.party}</p>
              <div className="flex h-16 items-end justify-center">
                {block.imageUrl ? (
                  // biome-ignore lint/performance/noImgElement: a short-lived signed URL printed on the sheet, not a page image
                  <img src={block.imageUrl} alt={`${block.party} signature`} className="max-h-16 object-contain" />
                ) : null}
              </div>
              <div className="border-neutral-900 border-t pt-1 text-center">
                <p>{block.name}</p>
                <p className="text-[11px] text-neutral-600">{block.caption}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
