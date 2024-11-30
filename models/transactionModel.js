class Transaction {
    constructor(transactionId, activeTransactionId, userId, stockCode, lot, costPrice, salePrice, startedAt, finishedAt) {
      this.transactionId = transactionId;
      this.activeTransactionId = activeTransactionId;
      this.userId = userId;
      this.stockCode = stockCode;
      this.lot = lot;
      this.costPrice = costPrice;
      this.salePrice = salePrice;
      this.startedAt = startedAt;
      this.finishedAt = finishedAt;
    }
} 

module.exports = Transaction;