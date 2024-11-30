const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.listUsers);
router.post('/create-user', userController.createUser);
router.post('/update-password', userController.updatePassword);
router.post('/login', userController.login); // Yeni eklendi

module.exports = router;

