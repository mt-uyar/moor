const request = require('request');
const cheerio = require('cheerio');
const rp = require('request-promise');

async function listStocks(req, res) {
  try {
    const url = "http://borsa.doviz.com/hisseler";
    request(url, (error, response, html) => {
      if (!error && response.statusCode == 200) {
        const $ = cheerio.load(html);
        const stocks = [];

        $("table tbody tr").each((index, element) => {
          const stockCode = $(element)
            .find("td:nth-child(1) div div:first-child")
            .text()
            .trim();
          const stockPrice = $(element)
            .find("td:nth-child(2)")
            .text()
            .trim();
          const stockVolume = $(element)
            .find("td:nth-child(5)")
            .text()
            .trim();
          const stockPercentage = $(element)
            .find("td:nth-child(6)")
            .text()
            .trim();
          const stockTime = $(element)
            .find("td:nth-child(7)")
            .text()
            .trim();
          const stockName = $(element)
            .find("td:nth-child(1) div div:nth-child(2)")
            .text()
            .trim();

          const stockObj = {
            stockCode: stockCode,
            stockPrice: stockPrice,
            stockVolume: stockVolume,
            stockPercentage: stockPercentage,
            stockTime: stockTime,
            stockName: stockName
          };

          stocks.push(stockObj);
        });
        const filteredData = stocks.filter(stock => stock.stockCode !== 'ALTINS1');
        res.json(filteredData);
      } else {
        res.status(500).send('Error fetching data from the website');
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error retrieving stocks');
  }
}



async function listStocksForHome() {
  try {
    const url = "http://borsa.doviz.com/hisseler";
    
    // Sayfayı çekiyoruz ve HTML'yi alıyoruz
    const html = await rp(url);
    const $ = cheerio.load(html);
    const stocks = [];
    

    $("table tbody tr").each((index, element) => {
      const stockCode = $(element)
        .find("td:nth-child(1) div div:first-child")
        .text()
        .trim();
      const stockPrice = $(element)
        .find("td:nth-child(2)")
        .text()
        .trim();
      const stockVolume = $(element)
        .find("td:nth-child(5)")
        .text()
        .trim();
      const stockPercentage = $(element)
        .find("td:nth-child(6)")
        .text()
        .trim();
      const stockTime = $(element)
        .find("td:nth-child(7)")
        .text()
        .trim();
      const stockName = $(element)
        .find("td:nth-child(1) div div:nth-child(2)")
        .text()
        .trim();

      const stockObj = {
        stockCode: stockCode,
        stockPrice: stockPrice,
        stockVolume: stockVolume,
        stockPercentage: stockPercentage,
        stockTime: stockTime,
        stockName: stockName
      };

      stocks.push(stockObj);
    });

    return stocks; // Şimdi burada dolu bir dizi döndürülüyor
  } catch (error) {
    console.error('Error:', error);
    return []; // Hata durumunda boş bir dizi döndür
  }
}


module.exports = {
  listStocks,
  listStocksForHome
};
