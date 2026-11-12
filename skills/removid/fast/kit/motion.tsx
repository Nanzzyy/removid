// motion.tsx: the motion vocabulary every scene is built from. Everything is a pure function of TIME IN SECONDS,
// used by previews and final scene clips at 60 fps. No CSS transitions, no Math.random, no timers.
import React from 'react';
import motionStyle from './style.json';
import {AbsoluteFill, delayRender, continueRender, cancelRender, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const TimeOffset = React.createContext(0);

/* ---------- clock ---------- */
/** t in seconds. stepFps > 0 holds poses (pixel / paper / clay looks: tokens.stepFps from pick.mjs). */
export const useClock = (stepFps = 0) => {
  const frame = useCurrentFrame(), {fps, width: W, height: H} = useVideoConfig();
  const raw = frame / fps + React.useContext(TimeOffset);
  return {t: stepFps > 0 ? Math.floor(raw * stepFps + 1e-9) / stepFps : raw, raw, fps, W, H};
};

/* ---------- easing + spring ---------- */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const outBack = (x: number, k = 1.70158) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
export const EASE: Record<string, (x: number) => number> = {
  linear: (x) => x, outCubic: (x) => 1 - Math.pow(1 - x, 3), inCubic: (x) => x * x * x, outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2, inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), smootherstep: (x) => x * x * x * (x * (x * 6 - 15) + 10), outBack,
};
export const ease = (name: string, x: number) => (EASE[name] ?? EASE.outCubic)(clamp01(x));
/** from -> to between seconds a and b. */
export const lin = (t: number, a: number, b: number, from = 0, to = 1, e = motionStyle.tokens.ease.move) => from + (to - from) * ease(e, (t - a) / (b - a));
/** Closed-form damped spring (anticipation-free overshoot then settle). Same feel as Remotion's spring(), but fps-independent. */
export const spring = (t: number, delay = 0, damping = 11, stiffness = 170, mass = 0.7) => {
  const x = t - delay; if (x <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
  if (z >= 1) return 1 - Math.exp(-w0 * x) * (1 + w0 * x);
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * x) * (Math.cos(wd * x) + ((z * w0) / wd) * Math.sin(wd * x));
};
/** Landing squash: pass seconds since impact. */
export const squash = (since: number) => { const k = since < 0 ? 0 : Math.max(0, 1 - since / 0.33) * Math.cos(since * 27); return {sx: 1 + 0.25 * k, sy: 1 - 0.25 * k}; };
/** Decaying screen shake for impacts: pass seconds since impact. */
export const shake = (since: number, amp = 14) => (since >= 0 && since < 0.45 ? Math.sin(since * 72) * (1 - since / 0.45) * amp : 0);
export const countUp = (t: number, a: number, b: number, from: number, to: number) => Math.round(lin(t, a, b, from, to, 'inOutCubic'));
const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** Text colour for a filled shape: whichever of two candidates reads better on `fill`. */
export const onColor = (fill: string, a: string, b: string) => (contrast(fill, a) >= contrast(fill, b) ? a : b);
/** Safe boxes: action 90 %, title 80 % (removid rule). */
export const safe = (W: number, H: number) => ({action: {x: W * 0.05, y: H * 0.05, w: W * 0.9, h: H * 0.9}, title: {x: W * 0.1, y: H * 0.1, w: W * 0.8, h: H * 0.8}});

/** 'poppins@800' -> {family:'poppins', weight:800} */
export const fontOf = (id: string) => { const [family, w] = id.split('@'); return {family, weight: Number(w)}; };

/* ---------- fonts (local files: scripts/fonts.mjs copies them to public/fonts) ---------- */
export const useFonts = (list: string[]) => {
  const [h] = React.useState(() => delayRender('fonts'));
  React.useEffect(() => {
    Promise.all(list.map((id) => { const [slug, w] = id.split('@');
      return new FontFace(slug, `url(${staticFile(`fonts/${slug}-${w}.woff2`)})`, {weight: w}).load(); }))
      .then((fs) => { fs.forEach((f) => (document as any).fonts.add(f)); continueRender(h); })
      .catch((e) => { cancelRender(e); });
  }, [h]);
};

/* ---------- kinetic text: the 7 presets used by recipes.json ---------- */
export type TextPreset = 'mask-rise' | 'pop' | 'slam' | 'type' | 'drop' | 'fade-rise' | 'stamp';
export const Words: React.FC<{text: string; t: number; delay?: number; size: number; color: string; preset?: TextPreset; font?: string; weight?: number;
  stagger?: number; floor?: number; align?: 'center' | 'left'; style?: React.CSSProperties}> =
({text, t, delay = 0, size, color, preset = 'mask-rise', font = 'poppins', weight = 800, stagger = 0.05, floor = 0, align = 'center', style}) => {
  const base: React.CSSProperties = {display: 'flex', maxWidth: '100%', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: size * 0.25,
    fontFamily: `'${font}', sans-serif`, fontWeight: weight, fontSize: size, lineHeight: 1.05, color, ...style};
  if (preset === 'type') {                                   // typewriter: 28 chars/s + blinking caret
    const n = Math.max(0, Math.floor((t - delay) * 28)), shown = text.slice(0, Math.max(floor > 0 ? text.split(' ')[0].length : 0, n));   // floor > 0 (hook): first word is on screen at frame 0
    return <div style={{...base, display: 'block', textAlign: align === 'center' ? 'center' : 'left', whiteSpace: 'pre-wrap'}}>{shown}<span style={{display: 'inline-block', width: size * 0.35, height: size * 0.8, background: color, opacity: Math.floor(t * 2) % 2 ? 0 : 1}} /></div>;
  }
  const words = text.split(' ');
  return (
    <div style={base}>
      {words.map((w, i) => {
        const d = delay + i * stagger;
        const p = Math.max(floor, ease(motionStyle.tokens.ease.enter, (t - d) / (preset === 'slam' || preset === 'stamp' ? 0.18 : 0.6)));
        const inner: React.CSSProperties = {display: 'inline-block'};
        let wrap: React.CSSProperties = {display: 'inline-block'};
        if (preset === 'mask-rise') { wrap = {...wrap, overflow: 'hidden', paddingBottom: size * 0.12}; inner.transform = `translateY(${(1 - p) * 115}%) rotate(${(1 - p) * 6}deg)`; }
        if (preset === 'pop') { inner.transform = `scale(${0.3 + 0.7 * p})`; inner.opacity = clamp01(p * 3); }
        if (preset === 'fade-rise') { inner.opacity = p; inner.transform = `translateY(${(1 - p) * 28}px)`; }
        if (preset === 'slam') { const s = shake(t - d - 0.18, size * 0.1); inner.transform = `scale(${1 + (1 - p) * 1.2}) translate(${s}px,${-s}px)`; inner.opacity = t < d ? floor : 1; }
        if (preset === 'stamp') { const s = shake(t - d - 0.18, size * 0.05); inner.transform = `scale(${1 + (1 - p) * 0.8}) rotate(${-3 - (1 - p) * 5}deg) translate(${s}px,0)`; inner.opacity = t < d ? floor : 1; inner.letterSpacing = '0.04em'; }
        if (preset === 'drop') { const sq = squash(t - d - 0.22); inner.transform = `translateY(${(1 - p) * -size * 2.2}px) scale(${sq.sx},${sq.sy})`; inner.transformOrigin = '50% 100%'; inner.opacity = clamp01(p * 4); }
        return <span key={i} style={wrap}><span style={inner}>{w}</span></span>;
      })}
    </div>
  );
};

/* ---------- camera + parallax ---------- */
export type CamPreset = 'still' | 'drift' | 'push' | 'punch';
const CAM = {still: {push: 0, rot: 0}, drift: {push: 0.04, rot: 0.3}, push: {push: 0.06, rot: 0.8}, punch: {push: 0.1, rot: 0}};
/** Wrap a layer. depth 0 = far background (barely moves), 1 = near foreground (moves most). */
export const Cam: React.FC<{t: number; dur: number; preset?: CamPreset; depth?: number; children: React.ReactNode}> = ({t, dur, preset = 'drift', depth = 0.5, children}) => {
  const c = CAM[preset], u = preset === 'still' ? 0 : preset === 'punch' ? ease('outCubic', t / 0.4) : ease(motionStyle.tokens.ease.move, t / dur);
  return <AbsoluteFill style={{transform: `scale(${Math.min(motionStyle.tokens.zoomMax, 1 + c.push * depth * u)}) translate(${-50 * depth * u}px,${-20 * depth * u}px) rotate(${c.rot * depth * (u - 0.5)}deg)`}}>{children}</AbsoluteFill>;
};

/* ---------- ambient motion: nothing on screen is ever dead ---------- */
export const Particles: React.FC<{t: number; n: number; color: string; seed?: string; W: number; H: number}> = ({t, n, color, seed = 'p', W, H}) => (
  <svg width={W} height={H} style={{position: 'absolute'}}>
    {Array.from({length: n}).map((_, i) => {
      const x = random(`${seed}x${i}`) * W, sp = 0.4 + random(`${seed}s${i}`) * 1.2, r = 3 + random(`${seed}r${i}`) * 8;
      const y = H - ((t * sp * 120 + random(`${seed}y${i}`) * H) % H);
      return <circle key={i} cx={x + Math.sin(t * 3 + i) * 16} cy={y} r={r} fill={color} opacity={0.3 + 0.4 * random(`${seed}o${i}`)} />;
    })}
  </svg>
);
export type BgPreset = 'flat' | 'grid' | 'paper' | 'dots' | 'scan';
export const Bg: React.FC<{preset?: BgPreset; t: number; W: number; H: number; bg: string; fg: string; accent: string}> = ({preset = 'flat', t, W, H, bg, fg, accent}) => (
  <AbsoluteFill style={{background: bg}}>
    <svg width={W} height={H} style={{position: 'absolute'}}>
      <defs>
        <pattern id="grid" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform={`translate(${t * 12},${t * 12})`}><path d="M90 0H0V90" fill="none" stroke={fg} strokeOpacity=".12" strokeWidth="2" /></pattern>
        <pattern id="dots" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform={`translate(${t * 10},0)`}><circle cx="30" cy="30" r="4" fill={fg} fillOpacity=".14" /></pattern>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0" /></filter>
      </defs>
      {preset === 'flat' && Array.from({length: 5}).map((_, i) => <circle key={i} cx={random(`bx${i}`) * W + Math.sin(t * 0.6 + i) * 40} cy={random(`by${i}`) * H + Math.cos(t * 0.5 + i) * 40} r={120 + random(`br${i}`) * 220} fill={accent} fillOpacity={0.06} />)}
      {preset === 'grid' && <rect width={W} height={H} fill="url(#grid)" />}
      {preset === 'dots' && <rect width={W} height={H} fill="url(#dots)" />}
      {preset === 'paper' && <rect width={W} height={H} filter="url(#grain)" opacity=".12" />}
      {preset === 'scan' && Array.from({length: Math.ceil(H / 6)}).map((_, i) => <rect key={i} y={i * 6} width={W} height={2} fill="#000" fillOpacity={0.18} />)}
    </svg>
    {preset === 'scan' && <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,${0.5 + 0.05 * Math.sin(t * 40)}))`}} />}
  </AbsoluteFill>
);
export const DrawPath: React.FC<{d: string; t: number; a: number; b: number; color: string; width?: number; len?: number}> = ({d, t, a, b, color, width = 12, len = 2000}) => (
  <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - lin(t, a, b))} />
);

