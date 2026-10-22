import { describe, expect, it } from "vitest";
import { countCharacters, createDocument, initialWorkspace, saveDocument, searchDocuments } from "./index";

describe("writing domain", () => {
  it("counts visible characters without whitespace", () => {
    expect(countCharacters("안녕, 세계\n좋은 아침")).toBe(9);
  });

  it("preserves the previous body as a version", () => {
    const workspace = initialWorkspace();
    const id = workspace.activeDocumentId;
    const before = workspace.projects[0]!.documents[0]!.content;
    const updated = saveDocument(workspace, id, { content: "새 본문" }, true);
    expect(updated.revision).toBe(2);
    expect(updated.projects[0]!.documents[0]!.versions[0]!.content).toBe(before);
  });

  it("searches title, body, folder and tags", () => {
    const document = { ...createDocument("첫 장"), tags: ["미스터리"], content: "밤의 기차" };
    expect(searchDocuments([document], "미스터리")).toHaveLength(1);
    expect(searchDocuments([document], "낮")).toHaveLength(0);
  });
});
