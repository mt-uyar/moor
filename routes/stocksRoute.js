const express = require('express');
const router = express.Router();
const stocksController = require('../controllers/stocksController');

router.post('/list', stocksController.listStocks);

module.exports = router;
