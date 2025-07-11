const express = require('express');
const router = express.Router();

// GET shop items
router.get('/', (req, res) => {
  res.status(200).json({ message: 'GET shop items - placeholder' });
});

// POST new shop item
router.post('/', (req, res) => {
  res.status(201).json({ message: 'POST shop item - placeholder' });
});

// PUT update shop item
router.put('/:id', (req, res) => {
  res.status(200).json({ message: 'PUT update shop item - placeholder' });
});

// DELETE shop item
router.delete('/:id', (req, res) => {
  res.status(200).json({ message: 'DELETE shop item - placeholder' });
});

module.exports = router;
