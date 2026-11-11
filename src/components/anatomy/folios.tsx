"use client";

import dynamic from "next/dynamic";
import type { ExhibitData } from "@/components/Exhibit";
import { HeartValve } from "./drawings/HeartValve";
import { Skull } from "./drawings/Skull";
import { Spine } from "./drawings/Spine";
import { Vitruvian } from "./drawings/Vitruvian";
import { SHEET, STUDIES } from "./data";

// The 3D room is heavy (three.js and the bone meshes), so it loads only when opened.
const ExploreSkull = dynamic(() => import("./skull3d/SkullRoom"), { ssr: false });
const ExploreSpine = dynamic(() => import("./spine3d/SpineRoom"), { ssr: false });
const ExploreBody = dynamic(() => import("./body3d/BodyRoom"), { ssr: false });
const ExploreHeart = dynamic(() => import("./heart3d/HeartRoom"), { ssr: false });

const scanOf = (id: string) => {
  const s = STUDIES.find((x) => x.id === id)!;
  return { src: s.scan.src, caption: s.scan.caption, holder: s.scan.holder, href: s.scan.href };
};

/*
 * The anatomy folios, in the same form as the machines: our ink drawing that
 * draws itself as you scroll, a caption in his manner (ours, and marked so),
 * his real sheet one click away, and a verdict: was he right?
 */
export const FOLIOS: ExhibitData[] = [
  {
    numeral: "I",
    title: "The Vitruvian Man",
    italian: "L’uomo vitruviano",
    year: "c. 1490",
    source: "Leonardo’s own lines, traced from the Vitruvian Man (Gallerie dell’Accademia, Venice) and redrawn stroke by stroke; the red measurements are ours.",
    note: "Il cerchio ha il centro nell’ombelico",
    noteEn: "“The circle has its centre at the navel.”",
    quote: { by: "ours" },
    drawingLabel: "His lines, redrawn",
    scan: {
      src: SHEET.src,
      caption: "The Vitruvian Man, c. 1490. Pen and ink on paper, 34.4 × 25.5 cm.",
      holder: `${SHEET.holder}`,
      href: SHEET.href,
    },
    body: "A Roman architect, Vitruvius, wrote that a well-made man fits both a circle and a square. Others had tried to draw it and failed. Leonardo made it work by drawing the man twice, in two poses, with a different centre for each shape.",
    steps: ["His lines return, stroke by stroke", "The circle, centred on the navel", "The square, centred lower down"],
    Machine: Vitruvian,
    Explore: ExploreBody,
    verdict: {
      question: "Was he right?",
      answer: "An ideal, not a man",
      tone: "maybe",
      why: "These are the ideal proportions Vitruvius described, refined by Leonardo’s own measuring, not a rule every body follows. Real people vary.",
      right: "The geometry. Earlier drawings centred both shapes on the navel and could not make it fit; he centred the circle on the navel and the square on the genitals.",
    },
  },
  {
    numeral: "II",
    title: "The Skull",
    italian: "Il cranio",
    year: "1489",
    source: "Leonardo’s own lines, traced from the skull sectioned (Royal Collection, RCIN 919058, verso) and redrawn stroke by stroke; the red notes are ours.",
    note: "Mezzo il capo è segato, per vedere dentro",
    noteEn: "“Half the head is sawn away, to see inside.”",
    quote: { by: "ours" },
    drawingLabel: "His lines, redrawn",
    scan: scanOf("skull"),
    body: "Among his earliest anatomy, two decades before his great dissections: the skull from the front, its left half cut away down the middle to show the hollows behind the face, the eye and the cheek. On a sheet from the same set he placed a skull where three lines at right angles meet, a way of locating what lies inside.",
    steps: ["His lines return, stroke by stroke", "The midline between the halves", "The hollows behind the face"],
    Machine: Skull,
    Explore: ExploreSkull,
    verdict: {
      question: "Was he right?",
      answer: "A first step",
      tone: "maybe",
      why: "These sheets come long before his real dissections of 1510–11. The skull is where he started, treating the head as a space to be measured like a building.",
      right: "Mapping the inside of the head with a grid. A sheet from the same set opens with the note “On the 2nd day of April 1489”.",
    },
  },
  {
    numeral: "III",
    title: "The Spine",
    italian: "La spina",
    year: "c. 1510–11",
    source: "Leonardo’s own lines, traced from the vertebral column (Royal Collection, RCIN 919007, verso) and redrawn stroke by stroke; the red brackets are ours.",
    note: "La spina ha quattro piegature",
    noteEn: "“The spine has four bends.”",
    quote: { by: "ours" },
    drawingLabel: "His lines, redrawn",
    scan: scanOf("spine"),
    body: "The column from the side and from the front: seven vertebrae of the neck, twelve of the back, five of the loins, then the fused sacrum. His own letters down the side mark where each region ends.",
    steps: ["His lines return, stroke by stroke", "Neck, back, loins and sacrum", "His one slip: a spine too many"],
    Machine: Spine,
    Explore: ExploreSpine,
    verdict: {
      question: "Was he right?",
      answer: "Yes",
      tone: "yes",
      why: "The Royal Collection calls it the first accurate depiction of the spine in history: its sections and curvatures are all correct.",
      right: "The S-shaped curve and the count of vertebrae. His one slip, in the upper back: twelve vertebrae, but thirteen spines.",
    },
  },
  {
    numeral: "IV",
    title: "The Heart’s Valve",
    italian: "La valvola del cuore",
    year: "c. 1512–13",
    source: "Leonardo’s own lines, traced from his studies of the aortic valve (Royal Collection, RCIN 919082) and redrawn stroke by stroke; the turning eddies are ours, set on his.",
    note: "Il sangue che esce si rivolge nel seno e serra la porta",
    noteEn: "“The blood that leaves turns back in the pouch and shuts the door.”",
    quote: { by: "ours" },
    drawingLabel: "His lines, redrawn",
    scan: scanOf("heart"),
    body: "Where blood leaves the heart, three cusps open and close. Leonardo watched flow through a model of the valve and saw the blood curl into eddies in the pouches behind the cusps, and reasoned that those eddies help the valve shut.",
    steps: ["His lines return, stroke by stroke", "The eddies he drew begin to turn", "Where they help the valve shut"],
    Machine: HeartValve,
    Explore: ExploreHeart,
    verdict: {
      question: "Was he right?",
      answer: "Yes",
      tone: "yes",
      why: "Five centuries later, imaging of living hearts showed the eddies in the aortic root where he had drawn them.",
      right: "That swirling blood in the sinuses plays a part in closing the valve.",
      test: "In 2014 an Oxford team used 4D MRI on living hearts: “Flow vortices in the aortic root: in vivo 4D-MRI confirms predictions of Leonardo da Vinci”, European Heart Journal.",
      testSource: { label: "Bissell et al., 2014", href: "https://ora.ox.ac.uk/objects/uuid:1a9e3be1-9102-4975-8613-3c26a71b6884" },
    },
  },
];
