const mysql = require('mysql2');
const logger = require('./logger');

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) {
        logger.error(`Erro ao conectar ao banco de dados: ${err.message}`, 'database');
        return;
    }
    logger.info('Conectado ao banco de dados MySQL!', 'database');
});

module.exports = connection;
