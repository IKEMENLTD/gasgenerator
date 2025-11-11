import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to static index.html
  redirect('/index.html')
}