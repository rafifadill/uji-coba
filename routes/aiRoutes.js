const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/chat', aiController.chat);
router.get('/ping', (req, res) => {
  res.json({ ok: true, at: '/api/ai/ping' });
});

module.exports = router;