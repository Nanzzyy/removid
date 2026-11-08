# Style: PRECISION

**Kategori:** `motion-3d`  
**Status:** Panduan orisinal berdasarkan interpretasi katalog/galeri publik, **bukan** prompt, kode, atau skill internal KreatorLab.  
**Referensi visual:** https://kreatorlab.id/videos/galeri-motion-precision.jpg

## Tujuan estetika
Showcase produk premium, komponen exploded view dan anotasi teknik.

## DNA visual
- **Tampilan dan material:** Objek mengambang pada latar editorial bersih, exploded assembly akurat, garis penunjuk tipis.
- **Palet awal:** off-white, charcoal, metallic gray, accent pastel halus. Jika pengguna punya brand kit, ikuti brand kit selama identitas style tetap terbaca.
- **Aset prioritas:** model komponen, light rig softbox, annotation lines, product labels.
- **Tipografi:** headline 2–8 kata per beat dan subtitle singkat. Pilih keluarga font yang legal tersedia; uji pada layar ponsel.
- **Komposisi:** satu focal point dominan per shot; hindari elemen dekoratif tidak relevan.

## Bahasa gerak dan kamera
- **Animasi:** exploded radial/linear lalu assembly presisi; ease-in-out halus tanpa bounce besar.
- **Kamera/layout:** macro detail dan orthographic/telephoto untuk mengurangi distorsi.
- **Tempo:** ikuti penekanan voiceover atau aksi; buat beat map dahulu. Hindari animasi dekoratif yang tidak memberi informasi.
- **Transisi:** utamakan cut/match action; gunakan efek khusus hanya ketika membantu perubahan makna atau lokasi.

## Audio dan sound design
soft mechanical clicks, understated synth. Pastikan VO jelas dan tidak tertutup musik/SFX.

## Yang tidak boleh dilakukan
komponen fiktif disebut spesifikasi nyata, ledakan agresif, teks terlalu kecil. Jangan mengarang data, karakteristik produk, elemen anatomi, atau fakta historis untuk mempercantik visual.

## Urutan kerja khusus style
1. Baca brief dan tentukan satu pesan yang harus diingat penonton.
2. Buat beat map berdasarkan naskah/VO; setiap beat memiliki tujuan, durasi, aksi visual, dan informasi yang divalidasi.
3. Kunci style bible (palet, material, geometri, contoh pose/objek, tipografi).
4. Buat frame kunci untuk awal-tengah-akhir sebelum produksi penuh.
5. Produksi gerak mengikuti arahan di atas. Gunakan model 3D dan scene berlapis; pertahankan skala, siluet, shader, dan karakter dari shot ke shot. Cek continuity dan hindari pergerakan kamera yang mengganggu cerita.
6. Render preview resolusi rendah; cek teks, kontinuitas, kesalahan fakta, frame kosong, dan sinkron audio.
7. Render final sesuai fps/rasio yang diminta setelah cek kemampuan perangkat.

## Contoh brief siap pakai
> Buat video berdurasi 30 detik, kategori motion-3d, style `PRECISION`, ide: "Perlihatkan susunan komponen earbud konsep dari casing hingga driver.". Output 9:16, Bahasa Indonesia. Buat storyboard per beat, style bible, prompt aset, arahan kamera, timeline, audio cue, QA dan langkah render. Jangan mengarang data. Jika bisa mengeksekusi tool, buat preview dulu sebelum final.

## Kontrak output agent
Untuk setiap shot, keluarkan `shot_id`, `start_s`, `end_s`, `voiceover`, `visual_description`, `asset_prompt`, `camera`, `motion`, `on_screen_text`, `sfx`, `transition`, dan `validation_notes`.
