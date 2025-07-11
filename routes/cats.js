const express = require('express'); //import express framework
const router = express.Router(); //create a new router

//list all the cats ^.,.^
router.get('/', (req, res) => {
    console.log('GET /cats route called');
    res.status(200).json({ message: 'GET ALL cats - placeholder' });
});

// POST a new cat ≽^•⩊•^≼
router.post('/', (req, res) => {
        console.log('POST /cats route called');
    res.status(201).json({ message: 'POST new cat - placeholder' });
});

// PUT update a cat ฅ^•ﻌ•^ฅ
router.put('/:id', (req, res) => {
        console.log(`PUT /cats/${req.params.id} route called`);
    res.status(200).json({ message: 'PUT update cat - placeholder' });
});

// DELETE a cat ^. .^₎Ⳋ
router.delete('/:id', (req, res) => {
    console.log(`DELETE /cats/${req.params.id} route called`);
    res.status(200).json({ message: 'DELETE cat - placeholder' });
});

module.exports = router;