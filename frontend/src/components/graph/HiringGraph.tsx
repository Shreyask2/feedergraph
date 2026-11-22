"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
  type EdgeProps,
  type EdgeTypes,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Feeder, GraphResponse, SecondHop } from "@/lib/types";
import { channelLabel, tierColor } from "@/lib/labels";
import { CompanyLogo } from "./CompanyLogo";
import { EmptyPaths } from "./EmptyPaths";

type CompanyData = {
  name: string;
  sub: string;
  isTarget: boolean;
  slug: string;
  domain?: string | null;
  tier: string;
  /** 0..1 share of max intern volume; drives border glow */
  volume: number;
  /** 2nd-degree node: drawn at 65% opacity */
  faded: boolean;
};
type CompanyNode = Node<CompanyData, "company">;

function CompanyNodeView({ data }: NodeProps<CompanyNode>) {
  const c = tierColor(data.tier);
  const glow = data.isTarget ? 28 : Math.round(4 + data.volume * 18);
  const alpha = data.isTarget ? "55" : Math.round(0x18 + data.volume * 0x40).toString(16).padStart(2, "0");
  return (
    <div
      className={`glass flex w-56 items-center gap-2.5 px-2.5 py-2 font-mono text-xs tabular-nums transition-[background-color,box-shadow] ${
        data.isTarget ? "" : "cursor-pointer hover:bg-white/10"
      }`}
      style={{
        opacity: data.faded ? 0.65 : 1,
        borderColor: data.isTarget ? c : `${c}${data.faded ? "40" : "70"}`,
        boxShadow: `0 0 ${glow}px ${c}${alpha}`,
      }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <CompanyLogo slug={data.slug} domain={data.domain} name={data.name} tier={data.tier} className={data.isTarget ? "size-9" : "size-8"} />
      <div className="min-w-0">
        <div className={`truncate font-bold ${data.isTarget ? "text-base" : "text-sm"}`}>{data.name}</div>
        <div className="truncate text-muted-foreground">{data.sub}</div>
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

/** labelAt: which end of the edge sits on the 1st-degree node; the label goes there. */
type FeedData = { channel: string | null; share: number; color: string; labelAt: "source" | "target" };

function FeedEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data }: EdgeProps<Edge<FeedData>>) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  // Pin the label just off the 1st-degree node: rows are evenly spaced there, so labels never collide.
  const atSource = data?.labelAt === "source";
  const lx = atSource ? sourceX + 12 : targetX - 12;
  const ly = atSource ? sourceY : targetY;
  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {data?.share !== undefined && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-sm border bg-background/90 px-1.5 py-0.5 font-mono tabular-nums text-[10px] whitespace-nowrap"
            style={{ transform: `translate(${atSource ? "0" : "-100%"},-50%) translate(${lx}px,${ly}px)`, borderColor: `${data.color}66`, color: data.color }}
          >
            {data.channel ? `${channelLabel(data.channel)} · ` : ""}
            {data.share.toFixed(0)}%
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Defined at module scope so the object identity is stable across renders.
const nodeTypes: NodeTypes = { company: CompanyNodeView };
const edgeTypes: EdgeTypes = { feed: FeedEdge };

/** Rows drawn on the canvas (list view shows all). Keep in sync with HOP_LIMIT in /api/graph. */
const GRAPH_LIMIT = 12;
const COL = 340; // horizontal gap between hop columns
const ROW = 84; // vertical pitch per 1st-degree node

/**
 * Three columns. inbound: hop2 -> hop1 -> target. outbound: target -> hop1 -> hop2.
 * Edges always point source -> target so the arrow of time reads left to right.
 */
function build(data: GraphResponse, feeders: Feeder[]) {
  const inbound = data.mode === "inbound";
  const shown = new Set(feeders.map((f) => f.entity.id));
  const max = Math.max(...feeders.map((f) => f.weighted_score), 1);
  const maxRaw = Math.max(...feeders.map((f) => f.raw_count), 1);
  const total = feeders.reduce((n, f) => n + f.raw_count, 0) || 1;
  const height = Math.max(feeders.length - 1, 0) * ROW;
  const [x2, x1, x0] = inbound ? [0, COL, COL * 2] : [COL * 2, COL, 0];
  const topRaw = feeders.reduce((m, f) => (f.raw_count > m ? f.raw_count : m), 0);
  const topId = feeders.find((f) => f.raw_count === topRaw)?.entity.id;
  const link = (near: string, far: string) => (inbound ? { source: far, target: near } : { source: near, target: far });

  const nodes: CompanyNode[] = [
    {
      id: data.target.id,
      type: "company",
      position: { x: x0, y: height / 2 },
      data: {
        name: data.target.name,
        sub: `RO ${(data.overall_ro_rate * 100).toFixed(0)}% · ${data.confidence_level}`,
        isTarget: true,
        slug: data.target.slug,
        domain: data.target.domain,
        tier: data.target.tier,
        volume: 1,
        faded: false,
      },
    },
    ...feeders.map(
      (f, i): CompanyNode => ({
        id: f.entity.id,
        type: "company",
        position: { x: x1, y: i * ROW },
        data: {
          name: f.entity.name,
          sub: `${f.raw_count} interns · RO ${(f.bayesian_ro_rate * 100).toFixed(0)}%`,
          isTarget: false,
          slug: f.entity.slug,
          domain: f.entity.domain,
          tier: f.entity.tier,
          volume: f.raw_count / maxRaw,
          faded: false,
        },
      }),
    ),
  ];

  const edges: Edge[] = feeders.map((f) => ({
    id: `h1-${f.entity.id}`,
    ...link(data.target.id, f.entity.id),
    type: "feed",
    animated: f.entity.id === topId, // highest-volume path only
    data: {
      channel: f.top_channel,
      share: (f.raw_count / total) * 100,
      color: tierColor(f.entity.tier),
      labelAt: inbound ? "source" : "target",
    },
    style: {
      strokeWidth: 1.5 + (f.weighted_score / max) * 5,
      stroke: tierColor(f.entity.tier),
      opacity: f.entity.id === topId ? 0.9 : 0.5,
    },
  }));

  // 2nd hop: one node per distinct entity (shared when it neighbours several hop1 nodes),
  // placed at the mean y of the hop1 nodes it connects to.
  const rowOf = new Map(feeders.map((f, i) => [f.entity.id, i]));
  const hop2 = new Map<string, { hop: SecondHop; rows: number[] }>();
  for (const h of data.second_hop) {
    // skip hops back into the 1st-degree column: those links are already visible as their own rows
    if (!rowOf.has(h.via) || shown.has(h.entity.id) || h.entity.id === data.target.id) continue;
    const g = hop2.get(h.entity.id) ?? { hop: h, rows: [] };
    g.rows.push(rowOf.get(h.via)!);
    hop2.set(h.entity.id, g);
    const c = tierColor(h.entity.tier);
    edges.push({
      id: `h2-${h.via}-${h.entity.id}`,
      ...link(h.via, h.entity.id),
      type: "feed", // no data: unlabeled
      style: { strokeWidth: 1.25, stroke: c, opacity: 0.35, strokeDasharray: "4 4" },
    });
  }
  // nudge apart hop2 nodes that land on the same y
  const used: number[] = [];
  for (const [id, { hop, rows }] of [...hop2].sort((a, b) => avg(a[1].rows) - avg(b[1].rows))) {
    let y = avg(rows) * ROW;
    while (used.some((u) => Math.abs(u - y) < ROW * 0.8)) y += ROW * 0.8;
    used.push(y);
    nodes.push({
      id,
      type: "company",
      position: { x: x2, y },
      data: {
        name: hop.entity.name,
        sub: `${inbound ? "feeds" : "hires"} ${hop.raw_count} · 2nd hop`,
        isTarget: false,
        slug: hop.entity.slug,
        domain: hop.entity.domain,
        tier: hop.entity.tier,
        volume: 0,
        faded: true,
      },
    });
  }
  return { nodes, edges };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const FIT = { padding: "6%" as const, maxZoom: 1.1 };

interface Props {
  data: GraphResponse;
  onFocus: (slug: string) => void;
}

export function HiringGraph({ data, onFocus }: Props) {
  const { nodes, edges } = useMemo(() => build(data, data.feeders.slice(0, GRAPH_LIMIT)), [data]);

  if (data.feeders.length === 0)
    return (
      <div className="absolute inset-0">
        <EmptyPaths target={data.target} />
      </div>
    );

  return (
    <div className="absolute inset-0">
      <ReactFlow
        key={data.mode + data.target.id + data.feeders.length}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT}
        minZoom={0.3}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          if (!node.data.isTarget) onFocus(node.data.slug);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="oklch(1 0 0 / 14%)" gap={32} />
        <Controls position="bottom-right" showInteractive={false} className="[&_button]:border-white/10 [&_button]:bg-card [&_button]:fill-foreground" />
      </ReactFlow>
    </div>
  );
}
