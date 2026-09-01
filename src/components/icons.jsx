export function VerifiedIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="#1D9BF0" />
      <path
        fill="white"
        d="M7.5 12.1l3 3 5-4-1-1-4 3.5-2-1.9z"
        transform="translate(0 1)"
      />
    </svg>
  );
}

export function ShieldIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 1l9 4v6c0 5-3.5 9.5-9 11-5.5-1.5-9-6-9-11z"
      />
      <path
        fill="white"
        d="M10.5 15.6l5.5-3.5-1-1.7-4.5 2.9-2.1-1.1z"
      />
    </svg>
  );
}
