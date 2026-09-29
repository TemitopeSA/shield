export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[9px] bg-brand shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path d="M12 2.5 4.5 5.4v6.1c0 4.7 3.1 8.6 7.5 10 4.4-1.4 7.5-5.3 7.5-10V5.4L12 2.5Z" fill="#121211" />
        <path d="M8.4 12.2 11 14.8l4.8-5" stroke="#FCD535" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
