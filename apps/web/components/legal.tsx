import type { ReactNode } from "react";
import { CONTACT_EMAIL, LEGAL_UPDATED_AT } from "../lib/site";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-8 py-4">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-xs text-zinc-500">最后更新：{LEGAL_UPDATED_AT}</p>
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function ContactEmail() {
  if (!CONTACT_EMAIL) {
    return <span data-testid="contact-email-placeholder">【联系邮箱待补充】</span>;
  }
  return (
    <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  );
}
