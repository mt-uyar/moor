const express = require('express');
const router = express.Router();
const activeTransactionController = require('../controllers/activeTransactionController');

router.post('/list', activeTransactionController.listActiveTransactions);
router.post('/list-summary', activeTransactionController.listSummaryActiveTransactions);
router.post('/create', activeTransactionController.createActiveTransaction);
router.post('/update', activeTransactionController.updateActiveTransaction);
router.post('/delete', activeTransactionController.deleteActiveTransaction);
router.post('/finish', activeTransactionController.finishActiveTransaction);
router.post('/home-summary', activeTransactionController.homeSummary);

module.exports = router;
