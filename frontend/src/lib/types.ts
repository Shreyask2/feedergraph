export type Confidence = "low" | "medium" | "high";

export const ROLES = ["SWE", "MLE_AI", "Quant", "PM", "Data", "Security", "Other"] as const;
export type Role = (typeof ROLES)[number];

export interface EntityLite {
  id: string;
  name: string;
  slug: string;
  entity_type: "company" | "oss_org" | "research_lab";
  tier: string;
  domain?: string | null;
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

export type Mode = "inbound" | "outbound";

/** 2nd-degree hop: top feeder into (inbound) / top destination from (outbound) a 1st-degree node. */
export interface SecondHop {
  via: string; // 1st-degree entity id
  entity: EntityLite;
  raw_count: number;
  weighted_score: number;
}

export interface GraphResponse {
  mode: Mode;
  target: EntityLite;
  overall_ro_rate: number;
  ro_known_total: number;
  confidence_level: Confidence;
  /** % of feeder submissions by each feeder's top channel, weighted by raw_count */
  channel_distribution: Record<string, number>;
  /** 1st-degree neighbours: inbound feeders or outbound destinations, by weighted_score DESC */
  feeders: Feeder[];
  second_hop: SecondHop[];
  entities: EntityLite[];
  /** whole-dataset totals, independent of filters */
  totals: { entities: number; paths: number };
}
