# Cyber Speedometer Dashboard

Speedometer bergaya cyberpunk (busur RPM, kecepatan digital, bahan bakar, gigi, mesin, health, odometer, sein, lampu, sabuk pengaman) yang mengikuti API dari `jgvrp-speedometer-template`.

## Struktur file
- `index.html`, `styles.css`, `script.js` — halaman utama (path absolut `/styles.css`, `/script.js` seperti template)
- `_headers` — konfigurasi Cloudflare Pages (tidak diubah dari template)
- `fonts/` — font Orbitron (lisensi OFL) yang disajikan lokal, karena CSP hanya mengizinkan `font-src 'self'`

## Fungsi (sama dengan template)
| Fungsi | Parameter |
|---|---|
| `setEngine(state)` | boolean |
| `setSpeed(speed)` | number, **m/s** |
| `setRPM(rpm)` | number **0–1** |
| `setFuel(fuel)` | number 0–1 |
| `setHealth(health)` | number 0–1 |
| `setGear(gear)` | string/number, `0` = netral/mundur (tampil `N/R`) |
| `setHeadlights(state)` | 0 mati, 1 nyala, 2 lampu jauh |
| `setLeftIndicator(state)` / `setRightIndicator(state)` | boolean |
| `setSeatbelts(state)` | boolean (`false` = ikon merah berkedip) |
| `setSpeedMode(mode)` | 0 KMH, 1 MPH, 2 Knots |
| `setOdometer(distance)` | number, **mil** (tampil otomatis dalam KM/MI/NM sesuai mode) |

Fungsi aman dipanggil sebelum DOM siap; nilainya disimpan lalu dirender setelah halaman siap.

## Pengaturan
Ubah `CONFIG` di bagian atas `script.js`: `rpmFull` (RPM saat `setRPM(1)`), `redline` (lampu REV), `gaugeMax`, `margin`.
HUD otomatis mengecil jika area tampil lebih kecil dari 500×330 px.

## Contoh
```javascript
setEngine(true);
setSpeed(25);          // 25 m/s
setRPM(0.6);
setFuel(0.75);
setHealth(0.9);
setGear(3);
setHeadlights(1);
setLeftIndicator(true);
setSeatbelts(true);
setSpeedMode(0);       // KMH
setOdometer(123.4);    // 123.4 mil
```
