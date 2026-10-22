import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "./actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Net Worth Tracker",
  description: "One view of your net worth across India and the USA.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href={user ? "/dashboard" : "/"} className="brand">
            Net Worth Tracker
          </Link>
          <nav>
            {user ? (
              <>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/history">History</Link>
                <Link href="/accounts/new">Add account</Link>
                <Link href="/import/cas">Import CAS</Link>
                <form action={logout}>
                  <button className="link">Log out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="button">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
