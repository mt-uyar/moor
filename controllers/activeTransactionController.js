const sql = require('mssql');
const config = require('../dbConfig')
const activeTransactionModel = require('../models/activeTransactionModel')
const transactionModel = require('../models/transactionModel')
const {listStocksForHome} = require('./stocksController')

const parsePercentageString = (str) => {
  str = str.replace('%', '').trim();
  str = str.replace(',', '.');
  return parseFloat(str);
};

function sortLargestSmallest(arr) {
  const sortedArr = [];
  const copyArr = [...arr];

  while (copyArr.length > 0) {
    const maxIndex = copyArr.reduce((maxIdx, curr, index) => curr.y > copyArr[maxIdx].y ? index : maxIdx, 0);
    sortedArr.push(copyArr[maxIndex]);
    copyArr.splice(maxIndex, 1);

    if (copyArr.length > 0) {
      const minIndex = copyArr.reduce((minIdx, curr, index) => curr.y < copyArr[minIdx].y ? index : minIdx, 0);
      sortedArr.push(copyArr[minIndex]);
      copyArr.splice(minIndex, 1);
    }
  }
  return sortedArr;
}

// Backend - activeTransactionController.js

// parseFloatManuel fonksiyonunu ekleyelim
function parseFloatManuel(str) {
  str = String(str);
  // Noktaları kaldır
  str = str.replace(/\./g, '');
  // Virgülü noktayla değiştir
  str = str.replace(',', '.');
  // parseFloat ile dönüştür
  return parseFloat(str);
}

async function homeSummary(req, res) {
  try {
    const { userId } = req.body
    const activeTransactions = await listActiveTransactionsForHome(userId);
    const summaryTransactions = await listSummaryActiveTransactionsForHome(userId);
    const stocks = await listStocksForHome();

    // Detaylı hesaplamalar için helper fonksiyon
    const calculateTransactionDetails = (transaction, stockData) => {
      const stockPrice = parseFloatManuel(stockData.stockPrice);
      const stockPercentage = parsePercentageString(stockData.stockPercentage);
      const lot = parseFloat(transaction.lot || transaction.totalLot);
      const costPrice = parseFloat(transaction.costPrice || transaction.avgCostPrice);

      const totalPrice = lot * stockPrice;
      const dailyProfitAmount = ((totalPrice * 100) / (100 - stockPercentage)) - totalPrice;
      const totalProfitAmount = lot * (stockPrice - costPrice);
      const totalProfitPercentage = ((stockPrice - costPrice) / costPrice) * 100;

      return {
        ...transaction,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        stockPrice: parseFloat(stockPrice.toFixed(2)),
        stockPercentage: parseFloat(stockPercentage.toFixed(2)),
        dailyProfitAmount: parseFloat(dailyProfitAmount.toFixed(2)),
        dailyProfitPercentage: parseFloat(stockPercentage.toFixed(2)),
        totalProfitAmount: parseFloat(totalProfitAmount.toFixed(2)),
        totalProfitPercentage: parseFloat(totalProfitPercentage.toFixed(2))
      };
    };

    // Her iki liste için de hesaplamaları yap
    const updatedActiveTransactions = activeTransactions.map(transaction => {
      const stockData = stocks.find(stock => stock.stockCode === transaction.stockCode);
      if (!stockData) return transaction;
      return calculateTransactionDetails(transaction, stockData);
    });

    const summaryTransactions2 = summaryTransactions.map(transaction => {
      const stockData = stocks.find(stock => stock.stockCode === transaction.stockCode);
      if (!stockData) return transaction;
      return calculateTransactionDetails(transaction, stockData);
    });

    const totalProfit = parseFloat(summaryTransactions2.reduce((sum, item) => 
      sum + item.totalProfitAmount, 0).toFixed(2));

    const dailyTotalProfit = parseFloat(summaryTransactions2.reduce((sum, item) => 
      sum + item.dailyProfitAmount, 0).toFixed(2));

    const totalY = parseFloat(summaryTransactions2.reduce((sum, item) => 
      sum + item.totalPrice, 0).toFixed(2));

    const chartData = summaryTransactions2.map(transaction => ({
      x: transaction.stockCode,
      y: transaction.totalPrice,
      percentage: parseFloat(((transaction.totalPrice / totalY) * 100).toFixed(2))
    }));

    const sortedData = sortLargestSmallest(chartData);

    res.json({
      activeTransactions: updatedActiveTransactions, // Güncellenen activeTransactions
      summaryTransactions,
      stocks,
      totalProfit,
      dailyTotalProfit,
      totalY,
      sortedData,
      summaryTransactions2
    });
  } catch (error) {
    console.error('Error in dashboard:', error);
    res.status(500).json({ error: 'An error occurred while fetching data' });
  }
}


async function listActiveTransactions(req, res) {
  try {
    const { userId } = req.body;
    console.log(userId)
    let pool = await sql.connect(config);
    let result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`SELECT * FROM dbo.[ActiveTransactions]
    WHERE userId = @userId AND
    active = 1`);
    res.json(result)
    console.log("sonuç:", result);
  } catch (error) {
    res.status(500).send('Error retrieving transactions from database');
  }
}

async function listActiveTransactionsForHome(userId) {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`SELECT * FROM dbo.[ActiveTransactions]
    WHERE userId = @userId AND
    active = 1`);
    return result.recordset;
  } catch (error) {
    console.log("hata")
  }
}

async function listSummaryActiveTransactions(req, res) {
  try {
    const { userId } = req.body;
    let pool = await sql.connect(config);
    let result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          userId,
          stockCode,
          SUM(lot) AS totalLot,
          SUM(lot * costPrice) / SUM(lot) AS avgCostPrice
        FROM dbo.[ActiveTransactions]
        WHERE userId = @userId AND active = 1
        GROUP BY stockCode, userId
      `);
    res.json(result);
  } catch (error) {
    res.status(500).send('Error retrieving transactions from database');
  }
}

async function listSummaryActiveTransactionsForHome(userId) {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          userId,
          stockCode,
          SUM(lot) AS totalLot,
          SUM(lot * costPrice) / SUM(lot) AS avgCostPrice
        FROM dbo.[ActiveTransactions]
        WHERE userId = @userId AND active = 1
        GROUP BY stockCode, userId
      `);
    return result.recordset;
  } catch (error) {
    console.log("hata")
  }
}

async function createActiveTransaction(req, res) {
  try {
      const { userId, stockCode, lot, costPrice, startedAt } = req.body;

      // Veritabanına bağlan
      let pool = await sql.connect(config);

      // Yeni bir Transaction nesnesi oluştur
      const newTransaction = new activeTransactionModel(null, userId, stockCode, lot, costPrice, true, startedAt);

      // Insert sorgusunu çalıştır
      let result = await pool
          .request()
          .input('userId', sql.Int, newTransaction.userId)
          .input('stockCode', sql.NVarChar, newTransaction.stockCode)
          .input('lot', sql.Int, newTransaction.lot)
          .input('costPrice', sql.Decimal(18, 2), newTransaction.costPrice)
          .input('active', sql.Bit, newTransaction.active)
          .input('startedAt', sql.DateTime, newTransaction.startedAt)
          .query(`
              INSERT INTO dbo.ActiveTransactions (UserId, StockCode, Lot, CostPrice, Active, StartedAt)
              VALUES (@userId, @stockCode, @lot, @costPrice, @active, @startedAt);

              SELECT SCOPE_IDENTITY() AS TransactionId;
          `);

      res.status(200).send('Transaction created successfully');
  } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).send('Error creating transaction');
  }
}


async function updateActiveTransaction(req, res) {
  try {
      const { activeTransactionId, stockCode, lot, costPrice, startedAt } = req.body;

      // Veritabanına bağlan
      let pool = await sql.connect(config);

      // Update sorgusunu çalıştır
      let result = await pool
          .request()
          .input('activeTransactionId', sql.Int, activeTransactionId)
          .input('stockCode', sql.NVarChar, stockCode)
          .input('lot', sql.Int, lot)
          .input('costPrice', sql.Decimal(18, 2), costPrice)
          .input('startedAt', sql.DateTime, startedAt) // StartedAt değerini de güncelle
          .query(`
              UPDATE dbo.ActiveTransactions
              SET StockCode = @stockCode, Lot = @lot, CostPrice = @costPrice, StartedAt = @startedAt
              WHERE ActiveTransactionId = @activeTransactionId;
          `);

      res.status(200).send('Transaction updated successfully');
  } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).send('Error updating transaction');
  }
}

  async function deleteActiveTransaction(req, res) {
    try {
      const { activeTransactionId } = req.body;
  
      // Veritabanına bağlan
      let pool = await sql.connect(config);
  
      // Update sorgusunu çalıştır
      let result = await pool
        .request()
        .input('activeTransactionId', sql.Int, activeTransactionId)
        .query(`
          UPDATE dbo.ActiveTransactions 
          SET Active = 0
          WHERE ActiveTransactionId = @activeTransactionId;
        `);
  
      res.status(200).send('Transaction deleted successfully');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).send('Error deleting transaction');
    }
  }

  async function finishActiveTransaction(req, res) {
    try {
        const { activeTransactionId, finishedAt, lot, salePrice } = req.body;

        // Veritabanına bağlan
        let pool = await sql.connect(config);

        // ActiveTransaction tablosundan bitirilen lot sayısını kontrol et
        let activeTransactionResult = await pool
            .request()
            .input('activeTransactionId', sql.Int, activeTransactionId)
            .query(`
                SELECT Lot FROM dbo.ActiveTransactions 
                WHERE ActiveTransactionId = @activeTransactionId;
            `);
        const lotDb = activeTransactionResult.recordset[0].Lot;

        if(lot == lotDb) {
            // ActiveTransaction tablosundaki işlemi tamamla
            let result = await pool
            .request()
            .input('activeTransactionId', sql.Int, activeTransactionId)
            .query(`
            UPDATE dbo.ActiveTransactions
            SET Active = 2
            WHERE ActiveTransactionId = @activeTransactionId;
            `);

            // CreateTransaction metodunu çağırarak işlemi Transaction tablosuna kaydet
            await createTransactionFromActiveTransaction(activeTransactionId, lotDb, salePrice, finishedAt);
            res.status(200).send('Transaction finished successfully');

        } else if(lot < lotDb) {
            const newLot = lotDb - lot;

            let result = await pool
            .request()
            .input('activeTransactionId', sql.Int, activeTransactionId)
            .input('lot', sql.Int, newLot)
            .query(`
            UPDATE dbo.ActiveTransactions 
            SET Lot = @lot
            WHERE ActiveTransactionId = @activeTransactionId;
            `);

            await createTransactionFromActiveTransaction(activeTransactionId, lot, salePrice, finishedAt);
            res.status(200).send('Transaction finished successfully');
        }
        
    } catch (error) {
        console.error('Error finishing transaction:', error);
        res.status(500).send('Error finishing transaction');
    }
}

async function createTransactionFromActiveTransaction(activeTransactionId, lotToFinish, salePrice, finishedAt) {
    try {
        // Veritabanına bağlan
        let pool = await sql.connect(config);

        // ActiveTransaction tablosundan işlemi al
        let result = await pool
            .request()
            .input('activeTransactionId', sql.Int, activeTransactionId)
            .query(`
                SELECT * FROM dbo.ActiveTransactions
                WHERE ActiveTransactionId = @activeTransactionId;
            `);

        // Alınan işlem bilgileri ile yeni bir Transaction nesnesi oluştur
        const activeTransaction = result.recordset[0];
        const newTransaction = new transactionModel(
            null,
            activeTransactionId,
            activeTransaction.userId,
            activeTransaction.stockCode,
            lotToFinish, // Bitirilen lot sayısını kullan
            activeTransaction.costPrice,
            salePrice,
            activeTransaction.startedAt,
            finishedAt // Kullanıcıdan gelen bitiş tarihini kullan
        );

        // Transaction tablosuna işlemi kaydet
        await pool
            .request()
            .input('activeTransactionId', sql.Int, newTransaction.activeTransactionId)
            .input('userId', sql.Int, newTransaction.userId)
            .input('stockCode', sql.NVarChar, newTransaction.stockCode)
            .input('lot', sql.Int, newTransaction.lot)
            .input('costPrice', sql.Decimal(18, 2), newTransaction.costPrice)
            .input('salePrice', sql.Decimal(18, 2), newTransaction.salePrice)
            .input('startedAt', sql.DateTime, newTransaction.startedAt)
            .input('finishedAt', sql.DateTime, newTransaction.finishedAt)
            .query(`
                INSERT INTO dbo.Transactions (ActiveTransactionId ,UserId, StockCode, Lot, CostPrice, SalePrice, StartedAt, FinishedAt)
                VALUES (@activeTransactionId, @userId, @stockCode, @lot, @costPrice, @salePrice, @startedAt, @finishedAt);
            `);
    } catch (error) {
        console.error('Error creating transaction from ActiveTransaction:', error);
    }
}

  
  
  






module.exports = {
  listActiveTransactions,
  createActiveTransaction,
  updateActiveTransaction,
  deleteActiveTransaction,
  finishActiveTransaction,
  listSummaryActiveTransactions,
  homeSummary
};


