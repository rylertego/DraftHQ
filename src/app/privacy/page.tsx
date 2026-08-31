import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy - DraftHQ",
  description:
    "What DraftHQ collects, why it is used, who it is shared with, and how to delete it.",
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

export default function PrivacyPage() {
  return (
    <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <article className="mx-auto w-full max-w-[760px]">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-400">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-7 text-slate-300">
          DraftHQ is a fantasy draft and league management service operated from
          the United States. This policy explains what we collect, why we use it,
          who receives it, and the choices you have. It applies to DraftHQ
          websites and apps, including <span className="font-semibold text-white">drafthq.net</span>.
        </p>

        <Section title="Information We Collect">
          <p>
            <span className="font-semibold text-white">Account information.</span>{" "}
            We collect your email address, authentication identifiers, and account
            status. Passwords are handled by our authentication provider and are
            not stored by DraftHQ in readable form.
          </p>
          <p>
            <span className="font-semibold text-white">Profile and league information.</span>{" "}
            We store the display name, avatar, nickname, bio, leagues, memberships,
            roles, invitations, teams, logos, owner photos, team names, short
            names, text-to-speech names, draft settings, draft order, picks,
            chat messages, and walk-up songs you or your commissioner add.
          </p>
          <p>
            <span className="font-semibold text-white">Imported fantasy league data.</span>{" "}
            If a commissioner imports a league, we may retrieve team names, owner
            names, roster slots, draft settings, prior-season records, standings,
            and related league metadata from providers such as Sleeper, ESPN, or
            Yahoo. Imported owner names may describe people who have not created
            DraftHQ accounts.
          </p>
          <p>
            <span className="font-semibold text-white">Provider credentials and cookies.</span>{" "}
            Private ESPN imports may require ESPN cookies that are sent to DraftHQ
            only to fetch that import preview. Yahoo imports use an OAuth flow and
            store Yahoo tokens in a short-lived, http-only browser cookie. Spotify
            playback tokens are stored in your browser local storage, not in
            DraftHQ database tables.
          </p>
          <p>
            <span className="font-semibold text-white">AI announcer information.</span>{" "}
            If AI announcer features are enabled, we may process announcement
            text, draft event details, league names, team names, player names,
            text-to-speech names, selected voices, and related draft-room context
            to generate draft-night commentary or audio. Optional custom voice
            provider API keys may be sent with a request to generate or preview
            audio, but DraftHQ does not store those keys in database tables unless
            we clearly say so in the feature.
          </p>
          <p>
            <span className="font-semibold text-white">Technical and security data.</span>{" "}
            We and our service providers may process IP addresses, device and
            browser information, request logs, authentication events, CAPTCHA
            signals, and error logs to keep the service reliable and secure.
          </p>
          <p>
            We do not collect payment card information today, and we do not sell
            personal information or share it for cross-context behavioral advertising.
          </p>
        </Section>

        <Section title="How We Use Information">
          <p>
            We use information to create and secure accounts, run leagues and
            drafts, synchronize draft rooms in real time, import league setup data,
            send invitations and account emails, play or preview walk-up music,
            provide support, prevent abuse, diagnose errors, and improve DraftHQ.
          </p>
        </Section>

        <Section title="Who Can See League Information">
          <p>
            DraftHQ is built around shared league spaces. League members can see
            league names, member profiles, team identities, draft order, picks,
            chat messages, walk-up songs, and draft results for leagues they are
            part of. Commissioners can also see and manage invitations and owner
            assignments. People outside a league should not be able to view that
            league through DraftHQ.
          </p>
        </Section>

        <Section title="Service Providers">
          <p>
            We use vendors that process information for us only as needed to
            operate DraftHQ:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li><span className="font-semibold text-white">Supabase</span> for database, authentication, storage, and realtime features.</li>
            <li><span className="font-semibold text-white">Vercel</span> for hosting and application delivery.</li>
            <li><span className="font-semibold text-white">Cloudflare</span> for DNS, security, and Turnstile bot protection.</li>
            <li><span className="font-semibold text-white">Resend</span> or another email provider for transactional email.</li>
            <li><span className="font-semibold text-white">OpenAI</span> and <span className="font-semibold text-white">ElevenLabs</span> when AI announcer features generate commentary or synthetic audio.</li>
            <li><span className="font-semibold text-white">Spotify</span> and <span className="font-semibold text-white">YouTube</span> when you search for, preview, or play walk-up music.</li>
            <li><span className="font-semibold text-white">Sleeper</span>, <span className="font-semibold text-white">ESPN</span>, and <span className="font-semibold text-white">Yahoo</span> when you choose to import or connect fantasy league data.</li>
          </ul>
        </Section>

        <Section title="Provider Connections">
          <p>
            Provider connections are optional. We use imported fantasy data to set
            up DraftHQ leagues and drafts, not to sell profiles or target ads.
            Disconnecting or deleting a league removes the active provider
            connection from DraftHQ, but it does not delete your account or data
            at the provider.
          </p>
          <p>
            You can disconnect Spotify in DraftHQ by clearing the connection in
            the app or by removing DraftHQ access from your Spotify account. After
            disconnecting, DraftHQ will no longer request Spotify playback tokens
            from that browser unless you connect again.
          </p>
        </Section>

        <Section title="AI Features">
          <p>
            AI announcer features are optional draft presentation tools. When
            used, DraftHQ may send the minimum draft-room context needed to
            generate the requested script or audio to AI service providers such
            as OpenAI or ElevenLabs. Generated audio may be cached so the same
            announcement does not need to be regenerated.
          </p>
          <p>
            AI-generated commentary is not the authoritative draft record. Draft
            settings, picks, owner assignments, and league records remain stored
            in DraftHQ and Supabase.
          </p>
        </Section>

        <Section title="Cookies and Local Storage">
          <p>
            DraftHQ uses cookies and browser storage for authentication, provider
            OAuth flows, bot protection, lobby audio preferences, and optional
            Spotify playback. We do not use advertising cookies.
          </p>
        </Section>

        <Section title="How Long We Keep Information">
          <p>
            We keep account information while your account exists. League and draft
            content is kept while the league exists because it is a shared record
            for league members. If you leave a league, your membership and owner
            assignment can be removed, but completed draft picks and league history
            may remain as part of the league record.
          </p>
          <p>
            Pending invitations may be kept until accepted, revoked, expired, or
            deleted. Provider cookies and OAuth state are short-lived. Security
            logs are kept only as long as reasonably needed for abuse prevention,
            debugging, compliance, and reliability.
          </p>
        </Section>

        <Section title="Your Choices">
          <p>
            You can update profile and team information in the app, leave leagues
            where that option is available, revoke provider access through the
            provider, and request deletion of your DraftHQ account. Depending on
            where you live, you may also have rights to access, correct, delete,
            export, or object to certain uses of your personal information.
          </p>
          <p>
            To make a privacy request, email{" "}
            <a className="font-semibold text-[color:var(--color-product-accent)] transition-opacity hover:opacity-80" href="mailto:privacy@drafthq.net">
              privacy@drafthq.net
            </a>.
          </p>
        </Section>

        <Section title="Children">
          <p>
            DraftHQ is not directed to children under 13, and we do not knowingly
            collect personal information from children under 13. If you believe a
            child provided personal information to DraftHQ, contact us and we will
            take appropriate steps to delete it.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use authentication, database-level access controls, storage rules,
            bot protection, and operational monitoring to protect DraftHQ. No
            online service can guarantee perfect security. If we learn of a
            security incident that requires notice, we will provide notice as
            required by applicable law.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy as DraftHQ changes. If we make material
            changes, we will update the date above and provide additional notice
            when appropriate.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Privacy questions or requests:{" "}
            <a className="font-semibold text-[color:var(--color-product-accent)] transition-opacity hover:opacity-80" href="mailto:privacy@drafthq.net">
              privacy@drafthq.net
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
