import { describe, expect, it } from "vitest";
import { getSelectedCandidateIdForRegion, getVisibleCandidates, getVisibleCities, getVisibleRegionLabels } from "./selectors";

const candidate = (id: string, region: "moscow" | "tver") => ({ id, region, city: id, district: id, road: "", roadDistance: "", coverage: "", demand: 1, lastMile: 1, transport: 1, site: 1, constraints: 1, coordinates: [0, 0] as [number, number], sx: 0, sy: 0, score: 1, breakdown: [] });

describe("селекторы регионов", () => {
  it("возвращают весь набор для all", () => expect(getVisibleCandidates([candidate("a", "moscow"), candidate("b", "tver")], "all")).toHaveLength(2));
  it("оставляют только элементы выбранного региона", () => expect(getVisibleCandidates([candidate("a", "moscow"), candidate("b", "tver")], "tver").map((item) => item.id)).toEqual(["b"]));
  it("сбрасывают выбор кандидата из другого региона на лучший доступный", () => expect(getSelectedCandidateIdForRegion([candidate("a", "moscow"), candidate("b", "tver")], "a", "tver")).toBe("b"));
  it("не изменяют выбранного кандидата, если он находится в регионе", () => expect(getSelectedCandidateIdForRegion([candidate("a", "moscow"), candidate("b", "tver")], "b", "tver")).toBe("b"));
  it("возвращают пустой набор для региона без городов", () => expect(getVisibleCities([], "vologda")).toEqual([]));
  it("фильтруют подписи регионов", () => expect(getVisibleRegionLabels([{ region: "moscow", name: "Москва" }, { region: "tver", name: "Тверь" }], "moscow")).toEqual([{ region: "moscow", name: "Москва" }]));
});
