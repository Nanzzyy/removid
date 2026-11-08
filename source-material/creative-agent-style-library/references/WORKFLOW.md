# Production workflow dan quality gates

## Fase 0: Brief dan routing
Masukan: topik, script/VO/footage, brand, target audience, durasi, format, style. Normalisasi nama style memakai JSON aliases. Isi yang belum ada dengan default terukur; jangan mengubah instruksi user. Hindari terlalu banyak pertanyaan.

## Fase 1: Narrative architecture
- Hook 0–2 detik: pertanyaan/konflik/hasil visual tanpa sensasional berlebih.
- Setup: 1 problem atau fakta utama.
- Development: scene menunjukan perubahan sebab-akibat; bukti diberikan sebelum payoff.
- Payoff: jawaban/insight di penghujung; CTA hanya jika relevan.
- Shot map harus mencantumkan VO tepat, durasi, dan asset cue.

## Fase 2: Style bible
Tetapkan: palet (max 4–6 warna fungsional), typographic roles, materials/shaders, icon geometry, character proportions, light rig, framing, depth and motion verbs, negative prompts. Gunakan referensi hanya sebagai analisis sifat visual; jangan mengambil aset brand tanpa hak.

## Fase 3: Storyboard dan asset plan
Tulis scene spec: id, start/end, objective, environment, foreground/midground/background, camera path, action, graphics, overlay, SFX, transition, validation. Untuk VO nyata, gunakan timestamp aktual bukan perkiraan otomatis.

## Fase 4: Build & review gates
- Gate A: preview 3 still frame (hook/penjelasan/payoff).
- Gate B: preview 3–5 detik untuk mengecek cadence, camera, subtitle dan artifacts.
- Gate C: draft utuh dengan audio sebelum final mahal.
- Fail harus diperbaiki pada shot terkait; jangan render ulang seluruh proyek kalau tidak diperlukan.

## Fase 5: Export dan QA
- 9:16: default 1080 x 1920; 16:9: 1920 x 1080, atau sesuai brief.
- 30 fps master umumnya cukup; gunakan 60 fps jika input dan animasi benar-benar mendukung, bukan sekadar penggandaan frame.
- MP4 H.264 + AAC broad compatibility default, kecuali platform meminta lain.
- Captions: kontras tinggi, 1–2 baris, ditempatkan agar tidak tertutup elemen UI platform; jangan invent voice timestamps.
- Audio: dialog jelas, tidak clipping; periksa peak dan mixing telinga.
- QA per shot: apakah cerita terbaca tanpa VO? apakah tulisan/fakta akurat? apakah visual mengikuti style? ada jitter/flicker/freeze? objek/pengisi suara konsisten?

## Handoff
Sediakan judul, style slug, daftar aset, source code/project (jika dibuat), MP4 (jika berhasil dirender), SRT (jika ditranskrip), status `RENDERED`/`PLANNED`/`BLOCKED`, dan command reproduksi yang telah diverifikasi.
