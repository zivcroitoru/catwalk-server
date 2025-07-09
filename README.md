
```markdown
# CatWalk Backend API

All URLs start with `/api`.  
You send JSON in the body, and get JSON back.  
Authentication (for protected routes) uses:
```

Authorization: Bearer <your-jwt-token>

````

---

## ▶️ Player API Flow

### 1. Sign Up / Sign In
```http
POST /api/auth/signup
Body:
{ "email":"you@example.com", "password":"StrongPass123!" }
→ 201 “User created!”

POST /api/auth/signin
Body:
{ "email":"you@example.com", "password":"StrongPass123!" }
→ 200 { "token":"<your-jwt>" }
````

> *# Create your account and get your token.*

---

### 2. Manage **Your** Cats

#### a) Add a New Cat

```http
POST /api/cats
Body:
{ "image":"<base64-or-url>" }
→ 201 { "id":"cat123", "spriteTemplate":"…", "generatedName":"Whiskers" }
```

> *# Upload a photo, server returns an ID + fun auto-name.*

#### b) List Your Cats

```http
GET /api/cats
→ 200 [
  { "id":"cat123", "name":"Whiskers", "imageURL":"…", "createdAt":"…" },
  …
]
```

> *# See all cats you’ve uploaded.*

#### c) Update Cat Details

```http
PUT /api/cats/:catId
Body:
{ "name":"Mr. Whiskers", "desc":"Fluffy Siamese" }
→ 200 { updated cat object }
```

> *# Change name or description.*

#### d) Replace Cat Photo

```http
POST /api/cats/:catId/photo
Body:
{ "image":"<new-base64-or-url>" }
→ 200 { new spriteTemplate + image link }
```

> *# Swap in a fresh photo (max 5 uploads/day).*

#### e) Delete a Cat

```http
DELETE /api/cats/:catId
→ 200 { "message":"Cat deleted." }
```

> *# Remove it from your library.*

---

### 3. Fashion Show Entries

#### a) Submit Outfit

```http
POST /api/fashion/entries
Body:
{ "catId":"cat123",
  "outfit":{ "hat":"flower-crown", "shoes":"pink-paws" }
}
→ 201 { "entryId":"entry456" }
```

> *# Dress up your cat for the contest.*

#### b) View All Entries

```http
GET /api/fashion/entries
→ 200 [
  { "entryId":"entry456",
    "cat":{ "name":"Whiskers", "imageURL":"…" },
    "outfit":{…}, "votes":42 },
  …
]
```

> *# Browse the gallery and vote counts.*

#### c) Vote on an Entry

```http
POST /api/fashion/entries/:entryId/vote
→ 200 { "message":"Vote submitted!" }
```

> *# Cast a vote (not on your own entry).*

#### d) Get Final Results

```http
GET /api/fashion/results/:sessionId
→ 200 {
  "standings":[ { "entryId":"entry456", "votes":42, "coinsAwarded":10 }, … ],
  "totalPool":125
}
```

> *# See who won and coin prizes.*

---

### 4. Shop & Inventory

#### a) Browse Store Items

```http
GET /api/shop/items?category=hat
→ 200 [ { "itemId":"hat01","name":"Bowler","price":50 }, … ]
```

> *# What’s for sale?*

#### b) Purchase an Item

```http
POST /api/shop/purchase
Body:
{ "itemId":"hat01" }
→ 200 { "balance":800, "ownedItemId":"hat01" }
```

> *# Spend coins to own it.*

#### c) Equip / Unequip

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

> *# Dress your cat and check your lootbag.*

---

### 5. Mailbox (Chat & Support)

```http
GET  /api/mailbox?filter=unread|all      # List threads
GET  /api/mailbox/:caseId/messages       # Read thread
POST /api/mailbox                        # Open new support case
POST /api/mailbox/:caseId/messages       # Reply in case
POST /api/mailbox/:caseId/mark-read      # Mark as read
```

> *# Talk to players or support.*

---

## 🛠️ Admin API Flow

> **All Admin URLs** start with `/api/admin` and require an Admin‐level token.

### 1. Admin Auth

```http
POST /api/admin/auth/signin
Body: { "email":"admin@example.com","password":"AdminPass!" }
→ 200 { "token":"<admin-jwt>" }

POST /api/admin/auth/signout
→ 204
```

> *# Login/out as an administrator.*

---

### 2. Global Cat Templates

```http
GET    /api/admin/cats
→ 200 [ { templateId, breedInfo, spriteTemplate,… } ]

POST   /api/admin/cats
Body: { breed:"Siamese", spriteTemplate:"…", defaultDesc:"…" }
→ 201 { templateId }

PUT    /api/admin/cats/:templateId
Body: { …fields to update… }
→ 200 { updated template }

DELETE /api/admin/cats/:templateId
→ 200 { message:"Deleted from catalog." }
```

> *# Manage the master list of cat breeds and sprites.*

---

### 3. Global Item Management

```http
GET    /api/admin/items
→ 200 [ { itemId,name,category,price,spriteURL }, … ]

POST   /api/admin/items
Body: { name:"Bowler", category:"hat", price:50, spriteURL:"…" }
→ 201 { itemId }

PUT    /api/admin/items/:itemId
Body: { …updates… }
→ 200 { updated item }

DELETE /api/admin/items/:itemId
→ 200 { message:"Item removed; refunds issued." }
```

> *# Control what players can buy.*

---

### 4. Player Accounts

```http
GET    /api/admin/players
→ 200 [ { playerId, email, createdAt, catCount, coinBalance }, … ]

GET    /api/admin/players/:playerId
→ 200 {
  profile:{…}, cats:[…], items:[…], cases:[…], quotas:{used,remaining}
}
```

> *# Inspect or audit any player’s data.*

---

### 5. Broadcasts & Support Cases

```http
GET    /api/admin/broadcasts
→ 200 [ { id,title,body,sentAt }, … ]

POST   /api/admin/broadcasts
Body: { title:"Welcome!", body:"Enjoy the new update." }
→ 201

GET    /api/admin/cases
→ 200 [ { caseId, playerId, title, status }, … ]

PUT    /api/admin/cases/:caseId/close
→ 200 { message:"Case closed." }
```

> *# Send game-wide announcements and close player support tickets.*

---



* **Players** use the non-`/admin` routes to manage their own cats, entries, coins and messages.
* **Admins** use `/api/admin` to control the global catalog, items, players, broadcasts and support.
