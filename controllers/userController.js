const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token bulunamadı' 
      });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          success: false, 
          message: 'Geçersiz token' 
        });
      }
      req.userId = decoded.userId;
      next();
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Authentication hatası' 
    });
  }
};

async function listUsers(req, res) {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Kullanıcılar listelenirken hata:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcılar listelenirken bir hata oluştu'
    });
  }
}

async function createUser(req, res) {
  try {
    const { userName, fullName, email, password } = req.body;

    if (!userName || !fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar gereklidir'
      });
    }

    const errors = {};

    // Email kontrolü
    const existingUserEmail = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUserEmail.rows.length > 0) {
      errors.emailError = 'Bu email adresi zaten kullanımda.';
    }

    // Kullanıcı adı kontrolü
    const existingUserName = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [userName]
    );

    if (existingUserName.rows.length > 0) {
      errors.userNameError = 'Bu kullanıcı adı zaten kullanımda.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, fullname, email, password, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id`,
      [userName, fullName, email, hashedPassword, true, new Date(), new Date()]
    );

    const userId = result.rows[0].user_id;
    const token = generateToken(userId);

    res.status(201).json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      user: {
        userId,
        userName,
        fullName,
        email,
        token
      }
    });
  } catch (error) {
    console.error('Kullanıcı oluşturulurken detaylı hata:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı oluşturulurken bir hata oluştu'
    });
  }
}

async function updatePassword(req, res) {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    const userResult = await pool.query(
      'SELECT password FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    const hashedPassword = userResult.rows[0].password;
    const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mevcut şifre yanlış'
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE users SET password = $1, updated_at = $2 WHERE user_id = $3',
      [hashedNewPassword, new Date(), userId]
    );

    res.status(200).json({
      success: true,
      message: 'Şifre başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Şifre güncellenirken hata:', error);
    res.status(500).json({
      success: false,
      message: 'Şifre güncellenirken bir hata oluştu'
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email ve şifre gereklidir'
      });
    }

    const result = await pool.query(
      'SELECT user_id, email, password, fullname, active FROM users WHERE email = $1',
      [email]
    );
    
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        message: 'Hesabınız aktif değil'
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    const token = generateToken(user.user_id);

    await pool.query(
      'UPDATE users SET token = $1, updated_at = $2 WHERE user_id = $3',
      [token, new Date(), user.user_id]
    );

    res.status(200).json({
      success: true,
      message: 'Giriş başarılı',
      user: {
        userId: user.user_id,
        fullName: user.fullname,
        email: user.email,
        token
      }
    });

  } catch (error) {
    console.error('Giriş yapılırken detaylı hata:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş yapılırken bir hata oluştu'
    });
  }
}

async function verifyToken(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ 
        success: false,
        valid: false 
      });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(200).json({ 
          success: true,
          valid: false 
        });
      }

      const result = await pool.query(
        'SELECT user_id FROM users WHERE user_id = $1 AND token = $2',
        [decoded.userId, token]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({ 
          success: true,
          valid: false 
        });
      }

      res.status(200).json({ 
        success: true,
        valid: true, 
        userId: decoded.userId 
      });
    });
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    res.status(500).json({ 
      success: false,
      valid: false 
    });
  }
}

async function logout(req, res) {
  try {
    const { userId } = req.body;

    await pool.query(
      'UPDATE users SET token = NULL WHERE user_id = $1',
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'Çıkış başarılı'
    });
  } catch (error) {
    console.error('Çıkış yapılırken hata:', error);
    res.status(500).json({
      success: false,
      message: 'Çıkış yapılırken bir hata oluştu'
    });
  }
}

module.exports = {
  listUsers,
  createUser,
  updatePassword,
  login,
  logout,
  verifyToken,
  authenticateToken
};