const express = require('express');
const { getPublicStyles } = require('../services/styles');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ items: getPublicStyles() });
});

module.exports = router;


