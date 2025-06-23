const { Pool } = require('pg'); 
// Configurazione pool PostgreSQL che gestisce l'insieme delle connessioni al database
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fotogramDB',
  password: 'Ciaone',
  port: 5432
});
module.exports = pool;