// Display helpers: never render raw snake_case enums in the UI.

const CHANNEL_LABELS: Record<string, string> = {
  cold_apply: "Cold Apply",
  referral: "Referral",
  return_intern: "Return Intern",
  recruiter_outreach: "Recruiter Outreach",
  hackathon_oss: "OSS / Hackathon",
};

const ROLE_LABELS: Record<string, string> = {
  SWE: "SWE",
  MLE_AI: "MLE / AI",
  Quant: "Quant",
  PM: "PM",
  Data: "Data",
  Security: "Security",
  Other: "Other",
};

const TIER_LABELS: Record<string, string> = {
  neolab: "Neolab",
  quant: "Quant",
  big_tech: "Big Tech",
  fintech: "Fintech",
  standard: "Standard",
  startup: "Startup",
};

const TYPE_LABELS: Record<string, string> = {
  company: "Company",
  oss_org: "OSS Org",
  research_lab: "Research Lab",
};

const title = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const pick = (m: Record<string, string>) => (k: string) => m[k] ?? title(k);

export const channelLabel = pick(CHANNEL_LABELS);
export const roleLabel = pick(ROLE_LABELS);
export const tierLabel = pick(TIER_LABELS);
export const typeLabel = pick(TYPE_LABELS);

/** Semantic accent per tier (hex so it works in inline SVG/styles too). */
export const TIER_COLOR: Record<string, string> = {
  neolab: "#7c3aed",
  quant: "#b45309",
  big_tech: "#1d4ed8",
  fintech: "#047857",
  standard: "#64748b",
  startup: "#be123c",
};
export const tierColor = (t: string) => TIER_COLOR[t] ?? TIER_COLOR.standard;

export const QUICK_PICKS = [
  { name: "Stripe", slug: "stripe" },
  { name: "NVIDIA", slug: "nvidia" },
  { name: "Meta", slug: "meta" },
  { name: "Google", slug: "google" },
  { name: "Jane Street", slug: "jane-street" },
  { name: "Capital One", slug: "capital-one" },
] as const;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Plain-English read of the confidence tier, for students. */
export const confidenceWord = (c: string) => ({ low: "limited data", medium: "fair sample", high: "solid sample" })[c] ?? c;
export const reports = (n: number) => `${n} report${n === 1 ? "" : "s"}`;
