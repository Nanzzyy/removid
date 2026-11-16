# Licensed sound effects (Openverse)

The five synthesized effects (`click tick whoosh impact chime`) cover UI and transitions. For a door, a shutter, steps or a crowd, find an openly licensed recording on Openverse (a search engine for Creative Commons and public-domain media) with `scripts/openverse.mjs`. Node only, no dependencies, nothing installed.

## When, and what leaves the machine

- At **build** time only (after Gate 2, while making the effects track), never while a scene renders. Every frame stays a pure function of time and every file is local.
- Only the search keywords go to `api.openverse.org`. Never the script, the brief, the brand or a claim. Say it in one line before the first search.
- Anonymous use is 5 requests an hour and 100 a day. For more, the user registers a free client (`POST /v1/auth_tokens/register/`) and exports `OPENVERSE_CLIENT_ID` and `OPENVERSE_CLIENT_SECRET` in their shell. The script exchanges them for a token and never prints or writes them. Never put them in a project file, `PROJECT.md` or a commit.

## Flow

```bash
O=<skill dir>/scripts/openverse.mjs
node $O search "door slam" --source freesound --max-sec 6 --limit 8      # id, seconds, type, licence, title, author
node $O fetch <id> --project <proj> --name door-slam-far                  # Asset/agen/sfx/door-slam-far.mp3 + a row in Asset/ASSETS.md
```

Then in the frame of `Storyboard/STORYBOARD.md` that needs it: `- sfx: lib door-slam-far.mp3 @5.00 gain=0.8`. `check storyboard` puts it in `plan.json`, warns when the file is missing or not in the ledger, and `sfx.mjs` mixes it with the synthesized events.

- **Pick by reading, not by title alone.** You cannot listen from here: compare seconds with the moment (a slam is 1-2 s, not 40), prefer `cc0` and `by`, and tell the user which file you chose and why. If the user can listen, offer the `url` or the Openverse page in the ledger row.
- `search` exits 1 with no result and 0 with some. `--json` gives the rows for a script.
- Most effects in Openverse come from **Freesound and carry no category**. Measured on the live API: `category=sound_effect` returned nothing for "door slam", while the same words without a category returned 240 results. So there is no category filter unless you pass `--category`; keywords, `--source freesound` and `--max-sec` do the narrowing.

## Licences

- The search asks for `by, by-sa, cc0, pdm` (commercial use and modification allowed) and drops everything with `nc` or `nd`: a video with a soundtrack is a derivative work. `fetch` refuses an nc/nd file too; `--allow-nc-nd` exists only for a user who accepted that in their own words.
- `by` and `by-sa` need the author credited in the video or its description. The ledger row says so; put the credit in the final message to the user and, when the video has end credits, in them. `cc0` and `pdm` need none.
- Every fetched file gets a row: who made it (third party, Openverse, source), the attribution text, the source page. Never delete the row; `sfx lib` warns when it is missing.

## What the tool checks, and what it cannot

- The download is https only (or loopback for tests), at most `--max-mb` (20), and must contain an audio stream (`ffprobe`); an error page saved as `.mp3` is discarded and nothing is kept. Existing names are never overwritten.
- `sfx.mjs` levels each library file to a -3 dBFS peak, cuts it at 4 s with a short fade, and then applies the same -16 dB base gain as the synthesized kinds (`gain=` adjusts one event). The mix is mono, 48 kHz.
- It cannot judge whether a sound fits the picture, or whether an uploader had the right to the licence they chose. If a file matters (a brand film), say so and ask the user to check the source page.

Tested against a fake Openverse on loopback (filters, quota, token, licences, size, a non-audio file) and once against the live API (search, detail, a CC0 download, the mix measured at its time with silence after). The live catalogue changes; the shape of the answer is read from `WordPress/openverse` `api/api/serializers`.
