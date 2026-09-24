"use client";

import React from "react";
import { Check } from "lucide-react";
import {
  parseDescription,
  type AutoBadge,
  type AutoSpec,
} from "@/utils/product-description";

/**
 * Rendu riche & automatique de la description produit : paragraphes,
 * titres de sections, puces / listes numérotées et lignes "Label : valeur".
 */

function toBgClass(accentClass: string): string {
  return accentClass.replace(/^text-/, "bg-");
}

export function RichDescription({
  text,
  accentClass = "text-[#f56b2a]",
}: {
  text: string;
  accentClass?: string;
}) {
  const blocks = parseDescription(text);

  if (blocks.length === 0) {
    return (
      <p className="text-gray-600 text-xs xl:text-[13px] leading-relaxed font-normal">
        {text}
      </p>
    );
  }

  const lineClass = "text-gray-600 text-xs xl:text-[13px] leading-relaxed font-normal";

  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <h4
              key={i}
              className="pt-2.5 first:pt-0 font-bold text-gray-900 uppercase tracking-wide text-[11px] flex items-center gap-2"
            >
              <span className={`w-1 h-3.5 rounded-full flex-shrink-0 ${toBgClass(accentClass)}`} />
              {b.text}
            </h4>
          );
        }
        if (b.type === "paragraph") {
          return (
            <p key={i} className={lineClass}>
              {b.text}
            </p>
          );
        }
        if (b.type === "label") {
          return (
            <div key={i} className={lineClass}>
              <span className="font-semibold text-gray-800">{b.label}</span>
              <span className="text-gray-400 mx-1.5">:</span>
              {b.value}
            </div>
          );
        }
        if (b.type === "list" && !b.ordered) {
          return (
            <ul key={i} className="space-y-1.5 my-1">
              {b.items.map((item, j) => (
                <li
                  key={j}
                  className="flex items-start gap-2 text-gray-600 text-xs xl:text-[13px] leading-relaxed"
                >
                  <Check size={13} strokeWidth={3} className={`mt-0.5 flex-shrink-0 ${accentClass}`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={i} className="list-decimal list-inside space-y-1.5 my-1">
            {b.items.map((item, j) => (
              <li key={j} className={lineClass}>
                {item}
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

export function AutoHighlights({
  items,
  accentClass = "text-[#f56b2a]",
  className = "",
}: {
  items: string[];
  accentClass?: string;
  className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`pt-3.5 mt-3.5 border-t border-gray-100 ${className}`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        Points forts
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-gray-700 text-xs leading-relaxed"
          >
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${toBgClass(accentClass)}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BADGE_TONES: Record<AutoBadge['tone'], string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

export function AutoBadgesRow({
  badges,
  className = "",
}: {
  badges: AutoBadge[];
  className?: string;
}) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 pt-3.5 mt-3.5 border-t border-gray-100 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${BADGE_TONES[b.tone]}`}
        >
          {b.text}
        </span>
      ))}
    </div>
  );
}

const SPEC_VALUE_TONE: Record<string, string> = {
  success: "text-emerald-700",
  danger: "text-red-600",
};

export function AutoSpecsGrid({
  specs,
  className = "grid grid-cols-2 gap-2 text-xs",
}: {
  specs: AutoSpec[];
  className?: string;
}) {
  if (!specs || specs.length === 0) return null;
  return (
    <div className={className}>
      {specs.map((s, i) => (
        <div key={`${s.label}-${i}`} className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
          <span className="block text-[9px] text-gray-400 uppercase font-medium">
            {s.label}
          </span>
          <span
            className={`font-medium block text-xs truncate ${
              s.tone ? SPEC_VALUE_TONE[s.tone] : "text-gray-800"
            }`}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}