import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-slate-900 p-4">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-slate-500 mb-4 text-sm">Could not find requested resource.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-[#6dd95d] hover:bg-[#5ec74e] text-slate-950 rounded-xl text-xs font-bold shadow-xs transition"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
