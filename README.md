```markdown
# CatWalk Backend API

All endpoints live under `/api`.  
Requests and responses are JSON.  
Protected routes require:
```

Authorization: Bearer <your-jwt-token>

````

---

## ▶️ Player API Flow

### 1. Sign Up / Sign In
```http
POST   /api/auth/signup  
Body:  
{ "email":"you@example.com", "password":"StrongPass123!" }  
→ 201 “User created!”

POST   /api/auth/signin  
Body:  
{ "email":"you@example.com", "password":"StrongPass123!" }  
→ 200 { "token":"<your-jwt>" }

POST   /api/auth/signout  
→ 204
````

> • Create your account, get your token, or sign out.

---

### 2. New-Cat “Adoption” Flow

#### a) Upload & Classify Photo

```http
POST   /api/cats/upload
Body: { "image":"<base64-or-URL>" }
→ 200 {
    "classificationId":"cls123",
    "templateId":"siamese-default-seal",
    "spriteURL":"https://…/siamese-seal.png",
    "autoName":"Luna",
    "autoDesc":"Seal-point Siamese"
  }
```

> • Counts toward your **5 daily uploads/edits**.
> • Server runs LLM classification up to 3 tries and picks a sprite.

#### b) Confirm Adoption

```http
POST   /api/cats/adopt
Body: {
  "classificationId":"cls123",
  "name":"My Luna?",      // optional override
  "description":"Fluffy and curious"
}
→ 201 { "catId":"cat456" }
```

> • Saves the new cat in your album (max **25 cats**).

---

### 3. Manage Your Cats

#### List Cats

```http
GET    /api/cats
→ 200 [
  { "id":"cat456","name":"My Luna","imageURL":"…","createdAt":"…" },
  …
]
```

#### Update Name/Description

```http
PUT    /api/cats/:catId
Body: { "name":"New Name","description":"…" }
→ 200 { updated cat object }
```

#### Replace Photo

```http
POST   /api/cats/:catId/photo
Body: { "image":"<new-base64-or-URL>" }
→ 200 {
    "classificationId":"cls789",
    "templateId":"…",
    "spriteURL":"…",
    "autoName":"…",
    "autoDesc":"…"
  }
```

> • Counts toward daily limit; preview only.

#### Re-process Same Photo

```http
POST   /api/cats/:catId/refresh
→ 200 { new classification preview… }
```

> • Also counts against your 5 uploads/day.

#### Delete a Cat

```http
DELETE /api/cats/:catId
→ 200 { "message":"Cat deleted." }
```

---

### 4. Fashion Show (Player)

#### Submit Outfit

```http
POST   /api/fashion/entries
Body: {
  "catId":"cat456",
  "outfit":{ "hat":"flower-crown","shoes":"pink-paws",… }
}
→ 201 { "entryId":"e789" }
```

#### View All Entries

```http
GET    /api/fashion/entries
→ 200 [
  { entryId, cat:{name,imageURL}, outfit, votes },
  …
]
```

#### Vote on an Entry

```http
POST   /api/fashion/entries/:entryId/vote
→ 200 { "message":"Vote submitted!" }
```

> • One vote per entry; you can’t vote your own.

#### Get Final Results

```http
GET    /api/fashion/results/:sessionId
→ 200 {
    standings:[ { entryId, votes, coinsAwarded }, … ],
    totalPool:125
  }
```

---

### 5. Shop & Inventory

#### Browse Store

```http
GET    /api/shop/items?category=hat
→ 200 [ { itemId,name,category,price,spriteURL }, … ]
```

#### Purchase Item

```http
POST   /api/shop/purchase
Body: { "itemId":"hat01" }
→ 200 { "balance":800, "ownedItemId":"hat01" }
```

#### Equip / Unequip

```http
POST   /api/inventory/cats/:catId/equip
Body: { "itemId":"hat01" }
→ 200 { catId, equipped:[…] }

DELETE /api/inventory/cats/:catId/unequip
Body: { "itemId":"hat01" }
→ 200 { catId, equipped:[…] }

GET    /api/inventory
→ 200 { cats:[…], items:[…], coins:<int> }
```

---

### 6. Mailbox (Player-Admin Chat)

```http
GET    /api/mailbox?filter=unread|all        # list threads
GET    /api/mailbox/:caseId/messages         # read thread
POST   /api/mailbox                          # open new case
POST   /api/mailbox/:caseId/messages         # reply in case
POST   /api/mailbox/:caseId/mark-read        # mark read
```

---

## 🛠️ Admin API Flow

All admin routes live under `/api/admin` and require an **Admin**-level JWT.

### 1. Admin Auth

```http
POST   /api/admin/auth/signin  
Body: { "email":"admin@example.com","password":"AdminPass!" }  
→ 200 { "token":"<admin-jwt>" }

POST   /api/admin/auth/signout  
→ 204
```

---

### 2. Global Cat Templates

```http
GET    /api/admin/cats
→ 200 [ { templateId, breed, variant, palette, spriteURL, description, createdAt }, … ]

POST   /api/admin/cats
Body: { breed, variant, palette, spriteURL, description }
→ 201 { templateId }

PUT    /api/admin/cats/:templateId
Body: { …updates… }
→ 200 { updated template }

DELETE /api/admin/cats/:templateId
→ 200 { "message":"Template deleted; notify affected players manually." }
```

---

### 3. Global Item Management

```http
GET    /api/admin/items
→ 200 [ { itemId,name,category,price,spriteURL }, … ]

POST   /api/admin/items
Body: { name, category, price, spriteURL }
→ 201 { itemId }

PUT    /api/admin/items/:itemId
Body: { …updates… }
→ 200 { updated item }

DELETE /api/admin/items/:itemId
→ 200 { "message":"Item removed; refunds issued." }
```

---

### 4. Player Accounts

```http
GET    /api/admin/players
→ 200 [ { playerId,email,createdAt,lastLogin,catCount,coinBalance,uploadUsage }, … ]

GET    /api/admin/players/:playerId
→ 200 { profile, cats, items, mailboxOverview, uploadQuota:{used,remaining} }
```

---

### 5. Broadcasts & Support Cases

```http
GET    /api/admin/broadcasts
→ 200 [ { id,title,body,sentAt }, … ]

POST   /api/admin/broadcasts
Body: { title, body }
→ 201

GET    /api/admin/cases
→ 200 [ { caseId,playerId,title,status }, … ]

PUT    /api/admin/cases/:caseId/close
→ 200 { "message":"Case closed." }
```

---

### 6. Fashion Show Management (Admin)

```http
GET    /api/admin/fashion/sessions
→ 200 [ …sessions… ]

POST   /api/admin/fashion/sessions
Body: { requiredParticipants, votingDurationSec }
→ 201 { showId, status:"waiting", … }

GET    /api/admin/fashion/sessions/:showId
→ 200 { show details }

PUT    /api/admin/fashion/sessions/:showId
Body: { status:"display"|"voting"|"results"|"completed" }
→ 200 { updated session }

DELETE /api/admin/fashion/sessions/:showId
→ 200 { "message":"Session removed." }

GET    /api/admin/fashion/sessions/:showId/participants
→ 200 [ …participants with votes & payouts… ]

GET    /api/admin/fashion/sessions/:showId/votes
→ 200 [ …individual vote records… ]
```

---

## 🕒 Quotas & Limits

* **Max cats per player:** 25
* **Daily uploads/edits:** 5 (resets at 00:00 server time)
* **Starting coins:** 100

```
```
