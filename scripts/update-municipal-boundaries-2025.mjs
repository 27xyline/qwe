import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCsv } from "./import-municipal-population.mjs";

const root = process.cwd();
const dataDirectory = resolve(root, "data");
const publicDataDirectory = resolve(root, "public/data");
const sourceFiles = [
  ["moscow", "moscow-oblast-municipalities.json", "Московская область"], ["tver", "tver-oblast-municipalities.json", "Тверская область"], ["vladimir", "vladimir-oblast-municipalities.json", "Владимирская область"], ["kaluga", "kaluga-oblast-municipalities.json", "Калужская область"], ["tula", "tula-oblast-municipalities.json", "Тульская область"], ["ryazan", "ryazan-oblast-municipalities.json", "Рязанская область"], ["yaroslavl", "yaroslavl-oblast-municipalities.json", "Ярославская область"], ["smolensk", "smolensk-oblast-municipalities.json", "Смоленская область"], ["kostroma", "kostroma-oblast-municipalities.json", "Костромская область"], ["ivanovo", "ivanovo-oblast-municipalities.json", "Ивановская область"], ["nizhny", "nizhny-novgorod-oblast-municipalities.json", "Нижегородская область"], ["vologda", "vologda-oblast-municipalities.json", "Вологодская область"], ["bryansk", "bryansk-oblast-municipalities.json", "Брянская область"], ["oryol", "oryol-oblast-municipalities.json", "Орловская область"], ["lipetsk", "lipetsk-oblast-municipalities.json", "Липецкая область"], ["tambov", "tambov-oblast-municipalities.json", "Тамбовская область"], ["mordovia", "mordovia-municipalities.json", "Республика Мордовия"], ["chuvashia", "chuvashia-municipalities.json", "Чувашская Республика"],
];

const aliases = {
  "moscow:Краснознаменск": "Городской округ Краснознаменск  (ЗАТО)",
  "moscow:Власиха": "Городской округ Власиха (ЗАТО)",
  "moscow:Восход": "Городской округ Восход (ЗАТО)",
  "moscow:Звездный городок": "Городской округ Звездный городок (ЗАТО)",
  "moscow:Молодёжный": "Городской округ Молодёжный (ЗАТО)",
  "tver:ЗАТО Озерный": "Городской округ поселок городского типа Озерный (ЗАТО)",
  "tver:ЗАТО Солнечный": "Городской округ поселок городского типа Солнечный (ЗАТО)",
  "vladimir:ЗАТО Радужный": "Городской округ город Радужный",
  "vladimir:город Гусь-Хрустальный": "Городской округ город Гусь-Хрустальный",
  "vladimir:город Ковров": "Городской округ город Ковров",
  "vladimir:город Владимир": "Городской округ город Владимир",
  "vladimir:округ Муром": "Городской округ округ Муром",
  "chuvashia:город Новочебоксарск": "Новочебоксарский городской округ",
  "chuvashia:город Чебоксары": "Чебоксарский городской округ",
};

const normalizeName = (value) => value.toLowerCase().replace(/ё/g, "е").replace(/[«»'"`]/g, "").replace(/[—–-]/g, " ").replace(/(муниципальный|городской|район|округ|республика|область|город|зато|пгт|поселок|типа|г)/g, " ").replace(/\s+/g, " ").trim();
const isMoscowZvenigorod = (feature) => feature.properties.region === "Московская область" && feature.properties.name.toLowerCase().includes("звенигород");

function mercatorToWgs84([x, y]) {
  if (Math.abs(x) <= 360 && Math.abs(y) <= 90) return [x, y];
  const longitude = x * 180 / 20037508.342789244;
  const latitude = 360 / Math.PI * Math.atan(Math.exp(y * Math.PI / 20037508.342789244)) - 90;
  return [longitude, latitude];
}

function perpendicularDistance(point, start, end) {
  const [x, y] = point; const [x1, y1] = start; const [x2, y2] = end;
  const dx = x2 - x1; const dy = y2 - y1;
  if (!dx && !dy) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
}

function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0; let index = 0;
  for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
    const distance = perpendicularDistance(points[pointIndex], points[0], points.at(-1));
    if (distance > maxDistance) { maxDistance = distance; index = pointIndex; }
  }
  if (maxDistance <= tolerance) return [points[0], points.at(-1)];
  return [...simplifyLine(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplifyLine(points.slice(index), tolerance)];
}

function simplifyRing(ring, tolerance) {
  const open = ring.slice(0, -1);
  if (open.length < 4) return ring.map(mercatorToWgs84);
  const origin = open[0];
  let pivot = 1; let greatestDistance = -1;
  for (let pointIndex = 1; pointIndex < open.length; pointIndex += 1) {
    const distance = Math.hypot(open[pointIndex][0] - origin[0], open[pointIndex][1] - origin[1]);
    if (distance > greatestDistance) { greatestDistance = distance; pivot = pointIndex; }
  }
  const firstHalf = simplifyLine(open.slice(0, pivot + 1), tolerance);
  const secondHalf = simplifyLine([...open.slice(pivot), origin], tolerance);
  const simplified = [...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)].map(mercatorToWgs84);
  return [...simplified, simplified[0]];
}

function transformGeometry(geometry, tolerance) {
  if (geometry.type === "Polygon") return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, tolerance)) };
  if (geometry.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => simplifyRing(ring, tolerance))) };
  throw new Error(`Неподдерживаемый тип геометрии: ${geometry.type}`);
}

async function run() {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) throw new Error("Укажите путь к GeoJSON с границами 2025 года");
  const [geojsonText, csvText, metadataText] = await Promise.all([
    readFile(resolve(inputPath), "utf8"), readFile(resolve(dataDirectory, "municipal-population-2025.csv"), "utf8"), readFile(resolve(dataDirectory, "municipal-population-source.json"), "utf8"),
  ]);
  const source = JSON.parse(metadataText);
  const rows = parseCsv(csvText);
  const geometry = JSON.parse(geojsonText);
  if (geometry.type !== "FeatureCollection" || !Array.isArray(geometry.features)) throw new Error("Ожидался GeoJSON FeatureCollection");
  const rowsByRegion = new Map(sourceFiles.map(([region]) => [region, rows.filter((row) => row.region_id === region)]));
  if (rows.length !== [...rowsByRegion.values()].reduce((sum, regionRows) => sum + regionRows.length, 0)) throw new Error("CSV содержит регион вне карты");
  const plans = await Promise.all(sourceFiles.map(async ([region, filename, sourceRegion]) => {
    const existing = JSON.parse(await readFile(resolve(publicDataDirectory, filename), "utf8"));
    const regionRows = rowsByRegion.get(region) ?? [];
    const rowByExactName = new Map(regionRows.map((row) => [`${region}:${row.rosstat_name.toLowerCase()}`, row]));
    const rowsByNormalizedName = new Map();
    for (const row of regionRows) {
      const key = `${region}:${normalizeName(row.rosstat_name)}`;
      rowsByNormalizedName.set(key, [...(rowsByNormalizedName.get(key) ?? []), row]);
    }
    const used = new Set();
    const features = geometry.features.filter((feature) => feature.properties?.region === sourceRegion && !isMoscowZvenigorod(feature)).map((feature) => {
      const alias = aliases[`${region}:${feature.properties.name}`] ?? feature.properties.name;
      const normalizedRows = rowsByNormalizedName.get(`${region}:${normalizeName(alias)}`) ?? [];
      const row = rowByExactName.get(`${region}:${alias.toLowerCase()}`) ?? (normalizedRows.length === 1 ? normalizedRows[0] : null);
      if (!row) throw new Error(`Не найдена строка Росстата для новой границы: ${region}:${feature.properties.name}`);
      if (used.has(row.rosstat_name)) throw new Error(`Две новые границы претендуют на одну строку Росстата: ${region}:${row.rosstat_name}`);
      used.add(row.rosstat_name);
      return {
        type: "Feature",
        properties: { name: row.rosstat_name, rosstatName: row.rosstat_name, municipalityType: row.municipality_type, oktmo: feature.properties.oktmo, population: row.population },
        geometry: transformGeometry(feature.geometry, 250),
      };
    });
    if (used.size !== regionRows.length) {
      const unused = regionRows.filter((row) => !used.has(row.rosstat_name)).map((row) => row.rosstat_name);
      throw new Error(`Есть строки Росстата без новой границы в регионе ${region}: ${unused.join(", ")}`);
    }
    return { filename, region, count: features.length, data: { ...existing, updatedAt: source.asOf, source, geography: { type: "FeatureCollection", features } } };
  }));
  await Promise.all(plans.map((plan) => writeFile(resolve(publicDataDirectory, plan.filename), JSON.stringify(plan.data))));
  for (const plan of plans) console.log(`${plan.region} → обновлено границ ${plan.count}`);
}

run().catch((error) => { console.error(`Обновление границ остановлено: ${error.message}`); process.exitCode = 1; });
