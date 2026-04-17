# Login Dashboard (Prisma + MySQL)

Project ini menggunakan Next.js App Router dengan autentikasi login superuser menggunakan Prisma yang terkoneksi ke MySQL.

## Alur aplikasi

- Tidak ada halaman registrasi/sign up.
- User login dari halaman `/login`.
- Jika login berhasil dan role adalah `SUPERUSER`, user akan diarahkan ke `/dashboard`.

## Konfigurasi environment

Isi file `.env` dengan koneksi MySQL:

```bash
DATABASE_URL="mysql://username:password@localhost:3306/nama_database"
SUPERUSER_EMAIL="superuser@example.com"
SUPERUSER_PASSWORD="Superuser123!"
```

`SUPERUSER_EMAIL` dan `SUPERUSER_PASSWORD` dipakai saat proses seed user awal.

## Menjalankan project

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
```

## Kredensial awal superuser

Setelah menjalankan seed:

- Email: nilai dari `SUPERUSER_EMAIL` (default: `superuser@example.com`)
- Password: nilai dari `SUPERUSER_PASSWORD` (default: `Superuser123!`)
