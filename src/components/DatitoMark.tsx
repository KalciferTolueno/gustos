type DatitoMarkProps = {
  className?: string;
};

export function DatitoMark({ className }: DatitoMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="60" height="60" x="2" y="2" rx="18" fill="#d9ff81" />
      <path
        fill="#0b0c0e"
        fillRule="evenodd"
        d="M17 13h13c11.6 0 21 8.06 21 19 0 7.84-4.83 14.42-12 17.36L29 55v-4H17V13Zm9 9v20h4c7.31 0 12-3.91 12-10s-4.69-10-12-10h-4Z"
        clipRule="evenodd"
      />
      <circle cx="33" cy="32" r="3.5" fill="#ff6e4a" />
    </svg>
  );
}
