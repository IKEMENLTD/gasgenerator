export default function ChartIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 3v18h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 9l-5 5-3-3-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="9" r="1.5" fill="currentColor" />
      <circle cx="13" cy="14" r="1.5" fill="currentColor" />
      <circle cx="10" cy="11" r="1.5" fill="currentColor" />
      <circle cx="6" cy="15" r="1.5" fill="currentColor" />
    </svg>
  )
}
