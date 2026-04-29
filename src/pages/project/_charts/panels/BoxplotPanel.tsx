import React, { useMemo, useState } from "react";
import { BoxSelect, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BoxplotRow } from "../types";
import { BoxPlotShape } from "../BoxPlotShape";
import { shortLabel, fmtN } from "../utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = "name" | "median" | "iqr" | "range" | "std";

type EnrichedRow = BoxplotRow & {
  iqr: number;
  range: number;
  lowerFence: number;
  upperFence: number;
  /** shifted lower fence (for BoxPlotShape pixel calc) */
  s_lf: number;
  /** shifted upper fence (for BoxPlotShape pixel calc) */
  s_uf: number;
  /** Bowley / Yule-Kendall quartile skewness index ∈ [-1, 1] */
  skewQ: number;
  /** Coefficient of Variation (%) — null if mean ≈ 0 or missing */
  cv: number | null;
};

type Props = {
  boxplotInfo: { data: BoxplotRow[]; shift: number };
  allBoxplotCols: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Bowley / Yule-Kendall quartile skewness: (Q3 − 2·Median + Q1) / IQR
 * Range: −1 (left) to +1 (right). 0 = symmetric.
 */
function bowleySkew(p25: number, p50: number, p75: number): number {
  const iqr = p75 - p25;
  return iqr > 0 ? (p75 - 2 * p50 + p25) / iqr : 0;
}

interface SkewMeta { label: string; icon: string; cls: string }

function skewMeta(skewQ: number): SkewMeta {
  if (skewQ >  0.15) return { label: "Queue droite",  icon: "▶", cls: "text-amber-600 dark:text-amber-400" };
  if (skewQ < -0.15) return { label: "Queue gauche",  icon: "◀", cls: "text-blue-600 dark:text-blue-400" };
  return                    { label: "Symétrique",    icon: "≈",  cls: "text-emerald-600 dark:text-emerald-400" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BoxplotPanel({ boxplotInfo, allBoxplotCols }: Props) {
  const [sortBy,     setSortBy]     = useState<SortKey>("name");
  const [showMean,   setShowMean]   = useState(true);
  const [showFences, setShowFences] = useState(true);
  const [showStats,  setShowStats]  = useState(false);

  // ── Enrich + sort ──────────────────────────────────────────────────────────
  const enrichedData = useMemo<EnrichedRow[]>(() => {
    const sorted = [...boxplotInfo.data].sort((a, b) => {
      switch (sortBy) {
        case "median": return b._p50 - a._p50;
        case "iqr":    return (b._p75 - b._p25) - (a._p75 - a._p25);
        case "range":  return (b._max - b._min)  - (a._max - a._min);
        case "std":    return ((b._std ?? 0) - (a._std ?? 0));
        default:       return a.name.localeCompare(b.name);
      }
    });

    return sorted.map((d) => {
      const iqr        = d._p75 - d._p25;
      const range      = d._max - d._min;
      const lowerFence = d._p25 - 1.5 * iqr;
      const upperFence = d._p75 + 1.5 * iqr;
      const s_lf       = lowerFence + boxplotInfo.shift;
      const s_uf       = upperFence + boxplotInfo.shift;
      const skewQ      = bowleySkew(d._p25, d._p50, d._p75);
      const cv         =
        d._mean != null && d._std != null && Math.abs(d._mean) > 1e-9
          ? Math.abs(d._std / d._mean) * 100
          : null;
      return { ...d, iqr, range, lowerFence, upperFence, s_lf, s_uf, skewQ, cv };
    });
  }, [boxplotInfo.data, boxplotInfo.shift, sortBy]);

  const { shift } = boxplotInfo;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (enrichedData.length === 0) {
    return (
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="h-[320px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <BoxSelect className="h-10 w-10 opacity-20" />
          <p className="text-sm">
            {allBoxplotCols.length === 0
              ? "Aucune colonne numérique disponible"
              : "Sélectionner au moins une colonne"}
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Chart card ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card overflow-hidden">

        {/* Header + controls */}
        <div className="px-5 pt-4 pb-2 flex flex-wrap items-start justify-between gap-3 border-b border-border/40">
          <div>
            <p className="text-sm font-semibold leading-snug">Distribution — Boîtes à moustaches</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enrichedData.length} colonne{enrichedData.length > 1 ? "s" : ""} · IQR [P25–P75]
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sort selector */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="h-7 rounded-lg text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nom (A→Z)</SelectItem>
                  <SelectItem value="median">Médiane ↓</SelectItem>
                  <SelectItem value="iqr">IQR ↓</SelectItem>
                  <SelectItem value="range">Étendue ↓</SelectItem>
                  <SelectItem value="std">Écart-type ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mean toggle */}
            <button
              onClick={() => setShowMean((v) => !v)}
              title="Afficher / masquer la moyenne (◆)"
              className={[
                "flex items-center gap-1 text-xs rounded-lg border px-2 py-1 transition-colors",
                showMean
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {showMean ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Moyenne ◆
            </button>

            {/* Tukey fences toggle */}
            <button
              onClick={() => setShowFences((v) => !v)}
              title="Afficher / masquer les bornes de Tukey (Q1 − 1.5·IQR / Q3 + 1.5·IQR)"
              className={[
                "flex items-center gap-1 text-xs rounded-lg border px-2 py-1 transition-colors",
                showFences
                  ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {showFences ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Tukey
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="p-4 pt-3">
          <ResponsiveContainer width="100%" height={Math.max(300, enrichedData.length * 62 + 40)}>
            <BarChart
              layout="vertical"
              data={enrichedData}
              margin={{ top: 10, right: 40, bottom: 10, left: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis
                type="number"
                domain={[0, "auto"]}
                tickFormatter={(v) => fmtN(v - shift, 1)}
                className="text-xs"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={155}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => shortLabel(String(v), 22)}
              />

              {/* ── Rich tooltip ────────────────────────────────────────── */}
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as EnrichedRow;
                  if (!d) return null;
                  const sk = skewMeta(d.skewQ);
                  return (
                    <div className="bg-card border rounded-xl p-3 text-xs shadow-lg min-w-[220px] space-y-1">
                      <p className="font-semibold text-sm truncate max-w-[240px] pb-1 border-b">{d.name}</p>

                      {/* 5-number summary */}
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                        <span className="text-muted-foreground">Max</span>
                        <span className="text-right font-medium tabular-nums">{fmtN(d._max)}</span>

                        <span className="text-muted-foreground">P75</span>
                        <span className="text-right font-medium tabular-nums">{fmtN(d._p75)}</span>

                        <span className="font-semibold" style={{ color: d.fill }}>Médiane</span>
                        <span className="text-right font-semibold tabular-nums" style={{ color: d.fill }}>{fmtN(d._p50)}</span>

                        {d._mean != null && (
                          <>
                            <span className="text-muted-foreground">Moyenne</span>
                            <span className="text-right tabular-nums">{fmtN(d._mean)}</span>
                          </>
                        )}

                        <span className="text-muted-foreground">P25</span>
                        <span className="text-right font-medium tabular-nums">{fmtN(d._p25)}</span>

                        <span className="text-muted-foreground">Min</span>
                        <span className="text-right font-medium tabular-nums">{fmtN(d._min)}</span>
                      </div>

                      {/* Spread stats */}
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 pt-1 border-t">
                        <span className="text-muted-foreground">IQR</span>
                        <span className="text-right font-medium tabular-nums text-primary">{fmtN(d.iqr)}</span>

                        <span className="text-muted-foreground">Étendue</span>
                        <span className="text-right tabular-nums">{fmtN(d.range)}</span>

                        {d._std != null && (
                          <>
                            <span className="text-muted-foreground">Écart-type σ</span>
                            <span className="text-right tabular-nums">{fmtN(d._std)}</span>
                          </>
                        )}

                        {d.cv != null && (
                          <>
                            <span className="text-muted-foreground">CV</span>
                            <span className="text-right tabular-nums">{fmtN(d.cv, 1)}%</span>
                          </>
                        )}
                      </div>

                      {/* Tukey fences */}
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 pt-1 border-t">
                        <span className="text-muted-foreground">Borne Tukey ↓</span>
                        <span className="text-right tabular-nums">{fmtN(d.lowerFence)}</span>

                        <span className="text-muted-foreground">Borne Tukey ↑</span>
                        <span className="text-right tabular-nums">{fmtN(d.upperFence)}</span>
                      </div>

                      {/* Skewness */}
                      <div className="pt-1 border-t flex items-center gap-1.5">
                        <span className={`font-medium ${sk.cls}`}>{sk.icon} {sk.label}</span>
                        <span className="text-muted-foreground text-[10px]">(indice={fmtN(d.skewQ, 2)})</span>
                      </div>
                    </div>
                  );
                }}
              />

              {/* ── Bars ─────────────────────────────────────────────────── */}
              <Bar
                dataKey="value"
                isAnimationActive={false}
                shape={(props: object) => (
                  <BoxPlotShape
                    {...props}
                    showMean={showMean}
                    showFences={showFences}
                    shift={shift}
                  />
                )}
              >
                {enrichedData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Legend + analysis panel ────────────────────────────────────────── */}
      <div className="mt-3 rounded-xl border bg-muted/20 p-3 space-y-3">

        {/* Visual key */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              swatch: <span className="mt-0.5 h-3 w-0.5 shrink-0 bg-slate-400" />,
              label: "Min / Max",
              desc: "Moustaches (extrêmes observés)",
            },
            {
              swatch: (
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm bg-primary/20 border border-primary" />
              ),
              label: "Boîte IQR",
              desc: "P25 → P75 (50 % central)",
            },
            {
              swatch: <span className="mt-0.5 h-3 w-0.5 shrink-0 bg-primary" />,
              label: "Médiane P50",
              desc: "Trait vertical plein",
            },
            {
              swatch: (
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm bg-white border-2 border-current text-primary" />
              ),
              label: "Moyenne ◆",
              desc: "Diamant blanc (si activé)",
            },
            {
              swatch: (
                <span className="mt-0.5 h-3 w-0.5 shrink-0 border-l-2 border-dashed border-amber-500" />
              ),
              label: "Tukey ± 1.5·IQR",
              desc: "Seuil outliers potentiels",
            },
          ].map(({ swatch, label, desc }) => (
            <div key={label} className="flex items-start gap-2">
              <div className="flex items-center h-4 shrink-0">{swatch}</div>
              <div>
                <p className="text-xs font-medium leading-tight">{label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Per-column compact summary with skewness indicator */}
        <div className="border-t pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-1.5 gap-x-6">
          {enrichedData.map((d) => {
            const sk = skewMeta(d.skewQ);
            return (
              <div key={d.name} className="flex items-center gap-2 text-xs min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="truncate text-muted-foreground flex-1" title={d.name}>
                  {shortLabel(d.name, 18)}
                </span>
                <span className="tabular-nums shrink-0 text-muted-foreground text-[10px]">
                  {fmtN(d._min, 1)} –{" "}
                  <span className="text-foreground font-medium">{fmtN(d._p50, 1)}</span>{" "}
                  – {fmtN(d._max, 1)}
                </span>
                <span
                  className={`text-[10px] shrink-0 font-medium ${sk.cls}`}
                  title={`Asymétrie de Bowley = ${d.skewQ.toFixed(2)} · ${sk.label}`}
                >
                  {sk.icon}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Collapsible full stats table ───────────────────────────────── */}
        <div className="border-t pt-2">
          <button
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors select-none"
            onClick={() => setShowStats((v) => !v)}
          >
            <span
              className="inline-block transition-transform duration-150"
              style={{ transform: showStats ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ›
            </span>
            Tableau statistique complet ({enrichedData.length} colonne{enrichedData.length > 1 ? "s" : ""})
          </button>

          {showStats && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-border/60">
              <table
                className="w-full text-xs tabular-nums min-w-[780px]"
                aria-label="Tableau statistique complet des colonnes sélectionnées"
              >
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    {[
                      { h: "Colonne",     title: "Nom de la variable" },
                      { h: "Min",         title: "Minimum observé" },
                      { h: "P25",         title: "1er quartile — 25 % des valeurs sont inférieures" },
                      { h: "Médiane",     title: "P50 — valeur centrale" },
                      { h: "Moyenne",     title: "Moyenne arithmétique" },
                      { h: "P75",         title: "3e quartile — 75 % des valeurs sont inférieures" },
                      { h: "Max",         title: "Maximum observé" },
                      { h: "IQR",         title: "Écart interquartile (P75 − P25) — dispersion du cœur de la distribution" },
                      { h: "Étendue",     title: "Portée totale (Max − Min)" },
                      { h: "σ",           title: "Écart-type" },
                      { h: "CV %",        title: "Coefficient de variation = σ/|Moyenne| × 100 — dispersion relative" },
                      { h: "Tukey ↓",     title: "Borne inférieure de Tukey : Q1 − 1.5 × IQR. Valeurs en dessous = outliers potentiels" },
                      { h: "Tukey ↑",     title: "Borne supérieure de Tukey : Q3 + 1.5 × IQR. Valeurs au dessus = outliers potentiels" },
                      { h: "Asymétrie",   title: "Indice de Bowley (quartiles) : > 0 = queue à droite, < 0 = queue à gauche" },
                    ].map(({ h, title }) => (
                      <th
                        key={h}
                        scope="col"
                        title={title}
                        className="px-2.5 py-2 text-left font-medium whitespace-nowrap text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enrichedData.map((d, i) => {
                    const sk = skewMeta(d.skewQ);
                    return (
                      <tr
                        key={d.name}
                        className={`border-t border-border/50 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                      >
                        {/* Colonne */}
                        <td className="px-2.5 py-1.5 font-medium max-w-[180px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                            <span className="truncate" title={d.name}>{shortLabel(d.name, 22)}</span>
                          </div>
                        </td>
                        {/* 5-number summary */}
                        <td className="px-2.5 py-1.5 text-right text-muted-foreground">{fmtN(d._min)}</td>
                        <td className="px-2.5 py-1.5 text-right text-muted-foreground">{fmtN(d._p25)}</td>
                        <td className="px-2.5 py-1.5 text-right font-semibold text-foreground">{fmtN(d._p50)}</td>
                        <td className="px-2.5 py-1.5 text-right">{d._mean != null ? fmtN(d._mean) : "—"}</td>
                        <td className="px-2.5 py-1.5 text-right text-muted-foreground">{fmtN(d._p75)}</td>
                        <td className="px-2.5 py-1.5 text-right text-muted-foreground">{fmtN(d._max)}</td>
                        {/* Spread */}
                        <td className="px-2.5 py-1.5 text-right font-medium text-primary">{fmtN(d.iqr)}</td>
                        <td className="px-2.5 py-1.5 text-right">{fmtN(d.range)}</td>
                        <td className="px-2.5 py-1.5 text-right">{d._std != null ? fmtN(d._std) : "—"}</td>
                        <td className="px-2.5 py-1.5 text-right">{d.cv != null ? `${fmtN(d.cv, 1)}%` : "—"}</td>
                        {/* Tukey fences */}
                        <td className="px-2.5 py-1.5 text-right text-muted-foreground">{fmtN(d.lowerFence)}</td>
                        <td className="px-2.5 py-1.5 text-right text-muted-foreground">{fmtN(d.upperFence)}</td>
                        {/* Skewness */}
                        <td className={`px-2.5 py-1.5 whitespace-nowrap ${sk.cls}`}>
                          {sk.icon} {sk.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] italic text-muted-foreground pt-1">
          Bornes de Tukey = Q1 − 1.5·IQR / Q3 + 1.5·IQR (méthode Tukey, 1977).
          Asymétrie = indice de Bowley ∈ [−1, 1].
          Le marqueur ◆ indique la moyenne arithmétique.
        </p>
      </div>
    </>
  );
}
