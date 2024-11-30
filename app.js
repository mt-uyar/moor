const express = require('express');
const userRoute = require('./routes/userRoute');
const activeTransactionRoute = require('./routes/activeTransactionRoute');
const transactionRoute = require('./routes/transactionRoute');
const stocksRoute = require('./routes/stocksRoute');

const app = express();
app.use(express.json());

app.use('/user', userRoute);
app.use('/active-transaction', activeTransactionRoute);
app.use('/transaction', transactionRoute);
app.use('/stocks', stocksRoute);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


