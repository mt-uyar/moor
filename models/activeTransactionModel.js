class Transaction {
    constructor(activeTransactionId, userId, stockCode, lot, costPrice, active, startedAt) {
      this.activeTransactionId = activeTransactionId;
      this.userId = userId;
      this.stockCode = stockCode;
      this.lot = lot;
      this.costPrice = costPrice;
      this.active = active;
      this.startedAt = startedAt;
    }
} 

module.exports = Transaction;