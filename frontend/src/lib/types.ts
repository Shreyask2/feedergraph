export type Confidence = "low" | "medium" | "high";

export const ROLES = ["SWE", "MLE_AI", "Quant", "PM", "Data", "Security", "Other"] as const;
export type Role = (typeof ROLES)[number];

export interface EntityLite {
  id: string;
  name: string;
  slug: string;
  entity_type: "company" | "oss_org" | "research_lab";
  tier: string;
}

export interface Feeder {
  entity: EntityLite;
  raw_count: number;
  verified_count: number;
  weighted_score: number;
  ro_yes_count: number;
  ro_known_total: number;
  bayesian_ro_rate: number;
  confidence_level: Confidence;
  top_channel: string | null;
}

export interface GraphResponse {
  target: EntityLite;
  overall_ro_rate: number;
  ro_known_total: number;
  confidence_level: Confidence;
  /** % of feeder submissions by each feeder's top channel, weighted by raw_count */
  channel_distribution: Record<string, number>;
  feeders: Feeder[];
  entities: EntityLite[];
}
