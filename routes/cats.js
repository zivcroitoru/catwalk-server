const express = require ('expres'); //import express framework
const router = express.router(); //create a new router

//list all the cats ^.,.^
router.get('/', (req,res) => {
    res.status(200).json({ message: 'GET ALL cats - placeh9older'});
});

// POST a new cat ≽^•⩊•^≼
router.post('/', (req, res) => {
  res.status(201).json({ message: 'POST new cat - placeholder' });
});

// PUT update a cat ฅ^•ﻌ•^ฅ
router.put('/:id', (req, res) => {
  res.status(200).json({ message: 'PUT update cat - placeholder' });
});

// DELETE a cat ^. .^₎Ⳋ
router.delete('/:id', (req, res) => {
  res.status(200).json({ message: 'DELETE cat - placeholder' });
});

module.exports = router;