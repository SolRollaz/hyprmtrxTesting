// File: api/game_portal/index.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const Game = require('../../Schema/gameSchema');

// GET /game_portal/games
router.get('/games', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const games = await Game.find({ user: userId });

    const formatted = games.map(g => ({
      name: g.name,
      apis: g.apis || []
    }));

    return res.json(formatted);
  } catch (err) {
    console.error('[GET /game_portal/games]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
