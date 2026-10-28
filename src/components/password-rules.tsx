import { Check, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "@/lib/validation/forms";

const RULES = [{ label: "At least 8 characters", test: (value: string) => value.length >= 8 }].concat(
  PASSWORD_RULES.map((rule) => ({ label: rule.label, test: (value: string) => rule.pattern.test(value) })),
);

// Live checklist shown under a new-password field. Same rules as `newPasswordSchema`.
export function PasswordRules({ value, id }: { readonly value: string; readonly id?: string }) {
  return (
    <ul id={id} className="flex flex-col gap-1 text-muted-foreground text-xs">
      {RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.label} className={cn("flex items-center gap-1.5", met && "text-foreground")}>
            {met ? (
              <Check className="size-3.5 text-primary" aria-hidden />
            ) : (
              <Circle className="size-3.5" aria-hidden />
            )}
            {rule.label}
            <span className="sr-only">{met ? "(done)" : "(missing)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
