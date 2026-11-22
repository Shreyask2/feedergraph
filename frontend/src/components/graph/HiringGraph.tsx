"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Feeder, GraphResponse } from "@/lib/types";

type CompanyData = { name: string; sub: string; isTarget: boolean; slug: string };
type CompanyNode = Node<CompanyData, "company">;

function CompanyNodeView({ data }: NodeProps<CompanyNode>) {
  return (
    <div
      className={`min-w-40 border px-3 py-2 font-mono text-xs ${
        data.isTarget
          ? "border-primary bg-primary text-primary-foreground"
          : "cursor-pointer border-border bg-card hover:border-primary"
      }`}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="text-sm font-bold">{data.name}</div>
      <div className={data.isTarget ? "" : "text-muted-foreground"}>{data.sub}</div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

// Defined at module scope so the object identity is stable across renders.
const nodeTypes: NodeTypes = { company: CompanyNodeView };

const ROW = 64;

function build(data: GraphResponse, feeders: Feeder[]) {
  const max = Math.max(...feeders.map((f) => f.weighted_score), 1);
  const height = Math.max(feeders.length - 1, 0) * ROW;
  const nodes: CompanyNode[] = [
    {
      id: data.target.id,
      type: "company",
      position: { x: 480, y: height / 2 },
      data: {
        name: data.target.name,
        sub: `RO ${(data.overall_ro_rate * 100).toFixed(0)}% · ${data.confidence_level}`,
        isTarget: true,
        slug: data.target.slug,
      },
    },
    ...feeders.map(
      (f, i): CompanyNode => ({
        id: f.entity.id,
        type: "company",
        position: { x: 0, y: i * ROW },
        data: {
          name: f.entity.name,
          sub: `${f.raw_count} interns · score ${f.weighted_score.toFixed(1)}`,
          isTarget: false,
          slug: f.entity.slug,
        },
      }),
    ),
  ];
  const edges: Edge[] = feeders.map((f) => ({
    id: `${f.entity.id}-${data.target.id}`,
    source: f.entity.id,
    target: data.target.id,
    animated: f.verified_count > 0,
    style: { strokeWidth: 1 + (f.weighted_score / max) * 7, stroke: "var(--primary)", opacity: 0.6 },
  }));
  return { nodes, edges };
}

interface Props {
  data: GraphResponse;
  onFocus: (slug: string) => void;
}

export function HiringGraph({ data, onFocus }: Props) {
  const { nodes, edges } = useMemo(() => build(data, data.feeders.slice(0, 15)), [data]);

  return (
    <div className="h-full min-h-[480px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          if (!node.data.isTarget) onFocus(node.data.slug);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
