import type { SVGProps } from "react";

// GCE mark: the initials on a rounded square in the current text colour, so it follows the theme and the
// sidebar's icon sizing.
// letterColor sets the initials' colour; use the surface colour behind the mark (default: the page background).
// compact draws only "G", for icon sizes (16px) where three letters cannot be read.
export function GceLogo({
  letterColor = "var(--background, #fff)",
  compact = false,
  ...props
}: SVGProps<SVGSVGElement> & { readonly letterColor?: string; readonly compact?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="GCE" {...props}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <text
        x="16"
        y={compact ? 23 : 20.5}
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize={compact ? 20 : 12}
        fontWeight="700"
        letterSpacing="-0.4"
        fill={letterColor}
      >
        {compact ? "G" : "GCE"}
      </text>
    </svg>
  );
}
