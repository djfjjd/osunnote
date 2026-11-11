import { describe, expect, it } from "vitest";
import { createDocument, initialWorkspace } from "@osunnote/domain";
import { parseWorkspaceBackup, serializeWorkspaceBackup } from "./storage";

describe("workspace backup files", () => {
  it("round-trips a complete workspace without dropping documents", () => {
    const workspace = initialWorkspace();
    const restored = parseWorkspaceBackup(serializeWorkspaceBackup(workspace));
    expect(restored.projects[0]?.documents).toEqual(workspace.projects[0]?.documents);
    expect(restored.revision).toBe(workspace.revision);
  });

  it("rejects malformed and unsupported backup files", () => {
    expect(() => parseWorkspaceBackup("not-json")).toThrow("JSON");
    expect(() => parseWorkspaceBackup(JSON.stringify({ format: "other", version: 1, workspace: initialWorkspace() }))).toThrow("지원하지 않는");
  });

  it("preserves a workspace containing 1,000 documents", () => {
    const workspace = initialWorkspace();
    workspace.projects[0]!.documents = Array.from({ length: 1_000 }, (_, index) => ({ ...createDocument(`글 ${index + 1}`), content: `본문 ${index + 1}` }));
    const restored = parseWorkspaceBackup(serializeWorkspaceBackup(workspace));
    expect(restored.projects[0]!.documents).toHaveLength(1_000);
    expect(restored.projects[0]!.documents[999]).toMatchObject({ title: "글 1000", content: "본문 1000" });
  });
});
