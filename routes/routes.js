const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getUsers } = require('../controllers/controllers');

// router.get('/', getAllEvents);
router.post('/register', registerUser); // nuevo
router.post('/login', loginUser);
router.get('/getUsers', getUsers);

module.exports = router;
