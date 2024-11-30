const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.post('/list', transactionController.listTransactions);
router.post('/create', transactionController.createTransaction);
router.post('/delete', transactionController.deleteTransaction);
router.post('/upsert-purified', transactionController.upsertPurifiedAmount);
router.post('/manuel-purify', transactionController.calculateManuelPurify);
router.post('/calculate-total-purification', transactionController.calculateTotalPurification);


module.exports = router;
