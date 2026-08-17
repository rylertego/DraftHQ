import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — DraftHQ",
  description: "What DraftHQ collects, why, who it is shared with, and how to delete it.",
};

const UPDATED = "August 16, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <article className="mx-auto w-full max-w-[720px]">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-7 text-slate-300">
          DraftHQ is a fantasy football draft platform operated from the United States.
          This policy describes what the service stores, why it stores it, who else
          receives it, and how to get it deleted. It covers{" "}
          <span className="font-semibold text-white">drafthq.net</span> only.
        </p>

        <Section title="What we collect">
          <p>
            <span className="font-semibold text-white">Account information.</span> Your
            email address and a password, handled by our authentication provider. We
            never see or store your password in readable form.
          </p>
          <p>
            <span className="font-semibold text-white">Profile information you choose
            to provide.</span> A display name, an optional avatar image, and an optional
            nickname and short bio shown to other members of your leagues.
          </p>
          <p>
            <span className="font-semibold text-white">League and draft content.</span>{" "}
            Leagues, teams, team names and logos, draft picks, draft order, timing
            settings, chat messages sent in a draft room, and walk-up song selections.
            Some of this is visible to everyone in your league — that is the point of a
            shared draft.
          </p>
          <p>
            <span className="font-semibold text-white">Imported league data.</span>{" "}
            If you import from Sleeper, we retrieve that league&apos;s teams, rosters,
            settings, and the owner names as they appear there. Those names may belong to
            people who have never used DraftHQ.
          </p>
          <p>
            <span className="font-semibold text-white">Technical data.</span> Our hosting
            and database providers keep standard server and access logs, including IP
            addresses, for security and reliability.
          </p>
          <p>
            We do not collect payment information, and we do not use advertising or
            cross-site tracking cookies.
          </p>
        </Section>

        <Section title="Why we use it">
          <p>
            To run the service: authenticating you, showing your leagues, keeping a draft
            in sync across everyone&apos;s devices, and sending the transactional emails
            the product depends on — invitations and password resets. We do not send
            marketing email.
          </p>
        </Section>

        <Section title="Who else receives it">
          <p>
            We use third-party providers to operate DraftHQ. They receive only what their
            function requires:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li><span className="font-semibold text-white">Supabase</span> — database, authentication, file storage</li>
            <li><span className="font-semibold text-white">Vercel</span> — application hosting</li>
            <li><span className="font-semibold text-white">Resend</span> — sending invitation and password-reset email</li>
            <li><span className="font-semibold text-white">Cloudflare</span> — DNS</li>
            <li><span className="font-semibold text-white">Spotify</span> and <span className="font-semibold text-white">YouTube</span> — only if you choose to add walk-up music; searching and playback contact their services directly</li>
            <li><span className="font-semibold text-white">Sleeper</span> and <span className="font-semibold text-white">ESPN</span> — only when importing a league or refreshing player rankings</li>
          </ul>
          <p>
            We do not sell personal information, and we do not share it for advertising.
          </p>
        </Section>

        <Section title="Music connections">
          <p>
            Connecting Spotify is optional and used only to play walk-up music during a
            draft. The connection token is stored in your own browser, not on our
            servers, and you can disconnect at any time from your Spotify account
            settings. Searching for songs does not require you to connect anything.
          </p>
        </Section>

        <Section title="What other people in your league can see">
          <p>
            League members can see your display name, avatar, nickname, bio, your team
            and its logo, your draft picks, your walk-up songs, and anything you send in
            draft chat. Your email address is visible to the commissioner who invited
            you. Leagues are private: people outside a league cannot view it.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            League and draft content is kept while the league exists, because a draft is
            a record its members may want to revisit. Leaving a league removes your
            membership and releases your team, but picks already made in a completed
            draft remain part of that draft&apos;s history.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can edit your profile and team details at any time in the app, leave a
            league from its settings page, and ask us to delete your account and its
            personal data by emailing the address below. Depending on where you live you
            may also have rights to access, correct, export, or object to the processing
            of your information; contact us and we will honour them.
          </p>
        </Section>

        <Section title="Children">
          <p>
            DraftHQ is not directed at children under 13, and we do not knowingly collect
            their information. If you believe a child has given us personal data, contact
            us and we will delete it.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Access to league data is enforced at the database level, so people who are
            not in a league cannot read it. No service can promise perfect security, but
            we take reasonable measures and fix problems when we find them.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this policy changes materially we will update the date above and, where
            appropriate, tell you in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, or requests to delete your data:{" "}
            <a className="font-semibold text-teal-400 hover:text-teal-300" href="mailto:privacy@drafthq.net">
              privacy@drafthq.net
            </a>
          </p>
        </Section>

        <div className="mt-12 border-t border-slate-800 pt-6">
          <Link href="/" className="text-sm font-semibold text-slate-400 transition-colors hover:text-white">
            ← Back to DraftHQ
          </Link>
        </div>
      </article>
    </main>
  );
}
