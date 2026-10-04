import type { SVGProps } from "react";
import {
  plantIconLabel,
  type PlantIconId,
  type PlantIconVariantId,
} from "./plantAppearance";

function TulipDrawing({ variant = "pink" }: { variant?: PlantIconVariantId }) {
  const palettes: Record<string, [string, string, string]> = {
    pink: ["#ec9398", "#a45465", "#f3b4b7"],
    red: ["#dc554f", "#933a3d", "#ee7770"],
    purple: ["#9b72bd", "#674888", "#b997d0"],
    white: ["#f7f4e9", "#9d988c", "#ffffff"],
    yellow: ["#f2c84f", "#a87929", "#ffe07a"],
    littleBeauty: ["#d95291", "#873366", "#f27aad"],
  };
  const [fill, stroke, light] = palettes[variant] || palettes.pink;
  return (
    <>
      <path d="M32 59L32 30" />
      <path
        fill="#77a660"
        d="M31 55Q10 46 12 29Q26 36 31 55ZM33 56Q37 36 52 30Q51 50 33 56Z"
      />
      <path
        fill={fill}
        stroke={stroke}
        d="M17 10L27 18L32 7L38 18L48 10L46 27Q32 44 18 27Z"
      />
      <path d="M27 18L30 32M38 18L35 32" stroke={stroke} />
      {variant === "littleBeauty" && (
        <path
          fill="#e7e9f5"
          stroke="#565994"
          d="M24 27Q32 20 41 27Q38 36 32 38Q26 35 24 27Z"
        />
      )}
      {variant !== "littleBeauty" && (
        <path stroke={light} d="M21 15Q25 28 31 34" />
      )}
    </>
  );
}

function CrocusDrawing({ variant = "purple" }: { variant?: PlantIconVariantId }) {
  const palettes: Record<string, [string, string, string]> = {
    blue: ["#7f9ed8", "#4f679f", "#a9bde5"],
    white: ["#f7f5ec", "#99948c", "#ffffff"],
    purple: ["#aa8dcb", "#70599a", "#c1a5de"],
  };
  const [fill, stroke, light] = palettes[variant] || palettes.purple;
  return (
    <>
      <path
        fill="#739a60"
        d="M30 59Q12 47 15 27Q23 45 30 59ZM35 59Q43 36 54 28Q50 52 35 59Z"
      />
      <path d="M32 59L32 35" />
      <path
        fill={fill}
        stroke={stroke}
        d="M31 41Q13 39 14 14Q26 15 31 31Q31 8 39 6Q48 19 38 36Q47 21 53 20Q52 42 31 41Z"
      />
      <path
        fill={light}
        stroke={stroke}
        d="M31 41Q21 31 25 12Q35 17 35 34Q40 21 45 18Q48 35 31 41Z"
      />
      <path stroke="#e7ae42" strokeWidth="3" d="M32 35L31 23M33 34L37 26" />
    </>
  );
}

function HyacinthDrawing({ variant = "blue" }: { variant?: PlantIconVariantId }) {
  const apricot = variant === "apricot";
  const fill = apricot ? "#efa98d" : "#7896d2";
  const stroke = apricot ? "#b76d61" : "#4f68a0";
  return (
    <>
      <path d="M32 60L32 13" />
      <path
        fill="#70975b"
        d="M30 58Q11 48 15 29Q27 39 30 58ZM35 58Q41 35 53 28Q51 50 35 58Z"
      />
      {[
        [32, 10],
        [23, 17],
        [40, 18],
        [18, 27],
        [31, 27],
        [45, 28],
        [23, 38],
        [38, 39],
      ].map(([x, y], index) => (
        <path
          key={index}
          transform={`translate(${x} ${y})`}
          fill={fill}
          stroke={stroke}
          d="M0 0C-8 -7 -12 3 -5 7C-3 14 7 12 7 5C14 -2 5 -9 0 0Z"
        />
      ))}
    </>
  );
}

function RoseDrawing({ variant = "pink" }: { variant?: PlantIconVariantId }) {
  const palettes: Record<string, [string, string, string]> = {
    pink: ["#df7e94", "#95465d", "#ed9cac"],
    red: ["#cf4b52", "#84333e", "#e36a70"],
    white: ["#f7f3e8", "#999184", "#ffffff"],
    yellow: ["#efc74f", "#a67b2d", "#ffe17a"],
    apricot: ["#efa078", "#aa6650", "#f6bb95"],
  };
  const [fill, stroke, light] = palettes[variant] || palettes.pink;
  return (
    <>
      <path d="M31 58L32 32" />
      <path
        fill="#6e9d60"
        d="M31 49Q13 50 13 36Q29 34 31 49ZM33 53Q36 38 51 40Q51 53 33 53Z"
      />
      <path
        fill={fill}
        stroke={stroke}
        d="M17 29C7 19 16 7 26 10C34 1 45 7 45 15C59 17 52 32 45 34C34 45 20 38 17 29Z"
      />
      <path
        fill={light}
        stroke={stroke}
        d="M19 23Q20 12 33 14Q46 13 45 26Q41 37 29 33Q19 31 23 22Q29 16 36 21Q42 26 34 28L29 25"
      />
    </>
  );
}

// Original, local vector illustrations. No fonts, external images or user SVG.
const drawings: Record<PlantIconId, React.ReactNode> = {
  raspberry: (
    <>
      <path
        stroke="#886544"
        d="M29 60Q23 40 16 24M31 60Q40 43 47 24M31 57Q35 32 31 10"
      />
      <path
        fill="#739e5c"
        d="M29 23L20 21L14 12L20 11L25 6L30 14ZM33 25L36 13L43 8L44 14L50 18L42 23ZM19 37L8 34L4 25L12 25L16 20L20 29ZM39 40L43 29L52 25L53 31L60 35L49 40Z"
      />
      <path stroke="#4e7b48" strokeWidth="1.3" d="M28 21L21 13M35 23L43 16M18 35L10 28M41 38L52 32" />
      {[
        [17, 43],
        [35, 33],
        [48, 47],
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`} strokeWidth="1.2">
          <path fill="#739e5c" d="M-6 -7L-2 -10L0 -7L3 -10L7 -6L1 -4Z" />
          <path fill="#cd5269" stroke="#96394e" d="M-6 -5Q0 -9 6 -5Q10 0 5 5L1 9Q-2 11 -5 6Q-11 1 -6 -5Z" />
          {[
            [-3, -3],
            [3, -3],
            [-5, 1],
            [0, 1],
            [5, 1],
            [-2, 5],
            [2, 5],
          ].map(([cx, cy], index) => (
            <circle key={index} cx={cx} cy={cy} r="2.4" fill={index < 2 ? "#ec8191" : "#db6278"} stroke="#a64158" />
          ))}
        </g>
      ))}
    </>
  ),
  blueberry: (
    <>
      <path
        stroke="#886544"
        d="M29 60Q24 43 17 25M33 60Q42 42 48 22M31 58L31 12M31 39L43 31"
      />
      <path
        fill="#79a36b"
        d="M28 20Q14 20 15 8Q27 7 28 20ZM33 21Q33 8 46 7Q49 18 33 21ZM19 35Q5 36 5 24Q17 21 19 35ZM42 36Q44 22 57 22Q59 34 42 36ZM29 49Q13 51 12 41Q23 35 29 49Z"
      />
      <path stroke="#4e7b48" strokeWidth="1.3" d="M26 18L20 12M35 18L42 11M17 33L10 27M45 33L53 26M26 47L17 43" />
      {[
        [18, 29],
        [34, 30],
        [48, 40],
        [35, 49],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <circle r="7" fill="#6886bb" stroke="#435d8d" strokeWidth="1.5" />
          <path fill="#40577f" stroke="none" d="M0 -4L1 -1L4 -1L2 1L3 4L0 2L-3 4L-2 1L-4 -1L-1 -1Z" />
          <path stroke="#acc1e2" strokeWidth="1.5" d="M-4 -3Q-6 0 -4 3" />
        </g>
      ))}
    </>
  ),
  lobelia: (
    <>
      <path d="M31 59Q30 42 17 23M31 53Q43 41 46 24M31 48L33 16" />
      <path
        fill="#78a46a"
        d="M28 52Q11 55 10 43Q22 40 28 52ZM34 51Q49 40 55 46Q50 57 34 51Z"
      />
      {[
        [16, 23],
        [34, 15],
        [47, 30],
      ].map(([x, y]) => (
        <g
          key={x}
          transform={`translate(${x} ${y})`}
          fill="#728add"
          stroke="#4c64ae"
          strokeWidth="1.5"
        >
          <path d="M0 0C-10 -2 -11 -12 -5 -11Q0 -10 0 -3Q3 -14 8 -9Q12 -4 3 0C16 0 13 10 6 9C5 17 -5 16 -6 9C-15 12 -17 1 -6 0Z" />
          <path stroke="#f8f2d5" strokeWidth="2.5" d="M-4 3L0 1L4 3M0 1L0 6" />
        </g>
      ))}
    </>
  ),
  calendula: (
    <>
      <path d="M32 60L32 31" />
      <path
        fill="#83a15b"
        d="M31 53Q11 52 13 40Q28 39 31 53ZM33 46Q39 33 51 38Q50 49 33 46Z"
      />
      <g
        transform="translate(32 24)"
        fill="#efa940"
        stroke="#cc7929"
        strokeWidth="1.3"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse
            key={i}
            cx="0"
            cy="-10"
            rx="3.8"
            ry="10"
            transform={`rotate(${i * 30})`}
          />
        ))}
        <circle r="8" fill="#e9912e" />
        <circle r="4.5" fill="#a76730" stroke="none" />
        <path
          stroke="#f7cb64"
          strokeWidth="1.5"
          d="M-3 -2L-2 -2M2 -3L3 -2M-1 2L0 3M3 1L4 2"
        />
      </g>
    </>
  ),
  blueFescue: (
    <>
      <path stroke="#617f51" d="M32 60L32 36M32 51L18 43M32 48L47 40" />
      <path
        fill="#719b5b"
        d="M31 54Q13 56 10 46Q22 40 31 49ZM33 52Q43 38 55 43Q50 54 33 52Z"
      />
      {[
        [19, 29],
        [31, 19],
        [44, 29],
      ].map(([x, y]) => (
        <g
          key={x}
          transform={`translate(${x} ${y})`}
          fill="#9d85d3"
          stroke="#735ea9"
          strokeWidth="1.2"
        >
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <ellipse
              key={angle}
              cx="0"
              cy="-6"
              rx="3.5"
              ry="7"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle r="3.5" fill="#f0c95a" stroke="none" />
        </g>
      ))}
    </>
  ),
  sweetWilliam: (
    <>
      <path d="M32 60L32 26M32 40L19 24M32 37L47 23" />
      <path
        fill="#6a955e"
        d="M30 51Q14 50 10 38Q24 39 30 51ZM34 48Q42 35 54 37Q47 49 34 48Z"
      />
      {[
        [20, 16],
        [33, 12],
        [45, 17],
        [15, 28],
        [29, 26],
        [43, 29],
      ].map(([x, y], i) => (
        <g
          key={x}
          transform={`translate(${x} ${y})`}
          fill={i % 2 ? "#e58ca6" : "#c96086"}
          stroke="#a54d70"
          strokeWidth="1.2"
        >
          {[0, 72, 144, 216, 288].map((angle) => (
            <path
              key={angle}
              transform={`rotate(${angle})`}
              d="M0 0L-4 -4L-5 -8L-2 -7L0 -10L2 -7L5 -8L4 -4Z"
            />
          ))}
          <circle r="3" fill="#fbebd8" stroke="none" />
          <circle r="1.4" fill="#9c476a" stroke="none" />
        </g>
      ))}
    </>
  ),
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
  crocus: <CrocusDrawing />,
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
  rose: <RoseDrawing />,
  tulip: <TulipDrawing />,
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
  lettuce: (
    <>
      <path
        fill="#80ad66"
        d="M32 58C12 60 3 48 11 37C1 27 10 15 22 20C20 7 34 2 40 15C51 8 61 20 53 31C64 42 51 58 32 58Z"
      />
      <path
        fill="#a8c982"
        d="M31 52C17 55 10 45 18 37C9 28 21 20 28 28C27 15 40 13 43 25C54 26 52 40 43 41C44 51 36 54 31 52Z"
      />
      <path d="M31 54L32 25M31 43L20 35M33 39L43 30" />
    </>
  ),
  arugula: (
    <>
      <path
        fill="#659950"
        d="M31 59C28 48 22 45 14 41C8 38 9 32 16 32C9 26 12 19 20 22C15 14 21 8 27 15C30 20 31 34 31 59Z"
      />
      <path
        fill="#78a95a"
        d="M33 59C35 47 41 44 50 39C57 35 54 29 48 30C56 23 51 17 44 21C50 12 42 7 37 15C34 22 33 37 33 59Z"
      />
      <path
        fill="#8bb868"
        d="M32 57C27 47 18 47 19 39C20 34 25 35 27 32C20 29 22 23 28 24C25 17 29 11 33 17C39 11 42 18 38 25C45 24 46 31 39 34C44 38 41 44 35 43Z"
      />
      <path stroke="#406f42" d="M32 60L32 18M31 50L17 38M33 47L50 36M31 38L24 29M33 36L43 27" />
      <g transform="translate(33 12)" fill="#f8f5e9" stroke="#9a946e">
        {[0, 90, 180, 270].map((angle) => (
          <ellipse
            key={angle}
            cx="0"
            cy="-5"
            rx="3"
            ry="5"
            transform={`rotate(${angle})`}
          />
        ))}
        <circle r="2" fill="#d5b34f" stroke="none" />
      </g>
    </>
  ),
  baikal: (
    <>
      <path
        fill="#5e9455"
        d="M29 49Q17 37 12 15Q17 16 21 27Q26 39 32 47ZM36 49Q43 30 53 13Q56 16 51 27Q45 41 39 50Z"
      />
      <path
        fill="#77aa62"
        d="M31 49Q24 30 27 5Q29 2 31 8Q32 25 35 48ZM35 49Q36 22 44 6Q47 3 45 12Q41 31 39 50Z"
      />
      <path
        fill="#8ab96c"
        d="M30 49Q20 29 21 10Q24 9 25 19Q27 33 34 48ZM38 50Q47 37 48 23Q51 22 50 31Q47 44 41 51Z"
      />
      <path
        fill="#f0ead6"
        stroke="#a79a75"
        d="M29 45Q25 48 26 53Q27 59 33 59Q40 59 41 53Q41 48 36 45Z"
      />
      <path
        stroke="#c8bc95"
        d="M32 47Q29 53 32 58M36 47Q39 53 36 58"
      />
      <path stroke="#a79a75" d="M30 59L27 63M34 59L34 64M38 59L41 63" />
    </>
  ),
  hyacinth: <HyacinthDrawing />,
  grapeHyacinth: (
    <>
      <path d="M32 60L32 15" />
      <path
        fill="#729b5b"
        d="M30 59Q11 49 15 29Q27 40 30 59ZM35 59Q40 36 52 28Q50 51 35 59Z"
      />
      {[
        [32, 12],
        [26, 18],
        [38, 19],
        [23, 26],
        [33, 27],
        [42, 28],
        [27, 35],
        [37, 36],
        [32, 44],
      ].map(([x, y], index) => (
        <path
          key={index}
          fill={index < 3 ? "#829ddd" : "#647fc4"}
          stroke="#485f9c"
          d={`M${x - 5} ${y - 4}Q${x} ${y - 9} ${x + 5} ${y - 4}L${x + 3} ${y + 4}Q${x} ${y + 7} ${x - 3} ${y + 4}Z`}
        />
      ))}
    </>
  ),
};

export function PlantIcon({
  icon,
  variant,
  ...props
}: SVGProps<SVGSVGElement> & {
  icon: PlantIconId;
  variant?: PlantIconVariantId;
}) {
  const drawing =
    icon === "tulip" ? (
      <TulipDrawing variant={variant} />
    ) : icon === "rose" ? (
      <RoseDrawing variant={variant} />
    ) : icon === "crocus" ? (
      <CrocusDrawing variant={variant} />
    ) : icon === "hyacinth" ? (
      <HyacinthDrawing variant={variant} />
    ) : (
      drawings[icon]
    );
  return (
    <svg
      viewBox="0 0 64 64"
      width="32"
      height="32"
      role="img"
      aria-label={plantIconLabel(icon, variant)}
      {...props}
    >
      <g
        fill="none"
        stroke="#426c45"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawing}
      </g>
    </svg>
  );
}
