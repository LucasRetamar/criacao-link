require('dotenv').config();
const express = require('express');
const logger = require('./logger');
const routes = require('./routes');
const app = express();
const porta = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


/*app.use((req, res, next) => {
    logger.http(`${req.method} ${req.url}\n${JSON.stringify(req.body, null, 2)}`, 'req');
    next();
});*/

app.use((req, res, next) => {
    const logBody = req.body ? { ...req.body } : {};
    if (logBody.logo && typeof logBody.logo === 'string') {
        logBody.logo = logBody.logo.substring(0, 50) + '... [TRUNCATED]';
    }
    logger.http(`${req.method} ${req.url}\n${JSON.stringify(logBody, null, 2)}`, 'req');
    next();
});


app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logger.error(`Erro de sintaxe JSON: ${err.message}`, 'req');
        return res.status(400).json({
            error: true,
            status: 400,
            message: 'O formato do seu JSON está incorreto (verifique vírgulas, aspas ou valores numéricos inválidos).'
        });
    }
    next();
});

app.use('/', routes);

app.listen(porta, () => {
    logger.info(`Servidor API rodando na porta ${porta}`, 'APISITE');
});