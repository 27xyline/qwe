import type { Candidate, CandidateCluster } from "./types";

const clusterRadiusInSvgUnits = (scale: number, viewportWidth: number) => 44 * 1000 / Math.max(1, viewportWidth * scale);

export function clusterCandidates(candidates: Candidate[], scale: number, viewportWidth: number, selectedCandidateId?: string): CandidateCluster[] {
  const sortedCandidates = [...candidates].toSorted((first, second) => first.id.localeCompare(second.id));
  if (scale >= 2.2) return sortedCandidates.map((candidate) => ({ id: candidate.id, x: candidate.sx, y: candidate.sy, candidates: [candidate], containsSelected: candidate.id === selectedCandidateId }));

  const radius = clusterRadiusInSvgUnits(scale, viewportWidth);
  const clusters: CandidateCluster[] = [];
  for (const candidate of sortedCandidates) {
    const cluster = clusters.find((item) => Math.hypot(item.x - candidate.sx, item.y - candidate.sy) <= radius);
    if (!cluster) {
      clusters.push({ id: candidate.id, x: candidate.sx, y: candidate.sy, candidates: [candidate], containsSelected: candidate.id === selectedCandidateId });
      continue;
    }
    cluster.candidates.push(candidate);
    cluster.x = cluster.candidates.reduce((sum, item) => sum + item.sx, 0) / cluster.candidates.length;
    cluster.y = cluster.candidates.reduce((sum, item) => sum + item.sy, 0) / cluster.candidates.length;
    cluster.containsSelected ||= candidate.id === selectedCandidateId;
    cluster.id = cluster.candidates.map((item) => item.id).join("+");
  }
  return clusters;
}
