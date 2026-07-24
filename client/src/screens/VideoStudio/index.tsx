import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  appendNode, emptyVideo, removeNode, serializeVideo, updateNode,
  validateVideo, videoDurationMs, NODE_RADIUS_PX,
} from "../../features/videos/authoring";
import { deleteVideo, loadVideos, saveVideo } from "../../features/videos/storage";
import type { AuthoredVideo, VideoScore } from "../../features/videos/types";
import { useGameStore } from "../../store";
import { ChartPreview } from "./ChartPreview";

/**
 * The chart authoring tool. Tap the field to drop numbered nodes, mark any node as a
 * SLIDE to require a drag from the previous one, then PLAY to test. EXPORT emits JSON
 * that can be committed as built-in content.
 */
export function VideoStudio({ onClose }: { onClose: () => void }) {
  const handle = useGameStore(s => s.handle);
  const [video, setVideo] = useState<AuthoredVideo>(() => emptyVideo(handle || "creator", Date.now()));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [library, setLibrary] = useState<AuthoredVideo[]>(() => loadVideos());
  const [playing, setPlaying] = useState(false);
  const [lastScore, setLastScore] = useState<VideoScore | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rect, setRect] = useState({ width: 360, height: 560 });
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ width: r.width, height: r.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const issues = useMemo(() => validateVideo(video, rect), [video, rect]);
  const errors = issues.filter(issue => issue.level === "error");
  const selected = video.nodes.find(node => node.id === selectedId) ?? null;

  const placeNode = (event: React.PointerEvent<HTMLDivElement>) => {
    if (playing) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    // Tapping an existing node selects it instead of stacking a new one on top.
    const hit = video.nodes.find(node =>
      Math.hypot((node.x - x) * bounds.width, (node.y - y) * bounds.height) <= NODE_RADIUS_PX + 6);
    if (hit) { setSelectedId(hit.id); return; }
    const next = appendNode(video, x, y);
    setVideo(next);
    setSelectedId(next.nodes[next.nodes.length - 1]?.id ?? null);
  };

  const persist = () => {
    setLibrary(saveVideo(video));
    setToast(`saved "${video.title}"`);
  };

  const exportJson = async () => {
    const json = serializeVideo(video);
    try {
      await navigator.clipboard.writeText(json);
      setToast("JSON copied to clipboard");
    } catch {
      // Clipboard is unavailable over plain http / without permission — surface the JSON
      // so the author can still copy it by hand rather than losing the export.
      window.prompt("Copy this chart JSON:", json);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
      style={{
        position: "fixed", inset: 0, zIndex: 500, background: "var(--bg)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Header lives outside the scroll region — same fix as Creator Studio. */}
      <header style={{ flexShrink: 0, padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(7,8,12,.96)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} aria-label="Close video studio" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", color: "#fff", cursor: "pointer" }}>←</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: ".05em" }}>VIDEO STUDIO</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>
              {video.nodes.length} NODES · {(videoDurationMs(video) / 1000).toFixed(1)}s
            </div>
          </div>
          <button
            onClick={() => { setLastScore(null); setPlaying(true); }}
            disabled={errors.length > 0 || video.nodes.length === 0}
            style={{
              marginLeft: "auto", padding: "9px 16px", borderRadius: 999, border: 0,
              background: errors.length || !video.nodes.length ? "rgba(255,255,255,.1)" : "var(--cyan)",
              color: errors.length || !video.nodes.length ? "rgba(255,255,255,.4)" : "#050608",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 900, letterSpacing: ".1em",
              cursor: errors.length || !video.nodes.length ? "not-allowed" : "pointer",
            }}
          >▶ PLAY</button>
        </div>
      </header>

      {/* ── Playfield ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, background: "linear-gradient(160deg,#11131a,#06070a 60%,#16070c)" }}>
        <div
          ref={fieldRef}
          onPointerDown={placeNode}
          style={{ position: "absolute", inset: 0, touchAction: "none", cursor: playing ? "default" : "crosshair" }}
        >
          {/* Slide links */}
          <svg aria-hidden width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {video.nodes.map((node, index) => index > 0 && node.kind === "slide" ? (
              <line
                key={`l-${node.id}`}
                x1={`${video.nodes[index - 1].x * 100}%`} y1={`${video.nodes[index - 1].y * 100}%`}
                x2={`${node.x * 100}%`} y2={`${node.y * 100}%`}
                stroke="var(--cyan)" strokeWidth={5} strokeLinecap="round" strokeDasharray="3 8" opacity={.75}
              />
            ) : null)}
          </svg>

          {!playing && video.nodes.map(node => (
            <div
              key={node.id}
              style={{
                position: "absolute", left: `${node.x * 100}%`, top: `${node.y * 100}%`,
                width: NODE_RADIUS_PX * 2, height: NODE_RADIUS_PX * 2,
                marginLeft: -NODE_RADIUS_PX, marginTop: -NODE_RADIUS_PX,
                borderRadius: "50%", display: "grid", placeItems: "center",
                border: `3px solid ${node.kind === "slide" ? "var(--cyan)" : "var(--red)"}`,
                background: node.id === selectedId ? "rgba(255,255,255,.14)" : "rgba(8,10,15,.8)",
                boxShadow: node.id === selectedId ? "0 0 20px rgba(255,255,255,.4)" : "none",
                fontFamily: "var(--font-display)", fontSize: 22, color: "#fff",
                pointerEvents: "none",
              }}
            >
              {node.id}
              <span style={{ position: "absolute", bottom: -15, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)" }}>
                {(node.hitAtMs / 1000).toFixed(2)}s
              </span>
            </div>
          ))}

          {!playing && video.nodes.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center", padding: 24 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,.5)", lineHeight: 1.7 }}>
                TAP ANYWHERE TO PLACE NODE 1<br />
                NODES ARE TAPPED IN NUMBER ORDER<br />
                MARK ONE AS SLIDE TO DRAG INTO IT
              </span>
            </div>
          )}
        </div>

        {playing && (
          <ChartPreview
            video={video}
            onExit={score => { setPlaying(false); setLastScore(score); }}
          />
        )}
      </div>

      {/* ── Inspector / controls ──────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, maxHeight: "42%", overflowY: "auto", borderTop: "1px solid rgba(255,255,255,.08)", background: "rgba(9,10,14,.98)", padding: "10px 14px 16px" }}>
        {lastScore && (
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: "1px solid var(--cyan)", background: "rgba(37,244,238,.08)", fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff" }}>
            ACCURACY {(lastScore.accuracy * 100).toFixed(1)}% · MAX COMBO {lastScore.maxCombo} ·{" "}
            {lastScore.counts.perfect}P / {lastScore.counts.great}G / {lastScore.counts.good}g / {lastScore.counts.miss}M
          </div>
        )}

        {issues.length > 0 && (
          <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 3 }}>
            {issues.slice(0, 4).map((issue, i) => (
              <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: issue.level === "error" ? "#ff94a8" : "var(--gold)" }}>
                {issue.level === "error" ? "✕" : "!"} {issue.message}
              </span>
            ))}
          </div>
        )}

        {selected ? (
          <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>NODE {selected.id}</strong>
              <button
                onClick={() => setVideo(updateNode(video, selected.id, { kind: selected.kind === "tap" ? "slide" : "tap" }))}
                disabled={selected.id === 1}
                style={{
                  padding: "5px 10px", borderRadius: 999,
                  border: `1px solid ${selected.kind === "slide" ? "var(--cyan)" : "var(--red)"}`,
                  background: "transparent", color: selected.kind === "slide" ? "var(--cyan)" : "var(--red)",
                  fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 900,
                  opacity: selected.id === 1 ? .4 : 1,
                  cursor: selected.id === 1 ? "not-allowed" : "pointer",
                }}
              >{selected.kind === "slide" ? "SLIDE" : "TAP"}</button>
              <button
                onClick={() => { setVideo(removeNode(video, selected.id)); setSelectedId(null); }}
                style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 999, border: "1px solid rgba(255,49,93,.5)", background: "rgba(255,49,93,.12)", color: "#ff94a8", fontFamily: "var(--font-mono)", fontSize: 9, cursor: "pointer" }}
              >DELETE</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>TIME</span>
              {[-100, -25, +25, +100].map(delta => (
                <button
                  key={delta}
                  onClick={() => setVideo(updateNode(video, selected.id, { hitAtMs: Math.max(100, selected.hitAtMs + delta) }))}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer" }}
                >{delta > 0 ? `+${delta}` : delta}</button>
              ))}
              <span style={{ minWidth: 52, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cyan)" }}>{(selected.hitAtMs / 1000).toFixed(2)}s</span>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>
            TAP A NODE TO EDIT ITS TYPE AND TIMING
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)" }}>TITLE</span>
            <input
              value={video.title}
              onChange={e => setVideo({ ...video, title: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 11 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)" }}>BEAT (MS)</span>
            <input
              type="number" min={100} step={50} value={video.beatMs}
              onChange={e => setVideo({ ...video, beatMs: Math.max(100, Number(e.target.value) || 100) })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 11 }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <StudioButton label="SAVE" onClick={persist} tone="cyan" />
          <StudioButton label="EXPORT" onClick={exportJson} tone="gold" />
          <StudioButton label="NEW" onClick={() => { setVideo(emptyVideo(handle || "creator", Date.now())); setSelectedId(null); setLastScore(null); }} tone="plain" />
        </div>

        {library.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)", marginBottom: 6 }}>SAVED ({library.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {library.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title} · {item.nodes.length}n
                  </span>
                  <button onClick={() => { setVideo(item); setSelectedId(null); setLastScore(null); }} style={{ padding: "4px 9px", borderRadius: 999, border: "1px solid rgba(37,244,238,.5)", background: "transparent", color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 9, cursor: "pointer" }}>LOAD</button>
                  <button onClick={() => setLibrary(deleteVideo(item.id))} style={{ padding: "4px 9px", borderRadius: 999, border: "1px solid rgba(255,49,93,.45)", background: "transparent", color: "#ff94a8", fontFamily: "var(--font-mono)", fontSize: 9, cursor: "pointer" }}>DEL</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ position: "absolute", bottom: 18, left: "50%", translate: "-50% 0", zIndex: 20, padding: "9px 16px", borderRadius: 999, background: "rgba(0,0,0,.88)", border: "1px solid var(--cyan)", color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 10 }}
        >{toast}</motion.div>
      )}
    </motion.div>
  );
}

function StudioButton({ label, onClick, tone }: { label: string; onClick: () => void; tone: "cyan" | "gold" | "plain" }) {
  const color = tone === "cyan" ? "var(--cyan)" : tone === "gold" ? "var(--gold)" : "rgba(255,255,255,.7)";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "11px 0", borderRadius: 999,
        border: `1px solid ${tone === "plain" ? "rgba(255,255,255,.18)" : color}`,
        background: tone === "plain" ? "rgba(255,255,255,.05)" : `color-mix(in srgb, ${color} 14%, transparent)`,
        color, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 900, letterSpacing: ".1em",
        cursor: "pointer",
      }}
    >{label}</button>
  );
}
