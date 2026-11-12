import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Bg, Words, useClock, useFonts, TextPreset, fontOf} from './motion';
import style from './style.json';
// Diagnostic: all 7 text presets on one frame (npx remotion still src/index.ts Presets out/presets.png --frame=60).
export const Presets: React.FC = () => {
  const {t, W, H} = useClock(0), P = style.palette, f = fontOf(style.font.head); useFonts([style.font.head, style.font.body]);
  const L: TextPreset[] = ['mask-rise', 'pop', 'slam', 'type', 'drop', 'fade-rise', 'stamp'];
  return (
    <AbsoluteFill style={{background: P.bg}}>
      <Bg preset="grid" t={t} W={W} H={H} bg={P.bg} fg={P.fg} accent={P.accent} />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 40}}>
        {L.map((p) => <div key={p} style={{textAlign: 'center'}}><div style={{fontFamily: 'sans-serif', fontSize: 26, color: P.sub}}>{p}</div><Words text="Pesan utama" t={t} delay={0.1} size={100} color={P.fg} preset={p} font={f.family} weight={f.weight} /></div>)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
