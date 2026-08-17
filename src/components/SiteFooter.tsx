import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
        <p>© {new Date().getFullYear()} DraftHQ</p>
        <nav className="flex items-center gap-5">
          <Link href="/privacy" className="transition-colors hover:text-slate-300">
            Privacy
          </Link>
          <a href="mailto:support@drafthq.net" className="transition-colors hover:text-slate-300">
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
