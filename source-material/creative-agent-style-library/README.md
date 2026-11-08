# Creative Agent Style Library v1.0

**Bisa dipakai di Claude Code, Codex, Hermes, dan coding agent lain yang membaca Markdown instructions.**

## Isi
- **4 executable-style SKILL.md**: satu router `creative-director`, dan tiga spesialis `motion-3d`, `video-editor`, `motion-graphics`.
- **36 style guides**: 34 nama dari katalog publik KreatorLab + 2 ekstra orisinal (`ZACK-FACTS-INSPIRED`, `CLAY-3D`).
- **Prompt universal** di `MASTER_PROMPT.md`.
- Style aliases JSON, catalog, workflow, scene spec JSON Schema, shotlist dan technical guide.

## Sumber & transparansi
- Katalog publik: https://kreatorlab.id/ (diakses 8 November 2026).
- **Terverifikasi dari halaman publik:** 11 gaya Motion 3D, 10 Video Editor, 13 Motion Graphics; thumbnail beberapa style dan deskripsi umum kategori.
- **Interpretasi kreatif kami:** semua uraian palet, kamera, animasi, sound design, negative prompts, pipeline dan parameter; ini tidak diklaim sebagai dokumentasi resmi atau file SKILL.md berbayar KreatorLab.
- Style EDITORIAL tercantum di katalog namun tidak memiliki preview terpisah yang teridentifikasi dari galeri yang tersedia.
- Untuk inspirasi educational 3D dengan open-loop storytelling kami gunakan prinsip genre umum; tidak menyalin skrip, suara, atau karakter Zack D. Films.
- Referensi implementasi: https://www.remotion.dev/ dan https://docs.blender.org/manual/en/latest/render/eevee/index.html .

## Instalasi (Claude Code)
Salin folder `skills/*` ke `<project>/.claude/skills/` atau `~/.claude/skills/` dan pastikan **folder `styles/` dan `references/` tetap tersedia**. Karena referensi berasal dari root repo dan link relatif, cara yang paling mudah untuk menjaga semuanya adalah mempertahankan direktori `creative-agent-style-library/` di dalam proyek, lalu tambahkan instruksi berikut di `AGENTS.md`/`CLAUDE.md`:

```
For video, 3D and motion requests, first read creative-agent-style-library/skills/creative-director/SKILL.md, then the category SKILL.md and corresponding style guide in creative-agent-style-library/styles/. Use the project references for the workflow, schema and QA.
```

Untuk **instalasi skill native** di `~/.claude/skills/`, copy seluruh bundle root (styles dan references) bersama skills ke lokasi terstruktur, atau buat symlink yang mempertahankan path `../../styles` dan `../../references`. Jangan hanya menyalin folder SKILL.md tanpa dependenciesnya.

## Instalasi agent independen
Tambahkan ke `AGENTS.md` (Codex) atau system prompt Hermes: `Read creative-agent-style-library/MASTER_PROMPT.md and follow the selected style guide exactly. Do not claim renders without tools.`

## Contoh penggunaan
> Buat Motion 3D style PAPERWORLD video 30 detik tentang proses mengubah sampah menjadi energi, 9:16, Bahasa Indonesia. Ikuti creative-agent-style-library, buat beatmap dan storyboard lalu preview frame utama sebelum full render.

## Keterbatasan penting
**Style skill adalah arahan dan keputusan produksi, bukan perangkat render.** Untuk mengeluarkan MP4, agent perlu tool yang benar-benar bisa menjalankan Blender, Remotion, FFmpeg atau editor lain. Style hanya menentukan bagaimana video dibangun secara konsisten.
