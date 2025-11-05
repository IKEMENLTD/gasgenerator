export default function LogoIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="#10b981" />

      {/* Robot head */}
      <rect x="30" y="30" width="40" height="35" rx="5" fill="white" />

      {/* Eyes */}
      <circle cx="40" cy="45" r="4" fill="#10b981" />
      <circle cx="60" cy="45" r="4" fill="#10b981" />

      {/* Antenna */}
      <line x1="50" y1="25" x2="50" y2="30" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="23" r="3" fill="white" />

      {/* Mouth - smile */}
      <path
        d="M 38 55 Q 50 60 62 55"
        stroke="#10b981"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Code brackets */}
      <path
        d="M 22 45 L 18 50 L 22 55"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 78 45 L 82 50 L 78 55"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
