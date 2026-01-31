import { redirect } from 'next/navigation';

/**
 * Sign-In Redirect Page
 *
 * This page redirects users from /sign-in to /login
 * Helps with user muscle memory and old bookmarks/links
 */
export default function SignInRedirect() {
  redirect('/login');
}
