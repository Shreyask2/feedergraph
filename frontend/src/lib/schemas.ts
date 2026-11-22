import { z } from "zod";
import { ROLES } from "@/lib/types";

export const CHANNELS = ["cold_apply", "referral", "return_intern", "recruiter_outreach", "hackathon_oss"] as const;
export const ENTITY_TYPES = ["company", "oss_org", "research_lab"] as const;
export const TIERS = ["neolab", "quant", "big_tech", "fintech", "standard", "startup"] as const;

const name = z.string().trim().min(1).max(100);

export const submitSchema = z.object({
  target_company_raw: name,
  role_category: z.enum(ROLES),
  internship_season: z.string().trim().regex(/^(Summer|Fall|Winter|Spring) 20\d{2}$/, "e.g. Summer 2026"),
  prior_experiences_raw: z.array(name).max(10).default([]),
  channel: z.enum(CHANNELS),
  received_return_offer: z.boolean().nullable().default(null),
});

export const resolveSchema = z.object({
  submission_id: z.uuid(),
  raw: name,
  action: z.enum(["map", "new"]),
  entity_id: z.uuid().optional(),
  new_name: name.optional(),
  entity_type: z.enum(ENTITY_TYPES).optional(),
  tier: z.enum(TIERS).optional(),
}).refine((v) => (v.action === "map" ? !!v.entity_id : !!v.new_name && !!v.entity_type), {
  message: "map needs entity_id; new needs new_name + entity_type",
});

// Mirrors pipeline/src/resolver.py normalize + config.CORPORATE_SUFFIXES.
const SUFFIXES = new Set(["inc", "llc", "corp", "technologies", "financial", "labs", "platforms"]);
export function normalize(raw: string): string {
  const tokens = raw.toLowerCase().replace(/[^\p{L}\p{N}\s]|_/gu, " ").split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !SUFFIXES.has(t));
  return (kept.length ? kept : tokens).join(" ");
}

// NFKD + strip combining marks so "Café" -> "cafe" (mirrors pipeline run_pipeline._slug).
export const slugify = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const FEEDBACK_CATEGORIES = ["bug", "missing_company", "feature", "other"] as const;
export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(5).max(1000),
  page_context: z.string().max(300).optional(),
  contact: z.string().trim().max(120).optional(),
});
