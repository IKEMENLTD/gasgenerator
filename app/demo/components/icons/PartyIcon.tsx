export default function PartyIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.75 15.25C4.64543 15.25 3.75 16.1454 3.75 17.25V19.25C3.75 20.3546 4.64543 21.25 5.75 21.25H7.75C8.85457 21.25 9.75 20.3546 9.75 19.25V17.25C9.75 16.1454 8.85457 15.25 7.75 15.25H5.75Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M16.25 2.75C15.1454 2.75 14.25 3.64543 14.25 4.75V6.75C14.25 7.85457 15.1454 8.75 16.25 8.75H18.25C19.3546 8.75 20.25 7.85457 20.25 6.75V4.75C20.25 3.64543 19.3546 2.75 18.25 2.75H16.25Z" stroke="currentColor" strokeWidth="2"/>
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
      <circle cx="16.5" cy="16.5" r="1.5" fill="currentColor"/>
      <path d="M3 3L10 10M21 21L14 14M10 3L3 10M21 14L14 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
