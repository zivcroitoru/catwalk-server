```markdown
# CatWalk Backend API

All endpoints live under `/api`.  
Requests and responses are in JSON.  
Protected routes require this header:

```

Authorization: Bearer <your-jwt-token>

````

---

## ▶️ Player API Flow

### 1. Sign Up / Sign In
```http
POST   /api/auth/signup  
Body:  
{ "email": "you@example.com", "password": "StrongPass123!" }  
→ 201 “User created!”

POST   /api/auth/signin  
Body:  
{ "email": "you@example.com", "password": "StrongPass123!" }  
→ 200 { "token": "your-token" }

POST   /api/auth/signout  
→ 204
````

---

### 2. Adopt a New Cat

#### a) Upload Photo → Get Classification

```http
POST   /api/cats/upload
Body: { "image": "<base64-or-url>" }
→ 200 {
  "templateId": "siamese-default-seal",       // classificationId = templateId
  "spriteURL": "https://…/siamese.png",
  "autoName": "Luna",
  "autoDesc": "Seal-point Siamese"
}
```

> • Counts toward **5 uploads/edits per day**.

#### b) Confirm Adoption

```http
POST   /api/cats/adopt
Body: {
  "templateId": "siamese-default-seal",   // from upload step
  "name": "My Luna",                      // optional
  "description": "Fluffy and sweet"       // optional
}
→ 201 { "catId": "cat456" }
```

> • Adds a cat to your collection (max 25 cats).

---

### 3. Manage Your Cats

#### View All Your Cats

```http
GET    /api/cats
→ 200 [ { id, name, spriteURL, templateId, createdAt }, … ]
```

#### Edit Name/Description

```http
PUT    /api/cats/:catId
Body: { "name": "Mimi", "description": "Cozy couch cat" }
→ 200 { updatedCat }
```

#### Upload New Photo

```http
POST   /api/cats/:catId/photo
Body: { "image": "<new image>" }
→ 200 {
  "templateId": "new-template-id",
  "spriteURL": "…",
  "autoName": "NewName",
  "autoDesc": "NewDesc"
}
```

#### Re-process Same Photo

```http
POST   /api/cats/:catId/refresh
→ 200 { templateId, spriteURL, autoName, autoDesc }
```

#### Delete Cat

```http
DELETE /api/cats/:catId
→ 200 { "message": "Cat deleted." }
```

---

### 4. Fashion Show (Player Side)

#### Submit Entry

```http
POST   /api/fashion/entries
Body: {
  "catId": "cat456",
  "outfit": { "hat": "crown", "accessory": "scarf" }
}
→ 201 { "entryId": "e789" }
```

#### View All Entries

```http
GET    /api/fashion/entries
→ 200 [ { entryId, cat: { name, spriteURL }, outfit, votes }, … ]
```

#### Vote

```http
POST   /api/fashion/entries/:entryId/vote
→ 200 { "message": "Vote submitted!" }
```

#### View Results

```http
GET    /api/fashion/results/:sessionId
→ 200 {
  standings: [ { entryId, votes, coinsAwarded }, … ],
  totalPool: 125
}
```

---

### 5. Shop & Inventory

#### Browse Items

```http
GET    /api/shop/items?category=hat
→ 200 [ { itemId, name, category, price, spriteURL }, … ]
```

#### Buy Item

```http
POST   /api/shop/purchase
Body: { "itemId": "hat01" }
→ 200 { "balance": 800, "ownedItemId": "hat01" }
```

#### Equip/Unequip Item

```http
POST   /api/inventory/cats/:catId/equip
Body: { "itemId": "hat01" }

DELETE /api/inventory/cats/:catId/unequip
Body: { "itemId": "hat01" }

GET    /api/inventory
→ 200 { cats: […], items: […], coins: 100 }
```

---

### 6. Mailbox (Support Chat)

```http
GET    /api/mailbox?filter=unread|all
GET    /api/mailbox/:caseId/messages
POST   /api/mailbox                        // new case
POST   /api/mailbox/:caseId/messages      // send message
POST   /api/mailbox/:caseId/mark-read
```

---

## 🛠️ Admin API Flow

All admin routes start with `/api/admin` and require an **admin token**.

### 1. Auth

```http
POST   /api/admin/auth/signin
POST   /api/admin/auth/signout
```

---

### 2. Global Cat Templates

```http
GET    /api/admin/cats
POST   /api/admin/cats
PUT    /api/admin/cats/:templateId
DELETE /api/admin/cats/:templateId
```

---

### 3. Item Management

```http
GET    /api/admin/items
POST   /api/admin/items
PUT    /api/admin/items/:itemId
DELETE /api/admin/items/:itemId
```

---

### 4. Players

```http
GET    /api/admin/players
GET    /api/admin/players/:playerId
```

---

### 5. Broadcasts & Support Cases

```http
GET    /api/admin/broadcasts
POST   /api/admin/broadcasts
GET    /api/admin/cases
PUT    /api/admin/cases/:caseId/close
```

---

### 6. Fashion Show (Admin Side)

```http
GET    /api/admin/fashion/sessions
POST   /api/admin/fashion/sessions
GET    /api/admin/fashion/sessions/:showId
PUT    /api/admin/fashion/sessions/:showId
DELETE /api/admin/fashion/sessions/:showId

GET    /api/admin/fashion/sessions/:showId/participants
GET    /api/admin/fashion/sessions/:showId/votes
```

---

## 🎯 Limits

* **Max Cats per Player:** 25
* **Daily Uploads/Edits:** 5
* **Starting Coins:** 100
* **Each Classification Result:** Uses LLM (up to 3 attempts)
* **classificationId = templateId**

```
```
