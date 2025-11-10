"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

const CANVAS_SIZE = 640;
const DEFAULT_PROMPT = "Nebulous aurora swirling above a futuristic city skyline";
const SAMPLE_PROMPTS = [
  "Bioluminescent forest under a violet moon",
  "Retro arcade dreamscape with neon clouds",
  "Origami birds soaring across a chromatic sky",
  "Clockwork garden glowing with golden sunlight"
];

type MulberryGenerator = () => number;

function createSeededRandom(seed: number): MulberryGenerator {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashPrompt(prompt: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < prompt.length; i += 1) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function pickPalette(rand: MulberryGenerator) {
  const baseHue = rand() * 360;
  const colors = Array.from({ length: 6 }, (_, i) => {
    const hue = (baseHue + rand() * 90 * (i % 2 === 0 ? 1 : -1)) % 360;
    const saturation = 0.55 + rand() * 0.35;
    const lightness = 0.35 + rand() * 0.4;
    return hslToHex(hue, saturation, lightness);
  });
  return colors;
}

function drawBackground(ctx: CanvasRenderingContext2D, rand: MulberryGenerator, palette: string[]) {
  const gradients = 3 + Math.floor(rand() * 3);
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const baseGradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  baseGradient.addColorStop(0, palette[0]);
  baseGradient.addColorStop(0.5, palette[1]);
  baseGradient.addColorStop(1, palette[2]);
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (let i = 0; i < gradients; i += 1) {
    const radial = ctx.createRadialGradient(
      rand() * CANVAS_SIZE,
      rand() * CANVAS_SIZE,
      CANVAS_SIZE * 0.1,
      rand() * CANVAS_SIZE,
      rand() * CANVAS_SIZE,
      CANVAS_SIZE * (0.4 + rand() * 0.3)
    );
    radial.addColorStop(0, `${palette[(i + 3) % palette.length]}a6`);
    radial.addColorStop(1, `${palette[(i + 4) % palette.length]}06`);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(rand() * CANVAS_SIZE, rand() * CANVAS_SIZE, CANVAS_SIZE * (0.35 + rand() * 0.25), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawOrganicShape(
  ctx: CanvasRenderingContext2D,
  rand: MulberryGenerator,
  palette: string[],
  index: number
) {
  const points = 5 + Math.floor(rand() * 6);
  const centerX = CANVAS_SIZE * (0.2 + rand() * 0.6);
  const centerY = CANVAS_SIZE * (0.2 + rand() * 0.6);
  const maxRadius = CANVAS_SIZE * (0.12 + rand() * 0.2);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - maxRadius * rand());
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const radius = maxRadius * (0.6 + rand() * 0.5);
    const x = centerX + Math.cos(angle) * radius + rand() * 22 - 11;
    const y = centerY + Math.sin(angle) * radius + rand() * 22 - 11;
    ctx.quadraticCurveTo(centerX, centerY, x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.45 + rand() * 0.35;
  ctx.fillStyle = palette[index % palette.length];
  ctx.fill();
  ctx.globalAlpha = 1;
}

function sprinkleHighlights(ctx: CanvasRenderingContext2D, rand: MulberryGenerator, palette: string[]) {
  const dots = 480 + Math.floor(rand() * 320);
  const glowColor = palette[palette.length - 1];
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < dots; i += 1) {
    const size = rand() * 2.2;
    const x = rand() * CANVAS_SIZE;
    const y = rand() * CANVAS_SIZE;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderPromptSignature(ctx: CanvasRenderingContext2D, prompt: string) {
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillStyle = "#ffffffaa";
  ctx.textBaseline = "bottom";
  const text = prompt.slice(0, 80) + (prompt.length > 80 ? "…" : "");
  ctx.fillText(text, 12, CANVAS_SIZE - 12);
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [history, setHistory] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const paletteCache = useMemo(() => new Map<string, string[]>(), []);

  const generateImage = useCallback(
    (text: string) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const seed = hashPrompt(text);
      const rand = createSeededRandom(seed);
      const palette = paletteCache.get(text) ?? pickPalette(rand);
      if (!paletteCache.has(text)) {
        paletteCache.set(text, palette);
      }

      drawBackground(ctx, rand, palette);

      const organicShapes = 6 + Math.floor(rand() * 5);
      for (let i = 0; i < organicShapes; i += 1) {
        drawOrganicShape(ctx, rand, palette, i);
      }

      sprinkleHighlights(ctx, rand, palette);
      renderPromptSignature(ctx, text);
    },
    [paletteCache]
  );

  const handleGenerate = useCallback(() => {
    startTransition(() => {
      setHistory((prev) => [prompt, ...prev.filter((item) => item !== prompt)].slice(0, 8));
      generateImage(prompt.trim() || DEFAULT_PROMPT);
    });
  }, [generateImage, prompt, startTransition]);

  const handleSurprise = useCallback(() => {
    const randomPrompt = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
    setPrompt(randomPrompt);
    startTransition(() => {
      setHistory((prev) => [randomPrompt, ...prev.filter((item) => item !== randomPrompt)].slice(0, 8));
      generateImage(randomPrompt);
    });
  }, [generateImage, startTransition]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const link = document.createElement("a");
    link.download = `${prompt.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "texture"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [prompt]);

  useEffect(() => {
    generateImage(DEFAULT_PROMPT);
  }, [generateImage]);

  return (
    <main className="page">
      <div className="panel">
        <header className="hero">
          <h1>Text to Image Generator</h1>
          <p>
            Transform language into vibrant, algorithmic artwork. Describe a scene, mood, or idea and watch a unique
            visual emerge instantly — generated entirely in your browser.
          </p>
        </header>
        <section className="controls">
          <label htmlFor="prompt" className="label">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe what you want to see..."
            rows={3}
          />
          <div className="actions">
            <button type="button" onClick={handleGenerate} disabled={isPending}>
              {isPending ? "Generating…" : "Generate"}
            </button>
            <button type="button" className="secondary" onClick={handleSurprise}>
              Surprise me
            </button>
            <button type="button" className="tertiary" onClick={handleDownload}>
              Download PNG
            </button>
          </div>
        </section>
        {history.length > 0 && (
          <section className="history">
            <h2>Recent prompts</h2>
            <div className="history-grid">
              {history.map((item) => (
                <button key={item} type="button" onClick={() => {
                  setPrompt(item);
                  startTransition(() => generateImage(item));
                }}>
                  {item}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="samples">
          <h2>Need inspiration?</h2>
          <div className="sample-grid">
            {SAMPLE_PROMPTS.map((item) => (
              <button key={item} type="button" onClick={() => {
                setPrompt(item);
                startTransition(() => generateImage(item));
              }}>
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>
      <aside className="stage">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
        </div>
      </aside>
    </main>
  );
}
