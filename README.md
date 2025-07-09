
---

# 🐾 CatWalk - Backend Web App API Specification

This document defines the API contract between the frontend (HTML/CSS/JS or Unity WebGL) and the backend (Node.js/Express) for the cat fashion competition game **CatWalk**.

---

## 🌐 General Best Practices

* **Base URL:** All routes are prefixed with `/api`
* **Authentication:** JWT-based. Use `Authorization: Bearer <token>`
* **Data Format:** All request and response bodies are JSON
* **Error Format:**

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "path": "cat.name", "message": "Name is required." }
    ]
  }
}
```

| Error Type                | Code | Use Case                    |
| ------------------------- | ---- | --------------------------- |
| `VALIDATION_ERROR`        | 400  | Bad input or missing fields |
| `AUTHENTICATION_ERROR`    | 401  | Invalid/missing JWT         |
| `FORBIDDEN_ERROR`         | 403  | Unauthorized action         |
| `NOT_FOUND`               | 404  | Resource not found          |
| `BUSINESS_RULE_VIOLATION` | 422  | Duplicate or logic conflict |
| `UNEXPECTED_ERROR`        | 500  | Internal server error       |

---

## 🔐 Authentication Endpoints

### POST `/api/auth/signup`

Creates a new user.

**Body:**

```json
{
  "email": "catlover@example.com",
  "password": "StrongCatPass123!"
}
```

**Response (201):**

```json
{ "message": "User created successfully. Please sign in." }
```

---

### POST `/api/auth/signin`

Authenticates a user and returns a JWT.

**Body:**

```json
{
  "email": "catlover@example.com",
  "password": "StrongCatPass123!"
}
```

**Response (200):**

```json
{ "token": "jwt_token_here" }
```

---

## 🐱 Cat Endpoints

### POST `/api/cats`

Uploads a new cat. **Auth required**

**Body:**

```json
{
  "name": "Whiskers",
  "image": "base64_or_url",
  "breed": "Siamese"
}
```

**Response (201):**

```json
{ "id": "cat_id", "message": "Cat uploaded!" }
```

---

### GET `/api/cats`

Returns user's cats. **Auth required**

**Response (200):**

```json
[
  {
    "id": "cat_id",
    "name": "Whiskers",
    "image": "url_or_base64",
    "createdAt": "2025-07-08T18:00:00.000Z"
  }
]
```

---

### DELETE `/api/cats/:id`

Deletes a cat by ID. **Auth required**

**Response (200):**

```json
{ "message": "Cat deleted." }
```

---

## 👗 Fashion System

### POST `/api/fashion`

Submits a fashion outfit for a cat. **Auth required**

**Body:**

```json
{
  "catId": "cat_id",
  "outfit": {
    "hat": "flower-crown",
    "accessory": "bowtie",
    "shoes": "pink-paws"
  }
}
```

**Response (201):**

```json
{ "entryId": "entry_id", "message": "Outfit submitted!" }
```

---

### GET `/api/fashion/show`

Returns all current fashion show entries. **Public**

**Response (200):**

```json
[
  {
    "cat": {
      "name": "Whiskers",
      "image": "url"
    },
    "outfit": {
      "hat": "flower-crown",
      "accessory": "bowtie"
    },
    "votes": 42
  }
]
```

---

### POST `/api/fashion/vote/:entryId`

Votes on a fashion entry. **Auth required**

**Response (200):**

```json
{ "message": "Vote submitted!" }
```

---
