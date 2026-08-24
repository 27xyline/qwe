import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dataDirectory = resolve(root, "data");
const publicDataDirectory = resolve(root, "public/data");
const sourceFiles = [
  ["moscow", "moscow-oblast-municipalities.json"], ["tver", "tver-oblast-municipalities.json"], ["vladimir", "vladimir-oblast-municipalities.json"], ["kaluga", "kaluga-oblast-municipalities.json"], ["tula", "tula-oblast-municipalities.json"], ["ryazan", "ryazan-oblast-municipalities.json"], ["yaroslavl", "yaroslavl-oblast-municipalities.json"], ["smolensk", "smolensk-oblast-municipalities.json"], ["kostroma", "kostroma-oblast-municipalities.json"], ["ivanovo", "ivanovo-oblast-municipalities.json"], ["nizhny", "nizhny-novgorod-oblast-municipalities.json"], ["vologda", "vologda-oblast-municipalities.json"], ["bryansk", "bryansk-oblast-municipalities.json"], ["oryol", "oryol-oblast-municipalities.json"], ["lipetsk", "lipetsk-oblast-municipalities.json"], ["tambov", "tambov-oblast-municipalities.json"], ["mordovia", "mordovia-municipalities.json"], ["chuvashia", "chuvashia-municipalities.json"],
];

export const normalizeName = (value) => value.toLowerCase().replace(/ё/g, "е").replace(/[«»'"`]/g, "").replace(/[—–-]/g, " ").replace(/(муниципальный|городской|район|округ|республика|область)/g, " ").replace(/\s+/g, " ").trim();

export function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/).filter(Boolean);
  const columns = header?.split(";");
  const expected = ["region_id", "rosstat_name", "municipality_type", "population", "as_of", "indicator_code"];
  if (JSON.stringify(columns) !== JSON.stringify(expected)) throw new Error("CSV должен содержать строго заданные шесть колонок в заданном порядке");
  const seen = new Set();
  return lines.map((line, index) => {
    const [region_id, rosstat_name, municipality_type, populationText, as_of, indicator_code] = line.split(";").map((value) => value.trim());
    const population = Number(populationText);
    const key = `${region_id}:${normalizeName(rosstat_name)}`;
    if (!region_id || !rosstat_name || !municipality_type || !Number.isSafeInteger(population) || population <= 0 || as_of !== "2025-01-01" || indicator_code !== "8112027") throw new Error(`Некорректная строка CSV ${index + 2}`);
    if (seen.has(key)) throw new Error(`Повторная строка Росстата: ${key}`);
    seen.add(key);
    return { region_id, rosstat_name, municipality_type, population, as_of, indicator_code };
  });
}

export function buildUpdatePlan(documents, rows, aliases, source) {
  if (source.provider !== "Росстат" || source.dataset !== "БД ПМО" || source.indicatorCode !== "8112027" || source.asOf !== "2025-01-01") throw new Error("Некорректные метаданные источника");
  const rowsByKey = new Map(rows.map((row) => [`${row.region_id}:${normalizeName(row.rosstat_name)}`, row]));
  const usedRows = new Set();
  const updates = [];
  for (const document of documents) {
    const featureKeys = new Set();
    const updatedFeatures = document.data.geography.features.map((feature) => {
      const alias = aliases[`${document.region}:${feature.properties.name}`] ?? feature.properties.name;
      const key = `${document.region}:${normalizeName(alias)}`;
      if (featureKeys.has(key)) throw new Error(`Два контура претендуют на одну строку: ${key}`);
      featureKeys.add(key);
      const row = rowsByKey.get(key);
      if (!row) throw new Error(`Не найдена строка Росстата для контура: ${document.region}:${feature.properties.name}`);
      if (usedRows.has(key)) throw new Error(`Строка Росстата использована повторно: ${key}`);
      usedRows.add(key);
      return { ...feature, properties: { ...feature.properties, population: row.population } };
    });
    const beforeGeometry = createHash("sha256").update(JSON.stringify(document.data.geography.features.map((feature) => feature.geometry))).digest("hex");
    const nextData = { ...document.data, source, geography: { ...document.data.geography, features: updatedFeatures } };
    const afterGeometry = createHash("sha256").update(JSON.stringify(nextData.geography.features.map((feature) => feature.geometry))).digest("hex");
    if (beforeGeometry !== afterGeometry) throw new Error(`Импорт изменил геометрию региона ${document.region}`);
    updates.push({ ...document, data: nextData, matched: updatedFeatures.length, population: updatedFeatures.reduce((sum, feature) => sum + feature.properties.population, 0) });
  }
  if (usedRows.size !== rows.length) {
    const unused = [...rowsByKey.keys()].filter((key) => !usedRows.has(key));
    throw new Error(`Есть строки Росстата без контура: ${unused.join(", ")}`);
  }
  return updates;
}

async function run() {
  const [csvText, aliasesText, sourceText] = await Promise.all([readFile(resolve(dataDirectory, "municipal-population-2025.csv"), "utf8"), readFile(resolve(dataDirectory, "municipal-population-aliases.json"), "utf8"), readFile(resolve(dataDirectory, "municipal-population-source.json"), "utf8")]);
  const rows = parseCsv(csvText);
  const aliases = JSON.parse(aliasesText);
  const source = JSON.parse(sourceText);
  const documents = await Promise.all(sourceFiles.map(async ([region, filename]) => ({ region, filename, data: JSON.parse(await readFile(resolve(publicDataDirectory, filename), "utf8")) })));
  const updates = buildUpdatePlan(documents, rows, aliases, source);
  await Promise.all(updates.map(({ filename, data }) => writeFile(resolve(publicDataDirectory, filename), JSON.stringify(data))));
  for (const update of updates) console.log(`${update.region} → контуров ${update.matched} → совпало ${update.matched} → ручных соответствий ${Object.keys(aliases).filter((key) => key.startsWith(`${update.region}:`)).length} → сумма населения ${update.population}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) run().catch((error) => { console.error(`Импорт остановлен: ${error.message}`); process.exitCode = 1; });
