const sql = require('mssql');
const jwt = require('jsonwebtoken');
const config = require('../dbConfig');

class TokenService {
  static async createTokens(user) {
    // Access token oluştur (kısa süreli - örn: 15 dakika)
    const accessToken = jwt.sign(
      { userId: user.UserId, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Refresh token oluştur (uzun süreli - örn: 30 gün)
    const refreshToken = jwt.sign(
      { userId: user.UserId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d' }
    );

    try {
      // Veritabanına token'ları kaydet
      const pool = await sql.connect(config);
      await pool.request()
        .input('userId', sql.Int, user.UserId)
        .input('token', sql.NVarChar, accessToken)
        .input('refreshToken', sql.NVarChar, refreshToken)
        .input('expiresAt', sql.DateTime, new Date(Date.now() + 15 * 60 * 1000)) // 15 dakika
        .query(`
          INSERT INTO UserTokens (UserId, Token, RefreshToken, ExpiresAt)
          VALUES (@userId, @token, @refreshToken, @expiresAt)
        `);

      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Token creation error:', error);
      throw error;
    }
  }

  static async refreshAccessToken(refreshToken) {
    try {
      // Refresh token'ı verify et
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      
      // Veritabanında refresh token'ı kontrol et
      const pool = await sql.connect(config);
      const result = await pool.request()
        .input('userId', sql.Int, decoded.userId)
        .input('refreshToken', sql.NVarChar, refreshToken)
        .query(`
          SELECT * FROM UserTokens 
          WHERE UserId = @userId 
          AND RefreshToken = @refreshToken 
          AND IsValid = 1
        `);

      if (result.recordset.length === 0) {
        throw new Error('Invalid refresh token');
      }

      // Yeni access token oluştur
      const newAccessToken = jwt.sign(
        { userId: decoded.userId },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Token tablosunu güncelle
      await pool.request()
        .input('userId', sql.Int, decoded.userId)
        .input('newToken', sql.NVarChar, newAccessToken)
        .input('expiresAt', sql.DateTime, new Date(Date.now() + 15 * 60 * 1000))
        .query(`
          UPDATE UserTokens
          SET Token = @newToken, 
              ExpiresAt = @expiresAt,
              LastUsedAt = GETDATE()
          WHERE UserId = @userId AND RefreshToken = @refreshToken
        `);

      return newAccessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  static async invalidateToken(userId, token) {
    try {
      const pool = await sql.connect(config);
      await pool.request()
        .input('userId', sql.Int, userId)
        .input('token', sql.NVarChar, token)
        .query(`
          UPDATE UserTokens
          SET IsValid = 0
          WHERE UserId = @userId AND Token = @token
        `);
    } catch (error) {
      console.error('Token invalidation error:', error);
      throw error;
    }
  }
}

module.exports = TokenService;