import type { SVGProps } from "react";
import { plantIcons, type PlantIconId } from "./plantAppearance";

// Original, local vector illustrations. No fonts, external images or user SVG.
const drawings: Record<PlantIconId, React.ReactNode> = {
  chard: (
    <>
      <path
        fill="#518954"
        d="M30 47C11 48 5 36 11 28C2 16 17 9 24 15C24 2 40 3 43 14C57 9 62 23 53 29C60 41 45 49 30 47Z"
      />
      <path
        stroke="#d57581"
        strokeWidth="4"
        d="M29 59L32 17M31 39L17 30M32 29L43 20M30 47L45 36"
      />
    </>
  ),
  yellowOnion: (
    <>
      <path fill="#78a25d" d="M28 29L21 6L27 5L33 24L36 5L42 7L36 30Z" />
      <path
        fill="#e5b964"
        stroke="#a87d3c"
        d="M28 26C26 34 10 32 11 45C12 60 51 61 53 45C55 34 38 33 36 26Z"
      />
      <path
        stroke="#bc914f"
        d="M29 30Q18 48 28 55M35 30Q45 48 36 55M32 31L32 55M28 58L25 62M33 58L33 62M37 57L41 61"
      />
    </>
  ),
  redOnion: (
    <>
      <path fill="#78a25d" d="M28 29L21 6L27 5L33 24L36 5L42 7L36 30Z" />
      <path
        fill="#b5688e"
        stroke="#804263"
        d="M28 26C26 34 10 32 11 45C12 60 51 61 53 45C55 34 38 33 36 26Z"
      />
      <path
        stroke="#e0a1bd"
        d="M29 30Q18 48 28 55M35 30Q45 48 36 55M32 31L32 55"
      />
      <path stroke="#804263" d="M28 58L25 62M33 58L33 62M37 57L41 61" />
    </>
  ),
  rosemary: (
    <>
      <path stroke="#93704c" d="M29 59L34 7M31 43L15 18M32 49L49 23" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} stroke="#68936f" strokeWidth="3">
          <path d={`M${33 - i} ${14 + i * 9}l-8 -7m8 7l8 -6`} />
          <path
            d={`M${19 + i * 3} ${25 + i * 5}l-8 -2M${46 - i * 3} ${29 + i * 5}l8 -2`}
          />
        </g>
      ))}
    </>
  ),
  potato: (
    <>
      <path
        fill="#c7a16c"
        stroke="#8d704c"
        d="M6 39C7 26 22 16 34 24C46 32 34 53 22 56C10 59 3 50 6 39Z"
      />
      <path
        fill="#d9b580"
        stroke="#8d704c"
        d="M29 25C27 12 43 8 53 19C63 30 58 46 49 49C36 51 31 39 29 25Z"
      />
      <g fill="#94744f" stroke="none">
        <ellipse cx="14" cy="41" rx="2" ry="1.5" />
        <ellipse cx="23" cy="31" rx="2" ry="1.5" />
        <ellipse cx="24" cy="49" rx="2" ry="1.5" />
        <ellipse cx="40" cy="21" rx="2" ry="1.5" />
        <ellipse cx="49" cy="32" rx="2" ry="1.5" />
        <ellipse cx="40" cy="40" rx="2" ry="1.5" />
      </g>
    </>
  ),
  peas: (
    <>
      <path d="M45 15Q38 5 46 4Q54 4 50 10" />
      <path fill="#77a85d" d="M46 12C24 13 4 34 8 54C30 59 54 34 46 12Z" />
      <path fill="#b5ce80" d="M44 17Q25 24 13 50Q38 45 44 17Z" />
      {[
        [37, 24],
        [29, 34],
        [20, 44],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="6" fill="#91b860" />
      ))}
    </>
  ),
  oleander: (
    <>
      <path d="M32 59L32 27M32 45L15 29M32 40L51 23" />
      <path
        fill="#698c5b"
        d="M30 52Q6 50 6 39Q22 39 30 52ZM34 50Q40 30 56 33Q47 45 34 50Z"
      />
      {[
        [19, 22],
        [42, 18],
      ].map(([x, y]) => (
        <g
          key={x}
          transform={`translate(${x} ${y})`}
          fill="#efa7b4"
          stroke="#b66b83"
        >
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-6"
              rx="4.5"
              ry="7"
              transform={`rotate(${a})`}
            />
          ))}
          <circle r="3" fill="#ebcc77" />
        </g>
      ))}
    </>
  ),
  peony: (
    <>
      <path d="M32 59L32 34" />
      <path
        fill="#6a955b"
        d="M30 53L13 50L9 40L20 41L22 35L31 47ZM34 53L50 50L55 40L44 41L42 35L34 47Z"
      />
      <g fill="#e59eae" stroke="#b66c89">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse
            key={a}
            cx="32"
            cy="18"
            rx="10"
            ry="13"
            transform={`rotate(${a} 32 25)`}
          />
        ))}
        <path
          fill="#f4c1c9"
          d="M19 24Q16 13 28 15Q36 7 40 18Q51 20 41 29Q40 40 31 34Q20 38 19 24Z"
        />
        <path fill="#edb0bd" d="M25 24Q24 17 32 20Q39 16 39 25Q36 32 28 29Z" />
      </g>
    </>
  ),
  crocus: (
    <>
      <path
        fill="#739a60"
        d="M30 59Q12 47 15 27Q23 45 30 59ZM35 59Q43 36 54 28Q50 52 35 59Z"
      />
      <path d="M32 59L32 35" />
      <path
        fill="#aa8dcb"
        stroke="#70599a"
        d="M31 41Q13 39 14 14Q26 15 31 31Q31 8 39 6Q48 19 38 36Q47 21 53 20Q52 42 31 41Z"
      />
      <path
        fill="#c1a5de"
        stroke="#70599a"
        d="M31 41Q21 31 25 12Q35 17 35 34Q40 21 45 18Q48 35 31 41Z"
      />
      <path stroke="#e7ae42" strokeWidth="3" d="M32 35L31 23M33 34L37 26" />
    </>
  ),
  oregano: (
    <>
      <path d="M30 55 Q35 35 28 10 M32 39L17 29 M32 29L46 19" />
      <path
        fill="#7cae61"
        d="M29 22Q12 24 14 9Q28 7 29 22ZM33 34Q35 16 49 20Q51 35 33 34ZM30 43Q10 45 12 30Q29 28 30 43ZM31 50Q36 35 49 40Q46 53 31 50Z"
      />
      <circle cx="28" cy="9" r="4" fill="#dba2bf" />
    </>
  ),
  lavender: (
    <>
      <path d="M31 58L31 14M29 57L17 22M34 57L46 18" />
      <path
        fill="#779962"
        d="M31 53Q16 49 15 39Q27 41 31 53ZM33 49Q45 38 50 40Q47 51 33 49Z"
      />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} fill={i % 2 ? "#b394dd" : "#8d69be"}>
          <ellipse cx="31" cy={10 + i * 7} rx="5" ry="4" />
          <ellipse cx={15 + i * 2} cy={20 + i * 6} rx="4" ry="3.5" />
          <ellipse cx={48 - i * 2} cy={16 + i * 6} rx="4" ry="3.5" />
        </g>
      ))}
    </>
  ),
  spinach: (
    <>
      <path fill="#619b57" d="M31 53C2 45 7 21 17 13C29 15 33 30 31 53Z" />
      <path fill="#8ab66a" d="M31 53C19 29 25 9 36 6C52 14 47 37 31 53Z" />
      <path fill="#4f8850" d="M31 53C32 27 47 22 55 24C60 43 46 52 31 53Z" />
      <path d="M31 59L35 17M30 51L18 26M34 51L48 33" />
    </>
  ),
  cornflower: (
    <>
      <path d="M31 59L32 30M32 49L19 40" />
      <path fill="#739b60" d="M31 50Q40 34 49 38Q42 49 31 50Z" />
      <path
        fill="#739ade"
        stroke="#435b99"
        d="M32 8L36 17L43 10L43 21L54 19L47 28L55 33L44 36L46 46L35 40L30 49L26 39L15 44L18 33L8 29L19 24L14 15L25 19Z"
      />
      <circle cx="32" cy="29" r="7" fill="#4e559f" />
    </>
  ),
  rose: (
    <>
      <path d="M31 58L32 32" />
      <path
        fill="#6e9d60"
        d="M31 49Q13 50 13 36Q29 34 31 49ZM33 53Q36 38 51 40Q51 53 33 53Z"
      />
      <path
        fill="#df7e94"
        stroke="#95465d"
        d="M17 29C7 19 16 7 26 10C34 1 45 7 45 15C59 17 52 32 45 34C34 45 20 38 17 29Z"
      />
      <path
        fill="#ed9cac"
        stroke="#95465d"
        d="M19 23Q20 12 33 14Q46 13 45 26Q41 37 29 33Q19 31 23 22Q29 16 36 21Q42 26 34 28L29 25"
      />
    </>
  ),
  tulip: (
    <>
      <path d="M32 59L32 30" />
      <path
        fill="#77a660"
        d="M31 55Q10 46 12 29Q26 36 31 55ZM33 56Q37 36 52 30Q51 50 33 56Z"
      />
      <path
        fill="#ec9398"
        stroke="#a45465"
        d="M17 10L27 18L32 7L38 18L48 10L46 27Q32 44 18 27Z"
      />
      <path d="M27 18L30 32M38 18L35 32" stroke="#a45465" />
    </>
  ),
  pumpkin: (
    <>
      <path
        fill="#658d4d"
        d="M30 20L29 9L36 7L36 20M36 15Q50 5 53 15Q51 22 44 17"
      />
      <ellipse
        cx="32"
        cy="38"
        rx="25"
        ry="19"
        fill="#e99740"
        stroke="#9e6239"
      />
      <ellipse
        cx="32"
        cy="38"
        rx="16"
        ry="19"
        fill="#f3ae4e"
        stroke="#b27637"
      />
      <ellipse cx="32" cy="38" rx="7" ry="19" fill="#f8bb61" stroke="#b27637" />
    </>
  ),
  zucchini: (
    <>
      <path
        fill="#59864b"
        d="M16 51Q3 45 12 33L39 13Q49 7 55 16Q61 25 48 33L25 52Q20 55 16 51Z"
      />
      <path stroke="#b4c477" d="M16 44L46 19M22 47L50 23" />
      <path fill="#87a666" d="M42 13L45 6L53 9L51 17Z" />
      <path fill="#f3c35b" stroke="#a48539" d="M11 35L5 30L5 39L10 44Z" />
    </>
  ),
  carrot: (
    <>
      <path
        fill="#ee9a4b"
        stroke="#a66338"
        d="M22 23Q35 16 44 28Q36 45 14 58Q16 40 22 23Z"
      />
      <path stroke="#b4713e" d="M21 33L29 36M19 43L25 46M33 29L39 32" />
      <path
        fill="#79a45b"
        d="M30 23Q17 13 23 7Q31 8 32 20Q30 3 39 5Q43 12 35 23Q47 8 53 15Q50 25 36 26Z"
      />
    </>
  ),
  tomato: (
    <>
      <path
        fill="#de7567"
        stroke="#a44f42"
        d="M32 23C9 13 2 36 14 49C25 61 44 57 53 44C63 26 44 15 32 23Z"
      />
      <path
        fill="#7b9d56"
        d="M32 24L20 17L26 26L15 29L29 31L34 39L37 29L49 25L37 23L36 15Z"
      />
      <path d="M32 23Q28 9 37 6" />
      <path d="M17 35Q13 42 20 47" stroke="#f5b19a" strokeWidth="3" />
    </>
  ),
};

export function PlantIcon({
  icon,
  ...props
}: SVGProps<SVGSVGElement> & { icon: PlantIconId }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="32"
      height="32"
      role="img"
      aria-label={plantIcons[icon]}
      {...props}
    >
      <g
        fill="none"
        stroke="#426c45"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawings[icon]}
      </g>
    </svg>
  );
}
