"use client";

import { useSyncExternalStore } from "react";

import { getClientCookie } from "@/lib/cookie.client";

import { mails } from "./_components/data";
import { MailComponent } from "./_components/mail";
import { DEFAULT_MAIL_LAYOUT, MAIL_LAYOUT_COOKIE } from "./_components/mail-layout-config";

const noop = () => () => undefined;

export default function Page() {
  // Read in the browser (static build); null during the build-time render, so the layout waits for it.
  const layoutCookie = useSyncExternalStore(
    noop,
    () => getClientCookie(MAIL_LAYOUT_COOKIE) ?? "",
    () => null,
  );
  if (layoutCookie === null) return null;

  return (
    <div className="h-dvh min-h-0 overflow-hidden">
      <MailComponent
        mails={mails}
        defaultLayout={layoutCookie ? JSON.parse(decodeURIComponent(layoutCookie)) : [...DEFAULT_MAIL_LAYOUT]}
      />
    </div>
  );
}
