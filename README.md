
## 🌐 Basics (applies to everything)

* **All URLs start with** `/api`
* **You send and get back** JSON (text your code can read)
* **Authentication** uses a “JWT” token you include as

  ```
  Authorization: Bearer <your-token-here>
  ```
* **Errors look like**:

  ```json
  {
    "error": {
      "type": "VALIDATION_ERROR",      // what kind of problem
      "message": "Name is required.",   // human-friendly summary
      "details": [                      // exact field(s) at fault
        { "path": "cat.name", "message": "Name is required." }
      ]
    }
  }
  ```

---

## 🔐 1. Authentication (logging in & out)

```http
POST /api/auth/signup       # Sign up: give email+password → “User created!”
POST /api/auth/signin       # Sign in: give email+password → get back your JWT
POST /api/auth/signout      # Sign out: tells server to forget your session
```

* **Why?**

  * *signup* → create your account
  * *signin* → get the “key” (token) you’ll use for all other requests
  * *signout* → end your session

---

## 🐱 2. Cat Management

### a) Add a new cat

```http
POST /api/cats              # Upload a photo of your new cat
Body:
{
  "image": "<base64-or-url>"  # picture file or link
}
→ 201 { "id": "cat123", "spriteTemplate": "...", ... }
```

> *# Server stores the picture, gives you an ID to refer to it.*

### b) List your cats

```http
GET /api/cats               # “What cats do I have?”
→ 200 [
     { "id":"cat123", "name":"Fluffy", "imageURL":"...", ... },
     …
   ]
```

> *# Server returns all your saved cats, with their data.*

### c) Update cat info

```http
PUT /api/cats/:catId        # Change name or description
Body:
{ "name":"Mr. Whiskers" }
→ 200 { updated cat object }
```

> *# Use your cat’s ID to rename or tweak its details.*

### d) Change cat picture

```http
POST /api/cats/:catId/photo # Upload a new photo for that cat
Body:
{ "image":"<new-base64-or-url>" }
→ 200 { new spriteTemplate, image link }
```

> *# Replace the old image. Counts toward daily upload limit.*

### e) Delete a cat

```http
DELETE /api/cats/:catId     # Remove a cat forever
→ 200 { "message":"Cat deleted." }
```

> *# Use when you want to get rid of an entry.*

---

## 👗 3. Fashion Show

### a) Submit an outfit

```http
POST /api/fashion/entries
Body:
{
  "catId":"cat123",
  "outfit":{ "hat":"flower-crown", "shoes":"pink-paws" }
}
→ 201 { "entryId":"entry456" }
```

> *# You picked items and paired them on your cat.*

### b) View all entries

```http
GET /api/fashion/entries
→ 200 [
     {
       "entryId":"entry456",
       "cat":{ "name":"Fluffy","imageURL":"..." },
       "outfit":{…},
       "votes":42
     },
     …
   ]
```

> *# See everyone’s submissions and current vote counts.*

### c) Vote

```http
POST /api/fashion/entries/:entryId/vote
→ 200 { "message":"Vote submitted!" }
```

> *# Cast one vote per entry (can’t vote your own).*

### d) Get results

```http
GET /api/fashion/results/:sessionId
→ 200 {
     "standings":[ { "entryId":"entry456", "votes":42, "coinsAwarded":10 }, … ],
     "totalPool":125
   }
```

> *# See final rankings and how many in-game coins each won.*

---

## 🛍️ 4. Shop & Inventory

### a) Browse items

```http
GET /api/shop/items?category=hat
→ 200 [ { "itemId":"hat01","name":"Bowler",… }, … ]
```

> *# Look at what’s for sale in each category.*

### b) Buy something

```http
POST /api/shop/purchase
Body: { "itemId":"hat01" }
→ 200 { "balance":800, "ownedItemId":"hat01" }
```

> *# Spend coins to own that item.*

### c) Manage equips

```http
POST   /api/inventory/cats/:catId/equip     # Put item on a cat
DELETE /api/inventory/cats/:catId/unequip   # Remove item from a cat
GET    /api/inventory                      # View all your cats, items, coin balance
```

> *# Dress up your cats and see what you own.*

---

## 📬 5. Mailbox (in-game chat & support)

```http
GET  /api/mailbox?filter=unread|all        # List conversations
GET  /api/mailbox/:caseId/messages         # Read messages in one thread
POST /api/mailbox                          # Start new thread (support case)
POST /api/mailbox/:caseId/messages         # Send a reply
POST /api/mailbox/:caseId/mark-read        # Mark messages as read
```

> *# Talk to other players or send support requests.*

---

## 🛠️ 6. Admin Panel (for game operators)

* **Admin login/logout**:

  ```http
  POST /api/admin/auth/signin
  POST /api/admin/auth/signout
  ```
* **Manage players**:

  ```http
  GET /api/admin/players
  GET /api/admin/players/:playerId
  ```
* **Broadcast messages**:

  ```http
  GET /api/admin/broadcasts
  POST /api/admin/broadcasts
  ```
* **Handle support cases**:

  ```http
  GET  /api/admin/cases
  PUT  /api/admin/cases/:caseId/close
  ```
* **Edit game content** (cats, items):

  ```http
  GET/POST/PUT/DELETE /api/admin/cats
  GET/POST/PUT/DELETE /api/admin/items
  ```

> *# Admins can see everything, send announcements, fix bugs, and manage in-game data.*

---

