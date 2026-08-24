import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { regionSources } from "../app/components/map/config";
import { parseCsv } from "./import-municipal-population.mjs";

const root = process.cwd();
const dataDirectory = resolve(root, "data");
const publicDataDirectory = resolve(root, "public/data");

async function loadData() {
  const names = (await readdir(publicDataDirectory)).filter((name) => name.endsWith("-municipalities.json"));
  return Promise.all(names.map(async (name) => ({ name, data: JSON.parse(await readFile(resolve(publicDataDirectory, name), "utf8")) })));
}

function eachPoint(coordinates: unknown, callback: (point: number[]) => void): void {
  if (!Array.isArray(coordinates)) throw new Error("Координаты должны быть массивом");
  if (typeof coordinates[0] === "number") callback(coordinates as number[]);
  else coordinates.forEach((value) => eachPoint(value, callback));
}

describe("муниципальные данные на 01.01.2025", () => {
  it("содержат 18 регионов, 531 границу и проверяемый источник", async () => {
    const [documents, source, geometrySource] = await Promise.all([loadData(), JSON.parse(await readFile(resolve(dataDirectory, "municipal-population-source.json"), "utf8")), JSON.parse(await readFile(resolve(dataDirectory, "municipal-boundaries-2025-source.json"), "utf8"))]);
    expect(documents).toHaveLength(18);
    expect(documents.reduce((sum, document) => sum + document.data.geography.features.length, 0)).toBe(531);
    expect(source).toMatchObject({ provider: "Росстат", dataset: "БД ПМО", indicatorCode: "8112027", asOf: "2025-01-01" });
    expect(source.sourceChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(geometrySource).toMatchObject({ provider: "OpenStreetMap", outputCoordinateSystem: "WGS 84", simplificationToleranceMeters: 250 });
    expect(geometrySource.sourceChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    for (const { data } of documents) expect(data.source).toMatchObject(source);
  });

  it("сопоставляют каждый контур с ровно одной официальной строкой и сохраняют координаты WGS 84", async () => {
    const [documents, csvText] = await Promise.all([loadData(), readFile(resolve(dataDirectory, "municipal-population-2025.csv"), "utf8")]);
    const rows = parseCsv(csvText);
    const regionByFilename = new Map(regionSources.map(({ path, region }) => [path.split("/").at(-1), region]));
    const seen = new Set<string>();
    const populationByKey = new Map<string, number>();
    for (const { name, data } of documents) {
      const region = regionByFilename.get(name);
      expect(region).toEqual(expect.any(String));
      for (const feature of data.geography.features) {
        expect(feature.properties.population).toBeGreaterThan(0);
        expect(feature.properties.name).toEqual(expect.any(String));
        expect(feature.properties.name).not.toMatch(/[A-Za-z]/);
        expect(feature.properties.rosstatName).toEqual(expect.any(String));
        const key = `${region}:${feature.properties.rosstatName}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        populationByKey.set(key, feature.properties.population);
        expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
        eachPoint(feature.geometry.coordinates, ([longitude, latitude]) => {
          expect(longitude).toBeGreaterThanOrEqual(-180);
          expect(longitude).toBeLessThanOrEqual(180);
          expect(latitude).toBeGreaterThanOrEqual(-90);
          expect(latitude).toBeLessThanOrEqual(90);
        });
      }
    }
    expect(seen).toHaveLength(rows.length);
    for (const row of rows) {
      expect(populationByKey.get(`${row.region_id}:${row.rosstat_name}`)).toBe(row.population);
    }
  });
});
