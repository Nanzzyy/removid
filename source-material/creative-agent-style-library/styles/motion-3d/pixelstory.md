# Style: PIXELSTORY

**Kategori:** `motion-3d`  
**Status:** Panduan orisinal berdasarkan interpretasi katalog/galeri publik, **bukan** prompt, kode, atau skill internal KreatorLab.  
**Referensi visual:** https://kreatorlab.id/videos/galeri-motion-pixelstory.jpg

## Tujuan estetika
Cerita pixel-art dengan lapisan kedalaman sinematik.

## DNA visual
- **Tampilan dan material:** Sprite beresolusi rendah dan pixel tegas di atas background hangat yang lebih lembut; partikel kotak.
- **Palet awal:** amber, merah bata, cokelat, aksen cyan. Jika pengguna punya brand kit, ikuti brand kit selama identitas style tetap terbaca.
- **Aset prioritas:** spritesheet karakter, tile-map, particle pixel, layers parallax.
- **Tipografi:** headline 2–8 kata per beat dan subtitle singkat. Pilih keluarga font yang legal tersedia; uji pada layar ponsel.
- **Komposisi:** satu focal point dominan per shot; hindari elemen dekoratif tidak relevan.

## Bahasa gerak dan kamera
- **Animasi:** animasi pose diskrit 8–12 fps secara visual meski komposisi diekspor 30/60 fps; parallax halus.
- **Kamera/layout:** kamera locked atau dolly minimal, fokus pada siluet sprite.
- **Tempo:** ikuti penekanan voiceover atau aksi; buat beat map dahulu. Hindari animasi dekoratif yang tidak memberi informasi.
- **Transisi:** utamakan cut/match action; gunakan efek khusus hanya ketika membantu perubahan makna atau lokasi.

## Audio dan sound design
chiptune halus, UI blip, foley retro. Pastikan VO jelas dan tidak tertutup musik/SFX.

## Yang tidak boleh dilakukan
pixel smoothing/bilinear pada sprite, inkonsistensi ukuran pixel, rotasi sprite kabur. Jangan mengarang data, karakteristik produk, elemen anatomi, atau fakta historis untuk mempercantik visual.

## Urutan kerja khusus style
1. Baca brief dan tentukan satu pesan yang harus diingat penonton.
2. Buat beat map berdasarkan naskah/VO; setiap beat memiliki tujuan, durasi, aksi visual, dan informasi yang divalidasi.
3. Kunci style bible (palet, material, geometri, contoh pose/objek, tipografi).
4. Buat frame kunci untuk awal-tengah-akhir sebelum produksi penuh.
5. Produksi gerak mengikuti arahan di atas. Gunakan model 3D dan scene berlapis; pertahankan skala, siluet, shader, dan karakter dari shot ke shot. Cek continuity dan hindari pergerakan kamera yang mengganggu cerita.
6. Render preview resolusi rendah; cek teks, kontinuitas, kesalahan fakta, frame kosong, dan sinkron audio.
7. Render final sesuai fps/rasio yang diminta setelah cek kemampuan perangkat.

## Contoh brief siap pakai
> Buat video berdurasi 30 detik, kategori motion-3d, style `PIXELSTORY`, ide: "Karakter pixel menemukan pintu rahasia di perpustakaan.". Output 9:16, Bahasa Indonesia. Buat storyboard per beat, style bible, prompt aset, arahan kamera, timeline, audio cue, QA dan langkah render. Jangan mengarang data. Jika bisa mengeksekusi tool, buat preview dulu sebelum final.

## Kontrak output agent
Untuk setiap shot, keluarkan `shot_id`, `start_s`, `end_s`, `voiceover`, `visual_description`, `asset_prompt`, `camera`, `motion`, `on_screen_text`, `sfx`, `transition`, dan `validation_notes`.
