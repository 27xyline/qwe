import type { Candidate, CityMetric, MunicipalityMetric, RegionFilter, RegionId } from "./types";

const matchesRegion = <T extends { region: RegionId }>(item: T, selectedRegion: RegionFilter) => selectedRegion === "all" || item.region === selectedRegion;

export const getVisibleMunicipalities = (features: MunicipalityMetric[], selectedRegion: RegionFilter) => features.filter((feature) => matchesRegion(feature.properties, selectedRegion));
export const getVisibleCities = (cities: CityMetric[], selectedRegion: RegionFilter) => cities.filter((city) => matchesRegion(city, selectedRegion));
export const getVisibleCandidates = (candidates: Candidate[], selectedRegion: RegionFilter) => candidates.filter((candidate) => matchesRegion(candidate, selectedRegion));
export const getSelectedCandidateIdForRegion = (candidates: Candidate[], currentCandidateId: string, selectedRegion: RegionFilter) => {
  const visibleCandidates = getVisibleCandidates(candidates, selectedRegion);
  return visibleCandidates.some((candidate) => candidate.id === currentCandidateId) ? currentCandidateId : (visibleCandidates[0]?.id ?? null);
};
export const getVisibleRegionLabels = <T extends { region: RegionId }>(labels: T[], selectedRegion: RegionFilter) => labels.filter((label) => matchesRegion(label, selectedRegion));
