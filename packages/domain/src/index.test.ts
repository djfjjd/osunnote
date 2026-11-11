import { describe, expect, it } from "vitest";
import {
  calendarEventOccurrence, calendarMonth, countCharacters, createDocument, createHomeWorkspace, initialWorkspace, koreanHoliday,
  saveDocument, searchDocuments,
} from "./index";

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

  it("creates a persistent editable home workspace", () => {
    const home = createHomeWorkspace();
    expect(home.pages).toHaveLength(1);
    expect(home.pages[0]!.blocks[0]).toMatchObject({ type: "text", content: "" });
    expect(home.pages[0]!.widgets.map((widget) => widget.type)).toEqual(["tasks", "upcoming", "recent-documents", "finance"]);
    expect(initialWorkspace().home.activePageId).toBeTruthy();
    expect(initialWorkspace().todos).toEqual([]);
    expect(initialWorkspace().calendarEvents).toEqual([]);
  });
});

describe("Korean calendar", () => {
  it("marks fixed, lunar and substitute public holidays", () => {
    expect(koreanHoliday("2026-03-01")?.name).toBe("삼일절");
    expect(koreanHoliday("2026-09-25")?.name).toBe("추석");
    expect(koreanHoliday("2026-10-05")?.name).toBe("개천절 대체공휴일");
    expect(koreanHoliday("2026-11-09")).toBeUndefined();
  });

  it("builds a six-week month with stable weekday values", () => {
    const days = calendarMonth(2026, 11);
    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ date: "2026-11-01", dayOfWeek: 0, inCurrentMonth: true });
    expect(days[6]).toMatchObject({ date: "2026-11-07", dayOfWeek: 6, inCurrentMonth: true });
  });

  it("calculates monthly events and moves holidays to the previous business day", () => {
    const event = { id: "event", title: "정산", date: "2026-10-05", recurrence: "monthly-day" as const, monthDay: 5, adjustPreviousBusinessDay: true, createdAt: 1, updatedAt: 1 };
    expect(calendarEventOccurrence(event, 2026, 10)).toBe("2026-10-02");
    expect(calendarEventOccurrence({ ...event, recurrence: "monthly-weekday", weekOfMonth: 2, dayOfWeek: 1, adjustPreviousBusinessDay: false }, 2026, 11)).toBe("2026-11-09");
  });
});
