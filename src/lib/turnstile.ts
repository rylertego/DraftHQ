// Cloudflare Turnstile, as a token source rather than a React component.
//
// Supabase's CAPTCHA setting gates *every* auth endpoint once enabled, and two
// of ours have no form to hang a widget on: signInAnonymously() for guest draft
// joins, and the signInWithPassword() that verifies the current password during
// a password change. A component-shaped API would not reach either, so this is
// a module-level widget that any caller can await a token from.
//
// The widget renders in interaction-only mode: invisible unless Cloudflare
// decides a human check is warranted, in which case it shows itself.
//
// Verification happens in Supabase, not here. Cloudflare is explicit that
// siteverify must never be called from the browser — the flow is
// browser -> your backend -> siteverify. Supabase is that backend: it takes the
// token, calls siteverify with the secret key from Attack Protection, and
// rejects the request itself if it fails.
//
// With no site key configured this resolves to undefined and every caller
// proceeds unchanged. That keeps local development working before the key
// exists, and means enabling this is a two-sided switch — the key here and the
// setting in Supabase Auth. Turning on only the Supabase side breaks auth;
// turning on only this side is a no-op.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Which surface is asking. Cloudflare reports on this label, so keeping them
 * distinct is what lets you see whether abuse is hitting signup specifically
 * rather than auth in general.
 */
export type CaptchaAction = "signup" | "login" | "password_change" | "guest_join";

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "timeout-callback"?: () => void;
  execution?: "render" | "execute";
  appearance?: "always" | "execute" | "interaction-only";
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

// One widget per action, since a widget's action is fixed at render time.
const widgets = new Map<CaptchaAction, string>();

/** True when a site key is configured. Supabase's setting must match. */
export function isCaptchaConfigured() {
  return Boolean(SITE_KEY);
}

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Turnstile requires a browser."));
      return;
    }
    if (window.turnstile) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function hostFor(action: CaptchaAction): HTMLElement {
  const existing = document.querySelector<HTMLElement>(
    `[data-turnstile-host="${action}"]`,
  );
  if (existing) return existing;

  const host = document.createElement("div");
  host.setAttribute("data-turnstile-host", action);
  // On-screen rather than off: interaction-only means Cloudflare may decide to
  // show a challenge, and a challenge rendered off-screen is one the person can
  // never complete — the request would just time out with no explanation.
  host.style.position = "fixed";
  host.style.bottom = "16px";
  host.style.right = "16px";
  host.style.zIndex = "2147483647";
  document.body.appendChild(host);
  return host;
}

/**
 * Resolves a single-use CAPTCHA token, or undefined when no site key is set.
 *
 * Never rejects. A CAPTCHA that fails to load must not be the reason someone
 * cannot log in — if Supabase is enforcing, it rejects the request itself with
 * a clear error, which is a better failure than a dead submit button.
 */
export async function getCaptchaToken(
  action: CaptchaAction,
): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;

  try {
    await loadScript();
    const api = window.turnstile;
    if (!api) return undefined;

    return await new Promise<string | undefined>((resolve) => {
      let settled = false;
      const finish = (token?: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(token);
      };
      const timer = window.setTimeout(() => finish(undefined), 20_000);

      let widgetId = widgets.get(action);

      if (widgetId === undefined) {
        widgetId = api.render(hostFor(action), {
          sitekey: SITE_KEY,
          action,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => finish(token),
          "error-callback": () => finish(undefined),
          "timeout-callback": () => finish(undefined),
        });
        widgets.set(action, widgetId);
      } else {
        // Tokens are single-use, so a reused widget has to be reset before it
        // will issue another one.
        api.reset(widgetId);
      }

      api.execute(widgetId);
    });
  } catch {
    return undefined;
  }
}
