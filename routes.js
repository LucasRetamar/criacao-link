const express = require('express');
const router = express.Router();
const logger = require('./logger');
const { atualizarDadosCliente } = require('./service');
const { validarDadosCliente } = require('./validacoes');


router.post('/atualizarDados', (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        logger.error('Requisição recebida sem corpo ou com formato incorreto', 'req');
        return res.status(400).json({
            error: true,
            status: 400,
            message: 'Nenhum dado foi enviado na requisição ou o formato está incorreto.'
        });
    }
    // O body agora é logado pelo middleware global no server.js

    const id_cliente = '0663';

    if (!id_cliente) {
        return res.status(400).json({ error: 'ID do cliente é obrigatório.' });
    }

    const { nome, nome_empresa, telefone, cpf_cnpj, link, logo, tempo_listagem, cores, servicos } = req.body;
    const dados = { id_cliente, nome, nome_empresa, telefone, cpf_cnpj, link, logo, tempo_listagem, cores, servicos };

    const validacao = validarDadosCliente(dados);
    if (!validacao.valido) {
        logger.error(`Erro ao atualizar dados: ${JSON.stringify(validacao, null, 2)}`, 'req');
        return res.status(400).json({
            error: true,
            message: 'Dados inválidos.',
            detalhes: validacao.erros
        });
    }

    atualizarDadosCliente(dados, (error, result) => {
        if (error) {
            logger.error(`Erro ao atualizar dados: ${error.message}`, 'req');
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
                    logger.info(`Atualização de cache para cliente ${id_cliente} - Status: ${cacheRes.status}`, 'cache');
                }).catch(cacheErr => {
                    logger.error(`Erro ao atualizar cache: ${cacheErr.message}`, 'cache');
                });
            }

            const painelLink = process.env.URL_ADM;
            const agendamentoLink = `${process.env.URL_CLIENTE}${link}`;

            fetch('https://s13.ass1.online:3009/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "telefone": telefone,
                    "texto": `Bem-vindo(a) à Agenda Serviço! 😁 \n\nParabéns! Sua página personalizada já está pronta para uso. 🚀 \n\nVocê já pode começar a organizar sua agenda e receber novos clientes. Confira os seus acessos: \n\n• Para gerenciar seu negócio: ${painelLink} (Acesse aqui suas ferramentas de gestão e controle). ⚙️ \n\n• Link de agendamento para seus clientes: ${agendamentoLink} (Confira o visual da sua página e teste o agendamento na prática!). 📅`
                })
            }).then(msgRes => {
                logger.info(`Mensagem de boas-vindas enviada para ${telefone} - Status: ${msgRes.status}`, 'send-bot');
            }).catch(msgErr => {
                logger.error(`Erro ao enviar mensagem de boas-vindas: ${msgErr.message}`, 'send-bot');
            });

            const responseData = {
                error: false,
                data: {
                    link: `${process.env.URL_CLIENTE}${link}`,
                    linkAdm: process.env.URL_ADM
                },
                message: result.message || "Site criado com sucesso!"
            };

            logger.info(`Resposta enviada para ${id_cliente}: ${result.message || "Site criado com sucesso!"}`, 'req');
            res.json(responseData);
        } else {
            logger.warn(`Cliente não encontrado: ${id_cliente}`, 'req');
            res.status(404).json({
                error: true,
                message: 'Cliente não encontrado.'
            });
        }
    });
});

module.exports = router;
