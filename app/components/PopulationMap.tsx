"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

type Position = [number, number];
type MapViewport = { scale: number; x: number; y: number };
type View = "density" | "population" | "placement";
type RegionId = "moscow" | "tver" | "vladimir" | "kaluga" | "tula" | "ryazan" | "yaroslavl" | "smolensk" | "kostroma" | "ivanovo" | "nizhny";
type Geometry = { type: string; coordinates: number[][][] | number[][][][] };
type Municipality = { type: "Feature"; properties: { name: string; population: number }; geometry: Geometry };
type City = { name: string; population: number; coordinates: Position };
type MapData = { updatedAt: string; geography: { type: "FeatureCollection"; features: Municipality[] }; cities: City[] };
type RegionMapData = MapData & { region: RegionId };
type MunicipalityMetric = Municipality & { properties: Municipality["properties"] & { region: RegionId; key: string; area: number; density: number } };
type CityMetric = City & { region: RegionId; regionName: string; index: number; color: string; district: string; districtDensity: number; sx: number; sy: number; x: number; y: number };
type RegionLayer = { region: RegionId; name: string; color: string; d: string; population: number; area: number; density: number; municipalities: number };
type CandidateDefinition = { id: string; region: RegionId; city: string; district: string; road: string; roadDistance: string; coverage: string; demand: number; lastMile: number; transport: number; site: number; constraints: number };
type ScoreBreakdown = { label: string; value: number; weight: number; contribution: number };
type Candidate = CandidateDefinition & { coordinates: Position; sx: number; sy: number; score: number; breakdown: ScoreBreakdown[] };

const regionMeta: Record<RegionId, { name: string; color: string }> = {
  moscow: { name: "Московская область", color: "#245eb7" },
  tver: { name: "Тверская область", color: "#327a76" },
  vladimir: { name: "Владимирская область", color: "#8c5d9e" },
  kaluga: { name: "Калужская область", color: "#aa6c3b" },
  tula: { name: "Тульская область", color: "#ad4e53" },
  ryazan: { name: "Рязанская область", color: "#387a9b" },
  yaroslavl: { name: "Ярославская область", color: "#6c7d35" },
  smolensk: { name: "Смоленская область", color: "#4f7598" },
  kostroma: { name: "Костромская область", color: "#8a7045" },
  ivanovo: { name: "Ивановская область", color: "#5a719a" },
  nizhny: { name: "Нижегородская область", color: "#9a5f45" },
};
const cityNames = new Set(["Балашиха", "Ногинск", "Подольск", "Химки", "Люберцы", "Мытищи", "Одинцово", "Красногорск", "Щёлково", "Электросталь", "Тверь", "Ржев", "Вышний Волочёк", "Кимры", "Торжок", "Конаково", "Удомля", "Владимир", "Ковров", "Муром", "Александров", "Гусь-Хрустальный", "Вязники", "Кольчугино", "Калуга", "Обнинск", "Людиново", "Киров", "Тула", "Новомосковск", "Алексин", "Щёкино", "Рязань", "Касимов", "Скопин", "Сасово", "Ярославль", "Рыбинск", "Переславль-Залесский", "Тутаев", "Смоленск", "Вязьма", "Рославль", "Ярцево", "Кострома", "Буй", "Галич", "Шарья", "Иваново", "Кинешма", "Шуя", "Вичуга", "Нижний Новгород", "Дзержинск", "Арзамас", "Саров"]);
const cityColors = ["#0077b6", "#00a896", "#7b2cbf", "#ef476f", "#e76f51", "#f4a261", "#6a994e", "#5e60ce", "#c1121f", "#577590", "#1982c4", "#8ac926", "#ffca3a", "#6a4c93", "#ff595e", "#2a9d8f", "#8338ec", "#118ab2", "#e63946", "#3a86ff", "#588157", "#f77f00", "#a44a3f", "#4361ee"];
const candidates: CandidateDefinition[] = [
  { id: "moscow-podolsk", region: "moscow", city: "Подольск", district: "Подольск", road: "М-2 «Крым»", roadDistance: "2,1 км", coverage: "315 тыс.", demand: 96, lastMile: 78, transport: 92, site: 82, constraints: 6 },
  { id: "moscow-noginsk", region: "moscow", city: "Ногинск", district: "Богородский", road: "М-7 «Волга»", roadDistance: "1,8 км", coverage: "287 тыс.", demand: 79, lastMile: 85, transport: 94, site: 80, constraints: 8 },
  { id: "moscow-kolomna", region: "moscow", city: "Коломна", road: "М-5 «Урал»", roadDistance: "3,6 км", coverage: "241 тыс.", demand: 71, lastMile: 91, transport: 79, site: 88, constraints: 7 },
  { id: "moscow-khimki", region: "moscow", city: "Химки", district: "Химки", road: "М-10 «Россия»", roadDistance: "2,5 км", coverage: "280 тыс.", demand: 87, lastMile: 63, transport: 71, site: 57, constraints: 16 },
  { id: "moscow-serpukhov", region: "moscow", city: "Серпухов", district: "Серпухов", road: "М-2 «Крым»", roadDistance: "2,9 км", coverage: "198 тыс.", demand: 62, lastMile: 88, transport: 76, site: 91, constraints: 8 },
  { id: "tver-tver", region: "tver", city: "Тверь", district: "Тверь", road: "М-10 «Россия»", roadDistance: "1,4 км", coverage: "413 тыс.", demand: 91, lastMile: 82, transport: 90, site: 78, constraints: 11 },
  { id: "tver-rzhev", region: "tver", city: "Ржев", district: "Ржевский", road: "М-9 «Балтия»", roadDistance: "2,8 км", coverage: "119 тыс.", demand: 61, lastMile: 84, transport: 84, site: 85, constraints: 8 },
  { id: "tver-torzhok", region: "tver", city: "Торжок", district: "Торжокский", road: "М-10 «Россия»", roadDistance: "2,3 км", coverage: "96 тыс.", demand: 64, lastMile: 86, transport: 89, site: 83, constraints: 9 },
  { id: "vladimir-vladimir", region: "vladimir", city: "Владимир", district: "Владимир", road: "М-7 «Волга»", roadDistance: "1,6 км", coverage: "344 тыс.", demand: 93, lastMile: 80, transport: 95, site: 76, constraints: 13 },
  { id: "vladimir-kovrov", region: "vladimir", city: "Ковров", district: "Ковров", road: "М-7 «Волга»", roadDistance: "3,2 км", coverage: "128 тыс.", demand: 81, lastMile: 84, transport: 86, site: 82, constraints: 9 },
  { id: "vladimir-murom", region: "vladimir", city: "Муром", district: "Муром", road: "М-12 «Восток»", roadDistance: "4,0 км", coverage: "126 тыс.", demand: 78, lastMile: 88, transport: 82, site: 86, constraints: 10 },
  { id: "kaluga-kaluga", region: "kaluga", city: "Калуга", district: "Калуга", road: "М-3 «Украина»", roadDistance: "2,2 км", coverage: "333 тыс.", demand: 86, lastMile: 81, transport: 88, site: 84, constraints: 9 },
  { id: "kaluga-obninsk", region: "kaluga", city: "Обнинск", district: "Обнинск", road: "М-3 «Украина»", roadDistance: "1,9 км", coverage: "125 тыс.", demand: 82, lastMile: 78, transport: 91, site: 76, constraints: 14 },
  { id: "tula-tula", region: "tula", city: "Тула", district: "Тула", road: "М-2 «Крым»", roadDistance: "2,0 км", coverage: "461 тыс.", demand: 92, lastMile: 82, transport: 93, site: 77, constraints: 12 },
  { id: "tula-novomoskovsk", region: "tula", city: "Новомосковск", district: "Новомосковск", road: "Р-132 «Золотое кольцо»", roadDistance: "3,1 км", coverage: "117 тыс.", demand: 76, lastMile: 85, transport: 82, site: 87, constraints: 8 },
  { id: "ryazan-ryazan", region: "ryazan", city: "Рязань", district: "Рязань", road: "М-5 «Урал»", roadDistance: "1,7 км", coverage: "520 тыс.", demand: 95, lastMile: 79, transport: 94, site: 75, constraints: 13 },
  { id: "ryazan-kasimov", region: "ryazan", city: "Касимов", district: "Касимов", road: "Р-132 «Золотое кольцо»", roadDistance: "3,4 км", coverage: "92 тыс.", demand: 59, lastMile: 87, transport: 76, site: 89, constraints: 7 },
  { id: "yaroslavl-yaroslavl", region: "yaroslavl", city: "Ярославль", district: "Ярославль", road: "М-8 «Холмогоры»", roadDistance: "1,5 км", coverage: "565 тыс.", demand: 94, lastMile: 81, transport: 95, site: 74, constraints: 12 },
  { id: "yaroslavl-rybinsk", region: "yaroslavl", city: "Рыбинск", district: "Рыбинск", road: "Р-132 «Золотое кольцо»", roadDistance: "2,7 км", coverage: "177 тыс.", demand: 80, lastMile: 84, transport: 83, site: 85, constraints: 9 },
  { id: "smolensk-smolensk", region: "smolensk", city: "Смоленск", district: "Смоленск", road: "М-1 «Беларусь»", roadDistance: "2,1 км", coverage: "314 тыс.", demand: 88, lastMile: 80, transport: 92, site: 79, constraints: 12 },
  { id: "smolensk-vyazma", region: "smolensk", city: "Вязьма", district: "Вяземский", road: "М-1 «Беларусь»", roadDistance: "2,6 км", coverage: "98 тыс.", demand: 63, lastMile: 86, transport: 89, site: 86, constraints: 8 },
  { id: "kostroma-kostroma", region: "kostroma", city: "Кострома", district: "Кострома", road: "Р-132 «Золотое кольцо»", roadDistance: "2,4 км", coverage: "268 тыс.", demand: 83, lastMile: 80, transport: 82, site: 82, constraints: 9 },
  { id: "kostroma-sharya", region: "kostroma", city: "Шарья", district: "Шарья", road: "Р-243 «Кострома — Шарья»", roadDistance: "3,7 км", coverage: "61 тыс.", demand: 52, lastMile: 88, transport: 72, site: 91, constraints: 7 },
  { id: "ivanovo-ivanovo", region: "ivanovo", city: "Иваново", district: "Иваново", road: "Р-132 «Золотое кольцо»", roadDistance: "1,8 км", coverage: "357 тыс.", demand: 90, lastMile: 80, transport: 88, site: 78, constraints: 11 },
  { id: "ivanovo-kineshma", region: "ivanovo", city: "Кинешма", district: "Кинешма", road: "Р-132 «Золотое кольцо»", roadDistance: "3,0 км", coverage: "124 тыс.", demand: 71, lastMile: 84, transport: 80, site: 86, constraints: 8 },
  { id: "nizhny-novgorod", region: "nizhny", city: "Нижний Новгород", district: "Нижний Новгород", road: "М-7 «Волга»", roadDistance: "1,5 км", coverage: "1,2 млн", demand: 98, lastMile: 78, transport: 97, site: 72, constraints: 16 },
  { id: "nizhny-dzerzhinsk", region: "nizhny", city: "Дзержинск", district: "Дзержинск", road: "М-7 «Волга»", roadDistance: "2,1 км", coverage: "228 тыс.", demand: 85, lastMile: 83, transport: 94, site: 80, constraints: 12 },
];
const keyRoads: { name: string; type: "federal" | "ring"; points: Position[] }[] = [
  { name: "М-1 «Беларусь»", type: "federal", points: [[32.04, 54.78], [32.55, 54.9], [33.1, 54.98], [34.3, 55.21], [35.15, 55.53], [35.64, 55.56], [36.16, 55.58], [36.7, 55.69], [37.18, 55.76], [37.62, 55.76]] },
  { name: "М-2 «Крым»", type: "federal", points: [[37.62, 55.76], [37.63, 55.57], [37.54, 55.43], [37.65, 55.22], [37.8, 54.83], [37.62, 54.52], [37.62, 54.19]] },
  { name: "М-3 «Украина»", type: "federal", points: [[37.62, 55.76], [37.4, 55.65], [37.23, 55.5], [36.93, 55.39], [36.76, 55.29], [36.61, 55.11], [36.26, 54.51]] },
  { name: "М-4 «Дон»", type: "federal", points: [[37.62, 55.76], [37.75, 55.56], [37.83, 55.39], [38.0, 55.22], [38.2, 55.02]] },
  { name: "М-5 «Урал»", type: "federal", points: [[37.62, 55.76], [37.88, 55.73], [38.2, 55.66], [38.56, 55.58], [39.0, 55.53], [39.4, 55.23], [39.73, 54.63]] },
  { name: "М-7 «Волга»", type: "federal", points: [[37.62, 55.76], [37.88, 55.77], [38.17, 55.79], [38.44, 55.86], [38.8, 55.93], [39.1, 56.03], [39.55, 56.1], [40.12, 56.13], [40.55, 56.2], [41.25, 56.29], [41.72, 56.23], [42.03, 56.05], [43.0, 56.18], [43.46, 56.24], [44.01, 56.33]] },
  { name: "М-8 «Холмогоры»", type: "federal", points: [[37.62, 55.76], [37.82, 55.88], [38.03, 56.03], [38.18, 56.2], [38.3, 56.4], [38.58, 56.75], [39.06, 57.1], [39.89, 57.63], [40.2, 57.85]] },
  { name: "Р-132 «Золотое кольцо»", type: "ring", points: [[37.62, 54.19], [38.28, 54.01], [39.22, 54.34], [39.73, 54.63], [40.45, 54.93], [39.9, 55.45], [39.89, 57.63], [40.93, 57.77], [41.6, 57.05], [42.14, 57.44], [42.35, 58.38], [38.84, 58.05]] },
  { name: "М-9 «Балтия»", type: "federal", points: [[37.62, 55.76], [37.26, 55.82], [36.86, 55.87], [36.44, 55.95], [36.1, 56.02]] },
  { name: "М-10 «Россия»", type: "federal", points: [[37.62, 55.76], [37.52, 55.89], [37.45, 56.1], [37.35, 56.38], [36.98, 56.65], [36.5, 56.79], [35.91, 56.86], [35.18, 57.05]] },
  { name: "М-12 «Восток»", type: "federal", points: [[38.12, 55.58], [38.8, 55.7], [39.6, 55.8], [40.36, 55.93], [41.05, 55.87], [41.7, 55.72], [42.04, 55.57]] },
  { name: "А-107 · малое кольцо", type: "ring", points: [[36.75, 55.68], [37.05, 55.45], [37.48, 55.36], [38.0, 55.4], [38.38, 55.63], [38.22, 55.9], [37.82, 56.02], [37.27, 55.98], [36.75, 55.68]] },
  { name: "А-108 · большое кольцо", type: "ring", points: [[36.08, 55.63], [36.47, 55.25], [37.17, 55.08], [38.05, 55.1], [38.67, 55.46], [38.75, 56.0], [38.38, 56.32], [37.72, 56.48], [36.82, 56.33], [36.25, 56.05], [36.08, 55.63]] },
];
const formatter = new Intl.NumberFormat("ru-RU");
const formatNumber = (value: number) => formatter.format(Math.round(value));
const formatCompact = (value: number) => value >= 1000000 ? `${(value / 1000000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн` : `${Math.round(value / 1000)} тыс.`;

function signedRingArea(ring: number[][]) {
  let twiceArea = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [longitudeA, latitudeA] = ring[index];
    const [longitudeB, latitudeB] = ring[index + 1];
    twiceArea += longitudeA * latitudeB - longitudeB * latitudeA;
  }
  return twiceArea / 2;
}

function normalizeGeometry(geometry: Geometry): Geometry {
  const normalizePolygon = (polygon: number[][][]) => polygon.map((ring, index) => {
    const shouldBeClockwise = index === 0;
    const isClockwise = signedRingArea(ring) < 0;
    return isClockwise === shouldBeClockwise ? ring : [...ring].reverse();
  });
  return geometry.type === "Polygon"
    ? { ...geometry, coordinates: normalizePolygon(geometry.coordinates as number[][][]) }
    : { ...geometry, coordinates: (geometry.coordinates as number[][][][]).map(normalizePolygon) };
}

function calculateAreaKm2(geometry: Geometry) {
  const radius = 6371.0088;
  const ringArea = (ring: number[][]) => {
    if (ring.length < 3) return 0;
    const meanLatitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length * Math.PI / 180;
    const longitudeScale = Math.cos(meanLatitude);
    let twiceArea = 0;
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [longitudeA, latitudeA] = ring[index];
      const [longitudeB, latitudeB] = ring[index + 1];
      twiceArea += longitudeA * longitudeScale * latitudeB - longitudeB * longitudeScale * latitudeA;
    }
    return Math.abs(twiceArea) * (Math.PI / 180 * radius) ** 2 / 2;
  };
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return polygons.reduce((total, polygon) => total + Math.max(0, polygon.reduce((polygonArea, ring, index) => polygonArea + (index === 0 ? ringArea(ring) : -ringArea(ring)), 0)), 0);
}

function MapMark() { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6.5 9.5 4l5 2.5L20 4v13.5l-5.5 2.5-5-2.5L4 20V6.5Z" /><path d="M9.5 4v13.5M14.5 6.5V20" /></svg>; }
function Slider({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) { return <label className="weight-control"><span>{label}</span><output>{value}%</output><input aria-label={label} type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function RegionLabel({ name, coordinates }: { name: string; coordinates: [number, number] }) {
  const [first, second] = name.split(" ");
  return <text x={coordinates[0]} y={coordinates[1]} className="region-label" aria-hidden="true"><tspan x={coordinates[0]}>{first}</tspan><tspan x={coordinates[0]} dy="17">{second}</tspan></text>;
}

export function PopulationMap() {
  const [rawData, setRawData] = useState<RegionMapData[] | null>(null);
  const [view, setView] = useState<View>("density");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState("moscow-podolsk");
  const [mapViewport, setMapViewport] = useState<MapViewport>({ scale: 1, x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const dragStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressMapClick = useRef(false);
  const mapRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<MapViewport>(mapViewport);
  const pendingViewport = useRef<MapViewport | null>(null);
  const transformFrame = useRef<number | null>(null);
  const [demandWeight, setDemandWeight] = useState(30);
  const [lastMileWeight, setLastMileWeight] = useState(25);
  const [transportWeight, setTransportWeight] = useState(20);
  const [siteWeight, setSiteWeight] = useState(15);
  const [constraintWeight, setConstraintWeight] = useState(10);
  const [minimumScore, setMinimumScore] = useState(70);

  useEffect(() => {
    const controller = new AbortController();
    const sources: { path: string; region: RegionId }[] = [
      { path: "/data/moscow-oblast-municipalities.json", region: "moscow" },
      { path: "/data/tver-oblast-municipalities.json", region: "tver" },
      { path: "/data/vladimir-oblast-municipalities.json", region: "vladimir" },
      { path: "/data/kaluga-oblast-municipalities.json", region: "kaluga" },
      { path: "/data/tula-oblast-municipalities.json", region: "tula" },
      { path: "/data/ryazan-oblast-municipalities.json", region: "ryazan" },
      { path: "/data/yaroslavl-oblast-municipalities.json", region: "yaroslavl" },
      { path: "/data/smolensk-oblast-municipalities.json", region: "smolensk" },
      { path: "/data/kostroma-oblast-municipalities.json", region: "kostroma" },
      { path: "/data/ivanovo-oblast-municipalities.json", region: "ivanovo" },
      { path: "/data/nizhny-novgorod-oblast-municipalities.json", region: "nizhny" },
    ];
    Promise.all(sources.map(async ({ path, region }) => {
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) throw new Error(`Could not load ${path}`);
      return { ...(await response.json() as MapData), region } as RegionMapData;
    })).then(setRawData).catch((error: unknown) => { if (error instanceof Error && error.name !== "AbortError") console.error("Could not load map data", error); });
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    if (transformFrame.current !== null) cancelAnimationFrame(transformFrame.current);
  }, []);

  const model = useMemo(() => {
    if (!rawData) return null;
    const features = rawData.flatMap((regionalData) => regionalData.geography.features.map((feature) => {
      const geometry = normalizeGeometry(feature.geometry);
      const area = calculateAreaKm2(geometry);
      return { ...feature, geometry, properties: { ...feature.properties, region: regionalData.region, key: `${regionalData.region}:${feature.properties.name}`, area, density: feature.properties.population / area } } as MunicipalityMetric;
    }));
    const regionalFrame = { type: "FeatureCollection", features } as unknown as d3.ExtendedFeatureCollection;
    const projection = d3.geoConicConformal().parallels([54.5, 57.5]).rotate([-37.5, 0]).fitExtent([[44, 22], [956, 566]], regionalFrame);
    const path = d3.geoPath(projection);
    const regionLayers = (Object.entries(regionMeta) as [RegionId, { name: string; color: string }][]).map(([region, meta]) => {
      const regionFeatures = features.filter((feature) => feature.properties.region === region);
      const collection = { type: "FeatureCollection", features: regionFeatures } as unknown as d3.ExtendedFeatureCollection;
      const population = d3.sum(regionFeatures, (feature) => feature.properties.population);
      const area = d3.sum(regionFeatures, (feature) => feature.properties.area);
      return { region, name: meta.name, color: meta.color, d: path(collection) ?? "", population, area, density: population / area, municipalities: regionFeatures.length } as RegionLayer;
    });
    const regionLabels = regionLayers.map((layer) => {
      const regionFeatures = features.filter((feature) => feature.properties.region === layer.region);
      const collection = { type: "FeatureCollection", features: regionFeatures } as unknown as d3.ExtendedFeatureCollection;
      return { region: layer.region, name: layer.name, coordinates: path.centroid(collection) };
    });
    const cities = rawData.flatMap((regionalData) => regionalData.cities.map((city) => ({ ...city, region: regionalData.region }))).filter((city) => cityNames.has(city.name)).toSorted((a, b) => b.population - a.population).map((city, index) => {
      const district = features.find((feature) => d3.geoContains(feature as d3.ExtendedFeature, city.coordinates));
      const [sx, sy] = projection(city.coordinates) ?? [0, 0];
      const angle = index * 2.3999632297; const offset = 9 + index;
      return { ...city, index: index + 1, color: cityColors[index % cityColors.length], regionName: regionMeta[city.region].name, district: district?.properties.name ?? regionMeta[city.region].name, districtDensity: district?.properties.density ?? 0, sx, sy, x: sx + Math.cos(angle) * offset, y: sy + Math.sin(angle) * offset } as CityMetric;
    });
    for (let step = 0; step < 120; step += 1) { for (let firstIndex = 0; firstIndex < cities.length; firstIndex += 1) { for (let secondIndex = firstIndex + 1; secondIndex < cities.length; secondIndex += 1) { const first = cities[firstIndex]; const second = cities[secondIndex]; const dx = second.x - first.x; const dy = second.y - first.y; const distance = Math.hypot(dx, dy) || .01; if (distance < 25) { const push = (25 - distance) / 2; first.x -= dx / distance * push; first.y -= dy / distance * push; second.x += dx / distance * push; second.y += dy / distance * push; } } } cities.forEach((city) => { city.x += (city.sx - city.x) * .028; city.y += (city.sy - city.y) * .028; }); }
    const cityByName = new Map(rawData.flatMap((regionalData) => regionalData.cities.map((city) => [`${regionalData.region}:${city.name}`, city] as const)));
    const ranked = candidates.map((candidate) => {
      const city = cityByName.get(`${candidate.region}:${candidate.city}`);
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
    return { features, path, projection, regionLabels, regionLayers, cities, ranked, scales: { population: d3.scaleSequentialLog([d3.min(population) ?? 1, d3.max(population) ?? 1], d3.interpolateYlGnBu), density: d3.scaleSequentialLog([Math.max(1, d3.min(density) ?? 1), d3.max(density) ?? 1], d3.interpolateYlGnBu) } };
  }, [rawData, demandWeight, lastMileWeight, transportWeight, siteWeight, constraintWeight]);

  if (!model || !rawData) return <div className="map-loading">Загружаем карту и данные…</div>;
  const isPlacement = view === "placement";
  const activeScale = model.scales[view === "population" ? "population" : "density"];
  const domain = activeScale.domain(); const legendValues = d3.range(5).map((index) => domain[0] * (domain[1] / domain[0]) ** (index / 4));
  const selectedFeature = model.features.find((feature) => feature.properties.key === selectedMunicipality);
  const selectedMapCity = model.cities.find((city) => city.name === selectedCityName);
  const visibleCities = model.cities.slice(0, 12);
  const focusedRegion = selectedFeature?.properties.region ?? selectedMapCity?.region;
  const focusedRegionStats = focusedRegion ? model.regionLayers.find((region) => region.region === focusedRegion) : null;
  const selected = model.ranked.find((candidate) => candidate.id === selectedCandidate) ?? model.ranked[0];
  const eligibleCandidates = model.ranked.filter((candidate) => candidate.score >= minimumScore);
  const roadLines = keyRoads.map((road) => ({ ...road, d: d3.line<Position>().x((point) => model.projection(point)?.[0] ?? 0).y((point) => model.projection(point)?.[1] ?? 0)(road.points) }));
  const clampOffset = (value: number, scale: number, axis: "x" | "y") => {
    const limit = (scale - 1) * (axis === "x" ? 260 : 165);
    return Math.max(-limit, Math.min(limit, value));
  };
  const formatViewportTransform = (viewport: MapViewport) => `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`;
  const applyViewportTransform = (viewport: MapViewport) => { if (mapRef.current) mapRef.current.style.transform = formatViewportTransform(viewport); };
  const scheduleViewportTransform = (viewport: MapViewport) => {
    viewportRef.current = viewport;
    pendingViewport.current = viewport;
    if (transformFrame.current !== null) return;
    transformFrame.current = requestAnimationFrame(() => {
      if (pendingViewport.current) applyViewportTransform(pendingViewport.current);
      pendingViewport.current = null;
      transformFrame.current = null;
    });
  };
  const commitViewport = (viewport: MapViewport) => {
    viewportRef.current = viewport;
    pendingViewport.current = null;
    if (transformFrame.current !== null) { cancelAnimationFrame(transformFrame.current); transformFrame.current = null; }
    applyViewportTransform(viewport);
    setMapViewport(viewport);
  };
  const changeZoom = (amount: number) => {
    const current = viewportRef.current;
    const scale = Math.max(1, Math.min(3, Number((current.scale + amount).toFixed(1))));
    commitViewport({ scale, x: clampOffset(current.x, scale, "x"), y: clampOffset(current.y, scale, "y") });
  };
  const resetMapViewport = () => commitViewport({ scale: 1, x: 0, y: 0 });
  const handleWheelZoom = (event: React.WheelEvent<SVGSVGElement>) => { event.preventDefault(); changeZoom(event.deltaY < 0 ? .2 : -.2); };
  const startMapDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (target.closest(".city-marker, .candidate-marker")) return;
    const viewport = viewportRef.current;
    if (viewport.scale === 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, x: viewport.x, y: viewport.y, moved: false };
    setIsDraggingMap(true);
  };
  const moveMapDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart.current) return;
    const pointerX = event.clientX - dragStart.current.pointerX;
    const pointerY = event.clientY - dragStart.current.pointerY;
    if (Math.hypot(pointerX, pointerY) > 4) dragStart.current.moved = true;
    const scale = viewportRef.current.scale;
    const x = clampOffset(dragStart.current.x + pointerX, scale, "x");
    const y = clampOffset(dragStart.current.y + pointerY, scale, "y");
    scheduleViewportTransform({ scale, x, y });
  };
  const endMapDrag = () => { suppressMapClick.current = dragStart.current?.moved ?? false; dragStart.current = null; commitViewport(viewportRef.current); setIsDraggingMap(false); };
  const selectMunicipality = (key: string) => {
    if (suppressMapClick.current) { suppressMapClick.current = false; return; }
    setSelectedMunicipality(key);
    setSelectedCityName(null);
  };
  const toggleMapCity = (city: CityMetric) => { setSelectedCityName((current) => current === city.name ? null : city.name); setSelectedMunicipality(null); };
  const simpleTitle = selectedMapCity ? `${selectedMapCity.name} · город` : selectedFeature ? `${selectedFeature.properties.name} · ${regionMeta[selectedFeature.properties.region].name}` : "Одиннадцать областей Центральной России";
  const simplePopulation = selectedMapCity ? `${formatNumber(selectedMapCity.population)} чел.` : selectedFeature ? `${formatNumber(selectedFeature.properties.population)} чел.` : `${formatNumber(d3.sum(model.features, (feature) => feature.properties.population))} чел.`;
  const simpleDensity = selectedMapCity ? `${formatNumber(selectedMapCity.districtDensity)} чел./км²` : selectedFeature ? `${formatNumber(selectedFeature.properties.density)} чел./км²` : "Выберите муниципалитет или город";

  return <main className={isPlacement ? "app-shell placement-page" : "app-shell"}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">●●●</span><span>Население одиннадцати областей</span></div>
      <div className="source-line">Данные на 01.01.2025 · муниципалитеты и крупнейшие города</div>
      <nav className="metric-switch" aria-label="Режим карты">
        <button type="button" aria-pressed={view === "density"} onClick={() => setView("density")}>Плотность</button>
        <button type="button" aria-pressed={view === "population"} onClick={() => setView("population")}>Население</button>
        <button type="button" className="placement-tab" aria-pressed={view === "placement"} onClick={() => setView("placement")}>Подбор баз БПЛА</button>
      </nav>
    </header>
    {isPlacement ? <section className="decision-layout" aria-label="Подбор площадок для баз БПЛА">
      <aside className="criteria-panel"><div className="panel-heading"><div className="placement-heading"><MapMark /><div><h2>Подбор площадок БПЛА</h2><p>Модель первичного отбора площадок</p></div></div><p className="workflow-intro">Рейтинг объединяет спрос, эффект последней мили, транспортную доступность, пригодность участка и ограничения полётов.</p></div>
        <div className="step-label"><b>1</b><span>Задайте важность критериев</span></div>
        <Slider label="Спрос на доставку" value={demandWeight} onChange={setDemandWeight} /><Slider label="Эффект последней мили" value={lastMileWeight} onChange={setLastMileWeight} /><Slider label="Транспорт и логистика" value={transportWeight} onChange={setTransportWeight} /><Slider label="Пригодность площадки" value={siteWeight} onChange={setSiteWeight} /><Slider label="Отсутствие ограничений" value={constraintWeight} onChange={setConstraintWeight} />
        <label className="threshold-control"><span>Минимальный рейтинг для отбора</span><output>{minimumScore} баллов</output><input aria-label="Минимальный рейтинг для отбора" type="range" min="0" max="100" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} /></label>
        <p className="formula">Рейтинг — средневзвешенная оценка пяти факторов. Ограничения понижают балл: 100 означает отсутствие ограничений.</p><p className="demo-note">Данные в прототипе демонстрационные. До операционного решения нужны актуальные геоданные, проверка воздушных зон и участка.</p>
        <section className="ranking"><div className="step-label"><b>3</b><span>Сравните кандидатов</span></div><h2>{eligibleCandidates.length} из {model.ranked.length} проходят порог <small>нажмите, чтобы увидеть детали</small></h2><ol>{model.ranked.map((candidate, index) => <li key={candidate.id}><button className={`${candidate.id === selected.id ? "rank-row selected" : "rank-row"}${candidate.score < minimumScore ? " below-threshold" : ""}`} type="button" onClick={() => setSelectedCandidate(candidate.id)}><b>{index + 1}</b><span><strong>{candidate.city}</strong><small>{candidate.road} · {candidate.roadDistance}</small></span><em>{Math.round(candidate.score)}</em></button></li>)}</ol></section>
      </aside>
      <section className="map-area" aria-label="Карта кандидатов и ключевых дорог одиннадцати областей">
        <div className="map-toolbar"><b>2. Изучите транспортные коридоры</b><span className="muted">нажмите на точку или строку кандидата</span></div>
        <svg ref={mapRef} className={isDraggingMap ? "zoomable-map dragging" : "zoomable-map"} style={{ transform: formatViewportTransform(mapViewport) }} onWheel={handleWheelZoom} onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag} viewBox="0 0 1000 610" role="img" aria-label="Карта одиннадцати областей Центральной России с кандидатами и ключевыми автомобильными дорогами">
          <defs><pattern id="map-grid" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M 46 0 L 0 0 0 46" className="map-grid-line" /></pattern>{model.regionLayers.map((region) => <filter key={`filter-${region.region}`} id={`region-border-${region.region}`} x="-3%" y="-3%" width="106%" height="106%"><feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="expanded" /><feComposite in="expanded" in2="SourceAlpha" operator="out" result="outer-border" /><feFlood floodColor={region.color} floodOpacity=".9" result="border-color" /><feComposite in="border-color" in2="outer-border" operator="in" /></filter>)}</defs>
          <rect width="1000" height="610" className="map-water" /><rect width="1000" height="610" className="map-grid" />
          {model.features.map((feature) => <path key={feature.properties.key} d={model.path(feature) ?? undefined} fill={model.scales.density(feature.properties.density)} className="municipality" />)}
          {model.regionLayers.map((region) => <path key={`${region.region}-tint`} d={region.d} fill={region.color} className="region-tint" />)}
          {model.regionLayers.map((region) => <g key={`${region.region}-outline`} className="region-outline" filter={`url(#region-border-${region.region})`}><path d={region.d} fill="#000" /></g>)}
          {roadLines.map((road) => <path key={road.name} d={road.d ?? undefined} className={`road-line ${road.type}`} />)}
          {model.regionLabels.map((region) => <RegionLabel key={region.region} name={region.name} coordinates={region.coordinates} />)}
          {model.ranked.map((candidate, index) => <g key={candidate.id} className={candidate.id === selected.id ? "candidate-marker active" : "candidate-marker"} transform={`translate(${candidate.sx}, ${candidate.sy})`} role="button" tabIndex={0} aria-label={`${index + 1}. ${candidate.city}: ${Math.round(candidate.score)} баллов`} onClick={() => setSelectedCandidate(candidate.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCandidate(candidate.id); } }}><circle className="candidate-range" r="29" /><circle className="candidate-dot" r="14" /><text>{index + 1}</text></g>)}
        </svg>
        <div className="zoom-controls" aria-label="Масштаб карты"><button type="button" onClick={() => changeZoom(.2)} aria-label="Приблизить">+</button><button type="button" onClick={() => changeZoom(-.2)} aria-label="Отдалить">−</button><button type="button" onClick={resetMapViewport} aria-label="Сбросить масштаб">⌂</button></div>
        <div className="map-key"><div><b>Плотность, чел./км²</b>{legendValues.map((value) => <span key={value}><i style={{ background: model.scales.density(value) }} />{formatNumber(value)}</span>)}</div><div><b>Контекст карты</b><span><i className="region-swatch" />Контуры областей</span><span><i className="road-swatch federal" />Федеральные магистрали</span><span><i className="road-swatch ring" />Кольцевые и Р-132</span><span><i className="city-swatch" />Кандидаты БПЛА</span><small>Одиннадцать областей · {model.features.length} муниципалитетов</small></div></div>
      </section>
      <section className="selected-detail" aria-live="polite"><div className="detail-title"><span>Кандидат №{model.ranked.findIndex((candidate) => candidate.id === selected.id) + 1} · {selected.score >= minimumScore ? "проходит порог" : "ниже порога"}</span><h2>{selected.city}</h2><p>{selected.district} · {regionMeta[selected.region].name}</p></div><div className="score-box"><span>Предварительный рейтинг</span><strong>{Math.round(selected.score)}</strong><small>из 100</small></div><div className="detail-metrics"><div><span>Охват населения</span><b>{selected.coverage}</b><small>в зоне анализа</small></div><div><span>Ближайшая магистраль</span><b>{selected.road}</b><small>{selected.roadDistance} от точки</small></div></div><div className="score-breakdown"><h3>Что формирует рейтинг</h3>{selected.breakdown.map((factor) => <div className="factor-row" key={factor.label}><span>{factor.label}</span><div aria-label={`${factor.label}: ${Math.round(factor.value)} из 100`}><i style={{ width: `${factor.value}%` }} /></div><b>{Math.round(factor.value)}</b><small>вес {factor.weight}%</small></div>)}</div><div className="why"><h3>Следующий шаг</h3><p>Проверьте актуальные запретные зоны, статус земли, подключение к электросети и точное время обслуживания. Только после этого площадку можно утверждать.</p></div></section>
    </section> : <section className="simple-workspace" aria-label="Карта населения одиннадцати областей">
      <div className="simple-map-frame">
        <svg ref={mapRef} className={isDraggingMap ? "zoomable-map dragging" : "zoomable-map"} style={{ transform: formatViewportTransform(mapViewport) }} onWheel={handleWheelZoom} onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag} viewBox="0 0 1000 610" role="img" aria-label={`Муниципалитеты одиннадцати областей Центральной России по показателю: ${view === "density" ? "плотность" : "население"}`}>
          <defs><pattern id="simple-map-grid" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M 46 0 L 0 0 0 46" className="map-grid-line" /></pattern>{model.regionLayers.map((region) => <filter key={`filter-${region.region}`} id={`region-border-${region.region}`} x="-3%" y="-3%" width="106%" height="106%"><feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="expanded" /><feComposite in="expanded" in2="SourceAlpha" operator="out" result="outer-border" /><feFlood floodColor={region.color} floodOpacity=".9" result="border-color" /><feComposite in="border-color" in2="outer-border" operator="in" /></filter>)}</defs>
          <rect width="1000" height="610" className="map-water" /><rect width="1000" height="610" fill="url(#simple-map-grid)" className="map-grid" />
          {model.features.map((feature) => <path key={feature.properties.key} d={model.path(feature) ?? undefined} fill={activeScale(feature.properties[view])} className={selectedFeature?.properties.key === feature.properties.key ? "municipality selected" : "municipality"} role="button" tabIndex={0} aria-label={`${feature.properties.name}, ${regionMeta[feature.properties.region].name}: ${formatNumber(feature.properties.population)} жителей`} onClick={() => selectMunicipality(feature.properties.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectMunicipality(feature.properties.key); } }} />)}
          {model.regionLayers.map((region) => <path key={`${region.region}-tint`} d={region.d} fill={region.color} className="region-tint" />)}
          {model.regionLayers.map((region) => <g key={`${region.region}-outline`} className="region-outline" filter={`url(#region-border-${region.region})`}><path d={region.d} fill="#000" /></g>)}
          {model.regionLabels.map((region) => <RegionLabel key={region.region} name={region.name} coordinates={region.coordinates} />)}
          {visibleCities.map((city) => <g key={`${city.region}:${city.name}`}><line x1={city.sx} y1={city.sy} x2={city.x} y2={city.y} stroke={city.color} className="city-leader" /><circle cx={city.sx} cy={city.sy} r="3" fill={city.color} /><g transform={`translate(${city.x}, ${city.y})`} className={selectedMapCity?.name === city.name ? "city-marker selected" : "city-marker"} role="button" tabIndex={0} aria-label={`${city.index}. ${city.name}, ${city.regionName}: ${formatNumber(city.population)} жителей`} onClick={(event) => { event.stopPropagation(); toggleMapCity(city); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleMapCity(city); } }}><circle r="10" fill={city.color} /><text>{city.index}</text></g></g>)}
        </svg>
        <div className="simple-zoom-controls zoom-controls" aria-label="Масштаб карты"><button type="button" onClick={() => changeZoom(.2)} aria-label="Приблизить">+</button><button type="button" onClick={() => changeZoom(-.2)} aria-label="Отдалить">−</button><button type="button" onClick={resetMapViewport} aria-label="Сбросить масштаб">⌂</button></div>
        <p>Колесо мыши меняет масштаб. После приближения зажмите карту и перетаскивайте её. Нажмите на муниципалитет или номер города, чтобы увидеть информацию.</p>
      </div>
      <aside className="simple-side">
        <section className="simple-detail">
          <span className="detail-kicker">{focusedRegionStats ? `${focusedRegionStats.name} · контекст` : "Общий охват"}</span>
          <h2>{simpleTitle}</h2>
          <dl>
            <div><dt>{selectedMapCity ? "Население города" : "Население"}</dt><dd>{simplePopulation}</dd></div>
            <div><dt>{selectedMapCity ? "Плотность округа" : "Плотность"}</dt><dd>{simpleDensity}</dd></div>
          </dl>
          <div className="coverage-stats">
            <span><b>{focusedRegionStats ? focusedRegionStats.municipalities : model.regionLayers.length}</b>{focusedRegionStats ? " муниципалитетов" : " областей"}</span>
            <span><b>{focusedRegionStats ? formatCompact(focusedRegionStats.area) : model.features.length}</b>{focusedRegionStats ? " км²" : " муниципалитетов"}</span>
          </div>
        </section>
        <section className="simple-legend">
          <h2>{view === "density" ? "Плотность населения" : "Численность населения"}</h2>
          <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${legendValues.map((value) => activeScale(value)).join(", ")})` }} />
          <div className="legend-scale"><span>{formatNumber(legendValues[0])}</span><span>{formatNumber(legendValues[legendValues.length - 1])}</span></div>
          <p>{view === "density" ? "чел. на км² · цвет муниципалитета" : "жителей · цвет муниципалитета"}</p>
          <div className="legend-symbols"><span><i className="region-swatch" />контур области</span><span><i className="city-swatch" />крупнейший город</span></div>
        </section>
        <section className="region-atlas"><h2>Сводка по областям</h2><ol>{model.regionLayers.map((region) => <li key={region.region}><i style={{ background: region.color }} /><span>{region.name.replace(" область", "")}</span><em>{formatCompact(region.population)}</em></li>)}</ol></section>
        <section className="city-list"><h2>10 крупнейших городов</h2><ol>{model.cities.slice(0, 10).map((city) => <li key={`${city.region}:${city.name}`}><button type="button" onClick={() => toggleMapCity(city)}><b style={{ background: city.color }}>{city.index}</b><span>{city.name}</span><em>{view === "density" ? `${formatNumber(city.districtDensity)} чел./км²` : `${formatNumber(city.population)} чел.`}</em></button></li>)}</ol></section>
      </aside>
    </section>}
  </main>;
}
