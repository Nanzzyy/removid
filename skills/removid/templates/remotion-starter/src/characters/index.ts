// The characters of this project. Claude designs them per video: pick the archetype closest to the brief (humanoid, voxel, mascot),
// set its data (colours from the brand, hair, outfit), show `npm run character -- <id>` to the user, and revise.
// None of these resembles a logo; never turn a brand logo or the Claude/Anthropic mark into the character.
// A style no archetype covers (robot, animal...): write a new builder next to these that returns a `Model` (see types.ts).
import {humanoid} from './humanoid.ts';
import {mascot} from './mascot.ts';
import type {CharacterDef} from './types.ts';
import {voxel} from './voxel.ts';

const list: CharacterDef[] = [
  humanoid({id: 'ayu', label: 'Ayu', about: 'Woman, long dark hair, teal blazer. Warm and professional: services, education, finance.', presentation: 'female', skin: 0xd9a27a, hair: 0x2b1d17, hairStyle: 'long', outfit: 'blazer', top: 0x1f7a6c, bottom: 0x2a2f3a, shoes: 0x1b1b1b, groundY: 904}),
  humanoid({id: 'bima', label: 'Bima', about: 'Man, short black hair, glasses, light shirt and tie. Trustworthy: B2B, tech, consulting.', presentation: 'male', skin: 0xc58c63, hair: 0x151515, hairStyle: 'short', outfit: 'shirt', top: 0xe8e4da, bottom: 0x2e3b55, shoes: 0x222222, accent: 0x1f7a6c, glasses: true, groundY: 904}),
  voxel({id: 'pixel', label: 'Pixel', about: 'Blocky pixel character in a blue hoodie. Playful: games, apps, younger audiences.', skin: 0xe7b48f, hair: 0x4a2c1a, hairStyle: 'short', top: 0x3b6fd8, bottom: 0x2b2f3d, shoes: 0x1a1a1a, accent: 0xf2c94c, groundY: 895}),
  mascot({id: 'bolo', label: 'Bolo', about: 'Round blue mascot with a pale belly. Friendly and neutral: any product, any age.', body: 0x4f7cff, limbs: 0x3558c9, belly: 0xdfe8ff, ink: 0x14213d, groundY: 856}),
];

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(list.map((c) => [c.id, c]));
export const DEFAULT_CHARACTER = 'ayu';

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTERS[id];
  if (!c) throw new Error(`unknown character "${id}". Registered: ${Object.keys(CHARACTERS).join(', ')}`);
  return c;
}
