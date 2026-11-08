# Style: ZACK-FACTS-INSPIRED

**Kategori:** `motion-3d`  
**Status:** Panduan orisinal berdasarkan interpretasi katalog/galeri publik, **bukan** prompt, kode, atau skill internal KreatorLab.  
**Referensi visual:** Bonus orisinal atau interpretasi; tidak tercantum sebagai style resmi di galeri KreatorLab.

## Tujuan estetika
Short edukasi 3D cepat berstruktur pertanyaan dan pembuktian visual; arahan orisinal, bukan prompt milik kreator.

## DNA visual
- **Tampilan dan material:** Karakter 3D stylized, close-up benda, cutaway interior tubuh/alat, kontras tinggi dan penjelasan sebab-akibat.
- **Palet awal:** warna objek familiar, background clean, rim light hangat-dingin. Jika pengguna punya brand kit, ikuti brand kit selama identitas style tetap terbaca.
- **Aset prioritas:** 3D character sheet, props, cutaway masks, anatomy/engineering references.
- **Tipografi:** headline 2–8 kata per beat dan subtitle singkat. Pilih keluarga font yang legal tersedia; uji pada layar ponsel.
- **Komposisi:** satu focal point dominan per shot; hindari elemen dekoratif tidak relevan.

## Bahasa gerak dan kamera
- **Animasi:** setiap kalimat memunculkan visual baru; cutaway terkontrol, pop-in bagian, impact push hanya di beat kunci.
- **Kamera/layout:** macro to medium, orbit 15–30 derajat, cut to sectional view; hindari kamera liar.
- **Tempo:** ikuti penekanan voiceover atau aksi; buat beat map dahulu. Hindari animasi dekoratif yang tidak memberi informasi.
- **Transisi:** utamakan cut/match action; gunakan efek khusus hanya ketika membantu perubahan makna atau lokasi.

## Audio dan sound design
narration question-payoff, foley tactile, hits secukupnya. Pastikan VO jelas dan tidak tertutup musik/SFX.

## Yang tidak boleh dilakukan
copy karakter/pengisi suara kreator tertentu, fakta medis palsu, kekerasan sensasional, voice clone tanpa izin. Jangan mengarang data, karakteristik produk, elemen anatomi, atau fakta historis untuk mempercantik visual.

## Urutan kerja khusus style
1. Baca brief dan tentukan satu pesan yang harus diingat penonton.
2. Buat beat map berdasarkan naskah/VO; setiap beat memiliki tujuan, durasi, aksi visual, dan informasi yang divalidasi.
3. Kunci style bible (palet, material, geometri, contoh pose/objek, tipografi).
4. Buat frame kunci untuk awal-tengah-akhir sebelum produksi penuh.
5. Produksi gerak mengikuti arahan di atas. Gunakan model 3D dan scene berlapis; pertahankan skala, siluet, shader, dan karakter dari shot ke shot. Cek continuity dan hindari pergerakan kamera yang mengganggu cerita.
6. Render preview resolusi rendah; cek teks, kontinuitas, kesalahan fakta, frame kosong, dan sinkron audio.
7. Render final sesuai fps/rasio yang diminta setelah cek kemampuan perangkat.

## Contoh brief siap pakai
> Buat video berdurasi 30 detik, kategori motion-3d, style `ZACK-FACTS-INSPIRED`, ide: "Kenapa sendok logam terasa lebih dingin daripada kayu pada suhu sama?". Output 9:16, Bahasa Indonesia. Buat storyboard per beat, style bible, prompt aset, arahan kamera, timeline, audio cue, QA dan langkah render. Jangan mengarang data. Jika bisa mengeksekusi tool, buat preview dulu sebelum final.

## Kontrak output agent
Untuk setiap shot, keluarkan `shot_id`, `start_s`, `end_s`, `voiceover`, `visual_description`, `asset_prompt`, `camera`, `motion`, `on_screen_text`, `sfx`, `transition`, dan `validation_notes`.
