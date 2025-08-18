
import express from 'express';
const router = express.Router();


// ───────────── Routes ─────────────
// import authRoutes from './controllers/authController.js';
import catController from './controllers/catsController.js';
import playersController from './controllers/playersControllers.js';
import shopController from './controllers/shopController.js';
import playerItemController from './controllers/playeritemController.js';
import catItemsController from './controllers/catitemController.js';
import ticketController from './controllers/ticketsController.js';
import broadcastController from './controllers/broadcastController.js';
//////////////////////////////////////////////////////////
// import mailboxRoutes from './routes/mailbox.js';

// import messagesRoutes from './routes/messages.js';
// import adminRoutes from './routes/admins.js';

//---------middleware--------//




// app.use('/auth', authRoutes);
// app.use('/api/cats', catsRoutes);
// app.use('/api/cat_items', catItemsRoutes);
// app.use('/api/players', playersRoutes);
// app.use('/api/shop', shopRoutes);
// app.use('/api/admins', adminRoutes);
// app.use('/api/playerItems', player_itemsRoutes);
// app.use('/api/messages', messagesRoutes);
// app.use('/api/mailbox', mailboxRoutes);
// app.use('/api/tickets', ticketsRoutes);
// app.use('/api/broadcasts', broadcastRoutes);


//--------authControllers.js--------//
// router.post("/signup", authController.signup);
// router.post("/login", authController.login);
// router.post("/logout", authController.logout);
// router.get("/me", requireLogin, authController.getMe);

//-------catsControllers.js--------//
router.get('/cats', requireAuth, catController.getPlayerCats);
router.post('/cats', requireAuth, catController.createCat);
router.patch('/cats/:id', requireAuth, catController.updateCat);
router.delete('/cats/:id', requireAuth, catController.deleteCat);
router.get('/cats/allcats', catController.getAllCats);
router.get('/cats/template/:template', catController.getCatByTemplate);
router.get('/cats/player/:playerId', catController.getCatsByPlayer);
router.post('/cats/catadd', catController.addTemplate);
router.patch('/cats/allcats/:id', catController.updateTemplateSprite);
router.delete('/cats/delete/:catId', catController.deleteTemplate);

//--------playersControllers.js--------//
router.get('/players', playersController.getPlayers);
router.post('/players', playersController.createPlayer);
router.get('/players/:id', playersController.getPlayerById);
router.put('/players/:id', playersController.updatePlayer);
router.delete('/players/:id', playersController.deletePlayer);
router.get('/players/:id/cats', playersController.getPlayerCats);
router.get('/players/:id/items', playersController.getPlayerItems);

//--------shopControllers.js--------//
router.get('/shop/shop-items', shopController.getShopItems);
router.get('/shop/allclothes', shopController.getAllClothes);
router.get('/shop', shopController.getShop);
router.post('/shop', shopController.createShopItem);
router.put('/shop/:id', shopController.updateShopItem);
router.delete('/shop/:id', shopController.deleteShopItem);
router.delete('/shop/delete/:itemId', shopController.deleteShopItemById);
router.patch('/shop/edit/:id', shopController.patchShopItem);
router.get('/shop/test', shopController.testShop);
router.get('/shop/:template', shopController.getShopItemByTemplate);
router.post('/shop/clothesadd', shopController.addClothesItem);

//--------playeritemController.js--------//
router.get('/playerItems', requireAuth, playerItemController.getPlayerItems);
router.post('/playerItems/buy', requireAuth, playerItemController.buyPlayerItem);

//--------catitemsControllers-------//
router.patch('/cat_items/:catId', catItemsController.patchCatEquipment);
router.get('/cat_items/:catId', catItemsController.getCatEquipment);

//--------ticketsController.js--------//
router.get('/tickets', ticketController.getAllTickets);
router.post('/tickets', ticketController.createTicket);
router.get('/tickets/test', ticketController.testTickets);
router.get('/tickets/:ticketId', ticketController.getTicketById);
router.get('/tickets/user/:userId/all', ticketController.getUserTickets);
router.get('/tickets/user/:userId/open', ticketController.getUserOpenTicket);
router.get('/tickets/:ticketId/messages', ticketController.getTicketMessages);
router.post('/tickets/:ticketId/messages', ticketController.sendTicketMessage);
router.patch('/tickets/:ticketId/close', ticketController.closeTicket);

//--------broadcastController.js--------//
router.get('/broadcasts', broadcastController.getAllBroadcasts);
router.post('/broadcasts', broadcastController.createBroadcast);




export default router;
