import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In | Voxanne AI",
  description: "Sign in to your Voxanne AI account. Access your dashboard, call logs, and agent configuration.",
  robots: {
    index: false,  // CRITICAL: Auth pages should not be indexed
    follow: false,
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
