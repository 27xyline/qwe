"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

type Position = [number, number];
type View = "density" | "population" | "placement";
type Geometry = { type: string; coordinates: number[][][] | number[][][][] };
type Municipality = { type: "Feature"; properties: { name: string; population: number }; geometry: Geometry };
type City = { name: string; population: number; coordinates: Position };
type MapData = { updatedAt: string; geography: { type: "FeatureCollection"; features: Municipality[] }; cities: City[] };
type MunicipalityMetric = Municipality & { properties: Municipality["properties"] & { area: number; density: number } };
type CityMetric = City & { index: number; color: string; district: string; districtDensity: number; sx: number; sy: number; x: number; y: number };
type CandidateDefinition = {
  city: string;
  district: string;
  road: string;
  roadDistance: string;
  coverage: string;
  demand: number;
  lastMile: number;
  transport: number;
  site: number;
  constraints: number;
};
type Candidate = CandidateDefinition & { coordinates: Position; sx: number; sy: number; score: number; breakdown: ScoreBreakdown[] };
type ScoreBreakdown = { label: string; value: number; weight: number; contribution: number };

const cityNames = new Set(["Балашиха", "Ногинск", "Подольск", "Химки", "Люберцы", "Мытищи", "Одинцово", "Красногорск", "Щёлково", "Электросталь"]);
const cityColors = ["#0077b6", "#00a896", "#7b2cbf", "#ef476f", "#e76f51", "#f4a261", "#6a994e", "#5e60ce", "#c1121f", "#577590"];
const candidates: CandidateDefinition[] = [
  { city: "Подольск", district: "Подольск", road: "М-2 «Крым»", roadDistance: "2,1 км", coverage: "315 тыс.", demand: 96, lastMile: 78, transport: 92, site: 82, constraints: 6 },
  { city: "Ногинск", district: "Богородский", road: "М-7 «Волга»", roadDistance: "1,8 км", coverage: "287 тыс.", demand: 79, lastMile: 85, transport: 94, site: 80, constraints: 8 },
  { city: "Коломна", district: "Коломна", road: "М-5 «Урал»", roadDistance: "3,6 км", coverage: "241 тыс.", demand: 71, lastMile: 91, transport: 79, site: 88, constraints: 7 },
  { city: "Химки", district: "Химки", road: "М-10 «Россия»", roadDistance: "2,5 км", coverage: "280 тыс.", demand: 87, lastMile: 63, transport: 71, site: 57, constraints: 16 },
  { city: "Серпухов", district: "Серпухов", road: "М-2 «Крым»", roadDistance: "2,9 км", coverage: "198 тыс.", demand: 62, lastMile: 88, transport: 76, site: 91, constraints: 8 },
];
const keyRoads: { name: string; type: "federal" | "ring"; points: Position[] }[] = [
  { name: "М-1 «Беларусь»", type: "federal", points: [[35.15, 55.53], [35.64, 55.56], [36.16, 55.58], [36.7, 55.69], [37.18, 55.76], [37.62, 55.76]] },
  { name: "М-2 «Крым»", type: "federal", points: [[37.62, 55.76], [37.63, 55.57], [37.54, 55.43], [37.65, 55.22], [37.72, 55.0], [37.8, 54.83]] },
  { name: "М-3 «Украина»", type: "federal", points: [[37.62, 55.76], [37.4, 55.65], [37.23, 55.5], [36.93, 55.39], [36.76, 55.29]] },
  { name: "М-4 «Дон»", type: "federal", points: [[37.62, 55.76], [37.75, 55.56], [37.83, 55.39], [38.0, 55.22], [38.2, 55.02]] },
  { name: "М-5 «Урал»", type: "federal", points: [[37.62, 55.76], [37.88, 55.73], [38.2, 55.66], [38.56, 55.58], [39.0, 55.53]] },
  { name: "М-7 «Волга»", type: "federal", points: [[37.62, 55.76], [37.88, 55.77], [38.17, 55.79], [38.44, 55.86], [38.8, 55.93], [39.1, 56.03]] },
  { name: "М-8 «Холмогоры»", type: "federal", points: [[37.62, 55.76], [37.82, 55.88], [38.03, 56.03], [38.18, 56.2], [38.3, 56.4]] },
  { name: "М-9 «Балтия»", type: "federal", points: [[37.62, 55.76], [37.26, 55.82], [36.86, 55.87], [36.44, 55.95], [36.1, 56.02]] },
  { name: "М-10 «Россия»", type: "federal", points: [[37.62, 55.76], [37.52, 55.89], [37.45, 56.1], [37.4, 56.33], [37.47, 56.55]] },
  { name: "А-107 · малое кольцо", type: "ring", points: [[36.75, 55.68], [37.05, 55.45], [37.48, 55.36], [38.0, 55.4], [38.38, 55.63], [38.22, 55.9], [37.82, 56.02], [37.27, 55.98], [36.75, 55.68]] },
  { name: "А-108 · большое кольцо", type: "ring", points: [[36.08, 55.63], [36.47, 55.25], [37.17, 55.08], [38.05, 55.1], [38.67, 55.46], [38.75, 56.0], [38.38, 56.32], [37.72, 56.48], [36.82, 56.33], [36.25, 56.05], [36.08, 55.63]] },
];
const formatter = new Intl.NumberFormat("ru-RU");
const formatNumber = (value: number) => formatter.format(Math.round(value));

function MapMark() { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6.5 9.5 4l5 2.5L20 4v13.5l-5.5 2.5-5-2.5L4 20V6.5Z" /><path d="M9.5 4v13.5M14.5 6.5V20" /></svg>; }
function Slider({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) { return <label className="weight-control"><span>{label}</span><output>{value}%</output><input aria-label={label} type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }

export function PopulationMap() {
  const [rawData, setRawData] = useState<MapData | null>(null);
  const [view, setView] = useState<View>("density");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState("Подольск");
  const [mapViewport, setMapViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const dragStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const [demandWeight, setDemandWeight] = useState(30);
  const [lastMileWeight, setLastMileWeight] = useState(25);
  const [transportWeight, setTransportWeight] = useState(20);
  const [siteWeight, setSiteWeight] = useState(15);
  const [constraintWeight, setConstraintWeight] = useState(10);
  const [minimumScore, setMinimumScore] = useState(70);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/moscow-oblast-municipalities.json", { signal: controller.signal }).then((response) => response.json()).then((data: MapData) => setRawData(data)).catch((error: unknown) => { if (error instanceof Error && error.name !== "AbortError") console.error("Could not load map data", error); });
    return () => controller.abort();
  }, []);

  const model = useMemo(() => {
    if (!rawData) return null;
    const radius = 6371.0088;
    const features = rawData.geography.features.map((feature) => { const area = d3.geoArea(feature as d3.ExtendedFeature) * radius * radius; return { ...feature, properties: { ...feature.properties, area, density: feature.properties.population / area } } as MunicipalityMetric; });
    const collection = { type: "FeatureCollection", features } as unknown as d3.ExtendedFeatureCollection;
    const projection = d3.geoConicConformal().parallels([54.5, 57.5]).rotate([-37.5, 0]).fitExtent([[35, 24], [965, 565]], collection);
    const path = d3.geoPath(projection);
    const cities = rawData.cities.filter((city) => cityNames.has(city.name)).toSorted((a, b) => b.population - a.population).map((city, index) => {
      const district = features.find((feature) => d3.geoContains(feature as d3.ExtendedFeature, city.coordinates));
      const [sx, sy] = projection(city.coordinates) ?? [0, 0];
      const angle = index * 2.3999632297; const offset = 9 + index;
      return { ...city, index: index + 1, color: cityColors[index], district: district?.properties.name ?? "Московская область", districtDensity: district?.properties.density ?? 0, sx, sy, x: sx + Math.cos(angle) * offset, y: sy + Math.sin(angle) * offset } as CityMetric;
    });
    for (let step = 0; step < 120; step += 1) { for (let firstIndex = 0; firstIndex < cities.length; firstIndex += 1) { for (let secondIndex = firstIndex + 1; secondIndex < cities.length; secondIndex += 1) { const first = cities[firstIndex]; const second = cities[secondIndex]; const dx = second.x - first.x; const dy = second.y - first.y; const distance = Math.hypot(dx, dy) || .01; if (distance < 25) { const push = (25 - distance) / 2; first.x -= dx / distance * push; first.y -= dy / distance * push; second.x += dx / distance * push; second.y += dy / distance * push; } } } cities.forEach((city) => { city.x += (city.sx - city.x) * .028; city.y += (city.sy - city.y) * .028; }); }
    const cityByName = new Map(rawData.cities.map((city) => [city.name, city]));
    const ranked = candidates.map((candidate) => {
      const city = cityByName.get(candidate.city);
      if (!city) return null;
      const [sx, sy] = projection(city.coordinates) ?? [0, 0];
      const breakdown = [
        { label: "Спрос на доставку", value: candidate.demand, weight: demandWeight },
        { label: "Последняя миля", value: candidate.lastMile, weight: lastMileWeight },
        { label: "Транспорт и логистика", value: candidate.transport, weight: transportWeight },
        { label: "Пригодность площадки", value: candidate.site, weight: siteWeight },
        { label: "Воздушные ограничения", value: 100 - candidate.constraints, weight: constraintWeight },
      ];
      const totalWeight = breakdown.reduce((sum, factor) => sum + factor.weight, 0);
      const score = totalWeight ? breakdown.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / totalWeight : 0;
      return { ...candidate, coordinates: city.coordinates, sx, sy, score, breakdown: breakdown.map((factor) => ({ ...factor, contribution: totalWeight ? factor.value * factor.weight / totalWeight : 0 })) } as Candidate;
    }).filter((candidate): candidate is Candidate => candidate !== null).toSorted((first, second) => second.score - first.score);
    const population = features.map((feature) => feature.properties.population); const density = features.map((feature) => feature.properties.density);
    return { features, path, projection, cities, ranked, scales: { population: d3.scaleSequentialLog([d3.min(population) ?? 1, d3.max(population) ?? 1], d3.interpolateYlGnBu), density: d3.scaleSequentialLog([Math.max(1, d3.min(density) ?? 1), d3.max(density) ?? 1], d3.interpolateYlGnBu) } };
  }, [rawData, demandWeight, lastMileWeight, transportWeight, siteWeight, constraintWeight]);

  if (!model || !rawData) return <div className="map-loading">Загружаем карту и данные…</div>;
  const isPlacement = view === "placement";
  const activeScale = model.scales[view === "population" ? "population" : "density"];
  const domain = activeScale.domain(); const legendValues = d3.range(5).map((index) => domain[0] * (domain[1] / domain[0]) ** (index / 4));
  const selectedFeature = model.features.find((feature) => feature.properties.name === selectedMunicipality);
  const selectedMapCity = model.cities.find((city) => city.name === selectedCityName);
  const selected = model.ranked.find((candidate) => candidate.city === selectedCity) ?? model.ranked[0];
  const eligibleCandidates = model.ranked.filter((candidate) => candidate.score >= minimumScore);
  const roadLines = keyRoads.map((road) => ({ ...road, d: d3.line<Position>().x((point) => model.projection(point)?.[0] ?? 0).y((point) => model.projection(point)?.[1] ?? 0)(road.points) }));
  const clampOffset = (value: number, scale: number, axis: "x" | "y") => {
    const limit = (scale - 1) * (axis === "x" ? 260 : 165);
    return Math.max(-limit, Math.min(limit, value));
  };
  const changeZoom = (amount: number) => setMapViewport((current) => {
    const scale = Math.max(1, Math.min(3, Number((current.scale + amount).toFixed(1))));
    return { scale, x: clampOffset(current.x, scale, "x"), y: clampOffset(current.y, scale, "y") };
  });
  const handleWheelZoom = (event: React.WheelEvent<SVGSVGElement>) => { event.preventDefault(); changeZoom(event.deltaY < 0 ? .2 : -.2); };
  const startMapDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (target.closest(".city-marker, .candidate-marker, .municipality")) return;
    if (mapViewport.scale === 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, x: mapViewport.x, y: mapViewport.y };
    setIsDraggingMap(true);
  };
  const moveMapDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart.current) return;
    const x = clampOffset(dragStart.current.x + event.clientX - dragStart.current.pointerX, mapViewport.scale, "x");
    const y = clampOffset(dragStart.current.y + event.clientY - dragStart.current.pointerY, mapViewport.scale, "y");
    setMapViewport((current) => ({ ...current, x, y }));
  };
  const endMapDrag = () => { dragStart.current = null; setIsDraggingMap(false); };
  const toggleMapCity = (city: CityMetric) => { setSelectedCityName((current) => current === city.name ? null : city.name); setSelectedMunicipality(null); };
  const simpleTitle = selectedMapCity ? `${selectedMapCity.name} · город` : selectedFeature?.properties.name ?? "Московская область";
  const simplePopulation = selectedMapCity ? `${formatNumber(selectedMapCity.population)} чел.` : selectedFeature ? `${formatNumber(selectedFeature.properties.population)} чел.` : `${formatNumber(d3.sum(model.features, (feature) => feature.properties.population))} чел.`;
  const simpleDensity = selectedMapCity ? `${formatNumber(selectedMapCity.districtDensity)} чел./км²` : selectedFeature ? `${formatNumber(selectedFeature.properties.density)} чел./км²` : "Выберите муниципалитет или город";

  return <main className={isPlacement ? "app-shell placement-page" : "app-shell"}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">●●●</span><span>Население Московской области</span></div>
      <div className="source-line">Данные на 01.01.2025 · муниципальные итоги Мосстата</div>
      <nav className="metric-switch" aria-label="Режим карты">
        <button type="button" aria-pressed={view === "density"} onClick={() => setView("density")}>Плотность</button>
        <button type="button" aria-pressed={view === "population"} onClick={() => setView("population")}>Население</button>
        <button type="button" className="placement-tab" aria-pressed={view === "placement"} onClick={() => setView("placement")}>Подбор баз БПЛА</button>
      </nav>
    </header>
    {isPlacement ? <section className="decision-layout" aria-label="Подбор площадок для баз БПЛА">
      <aside className="criteria-panel"><div className="panel-heading"><div className="placement-heading"><MapMark /><div><h2>Подбор баз БПЛА</h2><p>Модель первичного отбора площадок</p></div></div><p className="workflow-intro">Рейтинг объединяет спрос, эффект последней мили, транспортную доступность, пригодность участка и ограничения полётов.</p></div>
        <div className="step-label"><b>1</b><span>Задайте важность критериев</span></div>
        <Slider label="Спрос на доставку" value={demandWeight} onChange={setDemandWeight} /><Slider label="Эффект последней мили" value={lastMileWeight} onChange={setLastMileWeight} /><Slider label="Транспорт и логистика" value={transportWeight} onChange={setTransportWeight} /><Slider label="Пригодность площадки" value={siteWeight} onChange={setSiteWeight} /><Slider label="Отсутствие ограничений" value={constraintWeight} onChange={setConstraintWeight} />
        <label className="threshold-control"><span>Минимальный рейтинг для отбора</span><output>{minimumScore} баллов</output><input aria-label="Минимальный рейтинг для отбора" type="range" min="0" max="100" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} /></label>
        <p className="formula">Рейтинг — средневзвешенная оценка пяти факторов. Ограничения понижают балл: 100 означает отсутствие ограничений.</p><p className="demo-note">Данные в прототипе демонстрационные. До операционного решения нужны актуальные геоданные, проверка воздушных зон и участка.</p>
        <section className="ranking"><div className="step-label"><b>3</b><span>Сравните кандидатов</span></div><h2>{eligibleCandidates.length} из {model.ranked.length} проходят порог <small>нажмите, чтобы увидеть детали</small></h2><ol>{model.ranked.map((candidate, index) => <li key={candidate.city}><button className={`${candidate.city === selected.city ? "rank-row selected" : "rank-row"}${candidate.score < minimumScore ? " below-threshold" : ""}`} type="button" onClick={() => setSelectedCity(candidate.city)}><b>{index + 1}</b><span><strong>{candidate.city}</strong><small>{candidate.road} · {candidate.roadDistance}</small></span><em>{Math.round(candidate.score)}</em></button></li>)}</ol></section>
      </aside>
      <section className="map-area" aria-label="Карта кандидатов и ключевых дорог"><div className="map-toolbar"><b>2. Изучите транспортные коридоры</b><span className="muted">нажмите на точку или строку кандидата</span></div><svg className={isDraggingMap ? "zoomable-map dragging" : "zoomable-map"} style={{ transform: `translate(${mapViewport.x}px, ${mapViewport.y}px) scale(${mapViewport.scale})` }} onWheel={handleWheelZoom} onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag} viewBox="0 0 1000 610" role="img" aria-label="Карта Московской области с кандидатами и ключевыми автомобильными дорогами"><rect width="1000" height="610" className="map-water" />{model.features.map((feature) => <path key={feature.properties.name} d={model.path(feature) ?? undefined} fill={model.scales.density(feature.properties.density)} className="municipality" />)}<path d={model.path({ type: "FeatureCollection", features: model.features } as unknown as d3.ExtendedFeatureCollection) ?? undefined} className="region-outline" />{roadLines.map((road) => <path key={road.name} d={road.d ?? undefined} className={`road-line ${road.type}`} />)}{model.ranked.map((candidate, index) => <g key={candidate.city} className={candidate.city === selected.city ? "candidate-marker active" : "candidate-marker"} transform={`translate(${candidate.sx}, ${candidate.sy})`} role="button" tabIndex={0} aria-label={`${index + 1}. ${candidate.city}: ${Math.round(candidate.score)} баллов`} onClick={() => setSelectedCity(candidate.city)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCity(candidate.city); } }}><circle className="candidate-range" r="29" /><circle className="candidate-dot" r="14" /><text>{index + 1}</text></g>)}</svg><div className="zoom-controls" aria-label="Масштаб карты"><button type="button" onClick={() => changeZoom(.2)} aria-label="Приблизить">+</button><button type="button" onClick={() => changeZoom(-.2)} aria-label="Отдалить">−</button><button type="button" onClick={() => setMapViewport({ scale: 1, x: 0, y: 0 })} aria-label="Сбросить масштаб">⌂</button></div><div className="map-key"><div><b>Плотность, чел./км²</b>{legendValues.map((value) => <span key={value}><i style={{ background: model.scales.density(value) }} />{formatNumber(value)}</span>)}</div><div><b>Ключевые автодороги</b><span><i className="road-swatch federal" />Федеральные магистрали</span><span><i className="road-swatch ring" />А-107 и А-108</span><small>Схема ориентировочная</small></div></div></section>
      <section className="selected-detail" aria-live="polite"><div className="detail-title"><span>Кандидат №{model.ranked.findIndex((candidate) => candidate.city === selected.city) + 1} · {selected.score >= minimumScore ? "проходит порог" : "ниже порога"}</span><h2>{selected.city}</h2><p>{selected.district} городской округ</p></div><div className="score-box"><span>Предварительный рейтинг</span><strong>{Math.round(selected.score)}</strong><small>из 100</small></div><div className="detail-metrics"><div><span>Охват населения</span><b>{selected.coverage}</b><small>в зоне анализа</small></div><div><span>Ближайшая магистраль</span><b>{selected.road}</b><small>{selected.roadDistance} от точки</small></div></div><div className="score-breakdown"><h3>Что формирует рейтинг</h3>{selected.breakdown.map((factor) => <div className="factor-row" key={factor.label}><span>{factor.label}</span><div aria-label={`${factor.label}: ${Math.round(factor.value)} из 100`}><i style={{ width: `${factor.value}%` }} /></div><b>{Math.round(factor.value)}</b><small>вес {factor.weight}%</small></div>)}</div><div className="why"><h3>Следующий шаг</h3><p>Проверьте актуальные запретные зоны, статус земли, подключение к электросети и точное время обслуживания. Только после этого площадку можно утверждать.</p></div></section>
    </section> : <section className="simple-workspace" aria-label="Карта населения Московской области">
      <div className="simple-map-frame"><svg className={isDraggingMap ? "zoomable-map dragging" : "zoomable-map"} style={{ transform: `translate(${mapViewport.x}px, ${mapViewport.y}px) scale(${mapViewport.scale})` }} onWheel={handleWheelZoom} onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag} viewBox="0 0 1000 610" role="img" aria-label={`Муниципалитеты Московской области по показателю: ${view === "density" ? "плотность" : "население"}`}><rect width="1000" height="610" className="map-water" />{model.features.map((feature) => <path key={feature.properties.name} d={model.path(feature) ?? undefined} fill={activeScale(feature.properties[view])} className={selectedFeature?.properties.name === feature.properties.name ? "municipality selected" : "municipality"} role="button" tabIndex={0} aria-label={`${feature.properties.name}: ${formatNumber(feature.properties.population)} жителей`} onClick={() => { setSelectedMunicipality(feature.properties.name); setSelectedCityName(null); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMunicipality(feature.properties.name); setSelectedCityName(null); } }} />)}<path d={model.path({ type: "FeatureCollection", features: model.features } as unknown as d3.ExtendedFeatureCollection) ?? undefined} className="region-outline" />{model.cities.map((city) => <g key={city.name}><line x1={city.sx} y1={city.sy} x2={city.x} y2={city.y} stroke={city.color} className="city-leader" /><circle cx={city.sx} cy={city.sy} r="3" fill={city.color} /><g transform={`translate(${city.x}, ${city.y})`} className={selectedMapCity?.name === city.name ? "city-marker selected" : "city-marker"} role="button" tabIndex={0} aria-label={`${city.index}. ${city.name}: ${formatNumber(city.population)} жителей`} onClick={(event) => { event.stopPropagation(); toggleMapCity(city); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleMapCity(city); } }}><circle r="10" fill={city.color} /><text>{city.index}</text></g></g>)}</svg><div className="simple-zoom-controls zoom-controls" aria-label="Масштаб карты"><button type="button" onClick={() => changeZoom(.2)} aria-label="Приблизить">+</button><button type="button" onClick={() => changeZoom(-.2)} aria-label="Отдалить">−</button><button type="button" onClick={() => setMapViewport({ scale: 1, x: 0, y: 0 })} aria-label="Сбросить масштаб">⌂</button></div><p>Колесо мыши меняет масштаб. После приближения зажмите карту и перетаскивайте её. Нажмите на номер города, чтобы увидеть информацию; повторное нажатие вернёт сводку по области.</p></div>
      <aside className="simple-side"><section className="simple-detail"><h2>{simpleTitle}</h2><dl><div><dt>{selectedMapCity ? "Население города" : "Население"}</dt><dd>{simplePopulation}</dd></div><div><dt>{selectedMapCity ? "Плотность округа" : "Плотность"}</dt><dd>{simpleDensity}</dd></div></dl></section><section className="simple-legend"><h2>{view === "density" ? "Плотность, чел./км²" : "Население, чел."}</h2>{legendValues.map((value) => <span key={value}><i style={{ background: activeScale(value) }} />{formatNumber(value)}</span>)}</section><section className="city-list"><h2>10 крупнейших городов</h2><ol>{model.cities.map((city) => <li key={city.name}><button type="button" onClick={() => toggleMapCity(city)}><b style={{ background: city.color }}>{city.index}</b><span>{city.name}</span><em>{view === "density" ? `${formatNumber(city.districtDensity)} чел./км²` : `${formatNumber(city.population)} чел.`}</em></button></li>)}</ol></section></aside>
    </section>}
  </main>;
}
