/** Monograma vetorial: um G construído como um mostrador de instrumentos. */
export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="var(--primary)" />
      <path d="M29 13a12 12 0 1 0 2.5 12H21v-5h15v5" stroke="var(--primary-fg)" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="m20 17 6-7" stroke="var(--primary-fg)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
