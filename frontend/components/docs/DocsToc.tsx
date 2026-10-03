"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, GitBranch, MessageSquare } from "lucide-react";

export interface TocHeading {
  id: string;
  text: string;
  level?: number;
}

interface DocsTocProps {
  headings: TocHeading[];
}

export default function DocsToc({ headings }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string>(() => headings[0]?.id || "");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0% 0% -60% 0%" }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="docs-toc">
      <div className="docs-toc-title">On this page</div>
      <ul className="docs-toc-list">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`docs-toc-item ${activeId === h.id ? "active" : ""} ${
                h.level && h.level > 2 ? "indent" : ""
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>

      <div className="docs-toc-footer">
        <a
          href="https://github.com/AnoushkaSamanta/big-data-project"
          target="_blank"
          rel="noreferrer"
        >
          <GitBranch size={13} />
          <span>Edit this page on GitHub</span>
          <ExternalLink size={10} style={{ marginLeft: "auto", opacity: 0.5 }} />
        </a>

        <a href="#feedback">
          <MessageSquare size={13} />
          <span>Feedback & Issues</span>
        </a>
      </div>
    </aside>
  );
}
