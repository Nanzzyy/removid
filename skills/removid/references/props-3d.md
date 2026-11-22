# 3D props with sand3d

For an object that has to look right and move on its joints (a product, a device, furniture, a box that opens, a machine): write it as a short program with **sand3d** (https://github.com/Sandflow-ai/sand3d, Apache-2.0, "3D modeling in Python, built for LLMs"), export a GLB, and pose it from a Remotion scene. Remotion still authors the scene; sand3d only makes the object.

Not for the narrator or any character: those stay in `src/characters` (`references/character-and-narration.md`). Not for organic shapes, skinned meshes or textures: sand3d builds rigid parts with flat PBR materials. For those, ask the user for their own GLB; the same `GlbProp` loads it (joints are optional).

## sand3d is the user's tool, not ours

Do not install it. `python3 -c "import sand3d"` (Python 3.11 or 3.13; `bpy` has no wheel for 3.12) tells whether it exists. If not, say so and ask: it pulls in Blender as the `bpy` module (about 1 GB in a fresh venv, measured with sand3d 1.6.3 and bpy 5.2.4), so it is the user's call. Without it, use the user's GLB, or build the object from three.js primitives in the scene.

## The program

The whole API fits in a prompt (`docs/api.md` in the sand3d repo, about 3 600 tokens; read it before writing). Rules that matter, from its `docs/guidelines.md`: the first function is the table of contents and builds no geometry; one function per distinct part, built about its own origin; name each dimension once and derive the rest; say each shape with the verb that names it (no `bpy`); one frame per joint; millimetres. A tested example (`tests/fixtures/props/gift_box.py` in the removid repo, the same code):

```python
import sand3d as s3d

def gift_box(w=240, d=200, h=120, lid_h=36, wall=8):
    base = box_base(w, d, h, wall)
    lid = lid_part(w, d, lid_h)
    top = base.face("+Z")
    hinge = top.move(w / 2)                                  # the +X edge of the open top
    lid = s3d.at(lid, on=top)                                # sits on the rim
    s3d.joint("lid_hinge", lid, hinge, axis="+Y", range=(0, 110))
    return s3d.assembly("gift_box", base, lid)

def box_base(w, d, h, wall):
    base = s3d.box("base", w, d, h)
    s3d.fillet(base, 4, edges="side")
    s3d.pocket(base, s3d.rect(w - 2 * wall, d - 2 * wall), h - wall, on=base.face("+Z"))
    s3d.material(base, "painted_metal", color="#d63a3a")     # colours from the style's palette, not invented
    return base

def lid_part(w, d, lid_h):
    lid = s3d.box("lid", w + 6, d + 6, lid_h)
    s3d.fillet(lid, 4, edges="side")
    s3d.material(lid, "glossy_plastic", color="#f2e6c9")
    return lid
```

Export from the project's folder: keep the program in `Asset/agen/props/<name>.py`, run it, and write `s3d.export(machine, "<name>.glb")` next to it (`.glb` carries the joints; export at rest, or pose first, either works). Copy the GLB to `Source/remotion/public/props/<name>.glb` and list both in `Asset/ASSETS.md` (made by: agent, sand3d version). Name the file in the frame's `asset:` line of the storyboard.

## What the GLB contains (verified on sand3d 1.6.3)

Y-up, a root scaled 0.001 (nodes are in millimetres). Each moving part hangs on a node **named after its joint**, with `extras.s3d_joint = {name, type, value, axis, lower, upper}`: `axis` in the node's own frame, revolute values in **radians**, prismatic values in **metres**, `type` revolute, continuous or prismatic. The node's rotation is `rest × turn(axis, value)`; a prismatic node slides along `rest × axis`. A file exported after `pose()` records its value, and `GlbProp` undoes it to find the rest. `free` joints are not supported (the scene throws, naming the joint).

## In a scene

```tsx
import {GlbProp} from '../components/GlbProp.tsx';
import {easeNamed} from '../lib/ease.ts';
import {STYLE} from '../style.ts';

// inside a scene, t in seconds from useCurrentFrame() / fps: the lid opens between 1.0 s and 2.0 s
const k = easeNamed(STYLE.ease.move, (t - 1.0) / 1.0); // easeNamed clamps to 0..1
<GlbProp src="props/gift_box.glb" joints={{lid_hinge: 110 * k}} yaw={30} pitch={18} width={900} height={900} />
```

`joints` is degrees (revolute, continuous) or metres (prismatic); a joint not named stays at 0; a value outside the range, or a name that is not in the file, stops the render with a message (the same rule as sand3d's `pose`). The component frames the prop once for its whole range of motion, loads the file before the first frame (`delayRender`) and draws every frame from `joints`: time in, picture out, nothing else. Easing is the style's named curve, never linear; turn the camera with `yaw`/`pitch`, not with a timer.

## Check before building the scene

```bash
cd Source/remotion && npm run prop -- props/gift_box.glb --joint lid_hinge --values 0,55,110
```

It lists the joints and their ranges, renders `out/props/<name>-<joint>.png` (up to four values side by side) and **fails** when nothing is drawn, when the prop is clipped by its cell (raise `--margin`), when a value outside the range is asked (exit 2), or when two values look the same (the joint is not wired, or its axis is wrong). Look at the PNG as well: a passing check does not say the object is the right shape. Show it to the user with the character sheets before Gate 2 when the prop carries the video.

## Verified

`scripts/check-logic.mjs` poses nodes with the numbers sand3d itself wrote (a hinge at 92 degrees, a drawer at 0.12 m, a file exported with the joint already moved) and fails when the rotation order or the prismatic axis is wrong (mutants in `test.sh`). `./test.sh --full` renders the gift box at three lid angles, refuses 120 degrees, and must fail when the joint is made a no-op. Also checked by hand: a file exported at 90 degrees and the rest file posed to 90 degrees render the same picture (1 pixel differs), and the washing machine of sand3d's repo (revolute, prismatic and continuous joints) poses correctly.
