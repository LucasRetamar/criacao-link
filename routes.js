const express = require('express');
const router = express.Router();
const { atualizarDadosCliente } = require('./service');
const { validarDadosCliente } = require('./validacoes');

console.log('Arquivo routes.js carregado com sucesso!');


router.post('/atualizarDados', (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        return res.status(400).json({
            error: true,
            status: 400,
            message: 'Nenhum dado foi enviado na requisição ou o formato está incorreto.'
        });
    }
    console.log('Recebida requisição em /atualizarDados:', req.body);

    // const { id_cliente } = req.body;
    const id_cliente = '0663';

    if (!id_cliente) {
        return res.status(400).json({ error: 'ID do cliente é obrigatório.' });
    }

    const { nome, nome_empresa, telefone, cpf_cnpj, link, logo, tempo_listagem, cores, servicos } = req.body;
    const dados = { id_cliente, nome, nome_empresa, telefone, cpf_cnpj, link, logo, tempo_listagem, cores, servicos };

    const validacao = validarDadosCliente(dados);
    if (!validacao.valido) {
        return res.status(400).json({
            error: true,
            message: 'Dados inválidos.',
            detalhes: validacao.erros
        });
    }

    atualizarDadosCliente(dados, (error, result) => {
        if (error) {
            console.error('Erro ao atualizar dados:', error);
            return res.status(500).json({
                error: true,
                message: 'Erro ao processar atualização no banco de dados.',
                detalhes: error.sqlMessage || error.message
            });
        }

        if (result && result.ok) {
            const cacheUrl = process.env.CACHE_URL;
            const cacheApiKey = process.env.CACHE_API_KEY;

            if (cacheUrl && id_cliente) {
                fetch(`${cacheUrl}empresas/cache/adicionar/${id_cliente}`, {
                    method: 'PUT',
                    headers: {
                        'x-api-key': cacheApiKey
                    }
                }).then(cacheRes => {
                    console.log(`Atualização de cache para cliente ${id_cliente} - Status: ${cacheRes.status}`);
                }).catch(cacheErr => {
                    console.error('Erro ao atualizar cache:', cacheErr.message);
                });
            }

            res.json({
                error: false,
                data: {
                    link: `https://agendaservico.com/${link}`,
                    linkAdm: "https://agendaservico.com/login"
                },
                message: result.message || "Site criado com sucesso!"
            });
        } else {
            res.status(404).json({
                error: true,
                message: 'Cliente não encontrado.'
            });
        }
    });
});

module.exports = router;
