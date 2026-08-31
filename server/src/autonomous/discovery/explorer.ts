import type { BrowserController } from "../browser/browserController.js";
import { decideNextExplorationAction } from "../ai/agentDecision.js";
import { isCancelled, elapsedMs } from "../runRegistry.js";
import { saveScreenshot } from "../evidence/evidenceStore.js";
import { MAX_AI_ITERATIONS, MAX_RUN_DURATION_MS } from "../constants.js";
import type { DiscoveredPage, PageSummary } from "../types.js";

// A handful of extra AI-guided interactions (clicks and/or typing) are
// allowed on the SAME page before moving on, to get through multi-step
// JS-only flows (e.g. "pick an org from a searchable dropdown, then click
// Continue") that never expose a real <a href> to crawl and would otherwise
// strand the whole run on one screen — see explorer's inner loop below.
const MAX_INTERACTIONS_PER_PAGE = 6;

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

// Following a "Log out"/"Sign out" link mid-crawl would destroy the
// authenticated session for the rest of the run — every page queued after
// it would silently redirect to the login page instead of being explored.
// The crawler must never do this to itself; a dedicated Logout workflow
// (spec section 11) is still discovered from the page's elements below and
// tested deliberately later, in a controlled, ordered way (see executor.ts).
const LOGOUT_PATTERN = /log[\s-]?out|sign[\s-]?out/i;

function isLikelyLogoutUrl(url: string): boolean {
  return LOGOUT_PATTERN.test(new URL(url).pathname);
}

function isLikelyLogoutElement(name: string): boolean {
  return LOGOUT_PATTERN.test(name);
}

function sameOriginLinksFrom(controller: BrowserController): Promise<string[]> {
  return controller.extractLinks();
}

function withinBudget(runId: string): boolean {
  return !isCancelled(runId) && elapsedMs(runId) <= MAX_RUN_DURATION_MS;
}

// Deterministic BFS crawl (per spec section 23 — link discovery needs no AI)
// bounded by maxPages/duration/cancellation. Each visited page gets up to
// MAX_INTERACTIONS_PER_PAGE Gemini decisions (OBSERVE -> REASON -> ACT ->
// OBSERVE) to click and/or type through a JS-only navigation step (a picker,
// a searchable dropdown, a gate screen) — stopping as soon as real
// navigation (a URL change) happens, since the BFS queue takes over from
// there. Loop/duplicate detection is by normalized URL.
export async function exploreApplication(params: {
  runId: string;
  controller: BrowserController;
  rootUrl: string;
  maxPages: number;
  maxDepth: number;
  instructions?: string | null;
  onLog: (line: string) => void;
}): Promise<DiscoveredPage[]> {
  const { runId, controller, rootUrl, maxPages, maxDepth, instructions, onLog } = params;

  const visited = new Map<string, DiscoveredPage>();
  const queued = new Set<string>([normalizeUrl(rootUrl)]);
  const queue: { url: string; depth: number }[] = [{ url: normalizeUrl(rootUrl), depth: 0 }];

  let iterations = 0;

  function enqueue(url: string, depth: number) {
    const normalized = normalizeUrl(url);
    if (
      depth <= maxDepth &&
      !visited.has(normalized) &&
      !queued.has(normalized) &&
      !isLikelyLogoutUrl(normalized) &&
      visited.size + queued.size < maxPages
    ) {
      queued.add(normalized);
      queue.push({ url: normalized, depth });
    }
  }

  while (queue.length > 0 && visited.size < maxPages && iterations < MAX_AI_ITERATIONS) {
    if (isCancelled(runId)) {
      onLog("Exploration cancelled by user.");
      break;
    }
    if (elapsedMs(runId) > MAX_RUN_DURATION_MS) {
      onLog("Exploration stopped: run duration limit reached.");
      break;
    }

    const next = queue.shift();
    if (!next || visited.has(next.url)) continue;

    try {
      if (normalizeUrl(controller.getCurrentUrl()) !== next.url) {
        await controller.navigate(next.url);
      }
    } catch (err) {
      onLog(`Skipped ${next.url}: ${(err as Error).message}`);
      continue;
    }

    let summary: PageSummary = await controller.inspectPage();
    visited.set(next.url, { url: next.url, title: summary.title, page: summary, depth: next.depth });
    onLog(`Visited ${next.url} ("${summary.title}") — ${summary.elements.length} interactive element(s).`);

    let freshLinks = (await sameOriginLinksFrom(controller))
      .map(normalizeUrl)
      .filter((u) => !visited.has(u) && !queued.has(u) && !isLikelyLogoutUrl(u));
    for (const link of freshLinks) enqueue(link, next.depth + 1);

    // Inner loop: keep asking the AI to act on THIS page — clicking or
    // typing through e.g. an org picker or a multi-step form — until real
    // navigation happens (a URL change, which the outer BFS queue then
    // takes over), the interaction budget for this page is used up, the AI
    // has nothing useful left to try, or the global budgets run out. Tracks
    // what's already been tried here so a page can't be stuck repeating the
    // exact same no-op action for its whole budget.
    const attempted = new Set<string>();
    for (let attempt = 0; attempt < MAX_INTERACTIONS_PER_PAGE && iterations < MAX_AI_ITERATIONS && withinBudget(runId); attempt++) {
      iterations++;
      let decision;
      try {
        const decisionPage = { ...summary, elements: summary.elements.filter((e) => !isLikelyLogoutElement(e.name)) };
        decision = await decideNextExplorationAction({
          page: decisionPage,
          candidateLinks: freshLinks,
          instructions,
          visitedCount: visited.size,
          pageBudgetRemaining: maxPages - visited.size,
          alreadyAttempted: [...attempted],
        });
      } catch (err) {
        onLog(`AI decision step skipped: ${(err as Error).message}`);
        break;
      }

      onLog(`[AI] ${decision.action} — ${decision.reasoning}`);
      if (decision.action !== "click" && decision.action !== "type") break;
      if (!decision.params.selectorHint) break;

      const attemptKey = `${decision.action}:${decision.params.selectorHint}:${decision.params.value ?? ""}`;
      if (attempted.has(attemptKey)) {
        onLog("AI repeated an action with no new effect last time — stopping attempts on this page.");
        break;
      }
      attempted.add(attemptKey);

      try {
        if (decision.action === "click") {
          await controller.click(decision.params.selectorHint);
        } else {
          await controller.type(decision.params.selectorHint, decision.params.value ?? "");
          onLog(`Typed "${decision.params.value ?? ""}" into ${decision.params.selectorHint}.`);
        }
      } catch (err) {
        onLog(`${decision.action === "click" ? "Click" : "Type"} skipped: ${(err as Error).message}`);
        continue;
      }

      const revealed = await controller.inspectPage();
      // Visibility into what actually changed on screen, not just what the
      // AI intended — without this, a "type"/"click" that silently has no
      // effect (a disabled button staying disabled, a dropdown that never
      // opens because the typed value matched nothing) looks identical in
      // the logs to one that worked, which makes real diagnosis impossible.
      const revealedOptions = revealed.elements.filter((e) => e.role === "option");
      onLog(
        `Page now has ${revealed.elements.length} element(s)` +
          (revealedOptions.length > 0
            ? `, including ${revealedOptions.length} option(s): ${revealedOptions.map((e) => e.name || e.selectorHint).join(", ")}.`
            : ", no dropdown/listbox options among them."),
      );
      // A screenshot at every exploration interaction — visual proof of
      // what the page actually looked like at that moment, since the
      // normalized element summary above can't show things like a dropdown
      // rendered off-screen, a value that silently didn't take, or a
      // validation message. Saved to disk (server/uploads/autonomous/<runId>/)
      // for direct human inspection when the DOM-level signals aren't enough
      // to tell what went wrong.
      try {
        const shot = await controller.screenshot();
        const path = await saveScreenshot(runId, `explore-p${visited.size}-a${attempt}`, shot);
        onLog(`Screenshot saved: ${path}`);
      } catch {
        // Best-effort only.
      }
      const revealedUrl = normalizeUrl(revealed.url);
      if (revealedUrl !== next.url) {
        // Real navigation happened (even if it's the same page slot's
        // "current" URL never gets revisited) — hand off to the BFS queue
        // rather than continuing to interact here.
        enqueue(revealedUrl, next.depth + 1);
        break;
      }

      // Same URL, but the action may still have changed what's on screen
      // (a dropdown opened, a "Continue" button appeared) — refresh our
      // view of the page and try again, up to the interaction budget.
      summary = revealed;
      freshLinks = (await sameOriginLinksFrom(controller))
        .map(normalizeUrl)
        .filter((u) => !visited.has(u) && !queued.has(u) && !isLikelyLogoutUrl(u));
      for (const link of freshLinks) enqueue(link, next.depth + 1);
    }
  }

  return [...visited.values()];
}
