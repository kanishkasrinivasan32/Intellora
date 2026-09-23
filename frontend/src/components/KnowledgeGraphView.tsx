import { useEffect, useRef } from "react";
import { Network } from "vis-network/standalone";
import type { Topic } from "../lib/api";

type GraphSelection = {
  kind: "topic" | "concept" | "note";
  id: string;
  label: string;
  topic?: string;
};
export function KnowledgeGraphView({
  topics,
  custom,
  notes = [],
  onSelect,
}: {
  topics: Topic[];
  custom?: any;
  notes?: any[];
  onSelect?: (selection: GraphSelection) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const nodes: any[] = [],
      edges: any[] = [];
    if (custom) {
      nodes.push(
        ...custom.nodes.map((n: any) => ({
          id: n.id,
          label: n.label,
          color: "#e9f0e4",
          kind: "concept",
        })),
      );
      edges.push(...custom.edges);
    } else {
      nodes.push({
        id: "you",
        label: "Your knowledge",
        color: "#174c43",
        font: { color: "#fff" },
        size: 35,
      });
      topics.forEach((topic, index) => {
        nodes.push({
          id: topic.id,
          label: topic.name,
          color: ["#dfeae1", "#f2e4be", "#edddd5"][index % 3],
          size: 27,
          kind: "topic",
          topic: topic.name,
        });
        edges.push({ from: "you", to: topic.id });
        (topic.hierarchy || []).forEach((concept, i) => {
          const id = `${topic.id}-${i}`;
          nodes.push({
            id,
            label: concept.name,
            color: "#fffdf7",
            size: 18,
            kind: "concept",
            topic: topic.name,
          });
          edges.push({ from: topic.id, to: id });
          (concept.prerequisites || []).forEach((prerequisite) => {
            const p = topic.hierarchy.findIndex((c) => c.name === prerequisite);
            if (p >= 0)
              edges.push({
                from: `${topic.id}-${p}`,
                to: id,
                arrows: "to",
                dashes: true,
              });
          });
        });
      });
      notes.forEach((note) => {
        const parent = topics.find((topic) => topic.name === note.topic);
        if (!parent) return;
        const id = `note:${note.id}`;
        nodes.push({
          id,
          label: note.title,
          color: "#e8e1f0",
          shape: "box",
          size: 15,
          kind: "note",
          topic: note.topic,
          noteId: note.id,
        });
        edges.push({ from: parent.id, to: id, dashes: true });
      });
    }
    const network = new Network(
      ref.current,
      { nodes, edges },
      {
        nodes: {
          shape: "dot",
          borderWidth: 1,
          font: { face: "DM Sans", size: 13, color: "#25463d", multi: true },
          margin: { top: 14, right: 14, bottom: 14, left: 14 },
        },
        edges: {
          color: "#b7c6b9",
          width: 1.5,
          smooth: { enabled: true, type: "continuous", roundness: 0.2 },
        },
        physics: {
          barnesHut: { gravitationalConstant: -5000, springLength: 170 },
          stabilization: { iterations: 130 },
        },
        interaction: { hover: true, navigationButtons: false },
      },
    );
    network.on("click", (params) => {
      if (!params.nodes.length || !onSelect) return;
      const node: any = nodes.find((item) => item.id === params.nodes[0]);
      if (node)
        onSelect({
          kind: node.kind || "concept",
          id: node.noteId || String(node.id),
          label: node.label,
          topic: node.topic,
        });
    });
    return () => network.destroy();
  }, [topics, custom, notes, onSelect]);
  return (
    <div
      className="knowledge-canvas"
      ref={ref}
      aria-label="Interactive Grand Line map. Click a node to open its learning content; drag to explore and scroll to zoom."
    />
  );
}
