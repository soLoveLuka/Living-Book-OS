"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Network, Plus, ArrowLeftRight } from "lucide-react";

type Chapter = {
  id: string;
  title: string;
  content: string;
  anchors: { id: string; label: string; x: number; y: number }[];
};

type ThoughtNode = {
  id: string;
  text: string;
  x: number;
  y: number;
  chapterId?: string;
  page?: number;
};

type View = "cover" | "book" | "thoughtspace";
type CameraState = { x: number; y: number; z: number };
type ToolMode = "pan" | "pen";

const STORAGE = "living-book-os-v1";

function loadInitial() {
  const fallback = {
    chapters: [{ id: crypto.randomUUID(), title: "Prologue", content: "", anchors: [] as Chapter["anchors"] }],
    activeChapterId: "",
    nodes: [] as ThoughtNode[],
    camera: { x: 0, y: 0, z: 1 } as CameraState,
    view: "cover" as View,
    strokes: [] as { id: string; points: { x: number; y: number }[] }[],
  };
  if (typeof window === "undefined") {
    fallback.activeChapterId = fallback.chapters[0].id;
    return fallback;
  }
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) {
      fallback.activeChapterId = fallback.chapters[0].id;
      return fallback;
    }
    const parsed = JSON.parse(raw);
    const chapters = Array.isArray(parsed.chapters) && parsed.chapters.length ? parsed.chapters : fallback.chapters;
    return {
      chapters,
      activeChapterId: parsed.activeChapterId || chapters[0].id,
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      camera: (parsed.camera || { x: 0, y: 0, z: 1 }) as CameraState,
      view: parsed.view || "cover",
      strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
    };
  } catch {
    fallback.activeChapterId = fallback.chapters[0].id;
    return fallback;
  }
}

export default function Home() {
  const initial = loadInitial();
  const [view, setView] = useState<View>(initial.view);
  const [chapters, setChapters] = useState<Chapter[]>(initial.chapters);
  const [activeChapterId, setActiveChapterId] = useState<string>(initial.activeChapterId);
  const [nodes, setNodes] = useState<ThoughtNode[]>(initial.nodes);
  const [camera, setCamera] = useState<CameraState>(initial.camera);
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<ToolMode>("pan");
  const [strokes, setStrokes] = useState<{ id: string; points: { x: number; y: number }[] }[]>(initial.strokes ?? []);
  const [dragging, setDragging] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [pulse, setPulse] = useState(0);
  const last = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const cameraTarget = useRef(initial.camera);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeStroke = useRef<string | null>(null);

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === activeChapterId) ?? chapters[0],
    [chapters, activeChapterId]
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({ chapters, activeChapterId, nodes, camera, view, strokes })
    );
  }, [chapters, activeChapterId, nodes, camera, view, strokes]);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => (p + 1) % 1000), 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setCamera((current) => {
        const tx = cameraTarget.current.x;
        const ty = cameraTarget.current.y;
        const tz = cameraTarget.current.z;
        const next = {
          x: current.x + (tx - current.x) * 0.16 + velocity.current.x,
          y: current.y + (ty - current.y) * 0.16 + velocity.current.y,
          z: current.z + (tz - current.z) * 0.2,
        };
        velocity.current.x *= 0.9;
        velocity.current.y *= 0.9;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const addChapter = () => {
    const chapter = {
      id: crypto.randomUUID(),
      title: `Chapter ${chapters.length}`,
      content: "",
      anchors: [],
    };
    setChapters((prev) => [...prev, chapter]);
    setActiveChapterId(chapter.id);
  };

  const updateChapter = (patch: Partial<Chapter>) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapterId ? { ...c, ...patch } : c))
    );
  };

  const addAnchor = () => {
    const id = crypto.randomUUID();
    const label = `Thought ${activeChapter.anchors.length + 1}`;
    const anchor = { id, label, x: camera.x * -1 + 120 * Math.random(), y: camera.y * -1 + 120 * Math.random() };
    updateChapter({ anchors: [...activeChapter.anchors, anchor] });
    setNodes((prev) => [...prev, { id, text: label, x: anchor.x, y: anchor.y, chapterId: activeChapterId, page: pageIndex + 1 }]);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.min(3.6, Math.max(0.08, cameraTarget.current.z - e.deltaY * 0.0014));
    cameraTarget.current = { ...cameraTarget.current, z: next };
  };

  const gotoAnchor = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return setView("thoughtspace");
    setView("thoughtspace");
    cameraTarget.current = { x: -node.x + 120, y: -node.y + 80, z: 1.15 };
  };

  const pages = useMemo(() => {
    const text = activeChapter.content || "";
    const size = 1650;
    const arr = [] as string[];
    for (let i = 0; i < Math.max(1, text.length); i += size) arr.push(text.slice(i, i + size));
    return arr.length ? arr : [""];
  }, [activeChapter.content]);

  useEffect(() => {
    setPageIndex(0);
  }, [activeChapterId]);

  useEffect(() => {
    if (pageIndex > pages.length - 1) setPageIndex(Math.max(0, pages.length - 1));
  }, [pageIndex, pages.length]);

  const displayedPage = pages[pageIndex] ?? "";
  const chapterNodes = useMemo(
    () => nodes.filter((n) => n.chapterId === activeChapterId),
    [nodes, activeChapterId]
  );
  const isChapterOpening = pageIndex === 0;

  return (
    <main className="relative h-screen w-screen overflow-hidden grain">
      <AnimatePresence mode="wait">
        {view === "cover" && (
          <motion.section
            key="cover"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              onClick={() => setView("book")}
              whileHover={{ scale: 1.02, rotateY: -8 }}
              whileTap={{ scale: 0.99 }}
              className="relative h-[70vh] w-[44vh] min-w-[280px] rounded-r-lg border border-white/15 bg-gradient-to-b from-zinc-900 to-black p-8 text-left shadow-[0_40px_120px_rgba(0,0,0,.7)]"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(216,178,110,.2),transparent_40%)]" />
              <div className="absolute -right-3 top-0 h-full w-3 bg-gradient-to-b from-zinc-700 to-zinc-900 opacity-70" />
              <p className="text-xs tracking-[0.3em] text-amber-200/80">LIVING MANUSCRIPT</p>
              <h1 className="mt-10 text-4xl font-light leading-tight">Living Book OS</h1>
              <p className="mt-4 text-sm text-zinc-400">Spatial Storytelling Architecture</p>
              <p className="absolute bottom-10 text-xs tracking-[0.2em] text-zinc-500">by Luka</p>
            </motion.button>
          </motion.section>
        )}

        {view !== "cover" && (
          <motion.section
            key="workspace"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <header className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex items-center justify-between p-5 text-xs tracking-[0.2em] text-zinc-400">
              <div className="pointer-events-auto flex items-center gap-2">
                <BookOpen size={14} /> IAMLIVE / LIVING BOOK OS
              </div>
              <div className="pointer-events-auto flex gap-2">
                <button onClick={() => setView("book")} className="rounded-full border border-white/15 px-3 py-1 hover:border-white/35">BOOK</button>
                <button onClick={() => setView("thoughtspace")} className="rounded-full border border-white/15 px-3 py-1 hover:border-white/35">THOUGHTSPACE</button>
                <button onClick={() => setView(view === "book" ? "thoughtspace" : "book")} className="rounded-full border border-white/15 px-3 py-1 hover:border-white/35"><ArrowLeftRight size={12} className="inline" /></button>
              </div>
            </header>

            <motion.div
              className="absolute inset-0"
              animate={{ x: view === "book" ? "0%" : "-100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 120, mass: 0.9 }}
            >
              <div className="absolute inset-0 w-full grid grid-cols-[280px_1fr] gap-4 p-6 pt-18">
                  <aside className="rounded-3xl border border-white/10 bg-black/45 p-4 backdrop-blur">
                    <p className="mb-3 text-[11px] tracking-[0.22em] text-zinc-400">MANUSCRIPT NAV</p>
                    <div className="hide-scrollbar max-h-[65vh] space-y-2 overflow-auto">
                      {chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          onClick={() => setActiveChapterId(chapter.id)}
                          className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${chapter.id === activeChapterId ? "border-amber-200/40 bg-amber-100/5" : "border-white/10"}`}
                        >
                          {chapter.title}
                        </button>
                      ))}
                    </div>
                    <button onClick={addChapter} className="mt-3 w-full rounded-2xl border border-white/15 p-2 text-sm hover:border-white/35"><Plus size={14} className="mr-1 inline" /> New Chapter</button>
                  </aside>

                  <section className="relative rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.02),rgba(0,0,0,.25))] p-8 shadow-2xl backdrop-blur">
                    <div className="pointer-events-none absolute right-14 top-16 h-[56vh] w-[42%] min-w-[260px]">
                      {[...Array(Math.min(6, pages.length)).keys()].map((i) => (
                        <div
                          key={i}
                          className="absolute inset-0 rounded-md border border-white/12 bg-zinc-100/95"
                          style={{ transform: `translate(${i * 4}px, ${i * 3}px)`, opacity: 1 - i * 0.12 }}
                        />
                      ))}
                    </div>
                    <input
                      className="w-full border-none bg-transparent text-3xl font-light outline-none"
                      value={activeChapter.title}
                      onChange={(e) => updateChapter({ title: e.target.value })}
                    />
                    <textarea
                      className={`mt-6 h-[56vh] w-[52%] min-w-[320px] resize-none border-none bg-transparent leading-8 outline-none ${isChapterOpening ? "text-[19px] tracking-[0.015em]" : "text-[17px]"}`}
                      placeholder="Write the living page..."
                      value={displayedPage}
                      onChange={(e) => {
                        const nextPages = [...pages];
                        nextPages[pageIndex] = e.target.value;
                        updateChapter({ content: nextPages.join("") });
                      }}
                    />
                    <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                      <div>{activeChapter.content.trim().split(/\s+/).filter(Boolean).length} words · page {pageIndex + 1}/{pages.length}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} className="rounded-full border border-white/20 px-3 py-1 hover:border-white/40">Prev Page</button>
                        <button onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))} className="rounded-full border border-white/20 px-3 py-1 hover:border-white/40">Next Page</button>
                        <button onClick={addAnchor} className="rounded-full border border-white/20 px-3 py-1 hover:border-white/40"><Network size={12} className="mr-1 inline" /> Anchor Thought</button>
                        {activeChapter.anchors.at(-1) && (
                          <button
                            onClick={() => gotoAnchor(activeChapter.anchors.at(-1)!.id)}
                            className="rounded-full border border-amber-200/35 px-3 py-1 text-amber-200 hover:border-amber-200/60"
                          >
                            Glide to Latest Anchor
                          </button>
                        )}
                      </div>
                    </div>
                    {isChapterOpening && (
                      <p className="mt-3 text-[10px] uppercase tracking-[0.35em] text-amber-200/70">Chapter Opening</p>
                    )}
                    {chapterNodes.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                        {chapterNodes.slice(-6).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => gotoAnchor(n.id)}
                            className="rounded-full border border-white/20 px-3 py-1 hover:border-white/40"
                          >
                            {n.text} · p{n.page ?? 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section className="absolute inset-0 left-full w-full p-4 pt-18">
                  <div
                    ref={canvasRef}
                    className="relative h-full w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black/40"
                    onWheel={onWheel}
                    onPointerDown={(e) => {
                      if (tool === "pen") {
                        setDrawing(true);
                        const rect = canvasRef.current?.getBoundingClientRect();
                        const sx = ((e.clientX - (rect?.left ?? 0) - (camera.x - 1200)) / camera.z);
                        const sy = ((e.clientY - (rect?.top ?? 0) - (camera.y - 1200)) / camera.z);
                        const id = crypto.randomUUID();
                        activeStroke.current = id;
                        setStrokes((prev) => [...prev, { id, points: [{ x: sx, y: sy }] }]);
                        return;
                      }
                      setDragging(true);
                      last.current = { x: e.clientX, y: e.clientY };
                      velocity.current = { x: 0, y: 0 };
                    }}
                    onPointerMove={(e) => {
                      if (drawing && tool === "pen" && activeStroke.current) {
                        const rect = canvasRef.current?.getBoundingClientRect();
                        const sx = ((e.clientX - (rect?.left ?? 0) - (camera.x - 1200)) / camera.z);
                        const sy = ((e.clientY - (rect?.top ?? 0) - (camera.y - 1200)) / camera.z);
                        setStrokes((prev) => prev.map((s) => s.id === activeStroke.current ? { ...s, points: [...s.points, { x: sx, y: sy }] } : s));
                        return;
                      }
                      if (!dragging) return;
                      const dx = e.clientX - last.current.x;
                      const dy = e.clientY - last.current.y;
                      last.current = { x: e.clientX, y: e.clientY };
                      velocity.current = { x: dx * 0.05, y: dy * 0.05 };
                      cameraTarget.current = {
                        ...cameraTarget.current,
                        x: cameraTarget.current.x + dx,
                        y: cameraTarget.current.y + dy,
                      };
                    }}
                    onPointerUp={() => setDragging(false)}
                    onPointerUpCapture={() => {
                      setDrawing(false);
                      activeStroke.current = null;
                    }}
                    onPointerLeave={() => {
                      setDragging(false);
                      setDrawing(false);
                      activeStroke.current = null;
                    }}
                  >
                    <div className="absolute left-4 top-4 z-20 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-zinc-300">
                      x:{Math.round(camera.x)} y:{Math.round(camera.y)} z:{camera.z.toFixed(2)}
                    </div>
                    <div className="absolute right-4 top-4 z-20 flex gap-2 text-xs">
                      <button onClick={() => setTool("pan")} className={`rounded-full border px-3 py-1 ${tool === "pan" ? "border-amber-200/60 text-amber-200" : "border-white/20 text-zinc-300"}`}>Pan</button>
                      <button onClick={() => setTool("pen")} className={`rounded-full border px-3 py-1 ${tool === "pen" ? "border-amber-200/60 text-amber-200" : "border-white/20 text-zinc-300"}`}>Pen</button>
                      <button onClick={() => setStrokes((prev) => prev.slice(0, -1))} className="rounded-full border border-white/20 px-3 py-1 text-zinc-300 hover:border-white/40">Undo Ink</button>
                      <button onClick={() => setStrokes([])} className="rounded-full border border-white/20 px-3 py-1 text-zinc-300 hover:border-white/40">Clear Ink</button>
                    </div>

                    <motion.div
                      className="absolute left-0 top-0 h-[3200px] w-[3200px]"
                      style={{
                        transform: `translate(${camera.x - 1200}px, ${camera.y - 1200}px) scale(${camera.z})`,
                        transformOrigin: "0 0",
                        backgroundImage:
                          "radial-gradient(circle at 1px 1px, rgba(255,255,255,.12) 1px, transparent 0)",
                        backgroundSize: "44px 44px",
                      }}
                    >
                      {nodes.map((node) => (
                        <motion.div
                          key={node.id}
                          className="absolute max-w-[280px] rounded-2xl border border-white/12 bg-zinc-950/70 px-4 py-3 text-sm"
                          style={{ left: node.x, top: node.y }}
                          animate={{ boxShadow: pulse % 2 ? "0 0 0 rgba(0,0,0,0)" : "0 0 30px rgba(111,84,217,.25)" }}
                        >
                          {node.text}
                        </motion.div>
                      ))}
                      <svg className="pointer-events-none absolute inset-0 h-full w-full">
                        {strokes.map((s) => (
                          <polyline
                            key={s.id}
                            fill="none"
                            stroke="rgba(245, 208, 140, 0.9)"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
                          />
                        ))}
                      </svg>
                    </motion.div>
                  </div>
                </section>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
