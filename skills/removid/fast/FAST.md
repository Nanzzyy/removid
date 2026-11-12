# FAST: kit removid untuk video pendek tanpa narasi

`F` = direktori ini, `P` = folder proyek removid (path absolut). Pakai kit untuk video ≤45 detik tanpa narasi, karakter narator, footage, kursor atau zoom target. Selain itu gunakan starter penuh. Style motion-3d di kit ini hanya 2.5D; kebutuhan 3D asli memakai starter penuh.

## Intake sampai storyboard

1. Jalankan pemeriksaan versi dan `intake` dari `SKILL.md`; selesaikan pertanyaan yang belum terjawab. Router ringkas membantu memilih style, bukan mengganti intake:
   ```bash
   node "$F/scripts/pick.mjs" "<brief asli>" --pretty
   ```
   Baca output saja untuk palet/resep; tabel style tetap berasal dari `../styles/styles.json`. Style bernama menang. `fast.eligible` adalah saran; narasi harus dipastikan di intake. Musik sintesis adalah pilihan yang perlu disepakati di kebutuhan teknis.
2. Buat proyek memakai `project.mjs new ... --narration no --style ...`. Ikuti schema folder dan tulis `Storyboard/STRUCTURE.md`. Untuk video bernarasi kembali ke alur penuh: script → Gate 1 → voice → character, lalu storyboard. Video tanpa narasi mengikuti aturan yang sudah ada: struktur diperiksa bersama storyboard di Gate 2.
3. Tulis `Storyboard/STORYBOARD.md` dengan durasi, teks, dan transisi yang terhitung. Semua teks yang di-render harus terdaftar dalam `- text:` frame terkait, termasuk angka stat, suffix, judul, item dan CTA. Cantumkan setiap angka/klaim/domain di `CLAIMS.md`; placeholder tetap memblokir final.
4. Sebelum `submit storyboard`, tulis `Storyboard/direction.json`: konten kit, satu scene per frame, urutan sama. Jadwal frame berasal dari storyboard, sehingga JSON tidak memakai `beats`, `len`, `start` atau `end`.
   ```json
   {"title":"Demo","scenes":[
     {"id":"hook","frame":1,"type":"hook","text":"Pesan utama"},
     {"id":"cta","frame":2,"type":"cta","text":"Mulai sekarang","sub":"Lihat panduan"}
   ]}
   ```
   Jenis scene: `hook` (`text`); `stat` (`value`, `suffix`, `label`); `list` (`title`, `items`); `statement`/`cta` (`text`, `sub`); `custom` (`hits`, komponen buatan sendiri).
   Event bawaan lokal: hook slam 1 s; stat hitung 0,5–2,1 s, end 2,4 s; list item 0,3 + i×0,35 s; statement enter 0,3 s, hit 1,6 s; CTA hit 0,4 s, end 1,4 s. Sisakan waktu untuk animasi selesai dan teks dibaca. `custom.hits` berisi `{at,kind,d?,gain?}`, kind `enter|hit|end|slam|count`.
5. `check storyboard`, `submit storyboard`, tampilkan storyboard dan direction kepada user, lalu **Gate 2**. Tunggu persetujuan dengan evidence kata user. Direction termasuk hash persetujuan; revisinya membuat gate berikutnya stale.

## Build setelah Gate 2

```bash
bash "$F/setup.sh" "$P"
```

Setup memeriksa gate dan plan, membuat `Source/remotion`, mengompilasi `cues.json` + `style.json`, memasang dependensi dan font lokal. Ia menolak starter lain yang sudah ada. `--no-install` hanya menyalin kit. Untuk refresh timing/style: jalankan setup lagi; edit scene tetap dipertahankan. Font gagal dimuat berarti render gagal.

Cues memakai frame persis dari plan, tanpa pembulatan beat baru. BPM hanya mengatur musik; selaraskan batas frame ke beat saat menyusun storyboard bila diperlukan. Isi dan durasi event yang tidak cocok ditolak. Contoh `stat` dan jenis lain sudah jadi dalam `src/Scenes.tsx`; `custom` membutuhkan kode scene. Kit `src/motion.tsx` menyediakan `useClock(stepFps)`, `Words`, `Cam`, `Bg`, `Particles`, `DrawPath`, `spring`, `lin`, `ease`, `squash`, `shake`, `countUp`, `safe` dan `onColor`. Semua gerak fungsi waktu dalam detik; easing/zoom mengikuti token style. `stepFps` menahan pose, output tetap 60 fps.

```bash
cd "$P/Source/remotion"
npm run typecheck
npx remotion still src/index.ts Main60 out/check.png --frame=60 --scale=0.5
```

Periksa still pada awal, tiap klimaks, dan tiap batas scene: overlap, zona aman 90%/80%, keterbacaan, kontras, teks terpotong. Perbaiki sampai lolos. Bila direction/storyboard berubah, dapatkan persetujuan ulang sebelum build. Scene kit diekspor sebagai `Scene1`, `Scene2`, dst. Render tiap komposisi dengan range global dari `plan.json`, handle 15 frame di kedua sisi (clamp ke 0..totalFrames−1), menjadi `Asset/scenes/NN-name.mp4`. Setiap komposisi mempertahankan satu scene pada handles; belum ada transisi atau audio.

Jika musik disepakati, Python dengan numpy/scipy dan ffmpeg lengkap diperlukan (tidak dipasang oleh kit):
```bash
bash "$F/scripts/audio.sh" "$P"
```
`REMOVID_PYTHON`, `REMOVID_FFMPEG`, `REMOVID_FFPROBE` dapat menunjuk tool yang tersedia. Musik + efek dibuat dari cues menjadi `Asset/agen/sfx.wav`, divalidasi −15…−13 LUFS dan peak ≤−1,2 dBFS. Daftarkan font dan audio di `Asset/ASSETS.md`. Musik sintesis sederhana; jangan klaim lisensinya tanpa meninjau asal kode.

## Sample dan final

HyperFrames memotong klip, menerapkan transisi storyboard, dan mencampur audio: ikuti `references/handoff.md`, `project.mjs assemble`, lalu `hyperframes check`. Kit tidak menerapkan transisi kedua di Remotion.

Render sample 10 detik pada 60 fps ke `Result/sample`, **Gate 3**. Setelah sample disetujui, `project.mjs gate full`, render final pada 60 fps ke `Result/vN`. Jalankan `probe-mp4.sh` dan, bila audio dipakai:
```bash
bash "$F/scripts/qa.sh" "$P/Result/v1/video.mp4" 60 "$P/Result/v1/qa" 1080x1920 20
```
Ganti ukuran/durasi dengan nilai plan. QA gagal untuk fps, ukuran/durasi, audio, loudness, freeze >0,5 s, black >0,1 s, kegagalan ffmpeg atau contact sheet. Periksa sheet dan dengarkan hasil; **Gate 4**, lalu `gate deliver`. **Video tanpa suara adalah cacat**: `qa.sh` harus exit 0 (termasuk stream audio dan loudness) sebelum Gate 4. Jika `audio.sh` gagal (mis. tanpa numpy/scipy), berhenti dan beritahu user; jangan serahkan video tanpa audio. Laporkan hasil, spesifikasi, asumsi dan batasan; jangan klaim penghematan token berdasarkan ukuran file saja.

Jika **hanya loudness** yang gagal (peak > −1,2 dBFS) padahal `audio.sh` lulus: encode AAC HyperFrames bisa overshoot, dan bitrate-nya tidak dikontrol kit ini. Karena video FAST tanpa narasi, `Asset/agen/sfx.wav` adalah seluruh trek audionya. Pasang ulang dari WAV itu, lalu jalankan `qa.sh` lagi: `ffmpeg -i video.mp4 -i "$P/Asset/agen/sfx.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest fixed.mp4`. `qa.sh` pada MP4 akhir adalah penentu, bukan pemeriksaan WAV.
