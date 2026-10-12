import { useId } from 'react';

/**
 * Artes vetoriais originais do portal (sem uso de imagens de terceiros).
 * São determinísticas a partir de uma "semente", para que cada card tenha
 * uma variação estável sem depender de arquivos externos.
 */

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  { sky: ['#12052e', '#5b1265', '#ff4f7e', '#ffb347'], sun: ['#ffe36e', '#ff5c8a'], city: '#0b0620', glow: '#ff2d9b' },
  { sky: ['#030b2b', '#123a8a', '#2fb8ff', '#b3f5ff'], sun: ['#e9fbff', '#4cc3ff'], city: '#020617', glow: '#00e5ff' },
  { sky: ['#140726', '#3d0f5e', '#a8327f', '#ff9a62'], sun: ['#fff1a8', '#ff7a59'], city: '#0d0419', glow: '#ff7ad9' },
  { sky: ['#06142b', '#0f3d5e', '#1aa39a', '#ffd27a'], sun: ['#fff6c4', '#ffb347'], city: '#03101d', glow: '#2fffd5' },
];

function Palm({ x, y, s, flip, color }: { x: number; y: number; s: number; flip?: boolean; color: string }) {
  const d = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * d} ${s})`} fill={color}>
      <path d="M-3 0 C -1 -60, 6 -120, 14 -170 L 20 -169 C 12 -118, 5 -60, 4 0 Z" />
      <path d="M16 -168 C -10 -190, -50 -185, -78 -158 C -48 -172, -14 -170, 14 -160 Z" />
      <path d="M17 -168 C 40 -196, 82 -196, 104 -170 C 76 -182, 44 -178, 20 -160 Z" />
      <path d="M16 -170 C -6 -210, -40 -224, -66 -214 C -36 -206, -10 -190, 12 -164 Z" />
      <path d="M18 -170 C 34 -214, 66 -230, 92 -222 C 64 -212, 40 -194, 22 -164 Z" />
      <path d="M17 -170 C 10 -200, 14 -228, 30 -246 C 26 -220, 26 -196, 22 -166 Z" />
    </g>
  );
}

export function NeonScene({ seed = 'vice', variant, className, title }: { seed?: string; variant?: number; className?: string; title?: string }) {
  const uid = useId().replace(/:/g, '');
  const r = rng(seed);
  const p = PALETTES[(variant ?? Math.floor(r() * PALETTES.length)) % PALETTES.length]!;
  const W = 1600;
  const H = 900;
  const horizon = 610;

  const back: { x: number; w: number; h: number }[] = [];
  for (let x = -20; x < W; ) {
    const w = 40 + r() * 80;
    back.push({ x, w, h: 120 + r() * 220 });
    x += w + 4;
  }
  const front: { x: number; w: number; h: number; spire: boolean }[] = [];
  for (let x = 260 + r() * 80; x < W - 220; ) {
    const w = 46 + r() * 70;
    front.push({ x, w, h: 160 + r() * (r() > 0.85 ? 330 : 200), spire: r() > 0.8 });
    x += w + 10 + r() * 30;
  }
  const windows: { x: number; y: number; on: boolean }[] = [];
  for (const b of front) {
    for (let wy = horizon - b.h + 18; wy < horizon - 10; wy += 16) {
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 12) {
        if (r() > 0.62) windows.push({ x: wx, y: wy, on: r() > 0.3 });
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.45" stopColor={p.sky[1]} />
          <stop offset="0.8" stopColor={p.sky[2]} />
          <stop offset="1" stopColor={p.sky[3]} />
        </linearGradient>
        <linearGradient id={`sun${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sun[0]} />
          <stop offset="1" stopColor={p.sun[1]} />
        </linearGradient>
        <linearGradient id={`sea${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[2]} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.sky[0]} />
        </linearGradient>
        <mask id={`sunmask${uid}`}>
          <rect width={W} height={H} fill="#fff" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x="0" y={horizon - 150 + i * 22} width={W} height={3 + i * 1.6} fill="#000" />
          ))}
        </mask>
        <filter id={`glow${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#sky${uid})`} />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={r() * W} cy={r() * 300} r={r() * 1.6 + 0.3} fill="#fff" opacity={0.25 + r() * 0.5} />
      ))}
      <circle cx={W * (0.55 + r() * 0.2)} cy={horizon - 120} r="210" fill={`url(#sun${uid})`} mask={`url(#sunmask${uid})`} opacity="0.95" />
      <g fill={p.city} opacity="0.55">
        {back.map((b, i) => (
          <rect key={i} x={b.x} y={horizon - b.h} width={b.w} height={b.h} />
        ))}
      </g>
      <g fill={p.city}>
        {front.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={horizon - b.h} width={b.w} height={b.h} />
            {b.spire && <rect x={b.x + b.w / 2 - 2} y={horizon - b.h - 60} width="4" height="60" />}
          </g>
        ))}
      </g>
      <g fill={p.glow}>
        {windows.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width="5" height="7" opacity={w.on ? 0.85 : 0.18} />
        ))}
      </g>
      <rect x="0" y={horizon} width={W} height={H - horizon} fill={`url(#sea${uid})`} />
      <g stroke={p.glow} strokeOpacity="0.35" strokeWidth="2">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1="0" x2={W} y1={horizon + 14 + i * i * 4.2} y2={horizon + 14 + i * i * 4.2} />
        ))}
      </g>
      <line x1="0" x2={W} y1={horizon} y2={horizon} stroke={p.glow} strokeWidth="3" filter={`url(#glow${uid})`} />
      <Palm x={150} y={H + 30} s={2.4} color="#05020d" />
      <Palm x={330} y={H + 70} s={1.6} flip color="#05020d" />
      <Palm x={W - 120} y={H + 40} s={2.2} flip color="#05020d" />
    </svg>
  );
}

export function BrandMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`bm${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff2d9b" />
          <stop offset="1" stopColor="#00e5ff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0d1530" stroke={`url(#bm${uid})`} strokeWidth="2" />
      <circle cx="32" cy="30" r="15" fill={`url(#bm${uid})`} />
      <rect x="10" y="40" width="44" height="3" fill="#0d1530" />
      <rect x="10" y="46" width="44" height="2" fill="#0d1530" />
      <path d="M31 52c1-9 1-17-2-24M31 28c-6-4-12-3-16 1M31 28c5-5 12-6 17-3M31 28c-2-5-7-8-12-8M31 28c3-4 8-6 12-5" stroke="#0d1530" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Ilustração genérica de console + controle (sem reproduzir o desenho de nenhum produto real). */
export function ConsoleArt({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`c1${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#dfe8ff" />
          <stop offset="1" stopColor="#8fa6d9" />
        </linearGradient>
        <linearGradient id={`c2${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2a5e" />
          <stop offset="1" stopColor="#0a1230" />
        </linearGradient>
        <radialGradient id={`c3${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#00e5ff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#00e5ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="230" cy="232" rx="170" ry="22" fill={`url(#c3${uid})`} />
      <rect x="250" y="20" width="78" height="210" rx="14" fill={`url(#c1${uid})`} />
      <rect x="270" y="20" width="38" height="210" rx="6" fill={`url(#c2${uid})`} />
      <rect x="284" y="40" width="10" height="3" rx="1.5" fill="#00e5ff" />
      <path d="M90 150 C 70 150, 52 180, 56 210 C 58 226, 76 230, 88 218 L 112 194 L 188 194 L 212 218 C 224 230, 242 226, 244 210 C 248 180, 230 150, 210 150 Z" fill={`url(#c1${uid})`} />
      <path d="M118 150 L 182 150 L 176 178 L 124 178 Z" fill={`url(#c2${uid})`} />
      <circle cx="104" cy="172" r="9" fill="#26355f" />
      <circle cx="196" cy="172" r="9" fill="#26355f" />
      <rect x="140" y="160" width="20" height="3" rx="1.5" fill="#00e5ff" opacity="0.8" />
    </svg>
  );
}

/** Ilustração genérica de capa de jogo + acessórios para o banner 2. */
export function GameGearArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" className={className} aria-hidden="true">
      <g transform="translate(150 18) rotate(6)">
        <defs>
          <linearGradient id="gg-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12052e" />
            <stop offset="0.55" stopColor="#7a1460" />
            <stop offset="1" stopColor="#ff8a5c" />
          </linearGradient>
        </defs>
        <rect width="150" height="200" rx="10" fill="url(#gg-sky)" stroke="#ff5ca8" strokeWidth="2" />
        <circle cx="92" cy="104" r="38" fill="#ffe36e" opacity="0.9" />
        <g fill="#0b0620">
          <rect x="10" y="96" width="16" height="54" />
          <rect x="30" y="80" width="14" height="70" />
          <rect x="48" y="108" width="18" height="42" />
          <rect x="70" y="70" width="12" height="80" />
          <rect x="86" y="100" width="20" height="50" />
          <rect x="110" y="88" width="14" height="62" />
          <rect x="128" y="112" width="14" height="38" />
        </g>
        <rect y="150" width="150" height="50" rx="0" fill="#0b0620" opacity="0.85" />
        <text x="75" y="182" textAnchor="middle" fontFamily="Montserrat Variable, sans-serif" fontWeight="900" fontSize="20" fill="#fff">
          JOGOS
        </text>
      </g>
      <g transform="translate(40 150)">
        <path d="M34 0 C 14 0, -4 30, 0 60 C 2 76, 20 80, 32 68 L 56 44 L 132 44 L 156 68 C 168 80, 186 76, 188 60 C 192 30, 174 0, 154 0 Z" fill="#f2f4ff" />
        <path d="M62 0 L 126 0 L 120 28 L 68 28 Z" fill="#1a1030" />
        <circle cx="48" cy="22" r="9" fill="#2b1d4a" />
        <circle cx="140" cy="22" r="9" fill="#2b1d4a" />
      </g>
      <g transform="translate(300 150)" fill="none" stroke="#00e5ff" strokeWidth="9" strokeLinecap="round">
        <path d="M0 60 C 0 0, 80 0, 80 60" />
        <rect x="-8" y="52" width="20" height="36" rx="8" fill="#00e5ff" stroke="none" />
        <rect x="68" y="52" width="20" height="36" rx="8" fill="#00e5ff" stroke="none" />
      </g>
    </svg>
  );
}
