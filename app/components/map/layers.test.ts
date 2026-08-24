import { describe, expect, it } from "vitest";
import { defaultLayerVisibilityByView, getLayersForView, toggleLayerForView } from "./layers";

describe("настройки слоёв", () => {
  it("задаёт отдельные настройки по умолчанию для каждого режима", () => {
    expect(defaultLayerVisibilityByView.density).toEqual({ boundaries: true, cities: true, roads: false, candidates: false });
    expect(defaultLayerVisibilityByView.placement).toEqual({ boundaries: true, cities: false, roads: true, candidates: true });
  });
  it("изменяет слой только активного режима", () => {
    const next = toggleLayerForView(defaultLayerVisibilityByView, "density", "roads");
    expect(getLayersForView(next, "density").roads).toBe(true);
    expect(getLayersForView(next, "placement").roads).toBe(true);
    expect(next.population).toEqual(defaultLayerVisibilityByView.population);
  });
});
