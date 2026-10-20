// Decorative connected-node pattern (matches the reference's glowing network).
const nodes: [number, number][] = [
  [60, 120], [210, 60], [330, 190], [140, 300], [470, 90], [560, 250], [700, 330], [820, 60], [900, 230],
  [760, 330], [980, 120], [1080, 300], [1180, 70], [1240, 210], [90, 460], [300, 520], [520, 430],
  [660, 520], [880, 470], [1060, 540], [1220, 460], [40, 640], [400, 700], [760, 690], [1150, 680],
]
const links: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 3], [2, 4], [4, 5], [5, 6], [6, 7], [6, 8], [8, 9], [7, 10], [10, 11],
  [10, 12], [12, 13], [11, 13], [3, 14], [14, 15], [15, 16], [16, 5], [16, 17], [17, 18], [18, 19],
  [19, 20], [18, 9], [15, 22], [22, 23], [23, 24], [17, 23], [20, 11],
]

export default function NodeBackground({ className = '' }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} viewBox="0 0 1280 760" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g stroke="#1e7be0" strokeOpacity="0.45" strokeWidth="1.2">
        {links.map(([a, b], i) => (
          <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />
        ))}
      </g>
      <g fill="#1a8cff">
        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4.5 : 3} opacity={0.85} />
        ))}
      </g>
    </svg>
  )
}

export function Waves({ className = '' }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-x-0 bottom-0 w-full ${className}`} viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden>
      <path d="M0 120 C 220 40, 420 60, 640 120 S 1100 200, 1440 90 L1440 220 L0 220 Z" fill="#0b4fae" opacity="0.55" />
      <path d="M0 160 C 260 90, 520 120, 760 170 S 1180 210, 1440 140 L1440 220 L0 220 Z" fill="#1578e6" opacity="0.7" />
    </svg>
  )
}
