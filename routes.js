const express = require('express');
const router = express.Router();
const { atualizarDadosCliente } = require('./service');
const { validarDadosCliente } = require('./validacoes');
const RedisDB = require('./services/redis')

console.log('Arquivo routes.js carregado com sucesso!');


router.post('/atualizarDados', (req, res) => {
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
            res.json({
                error: false,
                data: {
                    link: "agendaservico.com",
                    linkAdm: "https://agendaservico.com/"
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

router.post('/redis', (req, res) => {

    const Redis = new RedisDB()
    Redis.connect()
    // Redis.setClient("key", "value")
    // Redis.setClientVerify("key", "value")
    // Redis.setClientVerify("nameClient", "idCliente")

    res.status(200).json({
        success: true,
        message: "Requisição recebida com sucesso"
    });

    // res.status(400).json({
    //     success: false,
    //     message: "Erro na requisição"
    // });
});

module.exports = router;
