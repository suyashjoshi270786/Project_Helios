import type { ElementSummary } from "../types.js";

// Best-effort, deterministic prose -> browser-action interpretation, applied
// against the LIVE page's current elements at replay time (not baked in at
// generation time, so it stays grounded in the actual DOM rather than a
// stale snapshot). This is intentionally simple pattern matching, not NLP —
// steps it can't confidently map become "assert" (no interaction, just
// evidence capture), which is the honest outcome when a generated step is
// too abstract to safely automate. Never targets a password field: replaying
// invalid/sample credentials is fine for a scenario that calls for it
// explicitly, but this generic interpreter should not guess at auth fields.
export type InterpretedAction =
  | { kind: "click"; selectorHint: string }
  | { kind: "type"; selectorHint: string; value: string }
  | { kind: "assert" };

const SAMPLE_TEXT_VALUE = "Automated test value";

const FILLABLE_TAGS = new Set(["input", "textarea"]);

function findElementByNameFragment(
  elements: ElementSummary[],
  fragment: string,
  filter?: (el: ElementSummary) => boolean,
): ElementSummary | undefined {
  const needle = fragment.toLowerCase().trim();
  if (!needle) return undefined;
  const candidates = filter ? elements.filter(filter) : elements;
  return (
    candidates.find((e) => e.name && e.name.toLowerCase() === needle) ??
    candidates.find((e) => e.name && (needle.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(needle)))
  );
}

export function interpretStep(stepText: string, pageElements: ElementSummary[]): InterpretedAction {
  const lower = stepText.toLowerCase();

  // "type" is checked before "click": a step like "Enter a query and click
  // Search" should fill the field, not the button, even though "click" also
  // appears in the text — and requiring a fillable tag (input/textarea)
  // stops it from ever matching a same-named button by mistake.
  const typeMatch = lower.match(/(?:enter|type|fill(?:s|ed|ing)?)\s+.*?(?:into|in|for)\s+(?:the\s+)?["']?([a-z0-9 _-]{2,40})["']?/);
  if (typeMatch) {
    const target = findElementByNameFragment(
      pageElements,
      typeMatch[1],
      (e) => FILLABLE_TAGS.has(e.tag) && e.type !== "password",
    );
    if (target) return { kind: "type", selectorHint: target.selectorHint, value: SAMPLE_TEXT_VALUE };
  }

  const clickMatch = lower.match(/click(?:s|ed|ing)?\s+(?:on\s+)?(?:the\s+)?["']?([a-z0-9 _-]{2,40})["']?/);
  if (clickMatch) {
    const target = findElementByNameFragment(pageElements, clickMatch[1], (e) => !FILLABLE_TAGS.has(e.tag));
    if (target) return { kind: "click", selectorHint: target.selectorHint };
  }

  return { kind: "assert" };
}
