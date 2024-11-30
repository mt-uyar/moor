const sql = require('mssql');
const config = require('../dbConfig');
const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT secret key'i env'den al
const JWT_SECRET = process.env.JWT_SECRET;

// Token oluşturma fonksiyonu
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

// Auth middleware
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
    let pool = await sql.connect(config);
    let result = await pool.request().query('SELECT * FROM dbo.[Users]');
    res.json({
      success: true,
      users: result.recordset
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

    // Gerekli alanları kontrol et
    if (!userName || !fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar gereklidir'
      });
    }

    let pool = await sql.connect(config);
    const errors = {};

    // Email kontrolü
    const existingUserEmail = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM dbo.Users WHERE Email = @email');

    if (existingUserEmail.recordset.length > 0) {
      errors.emailError = 'Bu email adresi zaten kullanımda.';
    }

    // Kullanıcı adı kontrolü
    const existingUserName = await pool
      .request()
      .input('username', sql.NVarChar, userName)
      .query('SELECT * FROM dbo.Users WHERE UserName = @userName');

    if (existingUserName.recordset.length > 0) {
      errors.userNameError = 'Bu kullanıcı adı zaten kullanımda.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hashed password:', hashedPassword); // Debug için

    // Insert sorgusunu çalıştır
    let result = await pool
      .request()
      .input('userName', sql.NVarChar, userName)
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword) // hashedPassword kullan
      .input('active', sql.Bit, 1)
      .input('createdAt', sql.DateTime, new Date())
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO dbo.Users (UserName, FullName, Email, Password, Active, CreatedAt, UpdatedAt)
        VALUES (@userName, @fullName, @email, @password, @active, @createdAt, @updatedAt);
        
        SELECT SCOPE_IDENTITY() AS UserId;
      `);

    const userId = result.recordset[0].UserId;
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

    let pool = await sql.connect(config);
    let userResult = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT Password FROM dbo.Users WHERE UserId = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    const hashedPassword = userResult.recordset[0].Password;
    const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mevcut şifre yanlış'
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    const updatedAt = new Date();
    
    await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('newPassword', sql.NVarChar, hashedNewPassword)
      .input('updatedAt', sql.DateTime, updatedAt)
      .query(`
        UPDATE dbo.Users 
        SET Password = @newPassword, UpdatedAt = @updatedAt 
        WHERE UserId = @userId
      `);

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

    // Email ve password kontrolü
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email ve şifre gereklidir'
      });
    }

    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT UserId, Email, Password, FullName, Active FROM dbo.Users WHERE Email = @email');
    
    const user = result.recordset[0];

    // Kullanıcı kontrolü
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    // Kullanıcı aktif mi kontrolü
    if (!user.Active) {
      return res.status(401).json({
        success: false,
        message: 'Hesabınız aktif değil'
      });
    }

    // Password kontrolü - null check eklenmiş hali
    if (!user.Password) {
      console.error('Veritabanında hash\'lenmiş şifre bulunamadı');
      return res.status(500).json({
        success: false,
        message: 'Bir hata oluştu, lütfen daha sonra tekrar deneyin'
      });
    }

    console.log('Password from request:', password); // Debug için
    console.log('Hashed password from DB:', user.Password); // Debug için

    const match = await bcrypt.compare(password, user.Password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    // Token oluştur
    const token = generateToken(user.UserId);

    // Token'ı veritabanına kaydet
    await pool
      .request()
      .input('userId', sql.Int, user.UserId)
      .input('token', sql.NVarChar, token)
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE dbo.Users 
        SET Token = @token, UpdatedAt = @updatedAt 
        WHERE UserId = @userId
      `);

    // Başarılı response
    res.status(200).json({
      success: true,
      message: 'Giriş başarılı',
      user: {
        userId: user.UserId,
        fullName: user.FullName,
        email: user.Email,
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

      let pool = await sql.connect(config);
      let result = await pool
        .request()
        .input('userId', sql.Int, decoded.userId)
        .input('token', sql.NVarChar, token)
        .query('SELECT UserId FROM dbo.Users WHERE UserId = @userId AND Token = @token');

      if (result.recordset.length === 0) {
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

    let pool = await sql.connect(config);
    await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('UPDATE dbo.Users SET Token = NULL WHERE UserId = @userId');

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

// Tek bir exports ile tüm fonksiyonları dışa aktar
module.exports = {
  listUsers,
  createUser,
  updatePassword,
  login,
  logout,
  verifyToken,
  authenticateToken
};