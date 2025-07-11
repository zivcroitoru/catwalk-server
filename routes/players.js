const express = require('express');
const router = express.Router();

// GET player info
router.get('/', (req, res) => {
  res.status(200).json({ message: 'GET player - placeholder' });
});

// POST create player
router.post('/', (req, res) => {
  res.status(201).json({ message: 'POST create player - placeholder' });
});

// PUT update player
router.put('/:id', (req, res) => {
  res.status(200).json({ message: 'PUT update player - placeholder' });
});

// DELETE player
router.delete('/:id', (req, res) => {
  res.status(200).json({ message: 'DELETE player - placeholder' });
});

module.exports = router;
