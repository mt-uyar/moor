// transactionController.js

const sql = require('mssql');
const config = require('../dbConfig');
const Transaction = require('../models/transactionModel');

async function listTransactions(req, res) {
  try {
    const { userId } = req.body;
    let pool = await sql.connect(config);
    let result = await pool.request()
      .input('userId', sql.Int, userId)  // Pass userId as a parameter
      .execute('[dbo].[sel_CalculatePurificationAmountByUser]');  // Call the stored procedure
    
    res.json(result);
  } catch (error) {
    res.status(500).send('Error retrieving transactions from database');
  }
}

async function calculateTotalPurification(req, res) {
  try {
    const { userId } = req.body;
    let pool = await sql.connect(config);
    let result = await pool.request()
      .input('userId', sql.Int, userId)  // Pass userId as a parameter
      .execute('[dbo].[sel_TotalPurificationAmountByUser]');  // Call the stored procedure
    
    res.json(result);
  } catch (error) {
    res.status(500).send('Error retrieving transactions from database');
  }
}

async function createTransaction(req, res) {
  try {
    const { activeTransactionId, userId, stockCode, lot, costPrice, salePrice } = req.body;
    const startedAt = new Date();
    let pool = await sql.connect(config);
    const newTransaction = new Transaction(null, activeTransactionId, userId, stockCode, lot, costPrice, salePrice, startedAt, null);
    let result = await pool
      .request()
      .input('activeTransactionId', sql.Int, newTransaction.activeTransactionId)
      .input('userId', sql.Int, newTransaction.userId)
      .input('stockCode', sql.NVarChar, newTransaction.stockCode)
      .input('lot', sql.Int, newTransaction.lot)
      .input('costPrice', sql.Decimal(18, 2), newTransaction.costPrice)
      .input('salePrice', sql.Decimal(18, 2), newTransaction.salePrice)
      .input('startedAt', sql.DateTime, newTransaction.startedAt)
      .query(`
        INSERT INTO dbo.Transactions (ActiveTransactionId, UserId, StockCode, Lot, CostPrice, SalePrice, StartedAt)
        VALUES (@activeTransactionId, @userId, @stockCode, @lot, @costPrice, @salePrice, @startedAt);
      `);
    res.status(200).send('Transaction created successfully');
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).send('Error creating transaction');
  }
}


async function upsertPurifiedAmount(req, res) {
  try {
    const { userId, purifiedAmount } = req.body;
    let pool = await sql.connect(config);

    let result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT purifiedAmount FROM PurifiedAmounts WHERE userId = @userId');

    if (result.recordset.length > 0) {
      // Kayıt varsa mevcut değeri al ve yeni değerle topla
      let existingAmount = result.recordset[0].purifiedAmount;
      let newAmount = parseFloat(existingAmount) + parseFloat(purifiedAmount);

      await pool
        .request()
        .input('userId', sql.Int, userId)
        .input('purifiedAmount', sql.Decimal(18, 2), newAmount)
        .query('UPDATE PurifiedAmounts SET purifiedAmount = @purifiedAmount WHERE userId = @userId');

      res.status(200).send('Purified amount updated successfully');
    } else {
      // Kayıt yoksa yeni değeri ekle
      await pool
        .request()
        .input('userId', sql.Int, userId)
        .input('purifiedAmount', sql.Decimal(18, 2), purifiedAmount)
        .query('INSERT INTO PurifiedAmounts (userId, purifiedAmount) VALUES (@userId, @purifiedAmount)');

      res.status(200).send('Purified amount inserted successfully');
    }
  } catch (error) {
    console.error('Error upserting purified amount:', error);
    res.status(500).send('Error upserting purified amount');
  }
}


async function deleteTransaction(req, res) {
  try {
    const { transactionId } = req.body;
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input('transactionId', sql.Int, transactionId)
      .query(`
        DELETE FROM dbo.Transactions 
        WHERE TransactionId = @transactionId;
      `);
    res.status(200).send('Transaction deleted successfully');
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).send('Error deleting transaction');
  }
}

async function calculateManuelPurify(req, res) {
  try {
    const { stockCode, startedAt, finishedAt, lot } = req.body;
    let pool = await sql.connect(config);

    let result = await pool
      .request()
      .input('stockCode', sql.VarChar, stockCode)
      .input('startedAt', sql.Date, startedAt)
      .input('finishedAt', sql.Date, finishedAt)
      .input('lot', sql.Int, lot)
      .execute('[dbo].[sel_CalculateManuelPurify]')

    if (result.recordset.length > 0) {
      res.status(200).json(result.recordset);
    } else {
      res.status(404).send('Stock code not found');
    }
  } catch (error) {
    console.error('Error calculating transaction:', error);
    res.status(500).send('Error calculating transaction');
  }
}


module.exports = {
  listTransactions,
  createTransaction,
  deleteTransaction,
  upsertPurifiedAmount,
  calculateManuelPurify,
  calculateTotalPurification

};
