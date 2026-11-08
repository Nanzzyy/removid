# Technical guide / implementasi realistis

## Pemilihan tool
- **Blender**: 3D modeling, environment, camera, lighting, physics/rigging dan render. Pertimbangkan EEVEE untuk preview cepat; Cycles untuk kualitas/lighting yang lebih akurat jika GPU memadai.
- **Remotion/React**: 2D/2.5D animasi, brand templates, captions, UI, charts, dynamic text, render terparameter dan integrasi timeline.
- **FFmpeg/ffprobe**: metadata input, transcode, normalize/trim bila dibenarkan, audio mix, export dan quality control.
- **NLE**: Premiere/Resolve/Kdenlive/CapCut bila memang tersedia; jangan mengklaim akses ke timeline editor hanya karena ada skill deskriptif.
- **Generative video**: dapat membantu B-roll atau gaya spesifik, namun perlu uji consistency; tidak cocok untuk label/data teknis presisi tanpa compositor.

## Kesiapan perangkat
- Periksa `ffmpeg -version`, `ffprobe -version`, `node -v`, `blender --version` hanya jika memiliki terminal dan izin eksekusi.
- Periksa VRAM dan storage; tanpa GPU mulai low-poly, render preview, batasi samples dan resolusi sebelum final.
- Tidak ada tool? Tetap berikan prompt aset, shotlist, audio cues, style bible, dan spesifikasi handoff; status = `PLAN_ONLY`.

## Frame dan timing
Gunakan durasi berbasis suara, bukan menetapkan selalu 1 kata = 0.5 detik. Pada 30 fps, 0.3 s = 9 frame; pada 60 fps, 0.3 s = 18 frame. Gunakan interpolation/easing, dan hold layar untuk teks utama agar sempat terbaca. Pastikan durasi shot dan audio sejalan.

## Referensi dokumentasi umum
- Blender EEVEE: https://docs.blender.org/manual/en/latest/render/eevee/index.html
- Remotion fundamentals: https://www.remotion.dev/docs/the-fundamentals
- Remotion render: https://www.remotion.dev/docs/render
- FFmpeg: https://ffmpeg.org/documentation.html

Dokumen ini adalah saran implementasi, bukan bukti bahwa KreatorLab memakai stack yang sama.
