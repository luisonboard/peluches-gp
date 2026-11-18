// HUD y menús en DOM: posición, vuelta, tiempo, minimapa, cuenta atrás, título, pausa y resultados.
import type { Race, CpuLevel } from '../game/race';
import { CPU_LEVELS } from '../game/race';
import type { Track } from '../game/track';
import { CHARACTERS, displayName, cssColor } from '../game/characters';
import type { ItemId, Species } from '../core/events';
import type { Cup } from '../game/cup';
import type { Kart } from '../game/kart';
import { TRACKS, trackOutline, type ReadyTrack } from '../world/tracks';
import { ITEM_ICONS } from './icons';

export { ITEM_ICONS };
const ITEM_ORDER: ItemId[] = ['turbo', 'pelota', 'chicle'];

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
#hud .stroke { paint-order: stroke fill; -webkit-text-stroke: 6px #2a2050; }
#hud .hud-pos { position: absolute; left: max(18px, env(safe-area-inset-left)); bottom: max(14px, env(safe-area-inset-bottom));
  font-size: clamp(56px, 11vh, 104px); font-weight: 900; line-height: 1; letter-spacing: -2px; }
#hud .hud-pos small { font-size: 0.4em; letter-spacing: 0; }
#hud .hud-lap { position: absolute; left: max(18px, env(safe-area-inset-left)); top: max(14px, env(safe-area-inset-top));
  font-size: clamp(22px, 4.2vh, 34px); font-weight: 900; line-height: 1.15; }
#hud .hud-lap .time { font-size: 0.72em; font-variant-numeric: tabular-nums; opacity: 0.95; }
#hud-map { position: absolute; right: max(14px, env(safe-area-inset-right)); top: max(12px, env(safe-area-inset-top));
  width: clamp(110px, 24vh, 190px); height: clamp(110px, 24vh, 190px); }
#hud .hud-msg { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-weight: 900;
  font-size: clamp(64px, 16vh, 150px); line-height: 1; }
#hud .hud-msg.small { font-size: clamp(34px, 7vh, 64px); }
#hud .hud-msg.pop { animation: pgp-pop 0.9s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes pgp-pop { 0% { transform: scale(0.3); opacity: 0 } 25% { transform: scale(1.12); opacity: 1 } 70% { transform: scale(1); opacity: 1 } 100% { transform: scale(1.05); opacity: 0 } }
#hud .hud-wrong { position: absolute; left: 0; right: 0; top: 18%; text-align: center; font-size: clamp(30px, 6vh, 52px);
  font-weight: 900; color: #ffd23a; animation: pgp-blink 0.6s steps(2) infinite; }
@keyframes pgp-blink { 50% { opacity: 0.25 } }
.pgp-screen { box-sizing: border-box; position: fixed; inset: 0; z-index: 10; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; pointer-events: auto;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  overflow-y: auto; }
.pgp-screen.dim { background: rgba(30, 26, 70, 0.45); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
.pgp-card { box-sizing: border-box; background: rgba(255,255,255,0.94); color: #2a2050; border-radius: 28px; padding: 22px 26px;
  box-shadow: 0 14px 0 rgba(42,32,80,0.25), 0 30px 60px rgba(0,0,0,0.25); width: min(760px, 100%); }
.pgp-logo { font-size: clamp(44px, 9vw, 84px); font-weight: 900; text-align: center; line-height: 1; margin: 0 0 4px;
  paint-order: stroke fill; -webkit-text-stroke: 8px #2a2050; letter-spacing: 1px; }
.pgp-logo span:nth-child(6n+1) { color: #e8423a } .pgp-logo span:nth-child(6n+2) { color: #2f7de0 }
.pgp-logo span:nth-child(6n+3) { color: #3fb24a } .pgp-logo span:nth-child(6n+4) { color: #ffb52a }
.pgp-logo span:nth-child(6n+5) { color: #8a4fd8 } .pgp-logo span:nth-child(6n) { color: #f07ab0 }
.pgp-sub { text-align: center; font-weight: 700; color: #fff; font-size: 18px; margin-bottom: 18px; text-shadow: 0 2px 0 #2a2050; }
.pgp-label { font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #6a64a0; margin: 14px 2px 8px; }
.pgp-row { display: flex; flex-wrap: wrap; gap: 10px; border-radius: 18px; padding: 4px; outline: 3px solid transparent; }
.pgp-row.focus { outline-color: #ffb52a; }
.pgp-chars { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 620px) { .pgp-chars { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.pgp-char { border: 4px solid transparent; border-radius: 18px; background: #f1effa; padding: 8px 4px 6px; text-align: center; cursor: pointer;
  font: inherit; color: inherit; display: grid; justify-items: center; gap: 4px; min-width: 0; }
.pgp-char .face { width: 52px; height: 52px; border-radius: 18px; position: relative; box-shadow: inset 0 -7px 0 rgba(0,0,0,0.18); }
.pgp-char .face::before, .pgp-char .face::after { content: ""; position: absolute; top: 18px; width: 10px; height: 12px; border-radius: 50%; background: #fff; box-shadow: inset 3px 2px 0 2px #1e2236; }
.pgp-char .face::before { left: 12px } .pgp-char .face::after { right: 12px }
.pgp-char .nm { font-weight: 900; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.pgp-char .sp { font-size: 11px; font-weight: 700; color: #6a64a0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pgp-char.sel { border-color: #2a2050; background: #fff; transform: translateY(-2px); }
.pgp-opt { border: 3px solid #d8d4ee; background: #fff; color: #2a2050; border-radius: 999px; padding: 8px 18px; font: inherit; font-weight: 900; font-size: 17px; cursor: pointer; }
.pgp-opt.sel { background: #2a2050; color: #fff; border-color: #2a2050; }
.pgp-go { display: block; margin: 20px auto 4px; border: 0; border-radius: 999px; background: #3fb24a; color: #fff; font: inherit; font-weight: 900;
  font-size: 28px; padding: 14px 44px; box-shadow: 0 7px 0 #23752c; cursor: pointer; }
.pgp-go:active { transform: translateY(4px); box-shadow: 0 3px 0 #23752c; }
.pgp-row.focus .pgp-go { outline: 4px solid #ffb52a; outline-offset: 4px; }
.pgp-hint { text-align: center; font-size: 13px; color: #6a64a0; margin-top: 10px; font-weight: 700; }
.pgp-results h2 { margin: 0 0 12px; text-align: center; font-size: 34px; }
.pgp-results table { width: 100%; border-collapse: collapse; font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pgp-results td { padding: 7px 8px; border-bottom: 2px solid #ece9f7; }
.pgp-results tr.me td { background: #fff4c8; }
.pgp-results .dot { display: inline-block; width: 16px; height: 16px; border-radius: 6px; vertical-align: -2px; margin-right: 8px; }
.pgp-results .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 16px; }
.pgp-results .btns .pgp-go { margin: 0; font-size: 22px; padding: 12px 30px; }
.pgp-results .btns .alt { background: #2f7de0; box-shadow: 0 7px 0 #1d5aa8; }
.pgp-results .btns .pgp-go.focus { outline: 4px solid #ffb52a; outline-offset: 4px; }
.pgp-opts { display: flex; flex-wrap: wrap; gap: 4px 28px; }
@media (max-height: 520px) {
  .pgp-logo { font-size: 38px; -webkit-text-stroke: 5px #2a2050; }
  .pgp-sub, .pgp-hint, .pgp-char .sp { display: none; }
  .pgp-screen { place-items: start center; }
  .pgp-card { padding: 10px 16px 14px; border-radius: 22px; }
  .pgp-label { margin: 6px 2px 4px; font-size: 11px; }
  .pgp-char { padding: 5px 2px 4px; border-width: 3px; }
  .pgp-char .face { width: 34px; height: 34px; border-radius: 12px; }
  .pgp-char .face::before, .pgp-char .face::after { top: 11px; width: 7px; height: 8px; }
  .pgp-char .face::before { left: 7px } .pgp-char .face::after { right: 7px }
  .pgp-char .nm { font-size: 13px; }
  .pgp-opt { padding: 5px 14px; font-size: 15px; }
  .pgp-go { font-size: 22px; padding: 8px 32px; margin: 10px auto 0; }
  .pgp-row .pgp-go { font-size: 16px !important; padding: 8px 14px !important; box-shadow: 0 5px 0 rgba(0,0,0,.22) !important; }
  .pgp-screen.title .pgp-row[style*="margin-top"] { margin-top: 8px !important; }
}
.pgp-tracks { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; width: 100%; }
.pgp-track { border: 4px solid transparent; border-radius: 18px; background: #f1effa; padding: 6px 8px; cursor: pointer; font: inherit; color: inherit;
  display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; text-align: left; min-width: 0; }
.pgp-track canvas, .pgp-track .lock { width: 56px; height: 42px; border-radius: 10px; background: #fff; display: block; }
.pgp-track .lock { display: grid; place-items: center; font-size: 22px; background: #e4e1f2; }
.pgp-track .nm { font-weight: 900; font-size: 15px; line-height: 1.15; }
.pgp-track .sp { font-size: 11px; font-weight: 700; color: #6a64a0; line-height: 1.2; }
.pgp-track.sel { border-color: #2a2050; background: #fff; }
.pgp-track .cupicon { width: 56px; height: 42px; border-radius: 10px; display: grid; place-items: center; font-size: 26px; background: linear-gradient(#ffe27a, #ffb52a); }
.pgp-track .sp { display: none; }
/* Nombre corto en la tarjeta (Cuarto, Bañera, Jardín, Copa); el completo va en la ayuda (title). */
.pgp-track .nm { display: none; }
.pgp-track .nm.short { display: block; }
@media (min-height: 521px) and (min-width: 621px) {
  .pgp-track { padding: 5px 8px; gap: 8px; }
  .pgp-track canvas, .pgp-track .lock, .pgp-track .cupicon { width: 44px; height: 33px; font-size: 20px; }
  .pgp-track .nm { font-size: 14px; }
}

.pgp-cup td.mv { width: 22px; text-align: center; font-size: 15px; }
.pgp-cup td.mv.up { color: #2f9a4a; } .pgp-cup td.mv.down { color: #d8423a; }
.pgp-cup td.add { color: #2f9a4a; text-align: right; width: 44px; }
.pgp-cup td.tot { text-align: right; width: 48px; }
.pgp-cup .sub { text-align: center; color: #6a64a0; font-weight: 800; margin: -6px 0 10px; }
.pgp-track:disabled { cursor: default; opacity: .6; }
@media (max-width: 620px) {
  .pgp-track-label { display: none; }
  .pgp-tracks { margin-top: 10px; }
  .pgp-track { grid-template-columns: 1fr; justify-items: center; text-align: center; gap: 4px; padding: 4px; }
  .pgp-track canvas, .pgp-track .lock, .pgp-track .cupicon { width: 44px; height: 33px; font-size: 16px; }
  .pgp-track .nm { font-size: 12px; }
  .pgp-track .sp { display: none; }
}
@media (max-height: 520px) {
  .pgp-track-label { display: none; }
  .pgp-tracks { margin-top: 6px; }
  .pgp-track { padding: 2px 6px; border-width: 3px; gap: 6px; border-radius: 14px; }
  .pgp-track canvas, .pgp-track .lock, .pgp-track .cupicon { width: 36px; height: 26px; font-size: 14px; border-radius: 8px; }
  .pgp-track .nm { font-size: 12px; }
  .pgp-track .sp { display: none; }
  .pgp-screen.title .pgp-row[style*="margin-top"] { flex-wrap: nowrap; gap: 8px !important; }
  .pgp-screen.title .pgp-row[style*="margin-top"] .pgp-go { white-space: nowrap; padding: 8px 12px !important; }
}
#hud .hud-item { position: absolute; left: 50%; top: max(10px, env(safe-area-inset-top)); transform: translateX(-50%);
  display: grid; justify-items: center; gap: 6px; }
#hud .hud-item .slot { width: clamp(58px, 11vh, 84px); height: clamp(58px, 11vh, 84px); border-radius: 22px; background: rgba(255,255,255,0.88);
  border: 5px solid #2a2050; display: grid; place-items: center; box-shadow: 0 5px 0 rgba(42,32,80,.35); }
#hud .hud-item .slot svg { width: 78%; height: 78%; }
#hud .hud-item .slot.empty { background: rgba(255,255,255,0.35); border-color: rgba(42,32,80,0.5); box-shadow: none; }
#hud .hud-item .slot.spin svg { animation: pgp-wob .12s linear infinite alternate; }
@keyframes pgp-wob { from { transform: scale(.85) rotate(-8deg) } to { transform: scale(1) rotate(8deg) } }
#hud .hud-power { width: clamp(150px, 26vh, 220px); background: rgba(42,32,80,.75); border-radius: 999px; padding: 4px; position: relative; }
#hud .hud-power .fill { height: 16px; border-radius: 999px; width: 0%; transition: width .15s linear; }
#hud .hud-power .lbl { position: absolute; inset: 0; display: grid; place-items: center; font-size: 12px; font-weight: 900; letter-spacing: .03em; color: #fff;
  text-shadow: 0 1px 0 #2a2050, 0 -1px 0 #2a2050, 1px 0 0 #2a2050, -1px 0 0 #2a2050; white-space: nowrap; }
#hud .hud-power.ready { animation: pgp-ready .5s ease-in-out infinite alternate; }
@keyframes pgp-ready { from { box-shadow: 0 0 0 0 rgba(255,210,58,.0) } to { box-shadow: 0 0 0 6px rgba(255,210,58,.9) } }
#hud-flash { position: fixed; inset: 0; background: #fffbe0; opacity: 0; pointer-events: none; z-index: 4; transition: opacity .35s ease-out; }
#hud .hud-toast { position: absolute; left: 0; right: 0; top: 46%; text-align: center; font-weight: 900; font-size: clamp(22px, 4.5vh, 38px); }
#hud .hud-toast.pop { animation: pgp-toast 1.6s ease-out both; }
@keyframes pgp-toast { 0% { transform: translateY(10px); opacity: 0 } 15% { transform: none; opacity: 1 } 80% { opacity: 1 } 100% { opacity: 0 } }
.pgp-power-info { margin: 8px 4px 0; font-size: 15px; font-weight: 700; color: #4a4480; }
.pgp-power-info b { color: #2a2050; }
@media (max-height: 520px) {
  .pgp-results h2 { font-size: 24px; margin-bottom: 6px; }
  .pgp-results table { font-size: 14px !important; }
  .pgp-results td { padding: 3px 6px; }
  .pgp-results .btns { margin-top: 10px; }
  .pgp-results .btns .pgp-go { font-size: 17px; padding: 8px 18px; }
  .pgp-screen.side { align-items: center; }
}
@media (max-height: 520px) { .pgp-power-info { font-size: 12px; margin-top: 4px; } }
@media (min-aspect-ratio: 6/5) and (min-width: 820px) {
  .pgp-screen.title { justify-items: end; padding-right: max(32px, env(safe-area-inset-right)); }
  .pgp-screen.title > div { width: min(640px, 56vw) !important; }
  .pgp-screen.side { justify-items: end; padding-right: max(24px, env(safe-area-inset-right)); }
  .pgp-screen.side .pgp-card { width: min(470px, 40vw) !important; }
}
@media (max-aspect-ratio: 5/6) {
  .pgp-screen.title { align-items: end; }
  .pgp-screen.side { align-items: end; }
  .pgp-screen.side .pgp-card { max-height: 52vh; overflow-y: auto; }
}
.pgp-screen.side { background: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
.pgp-screen.side .pgp-card { box-sizing: border-box; }
.pgp-screen.side table { font-size: 16px; }
#hud .hud-panel { position: absolute; inset: 0; }
#hud .hud-tag { display: none; }
#hud .hud-split-line { display: none; }
#hud.split .hud-panel { bottom: 50%; }
#hud.split .hud-panel.p2 { top: 50%; bottom: 0; }
#hud.split .hud-split-line { display: block; position: absolute; left: 0; right: 0; top: 50%; height: 6px; margin-top: -3px; background: #2a2050; }
#hud.split #hud-map { top: 50%; transform: translateY(-50%); width: clamp(96px, 19vh, 150px); height: clamp(96px, 19vh, 150px); }
#hud.split .hud-pos { font-size: clamp(40px, 8vh, 76px); bottom: 10px; }
#hud.split .hud-lap { font-size: clamp(17px, 3.2vh, 26px); top: 10px; }
#hud.split .hud-panel.p2 .hud-lap, #hud.split .hud-panel.p2 .hud-item { top: 14px; }
#hud.split .hud-msg { top: 24%; font-size: clamp(44px, 10vh, 96px); }
#hud.split .hud-msg.small { font-size: clamp(24px, 5vh, 44px); }
#hud.split .hud-wrong { top: 14%; font-size: clamp(22px, 4vh, 36px); }
#hud.split .hud-toast { top: 58%; font-size: clamp(18px, 3.4vh, 30px); }
#hud.split .hud-item { top: 10px; gap: 4px; }
#hud.split .hud-item .slot { width: clamp(46px, 8vh, 66px); height: clamp(46px, 8vh, 66px); border-radius: 18px; border-width: 4px; }
#hud.split .hud-power { width: clamp(120px, 20vh, 180px); }
#hud.split .hud-tag { display: block; position: absolute; right: calc(clamp(96px, 19vh, 150px) + 28px); bottom: 12px; font-size: clamp(18px, 3.4vh, 28px);
  font-weight: 900; line-height: 1; }
#hud.split .hud-panel.p2 .hud-tag { bottom: 12px; }
/* 3 y 4 jugadores: cuadrícula 2 × 2 (J1 J2 arriba, J3 J4 abajo). Con 3, el cuarto cuadrante lleva el minimapa grande. */
#hud .hud-split-v, #hud .hud-fill { display: none; }
#hud.quad .hud-panel { right: 50%; bottom: 50%; }
#hud.quad .hud-panel.p2 { left: 50%; right: 0; top: 0; bottom: 50%; }
#hud.quad .hud-panel.p3 { left: 0; right: 50%; top: 50%; bottom: 0; }
#hud.quad .hud-panel.p4 { left: 50%; right: 0; top: 50%; bottom: 0; }
#hud.quad .hud-split-line { display: block; position: absolute; left: 0; right: 0; top: 50%; height: 6px; margin-top: -3px; background: #2a2050; }
#hud.quad .hud-split-v { display: block; position: absolute; top: 0; bottom: 0; left: 50%; width: 6px; margin-left: -3px; background: #2a2050; }
#hud.quad.trio .hud-fill { display: block; position: absolute; left: 50%; top: 50%; right: 0; bottom: 0;
  background: radial-gradient(circle at 50% 50%, #3a2f78 0, #2a2050 70%); }
#hud.quad #hud-map { top: 50%; left: 50%; right: auto; transform: translate(-50%, -50%); width: clamp(72px, 13vh, 112px); height: clamp(72px, 13vh, 112px); }
#hud.quad.trio #hud-map { top: 75%; left: 75%; width: clamp(120px, 36vh, 280px); height: clamp(120px, 36vh, 280px); }
#hud.quad .hud-pos { font-size: clamp(36px, 7.5vh, 70px); bottom: 10px; }
#hud.quad .hud-lap { font-size: clamp(15px, 2.9vh, 24px); top: 10px; }
#hud.quad .hud-panel.p2 .hud-pos, #hud.quad .hud-panel.p4 .hud-pos { left: auto; right: max(18px, env(safe-area-inset-right)); }
#hud.quad .hud-panel.p2 .hud-lap, #hud.quad .hud-panel.p4 .hud-lap { left: auto; right: max(18px, env(safe-area-inset-right)); text-align: right; }
#hud.quad .hud-panel.p3 .hud-lap, #hud.quad .hud-panel.p4 .hud-lap, #hud.quad .hud-panel.p3 .hud-item, #hud.quad .hud-panel.p4 .hud-item { top: 14px; }
#hud.quad .hud-msg { top: 26%; font-size: clamp(36px, 9vh, 84px); }
#hud.quad .hud-msg.small { font-size: clamp(20px, 4.4vh, 38px); }
#hud.quad .hud-wrong { top: 40%; font-size: clamp(18px, 3.6vh, 30px); }
#hud.quad .hud-toast { top: 58%; font-size: clamp(15px, 3vh, 26px); }
#hud.quad .hud-item { top: 10px; gap: 4px; }
#hud.quad .hud-item .slot { width: clamp(40px, 7.5vh, 60px); height: clamp(40px, 7.5vh, 60px); border-radius: 16px; border-width: 4px; }
#hud.quad .hud-power { width: clamp(96px, 17vh, 150px); }
#hud.quad .hud-power .lbl { font-size: 10px; }
#hud.quad .hud-tag { display: block; position: absolute; left: max(18px, env(safe-area-inset-left)); top: calc(16px + clamp(15px, 2.9vh, 24px) * 2.4);
  font-size: clamp(14px, 2.8vh, 22px); font-weight: 900; line-height: 1; }
#hud.quad .hud-panel.p3 .hud-tag, #hud.quad .hud-panel.p4 .hud-tag { top: calc(20px + clamp(15px, 2.9vh, 24px) * 2.4); }
#hud.quad .hud-panel.p2 .hud-tag, #hud.quad .hud-panel.p4 .hud-tag { left: auto; right: max(18px, env(safe-area-inset-right)); }
#pgp-bench { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); z-index: 20; background: rgba(20,18,50,.9); color: #fff;
  font: 600 14px/1.5 ui-monospace, Menlo, monospace; padding: 10px 14px; border-radius: 12px; white-space: pre; pointer-events: none; }
`;

export interface TitleSetup {
  charIndex: number;
  trackId: string;
  /** Copa de 3 carreras en vez de una carrera suelta. */
  cup: boolean;
  cpu: CpuLevel;
  laps: number;
}

const ordinal = (n: number): string => `${n}º`;
const fmtTime = (t: number): string => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Color de cada jugador de este dispositivo (anillo del minimapa y etiqueta J1…J4). */
export const LOCAL_COLORS = ['#ffd23a', '#4ad8ff', '#ff7ad0', '#8cf26a'];

/** Lo que ve cada jugador en su mitad: posición, vuelta, objeto, poder y avisos. */
class HudPanel {
  readonly root = el('div', 'hud-panel');
  private pos = el('div', 'stroke hud-pos');
  private lap = el('div', 'stroke hud-lap');
  private msg = el('div', 'stroke hud-msg');
  private wrong = el('div', 'stroke hud-wrong', '¡Al revés! ↺');
  private itemBox = el('div', 'hud-item');
  private itemSlot = el('div', 'slot');
  private powerBar = el('div', 'hud-power');
  private powerFill = el('div', 'fill');
  private powerLbl = el('div', 'lbl');
  private toastEl = el('div', 'stroke hud-toast');
  private tag = el('div', 'stroke hud-tag');
  private shownItem = '';
  private lastLapHtml = '';
  private lastTag = '';
  private lastPos = '';
  private lastPct = -1;
  private lastPowerColor = '';
  private lastReady = false;
  private rouletteIdx = 0;

  constructor(n: number) {
    if (n) this.root.classList.add(`p${n + 1}`);
    this.powerBar.append(this.powerFill, this.powerLbl);
    this.itemBox.append(this.itemSlot, this.powerBar);
    this.root.append(this.pos, this.lap, this.itemBox, this.tag, this.msg, this.toastEl, this.wrong);
  }

  setRaceVisible(v: boolean): void {
    for (const e of [this.pos, this.lap, this.itemBox, this.tag]) e.style.display = v ? '' : 'none';
    if (!v) this.wrong.style.display = 'none';
  }

  flash(text: string, small: boolean, color: string): void {
    const m = this.msg;
    m.textContent = text;
    m.style.color = color;
    m.className = `stroke hud-msg${small ? ' small' : ''}`;
    void m.offsetWidth;
    m.classList.add('pop');
  }

  toast(text: string, color: string): void {
    const t = this.toastEl;
    t.textContent = text;
    t.style.color = color;
    t.className = 'stroke hud-toast';
    void t.offsetWidth;
    t.classList.add('pop');
  }

  private updateItem(p: Kart, touchMode: boolean, split: boolean): void {
    let key: string;
    if (p.rouletteT > 0) {
      this.rouletteIdx = (this.rouletteIdx + 1) % 18;
      key = `r${Math.floor(this.rouletteIdx / 6)}`;
      if (key !== this.shownItem) {
        this.itemSlot.innerHTML = ITEM_ICONS[ITEM_ORDER[Math.floor(this.rouletteIdx / 6)]];
        this.itemSlot.className = 'slot spin';
      }
    } else {
      key = p.item ?? '';
      if (key !== this.shownItem) {
        this.itemSlot.innerHTML = p.item ? ITEM_ICONS[p.item] : '';
        this.itemSlot.className = p.item ? 'slot' : 'slot empty';
      }
    }
    this.shownItem = key;
    // Solo se toca el DOM cuando algo cambia: con cuatro paneles, escribir estilos en cada cuadro cuesta.
    const pct = Math.round(p.power * 100);
    if (pct !== this.lastPct) this.powerFill.style.width = `${(this.lastPct = pct)}%`;
    const pc = cssColor(p.char.color);
    if (pc !== this.lastPowerColor) this.powerFill.style.background = this.lastPowerColor = pc;
    const ready = p.power >= 1;
    if (ready !== this.lastReady) this.powerBar.classList.toggle('ready', (this.lastReady = ready));
    const lbl = ready ? (touchMode || split ? `¡${p.char.power}!` : `¡${p.char.power}! (E · X)`) : p.char.power;
    if (this.powerLbl.textContent !== lbl) this.powerLbl.textContent = lbl;
  }

  update(race: Race, p: Kart, touchMode: boolean, split: boolean): void {
    this.updateItem(p, touchMode, split);
    const total = race.karts.length;
    const posHtml = `${ordinal(p.position)}<small>/${total}</small>`;
    if (posHtml !== this.lastPos) {
      this.pos.innerHTML = this.lastPos = posHtml;
      this.pos.style.color = ['#ffd23a', '#e6e9f2', '#f0a36a'][p.position - 1] ?? '#ffffff';
    }
    const lap = Math.max(1, Math.min(race.laps, p.lap));
    const html = `Vuelta ${lap}/${race.laps}<br><span class="time">${fmtTime(p.finished ? p.finishTime : race.time)}</span>`;
    if (html !== this.lastLapHtml) this.lap.innerHTML = this.lastLapHtml = html;
    const wrong = p.wrongWayT > 1 && !p.finished && race.phase === 'racing' ? '' : 'none';
    if (this.wrong.style.display !== wrong) this.wrong.style.display = wrong;
    const tag = split ? `J${p.localNo + 1} · ${p.name}` : '';
    if (tag !== this.lastTag) {
      this.tag.textContent = this.lastTag = tag;
      this.tag.style.color = LOCAL_COLORS[p.localNo] ?? '#fff';
    }
  }
}

/** Etiqueta del kart en las tablas: "(tú)" con un jugador; "(J1)"…"(J4)" en pantalla dividida. */
function youTag(localNo: number, split: boolean): string {
  if (localNo < 0) return '';
  return split ? ` (J${localNo + 1})` : ' (tú)';
}

export class Hud {
  private root = el('div');
  private panels: HudPanel[] = [new HudPanel(0)];
  private splitLine = el('div', 'hud-split-line');
  private splitV = el('div', 'hud-split-v');
  /** Cuarto cuadrante vacío con 3 jugadores (lleva el minimapa grande). */
  private fill = el('div', 'hud-fill');
  private players = 1;
  private lastMapAt = 0;
  private map = el('canvas');
  private mapCtx: CanvasRenderingContext2D;
  private mapPath: Path2D | null = null;
  private mapXf = { s: 1, ox: 0, oz: 0 };
  private screen: HTMLElement | null = null;
  private menuRows: { el: HTMLElement; left?: () => void; right?: () => void; ok?: () => void }[] = [];
  private focus = 0;
  private benchEl: HTMLElement | null = null;
  private flashEl = el('div');
  /** En pantallas táctiles no se muestran las teclas. */
  touchMode = false;
  private raceVisible = false;

  constructor() {
    const style = el('style');
    style.textContent = CSS;
    document.head.append(style);
    this.root.id = 'hud';
    this.map.id = 'hud-map';
    this.map.width = this.map.height = 380;
    this.mapCtx = this.map.getContext('2d')!;
    this.flashEl.id = 'hud-flash';
    this.root.append(this.panels[0].root, this.fill, this.splitLine, this.splitV, this.map);
    document.body.append(this.flashEl);
    document.body.append(this.root);
    this.setRaceVisible(false);
  }

  /** Jugadores en esta pantalla: 1; 2 = arriba y abajo; 3 o 4 = cuadrícula 2 × 2. */
  setPlayers(n: number): void {
    n = Math.max(1, Math.min(4, Math.round(n)));
    while (this.panels.length < n) {
      const p = new HudPanel(this.panels.length);
      this.panels.push(p);
      this.root.insertBefore(p.root, this.fill);
    }
    this.panels.forEach((p, i) => p.root.style.setProperty('display', i < n ? '' : 'none'));
    this.players = n;
    this.root.classList.toggle('split', n === 2);
    this.root.classList.toggle('quad', n >= 3);
    this.root.classList.toggle('trio', n === 3);
    this.setRaceVisible(this.raceVisible);
  }

  private get active(): HudPanel[] {
    return this.panels.slice(0, this.players);
  }

  setRaceVisible(v: boolean): void {
    this.raceVisible = v;
    this.map.style.display = v ? '' : 'none';
    this.panels.forEach((p) => p.setRaceVisible(v));
    this.splitLine.style.visibility = this.splitV.style.visibility = this.fill.style.visibility = v ? '' : 'hidden';
  }

  setTrack(track: Track): void {
    const b = track.bounds;
    const pad = 22;
    const size = this.map.width - pad * 2;
    const s = size / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    // Vista desde arriba con la salida abajo: x de pantalla = −x del mundo (la derecha del jugador queda a la derecha).
    this.mapXf = { s, ox: pad + (size + (b.maxX - b.minX) * s) / 2 + b.minX * s, oz: pad + (size - (b.maxZ - b.minZ) * s) / 2 - b.minZ * s };
    const p = new Path2D();
    track.samples.forEach((sm, i) => {
      const [x, y] = this.mapPt(sm.x, sm.z);
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
    p.closePath();
    this.mapPath = p;
  }

  private mapPt(x: number, z: number): [number, number] {
    return [this.mapXf.ox - x * this.mapXf.s, this.map.height - (this.mapXf.oz + z * this.mapXf.s)];
  }

  /** Mensaje grande animado en el centro. `player`: solo en la mitad de ese jugador (si no, en todas). */
  flash(text: string, small = false, color = '#ffffff', player?: number): void {
    const ps = player === undefined ? this.active : [this.active[player] ?? this.active[0]];
    for (const p of ps) p.flash(text, small, color);
  }

  /** Destello de pantalla (rayo). */
  screenFlash(strength = 0.85): void {
    const f = this.flashEl;
    f.style.transition = 'none';
    f.style.opacity = String(strength);
    void f.offsetWidth;
    f.style.transition = 'opacity .45s ease-out';
    f.style.opacity = '0';
  }

  /** Aviso corto a media pantalla ("¡Te dio Chispa!"). `player`: solo en su mitad. */
  toast(text: string, color = '#ffffff', player?: number): void {
    const ps = player === undefined ? this.active : [this.active[player] ?? this.active[0]];
    for (const p of ps) p.toast(text, color);
  }

  update(race: Race): void {
    const split = race.pilots.length > 1;
    race.pilots.forEach((pl, i) => this.panels[i]?.update(race, pl.kart, this.touchMode, split));
    // Con varios jugadores, el minimapa se redibuja a unos 30 cuadros por segundo (se nota igual y cuesta la mitad).
    const now = performance.now();
    if (!split || now - this.lastMapAt > 30) {
      this.lastMapAt = now;
      this.drawMap(race);
    }
  }

  private drawMap(race: Race): void {
    const g = this.mapCtx;
    const W = this.map.width;
    g.clearRect(0, 0, W, W);
    if (!this.mapPath) return;
    g.lineJoin = 'round';
    g.lineWidth = 30;
    g.strokeStyle = 'rgba(42,32,80,0.75)';
    g.stroke(this.mapPath);
    g.lineWidth = 18;
    g.strokeStyle = 'rgba(255,255,255,0.92)';
    g.stroke(this.mapPath);
    const order = [...race.karts].sort((a, b) => a.localNo - b.localNo);
    for (const k of order) {
      const me = k.localNo >= 0;
      const [x, y] = this.mapPt(k.pos.x, k.pos.z);
      g.beginPath();
      g.arc(x, y, me ? 15 : 11, 0, Math.PI * 2);
      g.fillStyle = cssColor(k.char.kart);
      g.fill();
      g.lineWidth = me ? 6 : 4;
      g.strokeStyle = me ? LOCAL_COLORS[k.localNo] ?? LOCAL_COLORS[0] : '#2a2050';
      g.stroke();
    }
  }

  // ---------------- Pantallas ----------------

  private openScreen(card: HTMLElement, dim: boolean): void {
    this.closeScreen();
    const s = el('div', `pgp-screen${dim ? ' dim' : ''}`);
    s.append(card);
    document.body.append(s);
    this.screen = s;
  }

  /** Añade una clase a la pantalla abierta (title, side). */
  screenClass(cls: string): void {
    this.screen?.classList.add(cls);
  }

  closeScreen(): void {
    this.screen?.remove();
    this.screen = null;
    this.menuRows = [];
  }

  get menuOpen(): boolean {
    return !!this.screen;
  }

  /** Navegación de menús con teclado o mando. */
  menuInput(keys: string[]): void {
    if (!this.menuRows.length) return;
    for (const k of keys) {
      const row = this.menuRows[this.focus];
      if (k === 'up') this.focus = Math.max(0, this.focus - 1);
      else if (k === 'down') this.focus = Math.min(this.menuRows.length - 1, this.focus + 1);
      else if (k === 'left') row.left?.();
      else if (k === 'right') row.right?.();
      else if (k === 'ok') (row.ok ?? this.menuRows[this.menuRows.length - 1].ok)?.();
      this.menuRows.forEach((r, i) => r.el.classList.toggle('focus', i === this.focus));
    }
  }

  showTitle(setup: TitleSetup, onChange: (s: TitleSetup) => void, onStart: () => void, onSettings: () => void, status: string, onFullscreen: (() => void) | null, onOnline: () => void, onSplit: (() => void) | null = null, onPhone: (() => void) | null = null): void {
    const wrap = el('div');
    wrap.style.width = 'min(760px, 100%)';
    const logo = el('div', 'pgp-logo');
    logo.innerHTML = [...'Peluches GP'].map((c) => `<span>${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    const sub = el('div', 'pgp-sub', 'Carreras de peluches por toda la casa');
    const card = el('div', 'pgp-card');
    wrap.append(logo, sub, card);

    card.append(el('div', 'pgp-label', 'Elige tu peluche'));
    const charRow = el('div', 'pgp-row');
    const chars = el('div', 'pgp-chars');
    chars.style.width = '100%';
    charRow.append(chars);
    const charBtns = CHARACTERS.map((c, i) => {
      const b = el('button', 'pgp-char');
      b.innerHTML = `<div class="face" style="background:${cssColor(c.color)}"></div><div class="nm">${displayName(c)}</div><div class="sp">${c.label}</div>`;
      b.onclick = () => setChar(i);
      chars.append(b);
      return b;
    });
    card.append(charRow);
    const powerInfo = el('div', 'pgp-power-info');
    card.append(powerInfo);

    card.append(el('div', 'pgp-label pgp-track-label', 'Pista'));
    const trackRow = el('div', 'pgp-row');
    const tracks = el('div', 'pgp-tracks');
    trackRow.append(tracks);
    const trackBtns = TRACKS.map((t) => {
      const b = el('button', 'pgp-track');
      if (t.ready) {
        b.append(trackThumb(t));
        b.onclick = () => setTrack(t.id);
      } else {
        b.disabled = true;
        b.append(el('div', 'lock', '🔒'));
      }
      const txt = el('div');
      b.title = t.ready ? `${t.name}: ${t.blurb.toLowerCase()}` : `${t.name}: pronto`;
      txt.append(el('div', 'nm', t.name), el('div', 'nm short', t.name.replace(/^El |^La /, '').split(' ')[0]), el('div', 'sp', t.ready ? t.blurb : 'Pronto'));
      b.append(txt);
      tracks.append(b);
      return b;
    });
    const cupBtn = el('button', 'pgp-track');
    cupBtn.append(el('div', 'cupicon', '🏆'));
    const cupTxt = el('div');
    cupTxt.append(el('div', 'nm', 'Copa Peluche'), el('div', 'nm short', 'Copa'), el('div', 'sp', 'Las 3 pistas seguidas'));
    cupBtn.append(cupTxt);
    cupBtn.title = 'Copa Peluche: las 3 pistas seguidas, con puntos';
    cupBtn.onclick = () => setCup();
    tracks.append(cupBtn);
    card.append(trackRow);

    const opts = el('div', 'pgp-opts');
    const cpuCol = el('div');
    const lapCol = el('div');
    opts.append(cpuCol, lapCol);
    card.append(opts);
    cpuCol.append(el('div', 'pgp-label', 'Rivales'));
    const cpuRow = el('div', 'pgp-row');
    const cpuBtns = CPU_LEVELS.map((lv) => {
      const b = el('button', 'pgp-opt', lv.label);
      b.onclick = () => setCpu(lv);
      cpuRow.append(b);
      return b;
    });
    cpuCol.append(cpuRow);

    lapCol.append(el('div', 'pgp-label', 'Vueltas'));
    const lapRow = el('div', 'pgp-row');
    const lapBtns = [2, 3].map((n) => {
      const b = el('button', 'pgp-opt', String(n));
      b.onclick = () => setLaps(n);
      lapRow.append(b);
      return b;
    });
    lapCol.append(lapRow);

    const goRow = el('div', 'pgp-row');
    goRow.style.justifyContent = 'center';
    goRow.style.gap = '12px';
    goRow.style.alignItems = 'center';
    const go = el('button', 'pgp-go', '¡A correr!');
    go.onclick = () => onStart();
    go.style.margin = '0';
    const gear = el('button', 'pgp-go', '⚙ Ajustes');
    gear.style.cssText = 'margin:0;background:#2f7de0;box-shadow:0 7px 0 #1d5aa8;font-size:20px;padding:12px 22px';
    gear.onclick = () => onSettings();
    const online = el('button', 'pgp-go', '👫 Jugar con otros');
    online.style.cssText = 'margin:0;background:#f07ab0;box-shadow:0 7px 0 #b84a80;font-size:20px;padding:12px 22px';
    online.onclick = () => onOnline();
    goRow.append(go, online);
    if (onSplit) {
      // Pantalla dividida: solo en computador o tablet con mandos (no en el teléfono).
      const sp = el('button', 'pgp-go', '👥 2–4 jugadores');
      sp.style.cssText = 'margin:0;background:#ff9a2a;box-shadow:0 7px 0 #c26a10;font-size:20px;padding:12px 22px';
      sp.onclick = () => onSplit();
      goRow.append(sp);
    }
    if (onPhone) {
      // Teléfono como mando para 1 jugador (QR); en «2–4 jugadores» el QR ya está en la pantalla de unirse.
      const ph = el('button', 'pgp-go', '📱 Mando');
      ph.title = 'Usar un teléfono como mando';
      ph.style.cssText = 'margin:0;background:#1fa59a;box-shadow:0 7px 0 #137168;font-size:20px;padding:12px 22px';
      ph.onclick = () => onPhone();
      goRow.append(ph);
    }
    goRow.append(gear);
    if (onFullscreen) {
      const fs = el('button', 'pgp-go', '⛶');
      fs.title = 'Pantalla completa';
      fs.setAttribute('aria-label', 'Pantalla completa');
      fs.style.cssText = 'margin:0;background:#8a4fd8;box-shadow:0 7px 0 #5e2fa3;font-size:24px;padding:10px 18px';
      fs.onclick = () => onFullscreen();
      goRow.append(fs);
    }
    goRow.style.marginTop = '18px';
    card.append(goRow);
    card.append(el('div', 'pgp-hint', status));
    card.append(el('div', 'pgp-hint', 'Teclado: flechas · Espacio derrapa · Shift objeto · E poder · C mira atrás · F pantalla completa &nbsp;|&nbsp; Mando: B acelera · A frena · R derrapa · L objeto · X poder · − mira atrás'));

    const s = { ...setup };
    const refresh = (): void => {
      const ch = CHARACTERS[s.charIndex];
      powerInfo.innerHTML = `<b>${displayName(ch)}</b> · ${ch.power}: ${ch.powerDesc.toLowerCase()}`;
      charBtns.forEach((b, i) => b.classList.toggle('sel', i === s.charIndex));
      trackBtns.forEach((b, i) => b.classList.toggle('sel', !s.cup && TRACKS[i].id === s.trackId));
      cupBtn.classList.toggle('sel', s.cup);
      cpuBtns.forEach((b, i) => b.classList.toggle('sel', CPU_LEVELS[i].id === s.cpu.id));
      lapBtns.forEach((b, i) => b.classList.toggle('sel', [2, 3][i] === s.laps));
    };
    const setChar = (i: number): void => {
      s.charIndex = (i + CHARACTERS.length) % CHARACTERS.length;
      refresh();
      onChange({ ...s });
    };
    const readyIds = TRACKS.filter((t) => t.ready).map((t) => t.id);
    const setTrack = (id: string): void => {
      if (id === s.trackId && !s.cup) return;
      s.trackId = id;
      s.cup = false;
      refresh();
      onChange({ ...s });
    };
    const setCup = (): void => {
      if (s.cup) return;
      s.cup = true;
      refresh();
      onChange({ ...s });
    };
    const stepTrack = (d: number): void => {
      // Las pistas y, al final, la copa.
      const opts = [...readyIds, 'copa'];
      const i = s.cup ? opts.length - 1 : readyIds.indexOf(s.trackId);
      const next = opts[Math.max(0, Math.min(opts.length - 1, i + d))];
      if (next === 'copa') setCup();
      else setTrack(next);
    };
    const setCpu = (lv: CpuLevel): void => {
      s.cpu = lv;
      refresh();
      onChange({ ...s });
    };
    const setLaps = (n: number): void => {
      s.laps = n;
      refresh();
      onChange({ ...s });
    };
    refresh();
    this.openScreen(wrap, false);
    const cpuIdx = (): number => CPU_LEVELS.findIndex((l) => l.id === s.cpu.id);
    this.menuRows = [
      { el: charRow, left: () => setChar(s.charIndex - 1), right: () => setChar(s.charIndex + 1) },
      { el: trackRow, left: () => stepTrack(-1), right: () => stepTrack(1) },
      { el: cpuRow, left: () => setCpu(CPU_LEVELS[Math.max(0, cpuIdx() - 1)]), right: () => setCpu(CPU_LEVELS[Math.min(CPU_LEVELS.length - 1, cpuIdx() + 1)]) },
      { el: lapRow, left: () => setLaps(2), right: () => setLaps(3) },
      { el: goRow, ok: onStart, right: onSettings },
    ];
    this.focus = 0;
    this.menuInput([]);
    charRow.classList.add('focus');
  }

  showPause(onResume: () => void, onRestart: (() => void) | null, onMenu: () => void, onSettings: () => void, onFullscreen: (() => void) | null, menuLabel = 'Menú'): void {
    const card = el('div', 'pgp-card pgp-results');
    card.style.width = 'min(420px, 100%)';
    card.append(el('h2', '', 'Pausa'));
    const btns = el('div', 'btns');
    btns.style.flexDirection = 'column';
    btns.style.alignItems = 'center';
    const mk = (t: string, cls: string, fn: () => void): HTMLButtonElement => {
      const b = el('button', `pgp-go ${cls}`, t);
      b.onclick = fn;
      btns.append(b);
      return b;
    };
    const a = mk('Seguir', '', onResume);
    const b = onRestart ? mk('Empezar de nuevo', 'alt', onRestart) : null;
    const d = mk('Ajustes', 'alt', onSettings);
    const rows: [HTMLElement, () => void][] = [[a, onResume]];
    if (b && onRestart) rows.push([b, onRestart]);
    rows.push([d, onSettings]);
    if (onFullscreen) rows.push([mk('Pantalla completa', 'alt', onFullscreen), onFullscreen]);
    rows.push([mk(menuLabel, 'alt', onMenu), onMenu]);
    card.append(btns);
    this.openScreen(card, true);
    this.menuRows = rows.map(([e, fn]) => ({ el: e, ok: fn }));
    this.focus = 0;
    this.menuInput([]);
  }

  showResults(race: Race, onAgain: () => void, onMenu: () => void, againLabel = 'Otra carrera', menuLabel = 'Menú'): void {
    const card = el('div', 'pgp-card pgp-results');
    card.style.width = 'min(560px, 100%)';
    let title: string;
    if (race.pilots.length > 1) {
      // Pantalla dividida: el título habla del mejor de los jugadores.
      const best = race.pilots.map((pl) => pl.kart).sort((a, b) => (a.place || 99) - (b.place || 99))[0];
      title = best.place === 1 ? `¡Ganó ${best.name}! 🏆` : best.place <= 3 ? `¡${best.name}, ${ordinal(best.place)} lugar! 🎉` : 'Carrera terminada';
    } else {
      const p = race.player;
      title = p.place === 1 ? '¡Ganaste! 🏆' : p.place <= 3 ? `¡${ordinal(p.place)} lugar! 🎉` : `Llegaste ${ordinal(p.place)}`;
    }
    card.append(el('h2', '', title));
    const table = el('table');
    card.append(table);
    const btns = el('div', 'btns');
    const again = el('button', 'pgp-go', againLabel);
    again.onclick = onAgain;
    const menu = el('button', 'pgp-go alt', menuLabel);
    menu.onclick = onMenu;
    btns.append(again, menu);
    card.append(btns);
    this.openScreen(card, true);
    this.menuRows = [
      { el: again, ok: onAgain, right: () => this.menuInput(['down']), left: () => this.menuInput(['up']) },
      { el: menu, ok: onMenu, right: () => this.menuInput(['down']), left: () => this.menuInput(['up']) },
    ];
    this.focus = 0;
    this.menuInput([]);
    this.resultsTable = table;
    this.resultsHtml = '';
    this.refreshResults(race);
  }

  /**
   * Clasificación de la copa tras una carrera (o la final). `me`: el peluche de este jugador.
   * `onNext` null = este dispositivo espera al anfitrión (se muestra `wait`).
   */
  showCup(cup: Cup, me: Species[], o: { onNext: (() => void) | null; nextLabel: string; onMenu: () => void; menuLabel: string; wait?: string }): void {
    this.resultsTable = null;
    const rows = cup.standings();
    const split = me.length > 1;
    const mine = rows.find((r) => me.includes(r.char));
    const card = el('div', 'pgp-card pgp-results pgp-cup');
    card.style.width = 'min(560px, 100%)';
    let title = `Copa Peluche · ${cup.raced} de ${cup.total}`;
    if (cup.done && mine && split) title = mine.rank === 1 ? `¡${mine.name} ganó la copa! 🏆` : mine.rank <= 3 ? `¡${mine.name}, ${ordinal(mine.rank)} en la copa! 🏆` : 'Copa terminada';
    else if (cup.done && mine) title = mine.rank === 1 ? '¡Ganaste la copa! 🏆' : mine.rank <= 3 ? `¡${ordinal(mine.rank)} en la copa! 🏆` : 'Copa terminada';
    card.append(el('h2', '', title));
    const next = TRACKS.find((t) => t.id === cup.trackId);
    card.append(el('div', 'sub', cup.done ? 'Clasificación final' : `Siguiente: ${next?.name ?? ''}`));
    const table = el('table');
    table.innerHTML = rows
      .map((r) => {
        const c = CHARACTERS.find((x) => x.id === r.char);
        const mv = r.rank < r.prevRank ? ['up', '▲'] : r.rank > r.prevRank ? ['down', '▼'] : ['', ''];
        const ln = me.indexOf(r.char);
        return `<tr class="${ln >= 0 ? 'me' : ''}"><td>${ordinal(r.rank)}</td><td class="mv ${mv[0]}">${mv[1]}</td>
        <td><span class="dot" style="background:${c ? cssColor(c.kart) : '#888'}"></span>${r.name}${youTag(ln, split)}</td>
        <td class="add">${r.last ? '+' + r.last : ''}</td><td class="tot">${r.points}</td></tr>`;
      })
      .join('');
    card.append(table);
    const btns = el('div', 'btns');
    const rowsNav: { el: HTMLElement; ok: () => void }[] = [];
    if (o.onNext) {
      const nb = el('button', 'pgp-go', o.nextLabel);
      nb.onclick = o.onNext;
      btns.append(nb);
      rowsNav.push({ el: nb, ok: o.onNext });
    } else if (o.wait) card.append(el('div', 'sub', o.wait));
    const mb = el('button', 'pgp-go alt', o.menuLabel);
    mb.onclick = o.onMenu;
    btns.append(mb);
    rowsNav.push({ el: mb, ok: o.onMenu });
    card.append(btns);
    this.openScreen(card, true);
    this.menuRows = rowsNav.map((r) => ({ ...r, right: () => this.menuInput(['down']), left: () => this.menuInput(['up']) }));
    this.focus = 0;
    this.menuInput([]);
  }

  private resultsTable: HTMLTableElement | null = null;
  private resultsHtml = '';

  /** Se llama en cada cuadro de los resultados: solo reescribe la tabla si cambió. */
  refreshResults(race: Race): void {
    if (!this.resultsTable) return;
    const html = race.order
      .map(
        (k) => `<tr class="${k.localNo >= 0 ? 'me' : ''}"><td>${k.finished ? ordinal(k.place) : '…'}</td>
        <td><span class="dot" style="background:${cssColor(k.char.kart)}"></span>${k.name}${youTag(k.localNo, race.pilots.length > 1)}</td>
        <td style="text-align:right">${k.finished ? fmtTime(k.finishTime) : 'en carrera'}</td></tr>`,
      )
      .join('');
    if (html !== this.resultsHtml) this.resultsTable.innerHTML = this.resultsHtml = html;
  }

  bench(text: string): void {
    if (!this.benchEl) {
      this.benchEl = el('div');
      this.benchEl.id = 'pgp-bench';
      document.body.append(this.benchEl);
    }
    this.benchEl.textContent = text;
  }
}

/** Minimapa pequeño de la pista para su tarjeta del menú (la salida abajo, como en la carrera). */
function trackThumb(t: ReadyTrack): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const W = 112;
  const H = 84;
  c.width = W;
  c.height = H;
  const pts = trackOutline(t);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
  }
  const pad = 10;
  const sc = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (z1 - z0));
  const ox = W / 2 + ((x0 + x1) / 2) * sc;
  const oz = H / 2 + ((z0 + z1) / 2) * sc;
  const g = c.getContext('2d')!;
  g.lineJoin = g.lineCap = 'round';
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(ox - p.x * sc, oz - p.z * sc) : g.moveTo(ox - p.x * sc, oz - p.z * sc)));
  g.closePath();
  g.strokeStyle = '#2a2050';
  g.lineWidth = 9;
  g.stroke();
  g.strokeStyle = '#ffd23a';
  g.lineWidth = 4;
  g.stroke();
  const p0 = pts[0];
  g.fillStyle = '#e8423a';
  g.beginPath();
  g.arc(ox - p0.x * sc, oz - p0.z * sc, 5, 0, Math.PI * 2);
  g.fill();
  return c;
}
