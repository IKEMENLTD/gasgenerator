export default function RobotIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2V6M12 6C10.8954 6 10 6.89543 10 8H14C14 6.89543 13.1046 6 12 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="6" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <circle cx="9" cy="12" r="1" fill="currentColor"/>
      <circle cx="15" cy="12" r="1" fill="currentColor"/>
      <path d="M9 16H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 14H4M20 14H18M6 11H4M20 11H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
