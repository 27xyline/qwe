import { describe, expect, it } from "vitest";
import { clusterCandidates } from "./clusters";
import type { Candidate } from "./types";

const candidate = (id: string, sx: number, sy = 0): Candidate => ({ id, region: "moscow", city: id, district: id, road: "", roadDistance: "", coverage: "", demand: 1, lastMile: 1, transport: 1, site: 1, constraints: 1, coordinates: [0, 0], sx, sy, score: 1, breakdown: [] });

describe("кластеризация кандидатов", () => {
  it("не превращает одинокий кандидат в кластер", () => expect(clusterCandidates([candidate("a", 100)], 1, 1000)).toMatchObject([{ candidates: [{ id: "a" }] }]));
  it("объединяет близкие кандидаты", () => expect(clusterCandidates([candidate("a", 100), candidate("b", 130)], 1, 1000)[0].candidates).toHaveLength(2));
  it("не объединяет далёкие кандидаты", () => expect(clusterCandidates([candidate("a", 100), candidate("b", 200)], 1, 1000)).toHaveLength(2));
  it("даёт одинаковый результат вне зависимости от порядка массива", () => expect(clusterCandidates([candidate("b", 130), candidate("a", 100)], 1, 1000)).toEqual(clusterCandidates([candidate("a", 100), candidate("b", 130)], 1, 1000)));
  it("раскрывает все точки на масштабе 2.2", () => expect(clusterCandidates([candidate("a", 100), candidate("b", 130)], 2.2, 1000)).toHaveLength(2));
  it("отмечает кластер с выбранным кандидатом", () => expect(clusterCandidates([candidate("a", 100), candidate("b", 130)], 1, 1000, "b")[0].containsSelected).toBe(true));
  it("безопасно обрабатывает пустой список", () => expect(clusterCandidates([], 1, 1000)).toEqual([]));
});
