# removid / fast

Kit dari arsip `files(1).zip`, diintegrasikan untuk video ≤45 detik tanpa narasi. Baca [FAST.md](FAST.md) saat memakai kit. `install.sh` memasangnya bersama skill induk, baik symlink maupun `--copy`.

- Router `scripts/pick.mjs` merangkum palet, token dan resep untuk 36 style. Palet/token tetap dibaca dari tabel induk; `data/recipes.json` berisi keputusan desain tambahan (teks, latar, kamera, SFX, musik, font), bukan data resmi.
- `setup.sh` dan `scripts/cues.mjs` memakai folder proyek dan storyboard yang disetujui. `direction.json` termasuk hash Gate 2, sehingga revisi membatalkan persetujuan lanjutan. Timing gambar dan bunyi berasal dari plan yang sama.
- `kit/motion.tsx` dan `example/src` menyediakan scene siap pakai; Remotion merender klip 60 fps. HyperFrames tetap mengerjakan pemotongan, transisi, dan audio.
- `scripts/audio.sh` mensintesis musik/efek dengan Python (numpy/scipy), lalu memvalidasi loudness memakai ffmpeg lengkap. Ia tidak memasang Python, dependensi Python, atau voice engine. Setup memasang paket npm dan font untuk proyek.
- `scripts/qa.sh` memeriksa video dan membuat contact sheet. Pemeriksaan otomatis melengkapi inspeksi gambar dan pendengaran.

Integrasi ini mempertahankan intake dan gate repo. Dukungan 3D kit terbatas pada 2.5D; narasi, footage, kursor dan zoom target memakai starter penuh. File video demo dari arsip tidak dimasukkan ke repo. Angka benchmark dan perkiraan penghematan token dari paket asal belum dibuktikan sebagai hasil agent di repo ini.

Pengujian: `node --test tests/fast.test.mjs`, `./test.sh`; pemeriksaan render kit ikut `./test.sh --full`. Gunakan `REMOVID_FFMPEG` untuk ffmpeg lengkap dan `REMOVID_PYTHON` untuk interpreter dengan numpy/scipy bila ingin menjalankan uji audio.
