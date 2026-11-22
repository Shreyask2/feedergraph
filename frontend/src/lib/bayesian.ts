import type { Confidence } from "./types";

// Mirrors pipeline/src/bayesian.py: prior m=0.55, pseudo-count C=5.
export const bayesianRoRate = (yes: number, known: number) => (5 * 0.55 + yes) / (5 + known);
export const confidenceLevel = (known: number): Confidence =>
  known < 5 ? "low" : known < 15 ? "medium" : "high";
