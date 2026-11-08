# Style: HIKAYAT

**Kategori:** `motion-graphics`  
**Status:** Panduan orisinal berdasarkan interpretasi katalog/galeri publik, **bukan** prompt, kode, atau skill internal KreatorLab.  
**Referensi visual:** https://kreatorlab.id/videos/galeri-mograph-hikayat.jpg

## Tujuan estetika
Cerita tradisi dan folklor seperti wayang/siluet panggung.

## DNA visual
- **Tampilan dan material:** Layered silhouettes, ornamental patterns, warm backlit shadow theater
- **Palet awal:** sepia, ochre, burnt sienna, black. Jika pengguna punya brand kit, ikuti brand kit selama identitas style tetap terbaca.
- **Aset prioritas:** silhouette puppets, ornamental borders, stage layers.
- **Tipografi:** headline 2–8 kata per beat dan subtitle singkat. Pilih keluarga font yang legal tersedia; uji pada layar ponsel.
- **Komposisi:** satu focal point dominan per shot; hindari elemen dekoratif tidak relevan.

## Bahasa gerak dan kamera
- **Animasi:** hinge puppetry, stage slide, curtain reveal, rhythmic repetition
- **Kamera/layout:** locked theatrical camera with focus shifts
- **Tempo:** ikuti penekanan voiceover atau aksi; buat beat map dahulu. Hindari animasi dekoratif yang tidak memberi informasi.
- **Transisi:** utamakan cut/match action; gunakan efek khusus hanya ketika membantu perubahan makna atau lokasi.

## Audio dan sound design
traditional percussion-inspired foley (original), paper twang. Pastikan VO jelas dan tidak tertutup musik/SFX.

## Yang tidak boleh dilakukan
simbol budaya digunakan tanpa riset, klaim asal-usul tidak tepat. Jangan mengarang data, karakteristik produk, elemen anatomi, atau fakta historis untuk mempercantik visual.

## Urutan kerja khusus style
1. Baca brief dan tentukan satu pesan yang harus diingat penonton.
2. Buat beat map berdasarkan naskah/VO; setiap beat memiliki tujuan, durasi, aksi visual, dan informasi yang divalidasi.
3. Kunci style bible (palet, material, geometri, contoh pose/objek, tipografi).
4. Buat frame kunci untuk awal-tengah-akhir sebelum produksi penuh.
5. Produksi gerak mengikuti arahan di atas. Gunakan layout, bentuk, teks, grafik 2D/2.5D. Semua nilai data, satuan, label dan klaim harus berasal dari sumber yang diberikan pengguna.
6. Render preview resolusi rendah; cek teks, kontinuitas, kesalahan fakta, frame kosong, dan sinkron audio.
7. Render final sesuai fps/rasio yang diminta setelah cek kemampuan perangkat.

## Contoh brief siap pakai
> Buat video berdurasi 30 detik, kategori motion-graphics, style `HIKAYAT`, ide: "Cerita rakyat singkat ditampilkan sebagai bayang-bayang.". Output 9:16, Bahasa Indonesia. Buat storyboard per beat, style bible, prompt aset, arahan kamera, timeline, audio cue, QA dan langkah render. Jangan mengarang data. Jika bisa mengeksekusi tool, buat preview dulu sebelum final.

## Kontrak output agent
Untuk setiap shot, keluarkan `shot_id`, `start_s`, `end_s`, `voiceover`, `visual_description`, `asset_prompt`, `camera`, `motion`, `on_screen_text`, `sfx`, `transition`, dan `validation_notes`.
