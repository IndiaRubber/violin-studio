import { VIOLIN_STRINGS, referenceFrequency } from './tuner-logic';

// Original drawing of a violin scroll and pegbox seen from the front. Pegs follow a real
// violin: D (upper) and G (lower) on the left, A (upper) and E (lower) on the right.
// Pure inline SVG, so it works offline with no external assets.

const VIEW = { w: 320, h: 214 };
interface Peg { id: string; side: 'left' | 'right'; y: number; nutX: number }
const PEGS: Peg[] = [
  { id: 'd4', side: 'left', y: 80, nutX: 156 },
  { id: 'a4', side: 'right', y: 104, nutX: 164 },
  { id: 'g3', side: 'left', y: 134, nutX: 150 },
  { id: 'e5', side: 'right', y: 158, nutX: 170 },
];
const NUT_Y = 180;

function pegHead(side: 'left' | 'right', y: number) {
  // A pear-shaped head with a collar, drawn for the left side and mirrored for the right.
  const d = `M128 ${y - 4} L112 ${y - 4} C108 ${y - 4} 106 ${y - 7} 102 ${y - 9} C92 ${y - 15} 74 ${y - 15} 66 ${y - 8} C62 ${y - 4} 62 ${y + 4} 66 ${y + 8} C74 ${y + 15} 92 ${y + 15} 102 ${y + 9} C106 ${y + 7} 108 ${y + 4} 112 ${y + 4} L128 ${y + 4} Z`;
  return <g transform={side === 'right' ? `translate(${VIEW.w} 0) scale(-1 1)` : undefined}>
    <path d={d} className="peg-head" />
    <rect x="106" y={y - 6} width="5" height="12" rx="1.5" className="peg-collar" />
    <ellipse cx="78" cy={y - 4} rx="9" ry="3" className="peg-shine" />
  </g>;
}

export function ViolinScroll({ active, onSelect, chromatic, a4 }: { active: string | null; onSelect: (id: string) => void; chromatic: boolean; a4: number }) {
  return <div className={`violin-scroll ${chromatic ? 'is-chromatic' : ''}`}>
    <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="vs-wood" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6e3415" /><stop offset="0.35" stopColor="#b8672f" /><stop offset="0.55" stopColor="#cf8443" /><stop offset="1" stopColor="#7a3b18" />
        </linearGradient>
        <radialGradient id="vs-volute" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#d48b4a" /><stop offset="0.7" stopColor="#a65a28" /><stop offset="1" stopColor="#6b3214" />
        </radialGradient>
        <linearGradient id="vs-ebony" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3a2a22" /><stop offset="1" stopColor="#15100d" /></linearGradient>
      </defs>
      {/* Scroll: front view of the volute, with mirrored spiral turns either side of the spine */}
      <path d="M160 6 C186 6 198 22 198 40 C198 56 188 66 178 70 L142 70 C132 66 122 56 122 40 C122 22 134 6 160 6 Z" fill="url(#vs-volute)" stroke="#4a210c" strokeWidth="1.5" />
      <path d="M160 10 L160 68" stroke="#7a3a17" strokeWidth="2" opacity="0.7" />
      {[1, -1].map(dir => <path key={dir} fill="none" stroke="#5a2a10" strokeWidth="1.6" opacity="0.85"
        d={`M${160 + dir * 4} 64 C${160 + dir * 26} 62 ${160 + dir * 34} 46 ${160 + dir * 30} 32 C${160 + dir * 26} 18 ${160 + dir * 10} 16 ${160 + dir * 8} 28 C${160 + dir * 6} 38 ${160 + dir * 18} 42 ${160 + dir * 20} 34`} />)}
      {/* Pegbox walls and dark cavity */}
      <path d="M136 68 L184 68 L190 178 L130 178 Z" fill="url(#vs-wood)" stroke="#4a210c" strokeWidth="1.5" />
      <path d="M144 74 L176 74 L180 172 L140 172 Z" fill="#241109" />
      {/* Peg shafts through the pegbox, then heads outside */}
      {PEGS.map(peg => <g key={peg.id} className={`peg ${active === peg.id ? 'is-active' : ''}`} data-peg={peg.id}>
        <rect x="128" y={peg.y - 3} width="64" height="6" rx="3" className="peg-shaft" />
        {pegHead(peg.side, peg.y)}
      </g>)}
      {/* Strings from each peg, over the nut, down the fingerboard */}
      <path d="M134 178 L186 178 L182 214 L138 214 Z" fill="url(#vs-ebony)" />
      <rect x="130" y={NUT_Y - 3} width="60" height="5" rx="1.5" fill="#efe6d2" />
      {PEGS.map(peg => <path key={peg.id} className={`vs-string ${active === peg.id ? 'is-active' : ''}`} fill="none"
        d={`M${peg.side === 'left' ? 152 : 168} ${peg.y} L${peg.nutX} ${NUT_Y} L${peg.nutX + (peg.nutX - 160) * 0.15} ${VIEW.h}`} />)}
    </svg>
    {PEGS.map(peg => {
      const note = VIOLIN_STRINGS.find(s => s.id === peg.id)!;
      const name = note.name.replace(/\d/, '');
      return <button key={peg.id} type="button" className={`peg-button ${peg.side}`} style={{ top: `${(peg.y / VIEW.h) * 100}%` }}
        aria-pressed={!chromatic && active === peg.id} aria-label={`${name} string, ${note.name}, ${referenceFrequency(note.midi, a4).toFixed(2)} Hz`}
        onClick={() => onSelect(peg.id)}>{name}</button>;
    })}
  </div>;
}
