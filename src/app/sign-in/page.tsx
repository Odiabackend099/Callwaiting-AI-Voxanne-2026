import type { Metadata } from "next"
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: "Sign In | Voxanne AI",
  description: "Sign in to your Voxanne AI account. Access your dashboard, call logs, and agent configuration.",
  robots: {
    index: false,  // Auth pages should not be indexed
    follow: false,
  },
}

/**
 * Sign-In Redirect Page
 *
 * This page redirects users from /sign-in to /login
 * Helps with user muscle memory and old bookmarks/links
 */
export default function SignInRedirect() {
  redirect('/login');
}
