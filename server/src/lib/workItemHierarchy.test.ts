import { describe, expect, it } from "vitest";
import type { WorkItemType } from "@prisma/client";
import { resolveSourceWorkItemIds, summarizeByType, walkSubtree } from "./workItemHierarchy.js";

type Node = { id: string; parentId: string | null; type: WorkItemType };

// Epic -> Feature -> Story -> Task/Defect, matching the hierarchy depth the
// app actually supports (per ALLOWED_PARENT_TYPES in app/src/pages/work-items/constants.ts).
function demandPlanningTree(): Node[] {
  return [
    { id: "epic-1", parentId: null, type: "Epic" },
    { id: "feature-1", parentId: "epic-1", type: "Feature" },
    { id: "feature-2", parentId: "epic-1", type: "Feature" },
    { id: "story-1", parentId: "feature-1", type: "Story" },
    { id: "task-1", parentId: "feature-1", type: "Task" },
    { id: "defect-1", parentId: "feature-1", type: "Defect" },
    { id: "story-2", parentId: "feature-2", type: "Story" },
    { id: "task-2", parentId: "feature-2", type: "Task" },
    // Unrelated sibling tree — must never appear when walking from epic-1.
    { id: "epic-2", parentId: null, type: "Epic" },
    { id: "feature-3", parentId: "epic-2", type: "Feature" },
  ];
}

describe("walkSubtree", () => {
  it("collects the full descendant subtree of an Epic, including the Epic itself", () => {
    const { orderedIds, truncated } = walkSubtree(demandPlanningTree(), "epic-1");
    expect(truncated).toBe(false);
    expect(new Set(orderedIds)).toEqual(
      new Set(["epic-1", "feature-1", "feature-2", "story-1", "task-1", "defect-1", "story-2", "task-2"]),
    );
    expect(orderedIds[0]).toBe("epic-1");
  });

  it("does not include an unrelated sibling Epic's descendants", () => {
    const { orderedIds } = walkSubtree(demandPlanningTree(), "epic-1");
    expect(orderedIds).not.toContain("epic-2");
    expect(orderedIds).not.toContain("feature-3");
  });

  it("scopes to just the Feature and its descendants when a Feature is selected", () => {
    const { orderedIds } = walkSubtree(demandPlanningTree(), "feature-1");
    expect(new Set(orderedIds)).toEqual(new Set(["feature-1", "story-1", "task-1", "defect-1"]));
  });

  it("scopes to just the Story and its descendants when a Story is selected", () => {
    const tree = [...demandPlanningTree(), { id: "subtask-1", parentId: "story-1", type: "SubTask" }];
    const { orderedIds } = walkSubtree(tree, "story-1");
    expect(new Set(orderedIds)).toEqual(new Set(["story-1", "subtask-1"]));
  });

  it("returns just the item itself when a leaf Task is selected", () => {
    const { orderedIds, truncated } = walkSubtree(demandPlanningTree(), "task-1");
    expect(orderedIds).toEqual(["task-1"]);
    expect(truncated).toBe(false);
  });

  it("returns an empty result for a root id that doesn't exist in the project", () => {
    const { orderedIds, truncated } = walkSubtree(demandPlanningTree(), "does-not-exist");
    expect(orderedIds).toEqual([]);
    expect(truncated).toBe(false);
  });

  it("is safe against a malformed parentId cycle (never loops forever, never duplicates a node)", () => {
    const cyclic: Node[] = [
      { id: "a", parentId: "b", type: "Epic" },
      { id: "b", parentId: "a", type: "Epic" },
    ];
    const { orderedIds } = walkSubtree(cyclic, "a", 100);
    expect(orderedIds).toEqual(["a", "b"]);
  });

  it("caps the walk at maxNodes and reports truncated", () => {
    const wide: Node[] = [{ id: "root", parentId: null, type: "Epic" }];
    for (let i = 0; i < 50; i++) wide.push({ id: `child-${i}`, parentId: "root", type: "Task" });
    const { orderedIds, truncated } = walkSubtree(wide, "root", 10);
    expect(orderedIds).toHaveLength(10);
    expect(truncated).toBe(true);
  });

  it("does not truncate when the tree fits exactly within maxNodes", () => {
    const wide: Node[] = [{ id: "root", parentId: null, type: "Epic" }];
    for (let i = 0; i < 9; i++) wide.push({ id: `child-${i}`, parentId: "root", type: "Task" });
    const { orderedIds, truncated } = walkSubtree(wide, "root", 10);
    expect(orderedIds).toHaveLength(10);
    expect(truncated).toBe(false);
  });
});

describe("summarizeByType", () => {
  it("counts nodes by type", () => {
    const counts = summarizeByType([{ type: "Epic" }, { type: "Feature" }, { type: "Feature" }, { type: "Task" }] as { type: WorkItemType }[]);
    expect(counts).toEqual({ Epic: 1, Feature: 2, Task: 1 });
  });

  it("returns an empty object for no nodes", () => {
    expect(summarizeByType([])).toEqual({});
  });

  it("matches walkSubtree's output for the Demand Planning fixture (dynamic, not hardcoded)", () => {
    const tree = demandPlanningTree();
    const { orderedIds } = walkSubtree(tree, "epic-1");
    const byId = new Map(tree.map((n) => [n.id, n]));
    const counts = summarizeByType(orderedIds.map((id) => byId.get(id)!));
    expect(counts).toEqual({ Epic: 1, Feature: 2, Story: 2, Task: 2, Defect: 1 });
  });
});

describe("resolveSourceWorkItemIds", () => {
  const keyToId = new Map([
    ["EPIC-001", "epic-1"],
    ["FEATURE-002", "feature-2"],
  ]);

  it("translates cited keys to real ids", () => {
    expect(resolveSourceWorkItemIds(["FEATURE-002"], keyToId, "epic-1")).toEqual(["feature-2"]);
  });

  it("translates multiple cited keys, preserving order", () => {
    expect(resolveSourceWorkItemIds(["EPIC-001", "FEATURE-002"], keyToId, "epic-1")).toEqual(["epic-1", "feature-2"]);
  });

  it("drops a hallucinated key that was never part of the analyzed payload", () => {
    expect(resolveSourceWorkItemIds(["FEATURE-999-MADE-UP"], keyToId, "epic-1")).toEqual(["epic-1"]);
  });

  it("falls back to the selected item when the model cites nothing", () => {
    expect(resolveSourceWorkItemIds([], keyToId, "epic-1")).toEqual(["epic-1"]);
  });

  it("falls back to the selected item when every cited key is invalid", () => {
    expect(resolveSourceWorkItemIds(["BOGUS-1", "BOGUS-2"], keyToId, "epic-1")).toEqual(["epic-1"]);
  });
});
