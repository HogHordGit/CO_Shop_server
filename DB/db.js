// Postgresql connection and pool
const pgSqlPool = require("pg").Pool;
const pool = new pgSqlPool({
   user: "postgres",
   password: "HogvardssPostgreSQL",
   database: "ShopCO",
   host: "localhost",
   port: "5432",
   max: 10
});

pool.connect((err, connection) => {
    if (err) throw err;
    console.log(`Connected to PosgreSQL DB successfull!`);
    connection.release();
})

module.exports = pool;