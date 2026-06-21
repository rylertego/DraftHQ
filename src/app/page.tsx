import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-12 sm:px-6 sm:py-20">
      <div className="w-full rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-2xl sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
          Live fantasy draft room
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Run draft night together from any screen.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-300">
          DraftHQ keeps every owner, pick, timer, and team in sync across phones
          and laptops.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-blue-800 bg-blue-950/30 p-5">
            <h2 className="text-xl font-bold">Joining a draft?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Open your invitation link or enter the code from your commissioner.
            </p>
            <Link
              className="mt-5 inline-flex w-full justify-center rounded bg-blue-600 px-4 py-3 font-semibold text-white"
              href="/join"
            >
              Join Draft
            </Link>
          </section>

          <section className="rounded-xl border border-gray-700 p-5">
            <h2 className="text-xl font-bold">Running the league?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Log in to create, import, configure, and control your draft room.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                className="rounded bg-gray-700 px-4 py-3 text-center font-semibold text-white"
                href="/login"
              >
                Log In
              </Link>
              <Link
                className="rounded bg-green-700 px-4 py-3 text-center font-semibold text-white"
                href="/create"
              >
                Create Draft
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
