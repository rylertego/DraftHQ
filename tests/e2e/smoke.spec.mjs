import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { getLocalSupabaseEnvironment } from "../../scripts/local-supabase-env.mjs";

const { Client } = pg;
const environment = getLocalSupabaseEnvironment();
const admin = createClient(
  environment.API_URL,
  environment.SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function createIdentity(label) {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `e2e-${suffix}@example.com`;
  const password = `E2e-${suffix}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: label },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Unable to create ${label}.`);
  }

  return { email, password, userId: data.user.id };
}

async function login(page, identity) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identity.email);
  await page.getByLabel("Password").fill(identity.password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/\/create$/);
}

async function draftPlayer(page, playerName) {
  await page.getByText("Click to draft", { exact: true }).click();
  await page
    .getByPlaceholder("Search name, position, or NFL team")
    .fill(playerName);
  await page
    .getByRole("button", { name: new RegExp(`^${playerName}`) })
    .click();
  await page.getByRole("button", { name: `Draft ${playerName}` }).click();
  await expect(
    page.getByPlaceholder("Search name, position, or NFL team")
  ).toBeHidden();
}

test("commissioner and owner complete the recoverable draft lifecycle", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const commissioner = await createIdentity("E2E Commissioner");
  const owner = await createIdentity("E2E Owner");
  const database = new Client({ connectionString: environment.DB_URL });
  const commissionerContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  let draftId = null;

  try {
    await database.connect();
    const commissionerPage = await commissionerContext.newPage();
    const ownerPage = await ownerContext.newPage();

    await login(commissionerPage, commissioner);
    await commissionerPage.getByLabel("Draft Name").fill("E2E Smoke Draft");
    await commissionerPage.getByLabel("Number of Teams").fill("2");
    await commissionerPage.getByLabel("Number of Rounds").fill("2");
    await commissionerPage
      .getByRole("button", { name: "Create Draft", exact: true })
      .click();
    await expect(commissionerPage).toHaveURL(/\/teams\?draftId=/);
    draftId = new URL(commissionerPage.url()).searchParams.get("draftId");
    expect(draftId).toBeTruthy();

    const joinCodeText = await commissionerPage
      .getByText(/Join code:/)
      .textContent();
    const joinCode = joinCodeText?.match(/Join code:\s*([A-Z0-9]+)/)?.[1];
    expect(joinCode).toBeTruthy();

    await login(ownerPage, owner);
    await ownerPage.goto(`/join/${joinCode}`);
    await ownerPage.getByLabel("Display Name").fill("E2E Owner");
    await ownerPage.getByRole("button", { name: "Join Draft" }).click();
    await expect(ownerPage).toHaveURL(new RegExp(`/draft\\?draftId=${draftId}`));

    await expect(
      commissionerPage.getByLabel("Team for E2E Owner")
    ).toBeVisible({ timeout: 15_000 });
    await commissionerPage
      .getByLabel("Team for E2E Commissioner")
      .selectOption({ label: "Team 1" });
    await commissionerPage
      .getByLabel("Team for E2E Owner")
      .selectOption({ label: "Team 2" });
    await commissionerPage.getByRole("button", { name: "Continue" }).click();
    await expect(commissionerPage).toHaveURL(
      new RegExp(`/draft\\?draftId=${draftId}`)
    );
    await expect(ownerPage.getByText("You control Team 2.")).toBeVisible({
      timeout: 15_000,
    });

    await commissionerPage.getByRole("button", { name: "Start Draft" }).click();
    await expect(
      commissionerPage.getByText("Overall 1 | Round 1, Pick 1")
    ).toBeVisible();
    await draftPlayer(commissionerPage, "Test Player 001");

    await expect(ownerPage.getByText("Your pick", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await commissionerPage.getByRole("button", { name: "Pause Draft" }).click();
    await expect(ownerPage.getByText("paused", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await ownerContext.setOffline(true);
    await commissionerPage.getByRole("button", { name: "Resume Draft" }).click();
    await ownerContext.setOffline(false);
    await ownerPage.reload();
    await expect(ownerPage.getByText("Your pick", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(ownerPage.getByText("Overall 2 | Round 1, Pick 2")).toBeVisible();
    await draftPlayer(ownerPage, "Test Player 002");

    await expect(
      commissionerPage.getByText("Overall 3 | Round 2, Pick 1")
    ).toBeVisible({ timeout: 15_000 });
    commissionerPage.once("dialog", (dialog) => dialog.accept());
    await commissionerPage
      .getByRole("button", { name: "Undo Last Pick" })
      .click();

    await expect(ownerPage.getByText("Overall 2 | Round 1, Pick 2")).toBeVisible({
      timeout: 15_000,
    });
    await draftPlayer(ownerPage, "Test Player 002");
    await expect(ownerPage.getByText("Overall 3 | Round 2, Pick 1")).toBeVisible();
    await draftPlayer(ownerPage, "Test Player 003");

    await expect(
      commissionerPage.getByText("Overall 4 | Round 2, Pick 2")
    ).toBeVisible({ timeout: 15_000 });
    await draftPlayer(commissionerPage, "Test Player 004");
    await expect(
      commissionerPage.getByText("All 4 picks are saved in DraftHQ.")
    ).toBeVisible();
    await expect(
      ownerPage.getByText("All 4 picks are saved in DraftHQ.")
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await Promise.allSettled([
      commissionerContext.close(),
      ownerContext.close(),
    ]);
    if (draftId) {
      await database.query("delete from public.drafts where id = $1", [draftId]);
    }
    await database.end().catch(() => undefined);
    await Promise.allSettled([
      admin.auth.admin.deleteUser(commissioner.userId),
      admin.auth.admin.deleteUser(owner.userId),
    ]);
  }
});
