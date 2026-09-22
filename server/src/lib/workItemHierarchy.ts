import { prisma } from "./prisma.js";
import type { WorkItemType } from "@prisma/client";

export type WorkItemAncestor = { id: string; key: string; title: string; type: WorkItemType };

// Walks up a work item's parentId chain. N+1 by construction (one query per
// level) — an intentional, pre-existing tradeoff (ancestor chains are
// shallow in practice), capped at 20 levels as a hard safety bound. Shared
// by the existing ancestor-breadcrumb use (GET /work-items/:id) and the
// Work-Item-to-Requirement generation flow, instead of each defining its own copy.
export async function buildAncestors(workItem: { parentId: string | null }): Promise<WorkItemAncestor[]> {
  const ancestors: WorkItemAncestor[] = [];
  let currentParentId = workItem.parentId;
  let guard = 0;
  while (currentParentId && guard < 20) {
    const parent = await prisma.workItem.findUnique({
      where: { id: currentParentId },
      select: { id: true, key: true, title: true, type: true, parentId: true },
    });
    if (!parent) break;
    ancestors.unshift({ id: parent.id, key: parent.key, title: parent.title, type: parent.type });
    currentParentId = parent.parentId;
    guard++;
  }
  return ancestors;
}

export type WorkItemHierarchyNode = {
  id: string;
  parentId: string | null;
  type: WorkItemType;
  key: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  severity: string | null;
  environment: string | null;
  stepsToReproduce: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  acceptanceCriteria: string[];
};

// Defensive cap against pathological trees — not a "fixed depth" (the walk
// is still unbounded in depth/shape), purely a payload-size safety valve.
// Callers must surface `truncated` to the user rather than silently
// dropping items, per the "don't hardcode counts, but be reasonably
// performant" balance this feature needs to strike.
export const MAX_SUBTREE_NODES = 300;

// Pure BFS over an already-fetched flat {id, parentId}[] list — separated
// from getWorkItemSubtree below so the traversal (ordering, the duplicate
// guard against a malformed parentId cycle, the truncation cap) can be unit
// tested without a database. Includes rootId itself in the result,
// matching getFolderDescendantIds' (routes/folders.ts) same convention.
export function walkSubtree(
  items: { id: string; parentId: string | null }[],
  rootId: string,
  maxNodes: number = MAX_SUBTREE_NODES,
): { orderedIds: string[]; truncated: boolean } {
  const byId = new Map(items.map((w) => [w.id, w]));
  const childrenByParent = new Map<string, string[]>();
  for (const w of items) {
    if (!w.parentId) continue;
    const list = childrenByParent.get(w.parentId) ?? [];
    list.push(w.id);
    childrenByParent.set(w.parentId, list);
  }

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  const queue = [rootId];
  let truncated = false;
  while (queue.length > 0) {
    if (orderedIds.length >= maxNodes) {
      truncated = true;
      break;
    }
    const id = queue.shift()!;
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }

  return { orderedIds, truncated };
}

// Single-query BFS — mirrors getFolderDescendantIds in routes/folders.ts
// (load every row for the project once, walk an in-memory parent->children
// map) rather than buildAncestors' N+1 shape, since a subtree can be much
// wider/deeper than an ancestor chain. Acceptance criteria are a real child
// table (WorkItemAcceptanceCriterion), not a column, so they need a second
// query — not "free" to include.
export async function getWorkItemSubtree(
  projectId: string,
  rootId: string,
): Promise<{ nodes: WorkItemHierarchyNode[]; truncated: boolean }> {
  const all = await prisma.workItem.findMany({
    where: { projectId },
    select: {
      id: true,
      parentId: true,
      type: true,
      key: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      severity: true,
      environment: true,
      stepsToReproduce: true,
      expectedResult: true,
      actualResult: true,
    },
  });
  const byId = new Map(all.map((w) => [w.id, w]));
  const { orderedIds, truncated } = walkSubtree(all, rootId);

  const criteria = await prisma.workItemAcceptanceCriterion.findMany({
    where: { workItemId: { in: orderedIds } },
    select: { workItemId: true, text: true },
    orderBy: { order: "asc" },
  });
  const criteriaByWorkItem = new Map<string, string[]>();
  for (const c of criteria) {
    const list = criteriaByWorkItem.get(c.workItemId) ?? [];
    list.push(c.text);
    criteriaByWorkItem.set(c.workItemId, list);
  }

  const nodes: WorkItemHierarchyNode[] = orderedIds.map((id) => {
    const w = byId.get(id)!;
    return { ...w, acceptanceCriteria: criteriaByWorkItem.get(id) ?? [] };
  });

  return { nodes, truncated };
}

export function summarizeByType(nodes: { type: WorkItemType }[]): Record<string, number> {
  const byType: Record<string, number> = {};
  for (const n of nodes) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
  }
  return byType;
}

// Translates the AI's cited "key" strings (e.g. "FEATURE-002") back to real
// database ids, using only the keys that were actually part of the
// analyzed payload — any key the model invents that wasn't given to it is
// silently dropped (defense against a hallucinated citation), and if
// nothing survives, the traceability falls back to the item the user
// selected rather than a requirement with no source at all.
export function resolveSourceWorkItemIds(keys: string[], keyToId: Map<string, string>, fallbackId: string): string[] {
  const ids = keys.map((k) => keyToId.get(k)).filter((id): id is string => !!id);
  return ids.length > 0 ? ids : [fallbackId];
}
