import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { summarizePage, extractSameOriginLinks } from "./domNormalizer.js";
import type { PageSummary } from "../types.js";

export type ConsoleEntry = { type: string; text: string };
export type NetworkEntry = { url: string; method: string; status?: number; failure?: string };

// The ONLY way anything in this feature touches a real browser. Exposes just
// the controlled action set from the implementation plan — Gemini never gets
// a raw browser handle, it only ever sees the JSON results these methods
// return (via PageSummary), and every method that navigates enforces the
// target application's own origin as a hard boundary.
export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly allowedOrigin: string;
  private readonly maxActions: number;
  private actionCount = 0;
  private consoleLog: ConsoleEntry[] = [];
  private networkLog: NetworkEntry[] = [];

  constructor(targetUrl: string, maxActions: number) {
    this.allowedOrigin = new URL(targetUrl).origin;
    this.maxActions = maxActions;
  }

  private bumpActionBudget() {
    this.actionCount++;
    if (this.actionCount > this.maxActions) {
      throw new Error(`Autonomous run exceeded the configured limit of ${this.maxActions} browser actions.`);
    }
  }

  private requirePage(): Page {
    if (!this.page) throw new Error("Browser has not been launched.");
    return this.page;
  }

  private assertAllowedUrl(absoluteUrl: string) {
    const origin = new URL(absoluteUrl).origin;
    if (origin !== this.allowedOrigin) {
      throw new Error(
        `Navigation to ${origin} is outside the target application's domain (${this.allowedOrigin}) and was blocked.`,
      );
    }
  }

  // Playwright's default headless launch uses a separate lightweight
  // "chrome-headless-shell" binary. On some Windows machines that binary
  // fails to start (STATUS_DLL_INIT_FAILED) even though a full browser
  // launches fine — fall back to a system-installed Chrome/Edge (channel)
  // before giving up, and surface one short, actionable error instead of
  // Playwright's raw multi-KB process log if every attempt fails.
  private async launchBrowser(): Promise<Browser> {
    const attempts: { label: string; options: Parameters<typeof chromium.launch>[0] }[] = [
      { label: "bundled Chromium", options: { headless: true } },
      { label: "system Chrome", options: { headless: true, channel: "chrome" } },
      { label: "system Edge", options: { headless: true, channel: "msedge" } },
    ];

    const failures: string[] = [];
    for (const attempt of attempts) {
      try {
        return await chromium.launch(attempt.options);
      } catch (err) {
        failures.push(`${attempt.label}: ${(err as Error).message.split("\n")[0]}`);
      }
    }

    throw new Error(
      `Could not launch a browser after trying bundled Chromium, Chrome, and Edge. This usually means a browser binary failed to start on this machine (missing runtime dependency, or blocked by antivirus/security software). Run "npx playwright install chromium" in server/ and check that ms-playwright isn't blocked. Details: ${failures.join(" | ")}`,
    );
  }

  async launch(): Promise<void> {
    this.browser = await this.launchBrowser();
    this.context = await this.browser.newContext({ viewport: { width: 1366, height: 900 } });
    this.page = await this.context.newPage();

    this.page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        this.consoleLog.push({ type: msg.type(), text: msg.text().slice(0, 500) });
      }
    });
    this.page.on("requestfailed", (req) => {
      this.networkLog.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
    });
    this.page.on("response", (res) => {
      if (res.status() >= 400) {
        this.networkLog.push({ url: res.url(), method: res.request().method(), status: res.status() });
      }
    });
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  getActionCount(): number {
    return this.actionCount;
  }

  async navigate(url: string): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    const absolute = new URL(url, page.url() || this.allowedOrigin).toString();
    this.assertAllowedUrl(absolute);
    await page.goto(absolute, { waitUntil: "domcontentloaded", timeout: 20000 });
  }

  async click(selectorHint: string): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    const locator = page.locator(selectorHint).first();
    try {
      await locator.click({ timeout: 8000 });
    } catch (err) {
      // Common component-library false positive (Ant Design, Material UI,
      // etc.): a modal/overlay wrapper div sits in the DOM — sometimes
      // invisible or positioned off the element it's supposedly wrapping —
      // and Playwright's actionability check refuses to click because that
      // div "intercepts pointer events", even though the target is exactly
      // what a real user would click. Retry once with a forced click, which
      // skips that check and dispatches the click directly, before giving
      // up. Only for this specific interception failure — a genuinely
      // missing/detached element should still fail normally.
      if (err instanceof Error && /intercepts pointer events/i.test(err.message)) {
        await locator.click({ timeout: 3000, force: true });
      } else {
        throw err;
      }
    }
  }

  async type(selectorHint: string, value: string): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    const locator = page.locator(selectorHint).first();
    try {
      await locator.fill(value, { timeout: 8000 });
    } catch (err) {
      // Searchable comboboxes (Ant Design's Select is a common example) often
      // mark their visible input readonly and manage the typed text purely
      // through keyboard events rather than the DOM value — fill() sets the
      // value directly and Playwright correctly refuses on a readonly
      // element, but the field still accepts real, simulated keystrokes.
      // Click first to focus/open it (many such comboboxes ignore keystrokes
      // until focused), then type character by character.
      if (err instanceof Error && /not editable/i.test(err.message)) {
        await locator.click({ timeout: 5000 }).catch(() => {});
        await locator.pressSequentially(value, { timeout: 8000, delay: 30 });
        // Searchable comboboxes typically debounce their filter/search
        // (often querying a server) rather than updating results
        // synchronously per keystroke — without this pause, the caller's
        // very next DOM inspection can run before any results have
        // rendered, making a real dropdown look identical to one that
        // never opened at all.
        await page.waitForTimeout(700);
      } else {
        throw err;
      }
    }
  }

  async select(selectorHint: string, value: string): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    await page.locator(selectorHint).first().selectOption(value, { timeout: 8000 });
  }

  async hover(selectorHint: string): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    await page.locator(selectorHint).first().hover({ timeout: 8000 });
  }

  async scroll(): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    await page.mouse.wheel(0, 800);
  }

  async wait(ms: number): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    await page.waitForTimeout(Math.min(ms, 5000));
  }

  async inspectPage(): Promise<PageSummary> {
    this.bumpActionBudget();
    return summarizePage(this.requirePage());
  }

  async extractLinks(): Promise<string[]> {
    return extractSameOriginLinks(this.requirePage());
  }

  async findElement(selectorHint: string): Promise<boolean> {
    this.bumpActionBudget();
    const page = this.requirePage();
    return (await page.locator(selectorHint).count()) > 0;
  }

  async screenshot(): Promise<Buffer> {
    this.bumpActionBudget();
    const page = this.requirePage();
    return page.screenshot({ timeout: 8000 });
  }

  captureConsole(): ConsoleEntry[] {
    return [...this.consoleLog];
  }

  captureNetwork(): NetworkEntry[] {
    return [...this.networkLog];
  }

  getCurrentUrl(): string {
    return this.requirePage().url();
  }

  async goBack(): Promise<void> {
    this.bumpActionBudget();
    const page = this.requirePage();
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  }

  // Deterministic, non-AI credential submission — this is the ONLY place
  // credentials touch the browser, and it never enters the Gemini loop.
  // Selector discovery uses common signals (type/name/id/autocomplete/role)
  // rather than a hardcoded selector for one specific app.
  async login(url: string, username: string, password: string): Promise<{ submitted: boolean; loginPageUrl?: string }> {
    await this.navigate(url);
    const page = this.requirePage();

    // Some apps show a brief client-side "checking your session" splash
    // (no inputs on the page at all yet) before routing to the real login
    // page — poll for a few seconds rather than assuming the password field
    // is present immediately after domcontentloaded.
    const passwordField = page.locator('input[type="password"]').first();
    const pollDeadline = Date.now() + 15000;
    while ((await passwordField.count()) === 0 && Date.now() < pollDeadline) {
      await page.waitForTimeout(1000);
    }
    if ((await passwordField.count()) === 0) {
      return { submitted: false };
    }

    // The URL of the ACTUAL login page (post-splash/redirect), not the
    // original target URL the caller passed in — those are frequently
    // different paths (e.g. "/" vs "/login"), which would make any
    // post-submit "did the URL change" check trivially true regardless of
    // whether login really succeeded. verifyAuthenticated() must compare
    // against this value, not the original navigate() target.
    const loginPageUrl = page.url();

    const usernameField = page
      .locator(
        [
          'input[autocomplete="username"]',
          'input[type="email"]',
          'input[name*="user" i]',
          'input[name*="email" i]',
          'input[id*="user" i]',
          'input[id*="email" i]',
          'input[type="text"]',
        ].join(", "),
      )
      .first();

    if ((await usernameField.count()) > 0) {
      await usernameField.fill(username, { timeout: 5000 }).catch(() => {});
    }
    await passwordField.fill(password, { timeout: 5000 });

    const submitButton = page
      .locator(
        [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Log in")',
          'button:has-text("Sign in")',
          'button:has-text("Login")',
        ].join(", "),
      )
      .first();

    if ((await submitButton.count()) > 0) {
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {}),
        submitButton.click({ timeout: 8000 }),
      ]);
    } else {
      await passwordField.press("Enter");
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    }

    return { submitted: true, loginPageUrl };
  }

  // Heuristic post-login check: URL changed away from the ACTUAL login page
  // (not the original navigate() target, which is often a different path —
  // see login()'s loginPageUrl), the password field is no longer present,
  // AND the page has rendered some real content. That third condition
  // matters: a blank/loading interstitial (a slow app splash, or a bot-check
  // wall) trivially satisfies "no password field" and "different URL" too,
  // which would otherwise report success on a page that never actually
  // loaded anything. Polls for a few seconds rather than checking once
  // immediately: apps that keep a live connection open (real-time/
  // collaborative features, websockets) never let networkidle settle, so
  // the post-login redirect can land a couple of seconds after login()
  // already gave up waiting.
  async verifyAuthenticated(preLoginUrl: string): Promise<boolean> {
    const page = this.requirePage();
    const check = async () => {
      const urlChanged = page.url() !== preLoginUrl;
      const passwordFieldGone = (await page.locator('input[type="password"]').count()) === 0;
      const hasRenderedContent = (await page.locator("body :is(a, button, input, select, textarea, h1, h2, table)").count()) > 0;
      return urlChanged && passwordFieldGone && hasRenderedContent;
    };
    const pollDeadline = Date.now() + 12000;
    while (Date.now() < pollDeadline) {
      if (await check()) return true;
      await page.waitForTimeout(1000);
    }
    return check();
  }
}
