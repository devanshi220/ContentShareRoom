# PulsePad — API Documentation

**Base URL:** `http://localhost:8080`

---

## Authentication APIs

### 1. Sign Up

| | |
|---|---|
| **URL** | `/api/auth/signup` |
| **Method** | `POST` |
| **Auth Required** | No |
| **Content-Type** | `application/json` |

**Request Body:**
```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "mypassword"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huIiw...",
  "username": "john"
}
```

**Error Responses (400):**
```json
{ "error": "Username already exists" }
```
```json
{ "error": "Email already exists" }
```

---

### 2. Login

| | |
|---|---|
| **URL** | `/api/auth/login` |
| **Method** | `POST` |
| **Auth Required** | No |
| **Content-Type** | `application/json` |

**Request Body:**
```json
{
  "username": "john",
  "password": "mypassword"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huIiw...",
  "username": "john"
}
```

**Error Response (400):**
```json
{ "error": "Invalid username or password" }
```

---

### 3. Get Current User

| | |
|---|---|
| **URL** | `/api/auth/me` |
| **Method** | `GET` |
| **Auth Required** | Yes — `Authorization: Bearer <token>` |

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huIiw...
```

**Success Response (200):**
```json
{ "username": "john" }
```

**Error Response (400):**
```json
{ "error": "Invalid token" }
```

---

## Room / Editor APIs

### 4. Get Room Initial State

| | |
|---|---|
| **URL** | `/api/room/{roomId}` |
| **Method** | `GET` |
| **Auth Required** | No |

**Path Parameters:**
- `roomId` — The 6-digit room ID (e.g. `482916`)

**Success Response (200):**

*When room has content:*
```json
{
  "content": [1, 2, 0, 3, 132, 45, ...]
}
```

*When room is empty / doesn't exist:*
```json
{
  "content": null
}
```

> **Note:** The `content` array is a Yjs binary update encoded as a list of integers (byte values).

---

### 5. Get Room User Count

| | |
|---|---|
| **URL** | `/api/room/{roomId}/users` |
| **Method** | `GET` |
| **Auth Required** | No |

**Path Parameters:**
- `roomId` — The 6-digit room ID

**Success Response (200):**
```
2
```

> Returns a plain integer — the number of currently connected users.

---

### 6. Check Room Join Availability

| | |
|---|---|
| **URL** | `/api/room/{roomId}/check-join` |
| **Method** | `GET` |
| **Auth Required** | No |

**Path Parameters:**
- `roomId` — The 6-digit room ID

**Success Response (200) — Room has space:**
```json
{ "success": true }
```

**Error Response (400) — Room is full:**
```json
{ "error": "Room is full. Maximum 3 users allowed." }
```

---

## WebSocket (STOMP) Endpoints

**WebSocket URL:** `ws://localhost:8080/ws`

### 7. Broadcast Code Update

| | |
|---|---|
| **Destination** | `/app/code/{roomId}` |
| **Subscribe** | `/topic/room/{roomId}` |
| **Protocol** | STOMP over WebSocket |

**Message Body (sent & received):**
```json
{
  "content": [1, 2, 0, 3, 132, 45, ...]
}
```

> The `content` is the full Yjs document state encoded as a list of integers. Sent by a client after a typing debounce (400ms). All subscribers to `/topic/room/{roomId}` receive the update.

---

### 8. Broadcast Cursor / Awareness Update

| | |
|---|---|
| **Destination** | `/app/cursor/{roomId}` |
| **Subscribe** | `/topic/cursor/{roomId}` |
| **Protocol** | STOMP over WebSocket |

**Message Body (sent & received):**
```json
{
  "awareness": [1, 234, 12, 0, 3, ...]
}
```

> The `awareness` array is a Yjs awareness protocol update encoded as a list of integers. Contains cursor position and user info (name, color).

---

## Background Scheduled Tasks

### 9. Room Memory Cleanup

| | |
|---|---|
| **Trigger** | Every 60 seconds (`@Scheduled(fixedRate = 60000)`) |
| **Action** | Removes room content from server memory |
| **Condition** | Room has 0 connected users AND content hasn't been updated in 24 hours |

> This is not an API endpoint — it runs automatically on the server.
