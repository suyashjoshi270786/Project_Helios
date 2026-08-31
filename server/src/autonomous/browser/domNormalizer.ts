import type { Page } from "playwright";
import type { PageSummary } from "../types.js";

const MAX_ELEMENTS = 40;

// Converts a live page into a compact, size-budgeted JSON summary — this,
// never the raw DOM, is what ever reaches Gemini (spec section 10 & 23).
// Prefers accessible name/role signals over raw markup so the summary stays
// meaningful across very different target applications.
export async function summarizePage(page: Page): Promise<PageSummary> {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const headingText = await page
    .locator("h1, h2")
    .first()
    .innerText({ timeout: 2000 })
    .catch(() => "");

  // IMPORTANT: this callback is serialized (via Function.prototype.toString)
  // and re-evaluated inside the page — it must not declare any named
  // function (declarations OR `const fn = () => {}`). tsx/esbuild's dev
  // transform wraps named functions in a `__name(...)` helper call for
  // name-preservation, and that helper only exists in the outer Node
  // module scope, not in the string Playwright ships into the browser —
  // so a named helper here throws "__name is not defined" at runtime.
  // Anonymous IIFEs (whose *result*, not the function itself, is what gets
  // bound to a const) are safe and used instead.
  const elements = await page.evaluate((max: number) => {
    const candidates = Array.from(
      document.querySelectorAll(
        // [role=option] and [role=listbox] descendants catch component-library
        // dropdowns (Ant Design, MUI, etc.) whose options only exist in the
        // DOM once opened via a click/type on the combobox that owns them —
        // without this, a searchable-select's revealed options are invisible
        // to exploration even after successfully opening the dropdown.
        "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=listbox] *",
      ),
    );

    const visible = candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });

    return visible.slice(0, max).map((el) => {
      const name = (() => {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria.trim();
        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
          const labelEl = document.getElementById(labelledBy);
          if (labelEl?.textContent) return labelEl.textContent.trim();
        }
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
          if (el.id) {
            const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (label?.textContent) return label.textContent.trim();
          }
          if ("placeholder" in el && el.placeholder) return el.placeholder.trim();
        }
        // Component-library comboboxes (Ant Design's Select is a common
        // example) often render their placeholder as a separate sibling
        // <span> rather than the input's own `placeholder` attribute —
        // without this, every such combobox reports an identical empty
        // name, making it impossible for anything (human or AI) reading
        // the summary to tell two side-by-side dropdowns apart. Search a
        // few ancestor levels for exactly one placeholder-classed element;
        // stop at the first level with exactly one match (unambiguous),
        // and never use a level with more than one (would risk grabbing a
        // neighboring field's placeholder instead of this element's own).
        let container = el.parentElement;
        for (let hops = 0; container && hops < 4; hops++) {
          const matches = container.querySelectorAll('[class*="placeholder" i]');
          if (matches.length === 1 && matches[0].textContent?.trim()) {
            return matches[0].textContent.trim();
          }
          if (matches.length > 1) break;
          container = container.parentElement;
        }
        return (el.textContent || "").trim().slice(0, 80);
      })();

      const selectorHint = (() => {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const testId = el.getAttribute("data-testid");
        if (testId) return `[data-testid="${testId}"]`;
        const attrName = el.getAttribute("name");
        if (attrName) return `${el.tagName.toLowerCase()}[name="${attrName}"]`;
        const text = (el.textContent || "").trim().slice(0, 40);
        if (text) return `${el.tagName.toLowerCase()}:has-text("${text.replace(/"/g, "")}")`;
        return el.tagName.toLowerCase();
      })();

      return {
        selectorHint,
        role: el.getAttribute("role") || el.tagName.toLowerCase(),
        name,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || undefined,
        required: el.hasAttribute("required") || undefined,
        href: el instanceof HTMLAnchorElement ? el.getAttribute("href") || undefined : undefined,
      };
    });
  }, MAX_ELEMENTS);

  return {
    url,
    title: title || "",
    headingText: headingText || "",
    elements: elements.map(({ href: _href, ...rest }) => rest),
  };
}

// Same-origin links found on the page, for the explorer's deterministic BFS
// frontier — kept separate from summarizePage's Gemini-facing output so the
// element list Gemini sees stays small even on link-heavy pages.
export async function extractSameOriginLinks(page: Page): Promise<string[]> {
  const origin = new URL(page.url()).origin;
  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") || ""));
  const resolved = new Set<string>();
  for (const href of hrefs) {
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    try {
      const absolute = new URL(href, page.url());
      if (absolute.origin === origin) {
        absolute.hash = "";
        resolved.add(absolute.toString());
      }
    } catch {
      // ignore unparsable hrefs
    }
  }
  return [...resolved];
}
