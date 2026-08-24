import type { LayerVisibility, MapLayer, View } from "./types";

const layerNames: Record<MapLayer, string> = { boundaries: "Границы регионов", cities: "Города", roads: "Дороги", candidates: "Кандидаты БПЛА" };

export function MapLayerControls({ view, layers, isOpen, onOpenChange, onToggle }: { view: View; layers: LayerVisibility; isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onToggle: (layer: MapLayer) => void }) {
  const visibleLayers: MapLayer[] = view === "placement" ? ["boundaries", "cities", "roads", "candidates"] : ["boundaries", "cities", "roads"];
  return <div className="map-layer-controls">
    <button type="button" className="layers-trigger" aria-expanded={isOpen} aria-controls="map-layer-panel" onClick={() => onOpenChange(!isOpen)}>Слои</button>
    {isOpen ? <div id="map-layer-panel" className="layers-panel" aria-label="Настройки слоёв карты">
      {visibleLayers.map((layer) => <label key={layer}><input type="checkbox" checked={layers[layer]} onChange={() => onToggle(layer)} /><span>{layerNames[layer]}</span></label>)}
    </div> : null}
  </div>;
}
