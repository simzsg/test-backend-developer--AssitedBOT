# AssistedBOT Crypto Backend

บริการ REST/Socket สำหรับติดตามราคาเหรียญคริปโตและจัดการผู้ใช้ที่สร้างด้วย Node.js + Express, Prisma (MySQL), BullMQ และ Socket.IO โค้ดหลักอยู่ใน `src/` โดยเริ่มต้นที่ `src/index.js` ซึ่งจะเปิด HTTP server, สมัครงานคิวสำหรับดึงข้อมูลราคา และเชื่อมต่อ Binance WebSocket อัตโนมัติ

## ความต้องการระบบ
- Node.js 18 หรือใหม่กว่า
- MySQL สำหรับเก็บข้อมูล (ตั้งค่าผ่าน `DATABASE_URL`)
- Redis สำหรับ BullMQ (`REDIS_URL`)
- การเข้าถึงอินเทอร์เน็ตเพื่อดึงข้อมูลราคาจาก Binance REST/WS (ปิดได้โดยแก้ .env)

## การตั้งค่าและรันระบบ
1. กำหนดค่าไฟล์ `.env` (ตัวอย่างใน repo มีให้แล้ว) ให้ถูกต้อง โดยกำหนดค่า
   - `DATABASE_URL`, `REDIS_URL`
   - `JWT_SECRET`, `JWT_ISSUER`, `JWT_EXPIRES`
   - `WATCH_SYMBOLS` ถ้าต้องการกำหนดเหรียญที่เฝ้าดู
2. ติดตั้ง dependency  
   ```bash
   npm install
   ```
3. สร้าง Prisma Client และฐานข้อมูล (แก้ชื่อ migration ได้ตามต้องการ)  
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
4. เริ่มเซิร์ฟเวอร์ (จะเริ่ม BullMQ worker และ Binance WS ภายในโปรเซสเดียวกัน)  
   ```bash
   npm run dev    # มี nodemon
   # หรือ
   npm start
   ```

HTTP server จะเปิดที่ `http://localhost:4000` (ปรับได้ผ่าน `PORT`) และ Socket.IO จะใช้พอร์ตเดียวกัน

## WebSocket
- URL: `ws://<host>:<port>`
- ใช้ Socket.IO client
- ต้องส่งโทเคน JWT ผ่าน
  - `Authorization: Bearer <token>` ใน header handshake หรือ
  - `auth: { token: "<token>" }` ตอน connect
- Event ที่มี:
  - `users:hello` (server -> client เมื่อเชื่อมต่อสำเร็จ)
  - `users:event` (ส่งเมื่อมี user สร้าง/แก้ไข/ลบ; admin จะเห็นทุก event, user เห็นของตัวเอง)

## รูปแบบการตอบกลับ
- สำเร็จ: `{ "ok": true, ... }`
- ผิดพลาด: `{ "error": "<ข้อความอธิบาย>" }` พร้อม HTTP status ตามสาเหตุ

## เอกสาร API
### 1. ระบบ Health
#### `GET /health`
- **Auth:** ไม่ต้อง
- **Description:** ใช้สำหรับตรวจสอบสถานะเซิร์ฟเวอร์
- **Response 200**
  ```json
  { "ok": true }
  ```

### 2. Authentication (`/api/auth`)
#### `POST /api/auth/register`
- **Auth:** ไม่ต้อง
- **Body (JSON):**
  ```json
  { "email": "user@example.com", "password": "string", "name": "string" }
  ```
- **Response 201**
  ```json
  {
    "ok": true,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User",
      "role": "MEMBER",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
  ```
- **Errors:** 400 (ข้อมูลไม่ครบ), 409 (อีเมลซ้ำ)

#### `POST /api/auth/login`
- **Auth:** ไม่ต้อง
- **Body (JSON):**
  ```json
  { "email": "user@example.com", "password": "string" }
  ```
- **Response 200**
  ```json
  {
    "ok": true,
    "token": "<JWT>",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User",
      "role": "MEMBER"
    }
  }
  ```
- **Errors:** 400 (ข้อมูลไม่ครบ), 401 (อีเมล/รหัสผ่านไม่ถูก), 403 (บัญชีถูกปิด)

#### `GET /api/auth/me`
- **Auth:** Bearer JWT
- **Description:** อ่านข้อมูลผู้ใช้ปัจจุบัน
- **Response 200**
  ```json
  {
    "ok": true,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User",
      "role": "MEMBER",
      "isDisabled": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
  ```

#### `PATCH /api/auth/me`
- **Auth:** Bearer JWT
- **Body (JSON):** อัปเดต `name` และ/หรือ `password`
- **Response 200:** `{ "ok": true, "user": { ... } }`
- **Errors:** 400 (ไม่มีฟิลด์ให้อัปเดต)

#### `DELETE /api/auth/me`
- **Auth:** Bearer JWT
- **Description:** ลบบัญชีตัวเอง
- **Response 200:** `{ "ok": true }`
- **Errors:** 404 (ไม่พบผู้ใช้)

### 3. Users (`/api/users`)
> เส้นทางนี้ `router.use(authenticate)` ทุกคำสั่งต้องส่ง Bearer JWT

#### `GET /api/users/me`
- **Description:** อ่านข้อมูลผู้ใช้ปัจจุบัน (สรุปสั้น)
- **Response 200:** `{ "ok": true, "user": { id, email, name, role } }`

#### `POST /api/users`
- **Auth เพิ่มเติม:** role = ADMIN เท่านั้น
- **Body (JSON):**
  ```json
  {
    "email": "someone@example.com",
    "password": "string",
    "name": "string",
    "role": "ADMIN" | "MEMBER"   // ถ้าไม่ส่งจะเป็น MEMBER
  }
  ```
- **Response 201:** `{ "ok": true, "user": { id, email, name, role, createdAt } }`
- **Errors:** 400 (ข้อมูลไม่ครบ), 409 (อีเมลซ้ำ)

#### `GET /api/users`
- **Auth เพิ่มเติม:** ADMIN
- **Query:**
  - `limit` (ค่าเริ่มต้น 20, สูงสุด 100)
  - `offset` (เริ่มต้น 0)
  - `q` (ค้นหาใน email/name แบบ contains ไม่สนตัวพิมพ์)
- **Response 200**
  ```json
  {
    "ok": true,
    "total": 123,
    "items": [
      {
        "id": 5,
        "email": "member@example.com",
        "name": "Member",
        "role": "MEMBER",
        "isDisabled": false,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "limit": 20,
    "offset": 0
  }
  ```

#### `GET /api/users/:id`
- **Access:** เจ้าของเองหรือ ADMIN
- **Response 200:** `{ "ok": true, "user": { ... } }`
- **Errors:** 400 (id ไม่ถูกต้อง), 403 (ไม่ใช่เจ้าของและไม่ใช่ admin), 404 (ไม่พบ)

#### `PATCH /api/users/:id`
- **Access:** เจ้าของสามารถแก้ `name`, `password`; ADMIN เพิ่มเติมสามารถแก้ `email`, `role`, `isDisabled`
- **Body (JSON):** ส่งเฉพาะฟิลด์ที่จะแก้ไข
- **Response 200:** `{ "ok": true, "user": { ... } }`
- **Errors:** 400 (ไม่มีฟิลด์ให้อัปเดตหรือ id ไม่ถูกต้อง), 403 (ไม่มีสิทธิ์), 404 (ไม่พบ), 409 (อีเมลซ้ำ)

#### `DELETE /api/users/:id`
- **Access:** ADMIN เท่านั้น
- **Response 200:** `{ "ok": true }`
- **Errors:** 400 (id ไม่ถูกต้อง), 404 (ไม่พบ)

### 4. Crypto (`/api/crypto`)
> ต้องส่ง Bearer JWT ทุกคำสั่ง และมี header `Cache-Control: no-store` ใน response เพื่อไม่ให้ cache

#### `GET /api/crypto/all`
- **Query:**
  - `limit` (เริ่ม 100 สูงสุด 1000)
  - `offset`
  - `sort` = `symbol` (default) หรือ `eventTime`
  - `order` = `asc`|`desc`
- **Response 200**
  ```json
  {
    "ok": true,
    "total": 12,
    "limit": 100,
    "offset": 0,
    "sort": "symbol",
    "order": "asc",
    "items": [
      {
        "id": 10,
        "symbol": "BTCUSDT",
        "price": "64251.12000000",
        "bid": "64250.99000000",
        "ask": "64251.33000000",
        "volume": "1234.56000000",
        "eventTime": "2025-01-01T00:00:00.000Z",
        "source": "WS"
      }
    ]
  }
  ```

#### `GET /api/crypto/currentPrice`
- **Query:** `symbols=BTCUSDT,ETHUSDT` (ถ้าไม่ส่งจะคืนทั้งหมด)
- **Response 200:** `{ "ok": true, "count": 2, "items": [ { symbol, price, bid, ask, volume, eventTime, updatedAt } ] }`

#### `GET /api/crypto/:symbol`
- **Params:** `symbol` (ไม่สนตัวพิมพ์, จะแปลงเป็นตัวใหญ่)
- **Response 200:** `{ "ok": true, "data": { symbol, price, bid, ask, volume, eventTime, updatedAt } }`
- **Errors:** 400 (ไม่ส่ง symbol), 404 (ไม่มีข้อมูล)

## การทดสอบเบื้องต้นด้วย curl
```bash
# สมัครสมาชิก
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Passw0rd!","name":"Admin"}'

# เข้าสู่ระบบเพื่อรับโทเคน
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Passw0rd!"}' | jq -r .token)

# เรียกดูราคาปัจจุบัน
curl http://localhost:4000/api/crypto/currentPrice \
  -H "Authorization: Bearer $TOKEN"
```

## โครงสร้างฐานข้อมูลหลัก
- `User`: เก็บข้อมูลผู้ใช้และสิทธิ์, flag `isDisabled`
- `PriceSnapshot`: เก็บ snapshot ล่าสุดของแต่ละ symbol (อัปเดตจาก REST/WS)
- `CurrentPrice`: ราคาปัจจุบันสำหรับตอบ API เร็ว ๆ

