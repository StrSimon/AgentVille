import { Container, FillGradient, Graphics } from 'pixi.js';
import type { Activity, Source } from '../types';
import { hash, shade } from './iso';

export type Tool = 'hammer' | 'book' | 'quill' | 'sword' | 'scroll' | 'pickaxe' | 'flask' | 'spyglass' | 'letter' | 'staff' | 'orb' | 'none';

export const TOOL_FOR: Record<Activity, Tool> = {
  coding: 'hammer', writing: 'quill', researching: 'book', browsing: 'spyglass', testing: 'sword',
  debugging: 'flask', planning: 'scroll', delegating: 'scroll', reviewing: 'spyglass', committing: 'letter',
  installing: 'pickaxe', deploying: 'staff', remembering: 'orb', waiting: 'none', idle: 'none',
};

const SKINS = [0xf2c9a0, 0xe0ac7e, 0xc68863, 0x9c6644, 0xf5d7b8];
const BEARDS = [0xb45309, 0x7c2d12, 0x52525b, 0xe5e7eb, 0xd97706, 0x3f2a1d, 0xfacc15, 0x9a3412];
const TUNIC: Record<Source, number[]> = {
  claude: [0xc2410c, 0xb45309, 0x9a3412, 0xd97757],
  codex: [0x047857, 0x0f766e, 0x15803d, 0x0e7490],
  custom: [0x1d4ed8, 0x4338ca, 0x0369a1, 0x6d28d9],
};

export interface DwarfParts {
  root: Container;
  body: Container;
  legL: Graphics; legR: Graphics;
  torso: Graphics;
  armBack: Graphics; armFront: Graphics;
  head: Container;
  mouth: Graphics;
  tools: Record<Tool, Graphics>;
  shadow: Graphics;
  ring: Graphics;
}

function drawTool(tool: Tool): Graphics {
  const g = new Graphics();
  switch (tool) {
    case 'hammer': g.rect(-1, 0, 2, 12).fill(0x7a5236); g.rect(-4.5, 10, 9, 5).fill(0x6b7280); break;
    case 'pickaxe': g.rect(-1, 0, 2, 13).fill(0x7a5236); g.poly([-7, 12, 0, 10, 7, 12, 0, 14]).fill(0x9ca3af); break;
    case 'sword': g.rect(-3, 2, 6, 1.6).fill(0xd4a558); g.rect(-0.9, 3, 1.8, 13).fill(0xe5e7eb); break;
    case 'book': g.rect(-5, 4, 10, 8).fill(0x7c3aed); g.rect(-4, 5, 8, 6).fill(0xf5ecd6); g.rect(-0.4, 4, 0.8, 8).fill(0x5b21b6); break;
    case 'quill': g.poly([0, 0, 3, 12, 1, 12]).fill(0xf5f5f4); g.rect(-5, 9, 6, 5).fill(0xf5ecd6); break;
    case 'scroll': g.rect(-5, 5, 10, 7).fill(0xf5ecd6); g.circle(-5, 8.5, 2).fill(0xd6c39a); g.circle(5, 8.5, 2).fill(0xd6c39a); break;
    case 'flask': g.circle(0, 10, 4).fill(0x84cc16); g.rect(-1, 3, 2, 4).fill(0xe5e7eb); break;
    case 'spyglass': g.rect(-1.6, -2, 3.2, 14).fill(0xd4a558); g.rect(-2, 10, 4, 3).fill(0x92400e); break;
    case 'letter': g.rect(-5, 6, 10, 7).fill(0xf5ecd6); g.poly([-5, 6, 0, 10, 5, 6]).fill(0xd6c39a); g.circle(0, 10, 1.4).fill(0xdc2626); break;
    case 'staff': g.rect(-1, -6, 2, 22).fill(0x7a5236); g.circle(0, -7, 3).fill(0xc084fc); break;
    case 'orb': g.circle(0, 10, 4).fill(0x67e8f9); g.circle(-1, 9, 1.4).fill(0xffffff); break;
    case 'none': break;
  }
  g.visible = false;
  return g;
}

const OUTLINE = { width: 1.1, color: 0x1a120c, alpha: 0.6 } as const;
const grads = new Map<string, FillGradient>();

/** Left-lit horizontal gradient (sun from the upper left), cached per color. */
function lit(base: number, light = 0.22, dark = -0.32): FillGradient {
  const key = `${base}-${light}-${dark}`;
  let g = grads.get(key);
  if (!g) {
    g = new FillGradient({
      start: { x: 0, y: 0 }, end: { x: 1, y: 0.4 },
      colorStops: [{ offset: 0, color: shade(base, light) }, { offset: 0.55, color: base }, { offset: 1, color: shade(base, dark) }],
    });
    grads.set(key, g);
  }
  return g;
}

function helmet(source: Source, level: number): Graphics {
  const g = new Graphics();
  const trim = level >= 5 ? 0xfacc15 : 0xb8bec9;
  if (source === 'codex') {
    // felt hood with fur trim
    g.poly([-8, -26, -2, -40, 1, -44, 8, -27, 5, -24, -5, -24]).fill(lit(0x0f766e)).stroke(OUTLINE);
    g.poly([1, -44, 8, -27, 4, -26]).fill({ color: 0x0b3b37, alpha: 0.45 });
    g.moveTo(-3, -36).quadraticCurveTo(0, -31, 2, -27).stroke({ width: 1, color: 0x0b3b37, alpha: 0.5 });
    g.roundRect(-8.5, -28.5, 17, 4, 2).fill(level >= 5 ? lit(0xfacc15) : lit(0xece6d6, 0.1, -0.25)).stroke(OUTLINE);
    g.circle(1, -44, 2.2).fill(0xece6d6).stroke(OUTLINE);
  } else if (source === 'claude') {
    // bronze helm with horns, rivets and a specular glint
    g.poly([-7, -30, -13.5, -40, -12, -31]).fill(lit(0xf2e8d2, 0.1, -0.3)).stroke(OUTLINE);
    g.poly([7, -30, 13.5, -40, 12, -31]).fill(lit(0xe2d6bc, 0.05, -0.35)).stroke(OUTLINE);
    g.moveTo(-8, -26).arc(0, -26, 8, Math.PI, 0).closePath().fill(lit(0xb8732f, 0.3, -0.4)).stroke(OUTLINE);
    g.ellipse(-3.2, -31, 2.2, 1.3).fill({ color: 0xfff1d6, alpha: 0.75 });
    g.rect(-0.8, -34, 1.6, 8).fill({ color: 0x7c4a1e, alpha: 0.8 });
    g.roundRect(-8.8, -27.5, 17.6, 3.2, 1.2).fill(lit(trim, 0.25, -0.3)).stroke(OUTLINE);
    for (const x of [-6, -2, 2, 6]) g.circle(x, -25.9, 0.7).fill(0xfff6e0);
  } else {
    g.moveTo(-7.5, -26).arc(0, -26, 7.5, Math.PI, 0).closePath().fill(lit(0x1d4ed8)).stroke(OUTLINE);
    g.roundRect(-8.5, -27.5, 17, 3, 1.2).fill(lit(trim)).stroke(OUTLINE);
  }
  return g;
}

/** Assemble a dwarf. Feet at (0,0), facing right. */
export function buildDwarf(id: string, source: Source, level: number, isSub: boolean): DwarfParts {
  const h = hash(id);
  const skin = SKINS[h % SKINS.length];
  const beard = BEARDS[(h >>> 3) % BEARDS.length];
  const tunic = (TUNIC[source] || TUNIC.custom)[(h >>> 6) % 4];

  const root = new Container();
  const ring = new Graphics();
  const shadow = new Graphics().ellipse(0, 0, 10, 4).fill({ color: 0x000000, alpha: 0.32 });
  const body = new Container();
  const boot = (g: Graphics) => g.roundRect(-2.6, 4.5, 5.6, 3, 1.4).fill(lit(0x2a1d14, 0.25, -0.3)).stroke(OUTLINE);
  const legL = new Graphics().roundRect(-1.8, -0.5, 3.8, 6.5, 1.6).fill(lit(0x4a3424)).stroke(OUTLINE);
  boot(legL);
  const legR = new Graphics().roundRect(-1.8, -0.5, 3.8, 6.5, 1.6).fill(lit(0x3f2a1d)).stroke(OUTLINE);
  boot(legR);
  legL.position.set(-2.6, -7);
  legR.position.set(2.6, -7);
  const torso = new Graphics();
  if (level >= 8) torso.poly([-7.5, -19, 7.5, -19, 9.5, -3, -9.5, -3]).fill(lit(0x7f1d1d)).stroke(OUTLINE);
  if (isSub) torso.roundRect(-12, -18.5, 6.5, 10.5, 2).fill(lit(0x92400e)).stroke(OUTLINE);
  torso.roundRect(-7.5, -20.5, 15, 14.5, 5.5).fill(lit(tunic)).stroke(OUTLINE);
  // tunic seam + chainmail hem
  torso.moveTo(0, -19).lineTo(0, -12).stroke({ width: 0.8, color: shade(tunic, -0.4), alpha: 0.6 });
  for (let x = -6; x <= 6; x += 2) torso.circle(x, -6.6, 0.9).fill(level >= 3 ? 0xd1d5db : 0x9ca3af);
  torso.roundRect(-7.6, -11.6, 15.2, 2.8, 1).fill(lit(0x3f2a1d, 0.2, -0.3));
  torso.roundRect(-1.8, -12, 3.6, 3.6, 0.8).fill(lit(level >= 3 ? 0xfacc15 : 0xb8bec9, 0.35, -0.3)).stroke({ ...OUTLINE, width: 0.8 });
  const armBack = new Graphics().roundRect(-1.9, 0, 3.8, 9, 1.9).fill(lit(shade(tunic, -0.25))).stroke(OUTLINE).circle(0, 9, 2).fill(lit(skin, 0.1, -0.25));
  armBack.position.set(-5.8, -18.5);
  const armFront = new Graphics().roundRect(-1.9, 0, 3.8, 9, 1.9).fill(lit(shade(tunic, 0.06))).stroke(OUTLINE).circle(0, 9, 2.2).fill(lit(skin, 0.15, -0.2)).stroke({ ...OUTLINE, width: 0.8 });
  armFront.position.set(5.8, -18.5);
  const tools = {} as Record<Tool, Graphics>;
  for (const t of ['hammer', 'book', 'quill', 'sword', 'scroll', 'pickaxe', 'flask', 'spyglass', 'letter', 'staff', 'orb', 'none'] as Tool[]) {
    tools[t] = drawTool(t);
    tools[t].position.set(0, 7);
    armFront.addChild(tools[t]);
  }
  const head = new Container();
  const face = new Graphics();
  face.circle(0, -25, 6.4).fill(lit(skin, 0.18, -0.25)).stroke(OUTLINE);
  face.ellipse(3.2, -23.6, 1.8, 1.1).fill({ color: 0xe0786a, alpha: 0.35 });
  // bushy brows + eyes with a glint
  face.roundRect(-3.4, -29.4, 3.4, 1.4, 0.7).fill(shade(beard, -0.1)).roundRect(1, -29.4, 3.4, 1.4, 0.7).fill(shade(beard, -0.1));
  face.circle(2.4, -27, 1).fill(0x1c1917).circle(-1.6, -27, 1).fill(0x1c1917);
  face.circle(2.7, -27.3, 0.35).fill(0xffffff).circle(-1.3, -27.3, 0.35).fill(0xffffff);
  // beard: gradient mass, strands, braided tip with a bead
  face.poly([-6.8, -25, -5.4, -17, -1.5, -12.5, 0, -11, 1.5, -12.5, 5.4, -17, 6.8, -25, 3.2, -22, -3.2, -22])
    .fill(lit(beard, 0.25, -0.35)).stroke(OUTLINE);
  for (const x of [-4, -1.5, 1.5, 4]) face.moveTo(x, -21.5).quadraticCurveTo(x * 0.7, -17, x * 0.3, -13.5).stroke({ width: 0.7, color: shade(beard, -0.35), alpha: 0.7 });
  face.roundRect(-1.1, -12, 2.2, 3.4, 1).fill(shade(beard, -0.1)).circle(0, -8.4, 1.1).fill(level >= 5 ? 0xfacc15 : 0xb8bec9);
  face.ellipse(0, -22.4, 3.6, 1.4).fill(lit(shade(beard, -0.12)));
  face.ellipse(1.6, -24.4, 2, 1.8).fill(lit(shade(skin, -0.05), 0.25, -0.2)).stroke({ ...OUTLINE, width: 0.7 });
  const mouth = new Graphics().ellipse(0, -20.3, 1.7, 1.3).fill(0x3b0a0a);
  mouth.visible = false;
  head.addChild(face, mouth, helmet(source, level));

  body.addChild(armBack, legL, legR, torso, head, armFront);
  root.addChild(ring, shadow, body);
  root.scale.set(isSub ? 1.08 : 1.35);
  return { root, body, legL, legR, torso, armBack, armFront, head, mouth, tools, shadow, ring };
}
