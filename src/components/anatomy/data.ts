/*
 * Everything the anatomy page says, with where it comes from. Coordinates are
 * in the pixel space of the Vitruvian Man scan at 960 × 1305, measured against
 * Leonardo's own circle and square.
 */

export const SHEET = {
  w: 960,
  h: 1305,
  src: "https://commons.wikimedia.org/wiki/Special:FilePath/Da_Vinci_Vitruve_Luc_Viatour.jpg?width=1200",
  href: "https://commons.wikimedia.org/wiki/File:Da_Vinci_Vitruve_Luc_Viatour.jpg",
  holder: "Gallerie dell’Accademia, Venice",
};

// Leonardo's square (soles to crown, fingertip to fingertip) and circle.
export const SQ = { x: 140, y: 285, w: 682, h: 667 };
export const CIRCLE = { cx: 480, cy: 548, r: 412 };
export const GROIN = { x: 481, y: 618 };

export type Rule = {
  id: string;
  title: string;
  /** What the rule says, and whose it is. */
  text: string;
  by: string;
  /** The overlay drawn on the sheet: SVG path data in sheet pixels. */
  paths: string[];
  /** Points to mark. */
  dots?: [number, number][];
};

const sq = `M${SQ.x} ${SQ.y}h${SQ.w}v${SQ.h}h${-SQ.w}Z`;
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const H = SQ.h;

export const RULES: Rule[] = [
  {
    id: "square",
    title: "As wide as he is tall",
    text: "Measure from the soles of the feet to the top of the head, then across the outstretched arms: the two are the same, so a man fits a square.",
    by: "Vitruvius, De architectura, Book III",
    paths: [sq, `M147 398H816`, `M${SQ.x + SQ.w + 30} ${SQ.y}V${SQ.y + SQ.h}`],
    dots: [
      [147, 398],
      [816, 398],
    ],
  },
  {
    id: "circle",
    title: "The navel is the centre",
    text: "Lay a man on his back with his hands and feet spread, put a compass point on his navel, and his fingers and toes touch the circle.",
    by: "Vitruvius, De architectura, Book III",
    paths: [circle(CIRCLE.cx, CIRCLE.cy, CIRCLE.r), `M${CIRCLE.cx} ${CIRCLE.cy}L172 292`, `M${CIRCLE.cx} ${CIRCLE.cy}L272 885`],
    dots: [
      [CIRCLE.cx, CIRCLE.cy],
      [172, 292],
      [790, 288],
      [272, 885],
      [690, 880],
    ],
  },
  {
    id: "centres",
    title: "Two shapes, two centres",
    text: "Earlier drawings tried to centre the square and the circle on the navel and could not make it work. Leonardo centred the circle on the navel and the square on the genitals, and set the two poses one over the other.",
    by: "Leonardo’s own solution",
    paths: [
      `M${SQ.x} ${SQ.y}L${SQ.x + SQ.w} ${SQ.y + SQ.h}M${SQ.x + SQ.w} ${SQ.y}L${SQ.x} ${SQ.y + SQ.h}`,
      `M${CIRCLE.cx} ${CIRCLE.cy - 40}V${CIRCLE.cy + 40}M${CIRCLE.cx - 40} ${CIRCLE.cy}H${CIRCLE.cx + 40}`,
    ],
    dots: [
      [GROIN.x, GROIN.y],
      [CIRCLE.cx, CIRCLE.cy],
    ],
  },
  {
    id: "head",
    title: "The head is an eighth",
    text: "From the chin to the crown of the head is an eighth of a man’s height. The ruler beside him is divided into eighths: the first one ends at his chin.",
    by: "Vitruvius, De architectura, Book III",
    paths: [
      `M${SQ.x + SQ.w + 30} ${SQ.y}V${SQ.y + H}` + Array.from({ length: 9 }, (_, i) => `M${SQ.x + SQ.w + 20} ${SQ.y + (H * i) / 8}h20`).join(""),
      `M400 ${SQ.y}H${SQ.x + SQ.w + 30}M400 ${SQ.y + H / 8}H${SQ.x + SQ.w + 30}`,
    ],
  },
  {
    id: "shoulders",
    title: "The shoulders are a quarter",
    text: "The broadest width of the shoulders is a quarter of the height. The bar across his shoulders is drawn a quarter as long as the side of the square.",
    by: "Vitruvius, De architectura, Book III",
    paths: [`M${GROIN.x - H / 8} 415H${GROIN.x + H / 8}`, `M${SQ.x - 30} ${SQ.y}V${SQ.y + H / 4}M${SQ.x - 40} ${SQ.y}h20M${SQ.x - 40} ${SQ.y + H / 4}h20`],
  },
];

export type Source = { label: string; href: string };

export type Study = {
  id: string;
  title: string;
  italian: string;
  date: string;
  /** Where to put its marker on the Vitruvian figure, if it has one. */
  at?: [number, number];
  scan: { src: string; href: string; caption: string; holder: string };
  shows: string;
  right: string;
  wrong?: string;
  since?: string;
  sources: Source[];
};

const commons = (file: string, width = 1200) => ({
  src: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`,
  href: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`,
});

const RCT = "Royal Collection Trust, Windsor";

export const STUDIES: Study[] = [
  {
    id: "skull",
    title: "The skull",
    italian: "Il cranio",
    date: "1489",
    at: [481, 318],
    scan: {
      ...commons("Leonardo da Vinci - RCIN 919058, Verso The skull sectioned 1489.jpg"),
      caption: "The skull sectioned, 1489 (RCIN 919058, verso).",
      holder: RCT,
    },
    shows:
      "Among his earliest anatomy, two decades before his great dissections. He drew the skull sawn open and set it where three lines at right angles meet, front to back, top to bottom and side to side, a way of locating what lies inside.",
    right: "Treating the head as a space you can map with a grid. A sheet from the same set opens with the note “On the 2nd day of April 1489”.",
    sources: [
      { label: "Royal Collection, RCIN 919058", href: "https://col.rct.uk/collection/919058/recto-the-cranium-sectioned-verso-the-skull-sectioned" },
      { label: "Royal Collection, RCIN 919057", href: "https://www.rct.uk/collection/919057" },
      { label: "Royal Collection, RCIN 919059", href: "https://rct.uk/collection/919059/recto-the-cranium-verso-notes-on-topics-to-be-investigated" },
    ],
  },
  {
    id: "shoulder",
    title: "The shoulder and arm",
    italian: "La spalla",
    date: "c. 1510–11",
    at: [566, 425],
    scan: {
      ...commons("Leonardo da Vinci - RCIN 919008, Verso The muscles of the shoulder, arm and neck c.1510-11.jpg"),
      caption: "The muscles of the shoulder, arm and neck, c. 1510–11 (RCIN 919008, verso).",
      holder: RCT,
    },
    shows:
      "With the sheet beside it, eight drawings turn the same shoulder from the front all the way round to the back, as if it were on a turntable.",
    right: "Every surface muscle of the shoulder and upper arm can be identified.",
    wrong: "A few quirks, such as splitting the deltoid over the shoulder into separate pieces.",
    sources: [{ label: "Royal Collection, RCIN 919008", href: "https://www.rct.uk/collection/919008" }],
  },
  {
    id: "spine",
    title: "The spine",
    italian: "La spina",
    date: "c. 1510–11",
    at: [481, 505],
    scan: {
      // Commons has the two sides of this sheet swapped: the photo filed as the
      // recto ("surface anatomy of the shoulder and arm") is the spine.
      ...commons("Leonardo da Vinci - RCIN 919007, Recto The surface anatomy of the shoulder and arm.jpg"),
      caption: "The vertebral column, c. 1510–11 (RCIN 919007, verso). On Wikimedia Commons this photo is filed under the other side’s title.",
      holder: RCT,
    },
    shows: "The whole column drawn from the front, the side and behind, with its sections and its curves.",
    right: "The Royal Collection calls it the first accurate depiction of the spine in history: its distinct sections and curvatures are all correct.",
    wrong: "He gives twelve thoracic vertebrae, correctly, but thirteen spines: one spine has no vertebra beneath it.",
    sources: [{ label: "Royal Collection, RCIN 919007", href: "https://www.rct.uk/collection/919007/recto-the-surface-anatomy-of-the-shoulder-and-arm-verso-the-vertebral-column" }],
  },
  {
    id: "heart",
    title: "The heart’s valve",
    italian: "Il cuore",
    date: "c. 1512–13",
    at: [508, 455],
    scan: {
      ...commons("Leonardo da Vinci - RCIN 919082, The aortic valve c.1512-13.jpg"),
      caption: "The aortic valve, c. 1512–13 (RCIN 919082).",
      holder: RCT,
    },
    shows: "Studies of the valve where blood leaves the heart, with small curling eddies drawn in the pouches behind its cusps.",
    right: "He watched flow through a model of the valve and concluded that the swirling eddies in those pouches help the valve close.",
    since:
      "In 2014 an Oxford team used 4D MRI on living hearts and saw the vortices where he had drawn them: “Flow vortices in the aortic root: in vivo 4D-MRI confirms predictions of Leonardo da Vinci”, European Heart Journal.",
    sources: [
      { label: "Royal Collection, the aortic valve", href: "https://rct.uk/collection/exhibitions/leonardo-da-vinci/the-queens-gallery-palace-of-holyroodhouse/the-aortic-valve" },
      { label: "Bissell et al., 2014", href: "https://ora.ox.ac.uk/objects/uuid:1a9e3be1-9102-4975-8613-3c26a71b6884" },
    ],
  },
  {
    id: "womb",
    title: "The child in the womb",
    italian: "Il feto",
    date: "c. 1511",
    scan: {
      ...commons("Leonardo da Vinci - Studies of the foetus in the womb.jpg"),
      caption: "The fetus in the womb, c. 1511 (RCIN 919102).",
      holder: RCT,
    },
    shows: "A child curled inside the opened womb, with smaller sketches and notes on reproduction around it.",
    right: "He is credited as the first to draw the fetus in its correct position in the womb.",
    wrong:
      "The placenta is drawn as many separate pieces, the way he had seen it in a cow. He never found that the human placenta is a single disc.",
    sources: [
      { label: "Royal Collection, RCIN 919102", href: "https://www.rct.uk/collection/919102" },
      { label: "Embryo Project, Arizona State University", href: "https://embryo.asu.edu/pages/leonardo-da-vincis-embryological-drawings-fetus" },
    ],
  },
];

export const CONTEXT_SOURCES: Source[] = [
  { label: "Nature: Leonardo’s anatomy", href: "https://www.nature.com/articles/484314a" },
  { label: "Royal Collection: Leonardo’s study of anatomy", href: "https://www.rct.uk/collection/stories/leonardo-in-the-royal-collection/leonardos-study-of-anatomy" },
  { label: "Wikipedia: Vitruvian Man", href: "https://en.wikipedia.org/wiki/Vitruvian_Man" },
  // The bones of the 3D skull and spine (Folios II and III): a modern model, reduced for the web.
  { label: "BodyParts3D, © The Database Center for Life Science, CC Attribution-Share Alike 2.1 Japan (3D skeleton, skull, spine, heart, shoulder and arm; meshes from the Kevin-Mattheus-Moerman/BodyParts3D mirror, simplified for the web)", href: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" },
];
