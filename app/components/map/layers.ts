import type { LayerVisibility, LayerVisibilityByView, MapLayer, View } from "./types";

export const defaultLayerVisibilityByView: LayerVisibilityByView = {
  density: { boundaries: true, cities: true, roads: false, candidates: false },
  population: { boundaries: true, cities: true, roads: false, candidates: false },
  placement: { boundaries: true, cities: false, roads: true, candidates: true },
};

export const getLayersForView = (layersByView: LayerVisibilityByView, view: View): LayerVisibility => layersByView[view];
export const toggleLayerForView = (layersByView: LayerVisibilityByView, view: View, layer: MapLayer): LayerVisibilityByView => ({
  ...layersByView,
  [view]: { ...layersByView[view], [layer]: !layersByView[view][layer] },
});
