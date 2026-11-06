import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera} from '../components/Camera.tsx';
import {CursorLayer} from '../components/CursorLayer.tsx';
import {Spotlight} from '../components/Spotlight.tsx';
import {TargetBox} from '../components/TargetBox.tsx';
import {camAt, zoomProgress} from '../lib/camera.ts';
import {planCursor, targetPress} from '../lib/cursor.ts';
import {easeOutBack} from '../lib/ease.ts';
import {rectStyle} from '../lib/geom.ts';
import {CARD, CURSOR, PRICE, SHOTS, T, TITLE} from './uiDemo.data.ts';

const INK = '#1F1E1D';
const CREAM = '#FAF9F5';
const CORAL = '#D97757';
const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';

export const UiDemo: React.FC<{debug: boolean}> = ({debug}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;

  const {legs} = planCursor(CURSOR, T);
  const clickOf = (target: string) => legs.find((l) => l.target === target)?.clickAt;
  const cam = camAt(t, SHOTS, width, height);

  // Everything below reacts to the click AFTER it happens (UI responds after the press).
  const searchClick = clickOf('search') ?? 0;
  const buyClick = clickOf('buy') ?? 0;
  const cartClick = clickOf('cart') ?? 0;
  const typed = 'ceramic mug'.slice(0, Math.max(0, Math.floor((t - (searchClick + 0.15)) * 14)));
  const added = t >= buyClick;
  const badge = added ? 1 : 0;
  const badgePop = added ? easeOutBack(Math.min(1, (t - buyClick) / 0.4)) : 0;
  const toastIn = interpolate(t, [buyClick + 0.1, buyClick + 0.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const toastOut = interpolate(t, [buyClick + 2.4, buyClick + 2.8], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const strength = Math.max(...SHOTS.map((z) => zoomProgress(t, z)));
  const activeZoom = SHOTS.reduce((best, z) => (zoomProgress(t, z) > zoomProgress(t, best) ? z : best), SHOTS[0]);

  return (
    <AbsoluteFill style={{background: CREAM, fontFamily: FONT, color: INK, overflow: 'hidden'}}>
      <Camera cam={cam} width={width} height={height}>
        {/* header */}
        <div style={{position: 'absolute', left: 0, top: 0, width, height: 110, background: '#FFFFFF', borderBottom: '2px solid #E8E4D8'}} />
        <div style={{position: 'absolute', left: 80, top: 28, fontSize: 44, fontWeight: 700}}>
          <span style={{color: CORAL}}>✺</span> Studio Shop
        </div>
        <TargetBox rect={T.cart} debug={debug} scale={cartClick && t >= cartClick ? targetPress(t, cartClick) : 1} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52}}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 7H6" />
            <circle cx="10" cy="20" r="1.4" />
            <circle cx="18" cy="20" r="1.4" />
          </svg>
          {badge > 0 && (
            <div
              style={{
                position: 'absolute',
                right: -6,
                top: -10,
                minWidth: 40,
                height: 40,
                borderRadius: 20,
                background: CORAL,
                color: '#fff',
                fontSize: 26,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${0.4 + 0.6 * badgePop})`,
              }}
            >
              {badge}
            </div>
          )}
        </TargetBox>

        {/* search */}
        <TargetBox rect={T.search} debug={debug} scale={targetPress(t, searchClick)} style={{background: '#fff', border: '3px solid #D8D2C0', borderRadius: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: '0 40px', fontSize: 38}}>
          <span style={{color: typed ? INK : '#9A9588'}}>{typed || 'Search products'}</span>
          {typed && t - searchClick < 5 && <span style={{display: 'inline-block', width: 3, height: 44, background: INK, marginLeft: 4, opacity: Math.floor(t * 2) % 2 ? 0 : 1}} />}
        </TargetBox>

        {/* product */}
        <div style={{...rectStyle(CARD), borderRadius: 40, background: `linear-gradient(145deg, ${CORAL}, #B9573A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 280, color: CREAM}}>✺</div>
        <div style={{...rectStyle(TITLE), fontSize: 64, fontWeight: 700, lineHeight: 1.1}}>Ceramic mug,<br />hand glazed</div>
        <div style={{...rectStyle(PRICE), fontSize: 56, fontWeight: 600, color: '#5E5A50'}}>$24.00 · in stock</div>
        <TargetBox rect={T.buy} debug={debug} scale={targetPress(t, buyClick)} style={{background: added ? '#2F7D57' : CORAL, color: '#fff', borderRadius: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 700}}>
          {added ? 'Added ✓' : 'Add to cart'}
        </TargetBox>

        {/* toast */}
        <div
          style={{
            position: 'absolute',
            left: 1060,
            top: 900,
            width: 560,
            height: 84,
            borderRadius: 20,
            background: INK,
            color: '#fff',
            fontSize: 34,
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
            opacity: Math.min(toastIn, toastOut),
            transform: `translateY(${(1 - toastIn) * 24}px)`,
          }}
        >
          Mug added to your cart
        </div>
      </Camera>

      <Spotlight rect={activeZoom.focus} cam={cam} strength={strength} />
      <CursorLayer t={t} cam={cam} legs={legs} start={CURSOR.start} targets={T} debug={debug} />
    </AbsoluteFill>
  );
};
