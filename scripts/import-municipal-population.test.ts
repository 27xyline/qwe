import { describe, expect, it } from "vitest";
import { buildUpdatePlan, normalizeName, parseCsv } from "./import-municipal-population.mjs";

const source = { provider: "Росстат", dataset: "БД ПМО", indicatorCode: "8112027", asOf: "2025-01-01", url: "https://example.test" };
const document = { region: "moscow", filename: "test.json", data: { updatedAt: "2025-01-01", geography: { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Орехово-Зуевский городской округ", population: 1 }, geometry: { type: "Polygon", coordinates: [] } }] }, cities: [] } };
const header = "region_id;rosstat_name;municipality_type;population;as_of;indicator_code";

describe("импорт муниципального населения", () => {
  it("нормализует регистр, ё и тире", () => expect(normalizeName("ОРЕХОВО–ЗУЕВСКИЙ городской округ")).toBe(normalizeName("Орехово-Зуевский")));
  it("обновляет только население и сохраняет геометрию", () => {
    const rows = parseCsv(`${header}\nmoscow;Орехово-Зуевский;городской округ;120000;2025-01-01;8112027`);
    const update = buildUpdatePlan([document], rows, {}, source)[0];
    expect(update.data.geography.features[0].properties.population).toBe(120000);
    expect(update.data.geography.features[0].geometry).toEqual(document.data.geography.features[0].geometry);
  });
  it("останавливается при отсутствии строки", () => expect(() => buildUpdatePlan([document], [], {}, source)).toThrow("Не найдена строка"));
  it("останавливается при неверной дате", () => expect(() => parseCsv(`${header}\nmoscow;Тест;округ;1;2024-01-01;8112027`)).toThrow("Некорректная строка"));
  it("различает городской и муниципальный округа с общей основой названия", () => {
    const rows = parseCsv(`${header}\nchuvashia;Чебоксарский городской округ;городской округ;1;2025-01-01;8112027\nchuvashia;Чебоксарский муниципальный округ;муниципальный округ;2;2025-01-01;8112027`);
    expect(rows).toHaveLength(2);
  });
  it("останавливается при неиспользованной строке", () => {
    const rows = parseCsv(`${header}\nmoscow;Орехово-Зуевский;округ;1;2025-01-01;8112027\nmoscow;Лишний;округ;1;2025-01-01;8112027`);
    expect(() => buildUpdatePlan([document], rows, {}, source)).toThrow("без контура");
  });
});
