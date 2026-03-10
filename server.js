require('dotenv').config();
const express = require('express');
const routes = require('./routes');
const app = express();
const porta = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Erro de sintaxe JSON detectado:', err.message);
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
    console.log(`Servidor API rodando na porta ${porta}`);
});