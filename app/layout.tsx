import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aegis Tutoring ERP & Academic Operating System',
  description: 'Enterprise tutoring center operating system for lead CRM, admissions, timetable scheduling, credit-based billing, session check-ins, payroll locking, and waterfall cohort accounting.',
  openGraph: {
    title: 'Aegis Tutoring ERP & Academic Operating System',
    description: 'Enterprise tutoring center operating system for lead CRM, admissions, timetable scheduling, credit-based billing, session check-ins, payroll locking, and waterfall cohort accounting.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
