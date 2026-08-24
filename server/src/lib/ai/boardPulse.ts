import { GENERATE_TEXT_PROVIDERS, type SuggestProvider } from "./suggest.js";

export type { SuggestProvider };

export type BoardPulseItem = {
  key: string;
  type: string;
  title: string;
  status: string;
  priority: string | null;
  assignee: string | null;
  dueDate: string | null;
  daysSinceUpdate: number;
};

const SYSTEM_PROMPT = `You are an Agile delivery assistant inside Helios, a quality engineering and delivery platform. You're given a compact snapshot of every work item currently on a project's Kanban board (key, type, status, priority, assignee, due date, and days since last update). Write a short standup-style briefing for a Product Owner or Scrum Master who has 30 seconds to read it.

Structure your response as these short sections, each with a one-line heading in plain text (no markdown symbols) followed by 1-3 short bullet-style lines (start each with "- "):

Overview
Stuck Items (anything with no update in 3+ days that isn't Done)
Needs an Owner (unassigned items)
At Risk (overdue due dates, or defects blocking other work)

Skip a section entirely (heading and all) if it has nothing to report. Reference items by their key (e.g. STORY-002). Be direct and specific — no filler like "everything looks good" unless it's genuinely true. Plain text only, no markdown formatting, no preamble.`;

function formatItem(item: BoardPulseItem): string {
  const parts = [
    item.key,
    item.type,
    `status=${item.status}`,
    item.priority ? `priority=${item.priority}` : null,
    item.assignee ? `assignee=${item.assignee}` : "unassigned",
    item.dueDate ? `due=${item.dueDate.slice(0, 10)}` : null,
    `updated ${item.daysSinceUpdate}d ago`,
  ];
  return `${item.title} — ${parts.filter(Boolean).join(" · ")}`;
}

export async function summarizeBoard(items: BoardPulseItem[], provider: SuggestProvider): Promise<string> {
  const generate = GENERATE_TEXT_PROVIDERS[provider];
  if (!generate) throw new Error("This model isn't available yet.");

  if (items.length === 0) {
    return "Overview\n- The board is empty — nothing to report yet.";
  }

  const prompt = `Board snapshot (${items.length} items):\n${items.map(formatItem).join("\n")}\n\nWrite the briefing now.`;
  return generate(SYSTEM_PROMPT, prompt);
}
