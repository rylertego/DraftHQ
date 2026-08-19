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
// With no site key configured this resolves to undefined and every caller
// proceeds unchanged. That keeps local development working before the key
// exists, and means enabling this is a two-sided switch — the key here and the
// setting in Supabase Auth. Turning on only the Supabase side breaks auth;
// turning on only this side is a no-op.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "timeout-callback"?: () => void;
      execution?: "render" | "execute";
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let container: HTMLElement | null = null;

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

/**
 * Resolves a single-use CAPTCHA token, or undefined when no site key is set.
 *
 * Never rejects. A CAPTCHA that fails to load must not be the reason someone
 * cannot log in — if Supabase is enforcing, it rejects the request itself with
 * a clear error, which is a better failure than a dead submit button.
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;

  try {
    await loadScript();
    const api = window.turnstile;
    if (!api) return undefined;

    if (!container) {
      container = document.createElement("div");
      container.setAttribute("data-turnstile-host", "");
      // Kept in the layout rather than off-screen: interaction-only means
      // Cloudflare may need to show a challenge, and a hidden challenge is one
      // the person can never complete.
      container.style.position = "fixed";
      container.style.bottom = "16px";
      container.style.right = "16px";
      container.style.zIndex = "2147483647";
      document.body.appendChild(container);
    }

    return await new Promise<string | undefined>((resolve) => {
      // Turnstile tokens are single-use, so each call re-executes the widget.
      const settle = (token?: string) => resolve(token);
      const timeout = window.setTimeout(() => settle(undefined), 20_000);

      const finish = (token?: string) => {
        window.clearTimeout(timeout);
        settle(token);
      };

      if (widgetId === null) {
        widgetId = api.render(container as HTMLElement, {
          sitekey: SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => finish(token),
          "error-callback": () => finish(undefined),
          "timeout-callback": () => finish(undefined),
        });
      } else {
        api.reset(widgetId);
      }

      api.execute(widgetId);
    });
  } catch {
    return undefined;
  }
}
