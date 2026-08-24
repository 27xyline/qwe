import type { RegionFilter as RegionFilterValue, RegionId } from "./types";

type RegionOption = { id: RegionId; name: string };

export function RegionFilter({ value, regions, onChange }: { value: RegionFilterValue; regions: RegionOption[]; onChange: (value: RegionFilterValue) => void }) {
  return <label className="region-filter"><span>Регион</span><select aria-label="Регион карты" value={value} onChange={(event) => onChange(event.target.value as RegionFilterValue)}><option value="all">Все регионы</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>;
}
