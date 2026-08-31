import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Service - DraftHQ",
  description: "The rules for using DraftHQ.",
};

const UPDATED = "August 31, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <article className="mx-auto w-full max-w-[760px]">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-slate-400">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-7 text-slate-300">
          These terms govern your use of DraftHQ. By creating an account, joining
          a league, importing league data, or using a draft room, you agree to
          these terms and our{" "}
          <Link href="/privacy" className="font-semibold text-[color:var(--color-product-accent)] transition-opacity hover:opacity-80">
            Privacy Policy
          </Link>.
        </p>

        <Section title="What DraftHQ Is">
          <p>
            DraftHQ is a fantasy draft and league experience platform. It helps
            commissioners create leagues, import or manually add teams, invite
            owners, run draft rooms, manage draft settings, and display draft
            results. DraftHQ is not a gambling platform, sportsbook, financial
            service, or official league operator.
          </p>
        </Section>

        <Section title="Accounts and Eligibility">
          <p>
            You must be at least 13 years old to use DraftHQ. You are responsible
            for your account, your login credentials, and activity that happens
            through your account. Use accurate information and keep your email
            address current so account and invitation messages can reach you.
          </p>
        </Section>

        <Section title="Commissioners and League Members">
          <p>
            Commissioners control league setup, teams, draft settings, invitations,
            owner assignments, draft start and pause controls, and other league
            administration features. League members are responsible for the team
            profile information, music selections, messages, and other content
            they add.
          </p>
          <p>
            Commissioners should have permission from league members before
            entering personal information, sending invitations, or importing owner
            names from another fantasy platform.
          </p>
        </Section>

        <Section title="Provider Imports and Connections">
          <p>
            DraftHQ may let you connect or import information from third-party
            services such as Sleeper, ESPN, Yahoo, Spotify, or YouTube. Your use
            of those services remains subject to their own terms and policies.
            You are responsible for having the right to access, import, and use
            the league data you bring into DraftHQ.
          </p>
          <p>
            DraftHQ is not affiliated with, endorsed by, or sponsored by the NFL,
            Sleeper, ESPN, Yahoo, Spotify, YouTube, or their related leagues,
            teams, or brands. Provider features may change or stop working if a
            provider changes its APIs, access rules, authentication requirements,
            or terms.
          </p>
        </Section>

        <Section title="Your Content">
          <p>
            You keep ownership of content you add to DraftHQ, such as team names,
            logos, owner photos, profile text, chat messages, draft notes, and
            song selections. You give DraftHQ permission to host, store, copy,
            display, and process that content as needed to operate and improve
            the service.
          </p>
          <p>
            Do not upload or enter content that you do not have permission to use,
            that infringes someone else&apos;s rights, or that is unlawful,
            abusive, harassing, hateful, sexually explicit, misleading, or harmful.
          </p>
        </Section>

        <Section title="Acceptable Use">
          <p>You agree not to:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Break or bypass authentication, authorization, rate limits, CAPTCHA, or draft controls.</li>
            <li>Access leagues, drafts, teams, accounts, APIs, or data you are not allowed to access.</li>
            <li>Send spam, abusive invitations, malicious content, or deceptive messages.</li>
            <li>Interfere with draft rooms, realtime systems, provider integrations, or other users.</li>
            <li>Use DraftHQ to violate another service&apos;s terms or applicable law.</li>
            <li>Reverse engineer, scrape, resell, or overload DraftHQ except where allowed by law or written permission.</li>
          </ul>
        </Section>

        <Section title="Drafts and Results">
          <p>
            DraftHQ tries to keep draft rooms reliable and synchronized, but you
            remain responsible for reviewing draft settings, owner assignments,
            picks, and exported results. If your league relies on DraftHQ for an
            important draft, commissioners should have a backup plan and verify
            settings before starting.
          </p>
        </Section>

        <Section title="AI Features">
          <p>
            DraftHQ may offer AI-generated announcer scripts, commentary, voices,
            or audio for draft-night presentation. AI output is for entertainment
            and presentation only. It is not an official draft ruling, league
            decision, player ranking, pick confirmation, or substitute for the
            draft record shown in DraftHQ.
          </p>
          <p>
            You are responsible for the prompts, settings, names, notes, voices,
            and other content you provide for AI features. Do not use AI features
            to impersonate someone without permission, create unlawful or abusive
            content, violate publicity, privacy, or intellectual property rights,
            or break a third-party AI provider&apos;s terms.
          </p>
        </Section>

        <Section title="Availability and Changes">
          <p>
            DraftHQ may change, suspend, or discontinue features at any time. We
            may also remove content, restrict accounts, revoke invitations, or
            disable leagues when needed to protect users, comply with law, enforce
            these terms, or keep the service working.
          </p>
        </Section>

        <Section title="No Warranties">
          <p>
            DraftHQ is provided as is and as available. To the fullest extent
            allowed by law, we disclaim warranties of merchantability, fitness for
            a particular purpose, non-infringement, accuracy, availability, and
            uninterrupted or error-free operation.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            To the fullest extent allowed by law, DraftHQ will not be liable for
            indirect, incidental, special, consequential, exemplary, or punitive
            damages, or for lost profits, lost data, lost league results, provider
            outages, or draft disputes. Where liability cannot be excluded, it is
            limited to the amount you paid DraftHQ in the 12 months before the
            claim, or 100 dollars if you paid nothing.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You may stop using DraftHQ at any time. We may suspend or terminate
            access if you violate these terms, create risk for other users, abuse
            the service, or create legal or security concerns. Some league and
            draft records may remain after an account leaves or is deleted because
            they are shared records for the league.
          </p>
        </Section>

        <Section title="Governing Law">
          <p>
            These terms are governed by applicable laws of the United States and
            the state laws that apply to DraftHQ, without regard to conflict of
            law rules. Some jurisdictions do not allow certain limitations, so
            parts of these terms may not apply to you.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms:{" "}
            <a className="font-semibold text-[color:var(--color-product-accent)] transition-opacity hover:opacity-80" href="mailto:support@drafthq.net">
              support@drafthq.net
            </a>
          </p>
        </Section>

        <div className="mt-12 border-t border-slate-800 pt-6">
          <Link href="/" className="text-sm font-semibold text-slate-400 transition-colors hover:text-white">
            Back to DraftHQ
          </Link>
        </div>
      </article>
    </main>
  );
}
