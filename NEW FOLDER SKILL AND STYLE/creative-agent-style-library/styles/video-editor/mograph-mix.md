# Style: MOGRAPH MIX

**Kategori:** `video-editor`  
**Status:** Panduan orisinal berdasarkan interpretasi katalog/galeri publik, **bukan** prompt, kode, atau skill internal KreatorLab.  
**Referensi visual:** https://kreatorlab.id/videos/galeri-editor-mograph-mix.jpg

## Tujuan estetika
Mix footage, icon motion, UI dan grafis vector modern.

## DNA visual
- **Tampilan dan material:** Gradient gelap, icon cards, glow secukupnya, responsive grid
- **Palet awal:** navy, violet, coral, amber (boleh override brand). Jika pengguna punya brand kit, ikuti brand kit selama identitas style tetap terbaca.
- **Aset prioritas:** UI cards, pictograms, bullet labels, floor grid.
- **Tipografi:** headline 2–8 kata per beat dan subtitle singkat. Pilih keluarga font yang legal tersedia; uji pada layar ponsel.
- **Komposisi:** satu focal point dominan per shot; hindari elemen dekoratif tidak relevan.

## Bahasa gerak dan kamera
- **Animasi:** icon orbit, card float, bar grow, smooth transitions
- **Kamera/layout:** mixed 2D/2.5D punch-ins, virtual camera subtle
- **Tempo:** ikuti penekanan voiceover atau aksi; buat beat map dahulu. Hindari animasi dekoratif yang tidak memberi informasi.
- **Transisi:** utamakan cut/match action; gunakan efek khusus hanya ketika membantu perubahan makna atau lokasi.

## Audio dan sound design
digital ticks, soft whoosh. Pastikan VO jelas dan tidak tertutup musik/SFX.

## Yang tidak boleh dilakukan
gradient berantakan, mockup UI tanpa kejelasan, glossy berlebihan. Jangan mengarang data, karakteristik produk, elemen anatomi, atau fakta historis untuk mempercantik visual.

## Urutan kerja khusus style
1. Baca brief dan tentukan satu pesan yang harus diingat penonton.
2. Buat beat map berdasarkan naskah/VO; setiap beat memiliki tujuan, durasi, aksi visual, dan informasi yang divalidasi.
3. Kunci style bible (palet, material, geometri, contoh pose/objek, tipografi).
4. Buat frame kunci untuk awal-tengah-akhir sebelum produksi penuh.
5. Produksi gerak mengikuti arahan di atas. Jadikan footage asli dan dialog sumber utama. Jangan membuat atau mengganti kata-kata narator tanpa instruksi. Gunakan grafik sebagai penopang, bukan pengganti cerita.
6. Render preview resolusi rendah; cek teks, kontinuitas, kesalahan fakta, frame kosong, dan sinkron audio.
7. Render final sesuai fps/rasio yang diminta setelah cek kemampuan perangkat.

## Contoh brief siap pakai
> Buat video berdurasi 30 detik, kategori video-editor, style `MOGRAPH MIX`, ide: "Lima fitur aplikasi ditampilkan dengan icon motion.". Output 9:16, Bahasa Indonesia. Buat storyboard per beat, style bible, prompt aset, arahan kamera, timeline, audio cue, QA dan langkah render. Jangan mengarang data. Jika bisa mengeksekusi tool, buat preview dulu sebelum final.

## Kontrak output agent
Untuk setiap shot, keluarkan `shot_id`, `start_s`, `end_s`, `voiceover`, `visual_description`, `asset_prompt`, `camera`, `motion`, `on_screen_text`, `sfx`, `transition`, dan `validation_notes`.
