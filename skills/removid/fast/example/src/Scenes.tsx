// Scenes.tsx: five ready scene types (hook | stat | list | statement | cta). Content comes from cues.json (<- direction.json),
// look comes from style.json (<- pick.mjs). Event times come from scene.hits, the same numbers that make the sound. For anything else: add a component and use type "custom".
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import cues from './cues.json';
import style from './style.json';
import {Bg, Cam, Particles, TimeOffset, Words, DrawPath, countUp, spring, shake, ease, onColor, useClock, useFonts, fontOf, TextPreset, CamPreset, BgPreset} from './motion';

const P = style.palette, R = style.recipe, T = style.tokens, head = fontOf(style.font.head), body = fontOf(style.font.body);
type Scene = (typeof cues.scenes)[number] & {text?: string; sub?: string; value?: number; suffix?: string; label?: string; title?: string; items?: string[]};
const hitAt = (s: Scene, i: number) => s.hits[i]?.at ?? 0;
const ACC = [P.accent, P.accent2, P.fg];

/** Shared stage: background, drifting particles (far) and a camera (near) around the content. */
const Stage: React.FC<{s: Scene; i: number; t: number; W: number; H: number; shakeAmp?: number; children: React.ReactNode}> = ({s, i, t, W, H, shakeAmp = 0, children}) => {
  const d = s.end - s.start, opacity = (s.start === 0 ? 1 : ease(T.ease.enter, (t - s.enterAt) / .2)) * (1 - ease(T.ease.move, (t - s.leaveAt + .2) / .2)), sh = shakeAmp ? shake(t - hitAt(s, 0), shakeAmp) : 0;
  return (
    <AbsoluteFill style={{transform: `translate(${sh}px,${-sh}px)`}}>
      <Bg preset={R.bg as BgPreset} t={t} W={W} H={H} bg={P.bg} fg={P.fg} accent={ACC[i % 2]} />
      <Cam t={t} dur={d} preset={R.cam as CamPreset} depth={0.4}><Particles t={t} n={22} color={P.accent} seed={s.id} W={W} H={H} /></Cam>
      <Cam t={t} dur={d} preset={R.cam as CamPreset} depth={0.9}><AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: `${H * .16}px ${W * .16}px`, opacity}}>{children}</AbsoluteFill>
      </Cam>
    </AbsoluteFill>
  );
};
const text = (s: Scene, t: number, size: number, o: {delay?: number; floor?: number; color?: string; preset?: TextPreset; body?: boolean} = {}) => {
  const f = o.body ? body : head;
  return <Words text={s.text ?? ''} t={t} delay={o.delay ?? 0} size={size} color={o.color ?? P.fg} preset={o.preset ?? (R.text as TextPreset)} font={f.family} weight={f.weight} floor={o.floor ?? 0} />;
};

const Hook: React.FC<{s: Scene; i: number}> = ({s, i}) => { const {t, W, H} = useClock(T.stepFps), u = Math.min(W, H) / 1080;
  return <Stage s={s} i={i} t={t} W={W} H={H} shakeAmp={16 * u}>{text(s, t, 150 * u, {floor: 0.55})}</Stage>; };

const Stat: React.FC<{s: Scene; i: number}> = ({s, i}) => { const {t, W, H} = useClock(T.stepFps), u = Math.min(W, H) / 1080;
  const a = hitAt(s, 0), b = a + ((s.hits[0] as any)?.d ?? 1.5), end = hitAt(s, 1), pulse = 1 + 0.06 * spring(t, end, 8, 220) * (t >= end ? 1 : 0);
  return (
    <Stage s={s} i={i} t={t} W={W} H={H}>
      <div style={{fontFamily: head.family, fontWeight: head.weight, fontSize: 330 * u, color: P.hero, transform: `scale(${(0.8 + 0.2 * spring(t, 0.05)) * pulse})`, lineHeight: 1}}>{countUp(t, a, b, 0, s.value ?? 0)}{s.suffix ?? ''}</div>
      <svg width={760 * u} height={40 * u} style={{margin: `${30 * u}px 0`}}><DrawPath d={`M0 ${20 * u} H${760 * u}`} t={t} a={a} b={b} color={P.accent2} width={24 * u} len={760 * u} /></svg>
      <Words text={s.label ?? ''} t={t} delay={b + 0.1} size={58 * u} color={P.sub} preset="fade-rise" font={body.family} weight={body.weight} />
    </Stage>); };

const List: React.FC<{s: Scene; i: number}> = ({s, i}) => { const {t, W, H} = useClock(T.stepFps), u = Math.min(W, H) / 1080;
  return (
    <Stage s={s} i={i} t={t} W={W} H={H}>
      <Words text={s.title ?? ''} t={t} size={100 * u} color={P.fg} preset={R.text as TextPreset} font={head.family} weight={head.weight} />
      <div style={{height: 48 * u}} />
      {(s.items ?? []).map((x, k) => { const p = spring(t, hitAt(s, k), 10, 190);
        return (
          <div key={k} style={{width: 800 * u, maxWidth: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 28 * u, padding: `${26 * u}px ${36 * u}px`, marginBottom: 26 * u, borderRadius: 32 * u, background: P.fg, color: P.bg,
            fontFamily: body.family, fontWeight: 700, fontSize: 64 * u, transform: `translateX(${(1 - p) * 900}px)`}}>
            <span style={{minWidth: 84 * u, height: 84 * u, borderRadius: '50%', background: ACC[k % 2], display: 'grid', placeItems: 'center', fontFamily: head.family, fontWeight: head.weight, color: onColor(ACC[k % 2], P.bg, P.fg)}}>{k + 1}</span>{x}
          </div>); })}
    </Stage>); };

const Statement: React.FC<{s: Scene; i: number}> = ({s, i}) => { const {t, W, H} = useClock(T.stepFps), u = Math.min(W, H) / 1080;
  return (
    <Stage s={s} i={i} t={t} W={W} H={H} shakeAmp={0}>
      {text(s, t, 120 * u, {delay: hitAt(s, 0)})}
      <svg width={600 * u} height={30 * u} style={{margin: `${34 * u}px 0`}}><DrawPath d={`M0 ${15 * u} H${600 * u}`} t={t} a={hitAt(s, 1)} b={hitAt(s, 1) + 0.5} color={P.accent} width={14 * u} len={600 * u} /></svg>
      <Words text={s.sub ?? ''} t={t} delay={hitAt(s, 1) + 0.2} size={54 * u} color={P.sub} preset="fade-rise" font={body.family} weight={body.weight} />
    </Stage>); };

const Cta: React.FC<{s: Scene; i: number}> = ({s, i}) => { const {t, W, H} = useClock(T.stepFps), u = Math.min(W, H) / 1080, e = hitAt(s, 1);
  const breathe = 1 + 0.03 * Math.sin(t * 5), ring = ease('outCubic', (t - e) / 0.8);
  return (
    <Stage s={s} i={i} t={t} W={W} H={H}>
      {text(s, t, 130 * u, {delay: hitAt(s, 0)})}
      <div style={{position: 'relative', marginTop: 60 * u}}>
        {t >= e && <div style={{position: 'absolute', inset: 0, borderRadius: 999, border: `${6 * u}px solid ${P.accent}`, transform: `scale(${1 + ring * 0.6})`, opacity: 1 - ring}} />}
        <div style={{padding: `${28 * u}px ${70 * u}px`, borderRadius: 999, background: P.accent, color: onColor(P.accent, P.bg, P.fg), fontFamily: body.family, fontWeight: 800, fontSize: 60 * u, transform: `scale(${spring(t, e - 0.3) * breathe})`}}>{s.sub ?? ''}</div>
      </div>
    </Stage>); };

const Custom: React.FC<{s: Scene; i: number}> = ({s, i}) => { const {t, W, H} = useClock(T.stepFps), u = Math.min(W, H) / 1080;
  // build bespoke scenes here: <Stage s={s} i={i} t={t} W={W} H={H}>{...}</Stage>, animate with lin()/spring()/ease() from `t` and s.hits
  return <Stage s={s} i={i} t={t} W={W} H={H}>{text(s, t, 110 * u, {floor: 0.5})}</Stage>; };

const TYPE: Record<string, React.FC<{s: Scene; i: number}>> = {hook: Hook, stat: Stat, list: List, statement: Statement, cta: Cta, custom: Custom};

export const Main: React.FC = () => {
  const {fps} = useClock(0); useFonts([...new Set([style.font.head, style.font.body])]);
  return (
    <AbsoluteFill style={{background: P.bg}}>
      {(cues.scenes as Scene[]).map((s, i) => { const S = TYPE[(s as any).type ?? 'custom'] ?? Custom;
        return <Sequence key={s.id} from={Math.round(s.start * fps)} durationInFrames={Math.round(s.end * fps) - Math.round(s.start * fps)}><S s={s} i={i} /></Sequence>; })}
    </AbsoluteFill>
  );
};

// Each clip shows one scene throughout its transition handles. Render the global
// frame range from plan.json; HyperFrames supplies cuts, transitions and audio.
export const Clip: React.FC<{scene: number}> = ({scene}) => {
  const s = cues.scenes[scene] as Scene, S = TYPE[s.type] ?? Custom;
  useFonts([...new Set([style.font.head, style.font.body])]);
  return <TimeOffset.Provider value={-s.start}><S s={s} i={scene} /></TimeOffset.Provider>;
};
