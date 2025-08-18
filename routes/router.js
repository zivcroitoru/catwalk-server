// import express from 'express';
// const router = express.Router();

// // ───────────── Controllers ─────────────
// import catController from './controllers/catsController.js';
// import playersController from './controllers/playersControllers.js';
// import shopController from './controllers/shopController.js';
// import playerItemController from './controllers/playeritemController.js';
// import catItemsController from './controllers/catitemController.js';
// import ticketController from './controllers/ticketsController.js';
// import broadcastController from './controllers/broadcastController.js';
// import { signup, login, logout, getMe, updateUser, requireLogin } from './controllers/authController.js';

// // ───────────── Auth Routes ─────────────
// router.post('/auth/signup', signup);
// router.post('/auth/login', login);
// router.post('/auth/logout', logout);
// router.get('/auth/me', requireLogin, getMe);
// router.patch('/auth/user', requireLogin, updateUser);

// // ───────────── Cat Routes ─────────────
// router.get('/api/cats', requireLogin, catController.getPlayerCats);
// router.post('/api/cats', requireLogin, catController.createCat);
// router.patch('/api/cats/:id', requireLogin, catController.updateCat);
// router.delete('/api/cats/:id', requireLogin, catController.deleteCat);
// router.get('/api/cats/allcats', catController.getAllCats);
// router.get('/api/cats/template/:template', catController.getCatByTemplate);
// router.get('/api/cats/player/:playerId', catController.getCatsByPlayer);
// router.post('/api/cats/catadd', catController.addTemplate);
// router.patch('/api/cats/allcats/:id', catController.updateTemplateSprite);
// router.delete('/api/cats/delete/:catId', catController.deleteTemplate);

// // ───────────── Player Routes ─────────────
// router.get('/api/players', playersController.getPlayers);
// router.post('/api/players', playersController.createPlayer);
// router.get('/api/players/:id', playersController.getPlayerById);
// router.put('/api/players/:id', playersController.updatePlayer);
// router.delete('/api/players/:id', playersController.deletePlayer);
// router.get('/api/players/:id/cats', playersController.getPlayerCats);
// router.get('/api/players/:id/items', playersController.getPlayerItems);

// // ───────────── Shop Routes ─────────────
// router.get('/api/shop/shop-items', shopController.getShopItems);
// router.get('/api/shop/allclothes', shopController.getAllClothes);
// router.get('/api/shop', shopController.getShop);
// router.post('/api/shop', shopController.createShopItem);
// router.put('/api/shop/:id', shopController.updateShopItem);
// router.delete('/api/shop/:id', shopController.deleteShopItem);
// router.delete('/api/shop/delete/:itemId', shopController.deleteShopItemById);
// router.patch('/api/shop/edit/:id', shopController.patchShopItem);
// router.get('/api/shop/test', shopController.testShop);
// router.get('/api/shop/:template', shopController.getShopItemByTemplate);
// router.post('/api/shop/clothesadd', shopController.addClothesItem);

// // ───────────── Player Items ─────────────
// router.get('/api/playerItems', requireLogin, playerItemController.getPlayerItems);
// router.post('/api/playerItems/buy', requireLogin, playerItemController.buyPlayerItem);

// // ───────────── Cat Items ─────────────
// router.patch('/api/cat_items/:catId', requireLogin, catItemsController.patchCatEquipment);
// router.get('/api/cat_items/:catId', requireLogin, catItemsController.getCatEquipment);

// // ───────────── Ticket Routes ─────────────
// router.get('/api/tickets', ticketController.getAllTickets);
// router.post('/api/tickets', ticketController.createTicket);
// router.get('/api/tickets/test', ticketController.testTickets);
// router.get('/api/tickets/:ticketId', ticketController.getTicketById);
// router.get('/api/tickets/user/:userId/all', ticketController.getUserTickets);
// router.get('/api/tickets/user/:userId/open', ticketController.getUserOpenTicket);
// router.get('/api/tickets/:ticketId/messages', ticketController.getTicketMessages);
// router.post('/api/tickets/:ticketId/messages', ticketController.sendTicketMessage);
// router.patch('/api/tickets/:ticketId/close', ticketController.closeTicket);

// // ───────────── Broadcast Routes ─────────────
// router.get('/api/broadcasts', broadcastController.getAllBroadcasts);
// router.post('/api/broadcasts', broadcastController.createBroadcast);

// export default router;

// routes/router.js
import express from 'express';
const router = express.Router();

// ───────────── Controllers ─────────────
import catController from './controllers/catsController.js';
import playersController from './controllers/playersControllers.js';
import shopController from './controllers/shopController.js';
import playerItemController from './controllers/playeritemController.js';
import catItemsController from './controllers/catitemController.js';
import ticketController from './controllers/ticketsController.js';
import broadcastController from './controllers/broadcastController.js';
import {
  signup,
  login,
  logout,
  getMe,
  updateUser,
  requireLogin
} from './controllers/authController.js';
import {
  loginAdmin,
  getTickets,
  getTicketMessages,
  respondToTicket
} from './controllers/adminController.js';

// ───────────── Auth Routes ─────────────
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/me', requireLogin, getMe);
router.patch('/auth/user', requireLogin, updateUser);

// ───────────── Cat Routes ─────────────
router.get('/api/cats', requireLogin, catController.getPlayerCats);
router.post('/api/cats', requireLogin, catController.createCat);
router.patch('/api/cats/:id', requireLogin, catController.updateCat);
router.delete('/api/cats/:id', requireLogin, catController.deleteCat);

router.get('/api/cats/allcats', catController.getAllCats);
router.get('/api/cats/template/:template', catController.getCatByTemplate);
router.get('/api/cats/player/:playerId', catController.getCatsByPlayer);
router.post('/api/cats/catadd', catController.addTemplate);
router.patch('/api/cats/allcats/:id', catController.updateCatSprite); // ✅ fixed
router.delete('/api/cats/delete/:catId', catController.deleteTemplate);

// ───────────── Player Routes ─────────────
router.get('/api/players', playersController.getPlayers);
router.post('/api/players', playersController.createPlayer);
router.get('/api/players/:id', playersController.getPlayerById);
router.put('/api/players/:id', playersController.updatePlayer);
router.delete('/api/players/:id', playersController.deletePlayer);
router.get('/api/players/:id/cats', playersController.getPlayerCats);
router.get('/api/players/:id/items', playersController.getPlayerItems);

// ───────────── Shop Routes ─────────────
router.get('/api/shop/shop-items', shopController.getShopItems);
router.get('/api/shop/allclothes', shopController.getAllClothes);
router.get('/api/shop', shopController.getShop);
router.post('/api/shop', shopController.createShopItem);
router.put('/api/shop/:id', shopController.updateShopItem);
router.delete('/api/shop/:id', shopController.deleteShopItem);
router.delete('/api/shop/delete/:itemId', shopController.deleteShopItemById);
router.patch('/api/shop/edit/:id', shopController.patchShopItem);
router.get('/api/shop/test', shopController.testShop);
router.get('/api/shop/:template', shopController.getShopItemByTemplate);
router.post('/api/shop/clothesadd', shopController.addClothesItem);

// ───────────── Player Item Routes ─────────────
router.get('/api/playerItems', requireLogin, playerItemController.getPlayerItems);
// router.post('/api/playerItems', requireLogin, playerItemController.buyPlayerItem);
router.patch('/api/playerItems', requireLogin, playerItemController.addPlayerItem);


// ───────────── Cat Item Routes ─────────────
router.patch('/api/cat_items/:catId', requireLogin, catItemsController.patchCatEquipment);
router.get('/api/cat_items/:catId', requireLogin, catItemsController.getCatEquipment);

// ───────────── Ticket Routes ─────────────
router.get('/api/tickets', ticketController.getAllTickets);
router.post('/api/tickets', ticketController.createTicket);
router.get('/api/tickets/test', ticketController.testTickets);
router.get('/api/tickets/:ticketId', ticketController.getTicketById);
router.get('/api/tickets/user/:userId/all', ticketController.getUserTickets);
router.get('/api/tickets/user/:userId/open', ticketController.getUserOpenTicket);
router.get('/api/tickets/:ticketId/messages', ticketController.getTicketMessages);
router.post('/api/tickets/:ticketId/messages', ticketController.sendTicketMessage);
router.patch('/api/tickets/:ticketId/close', ticketController.closeTicket);

// ───────────── Broadcast Routes ─────────────
router.get('/api/broadcasts', broadcastController.getAllBroadcasts);
router.post('/api/broadcasts', broadcastController.createBroadcast);

//--------admin routes--------//

router.post('/api/admins/login', loginAdmin);
router.get('/api/admins/tickets', getTickets);
router.get('/api/admins/messages/:ticketId', getTicketMessages);
router.post('/api/admins/messages/:ticketId', respondToTicket);

export default router;

