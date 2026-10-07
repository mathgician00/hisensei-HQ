import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'hisensei HQ - Academic Operating System',
  description: 'Enterprise tutoring center operating system for lead CRM, admissions, timetable scheduling, credit-based billing, session check-ins, payroll locking, and waterfall cohort accounting.',
  openGraph: {
    title: 'hisensei HQ - Academic Operating System',
    description: 'Enterprise tutoring center operating system for lead CRM, admissions, timetable scheduling, credit-based billing, session check-ins, payroll locking, and waterfall cohort accounting.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
