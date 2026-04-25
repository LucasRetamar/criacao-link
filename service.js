const db = require('./database');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

const SERVICE_IMAGE_MAPPING = {
    'Corte + Barba': '01.png',
    'Corte de cabelo': '02.png',
    'Sobrancelha': '03.png',
    'Barba completa': '04.png',
    'Pigmentação': '05.png',
    'Corte feminino': '06.png',
    'Escova': '07.png',
    'Progressiva': '08.png',
    'Mechas': '09.png',
    'Hidratação': '10.png'
};

const GROUP_A_SERVICES = ['Corte + Barba', 'Corte de cabelo', 'Sobrancelha', 'Barba completa', 'Pigmentação'];
const GROUP_B_SERVICES = ['Corte feminino', 'Escova', 'Progressiva', 'Mechas', 'Hidratação'];

const uploadLogoToAsImage = async (idCliente, base64Image) => {
    if (!base64Image || !base64Image.includes('base64,')) {
        return { path: null, error: false };
    }

    try {
        const parts = base64Image.split(';base64,');
        const mimeType = parts[0].split(':')[1];
        const base64Data = parts[1];
        const buffer = Buffer.from(base64Data, 'base64');

        const formData = new FormData();
        formData.append('idCliente', idCliente);
        formData.append('type', 'logo');

        const blob = new Blob([buffer], { type: mimeType });
        formData.append('image', blob, 'logo.png');

        const response = await fetch(process.env.IMAGE_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            logger.error(`Servidor de imagem retornou erro: ${response.status}`, 'asimagem');
            return { path: null, error: true };
        }

        const text = await response.text();
        try {
            const result = JSON.parse(text);
            return { path: result.fileNameFormatada || null, error: false };
        } catch (parseError) {
            logger.error(`Erro ao parsear JSON do servidor de imagem: ${text}`, 'asimagem');
            return { path: null, error: true };
        }
    } catch (error) {
        logger.error(`Erro no upload para asimage: ${error.message}`, 'asimagem');
        return { path: null, error: true };
    }
};

const uploadLocalImageToAsImage = async (idCliente, fileName) => {
    try {
        const filePath = path.join(__dirname, 'fotos', fileName);
        if (!fs.existsSync(filePath)) {
            logger.error(`Arquivo de imagem local não encontrado: ${filePath}`, 'asimagem');
            return { path: null, error: true };
        }

        const buffer = fs.readFileSync(filePath);
        const mimeType = 'image/png';

        const formData = new FormData();
        formData.append('idCliente', idCliente);
        formData.append('type', 'servico');

        const blob = new Blob([buffer], { type: mimeType });
        formData.append('image', blob, fileName);

        const response = await fetch(process.env.IMAGE_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            logger.error(`Servidor de imagem retornou erro ao subir servico: ${response.status}`, 'asimagem');
            return { path: null, error: true };
        }

        const text = await response.text();
        try {
            const result = JSON.parse(text);
            return { path: result.fileNameFormatada || null, error: false };
        } catch (parseError) {
            logger.error(`Erro ao parsear JSON do servidor de imagem (servico): ${text}`, 'asimagem');
            return { path: null, error: true };
        }
    } catch (error) {
        logger.error(`Erro no upload local para asimage: ${error.message}`, 'asimagem');
        return { path: null, error: true };
    }
};

const uploadSubscriptionImages = async (idCliente, idAssinaturaPacote, images) => {
    if (!images || images.length === 0) return { error: false };

    try {
        const formData = new FormData();
        formData.append('idCliente', idCliente);
        formData.append('type', 'assinatura_pacote');
        formData.append('idAssinaturaPacote', idAssinaturaPacote);
        formData.append('edicao', 'true');

        for (let i = 0; i < images.length; i++) {
            const fileName = images[i];
            const filePath = path.join(__dirname, 'fotos', fileName);
            if (fs.existsSync(filePath)) {
                const buffer = fs.readFileSync(filePath);
                const blob = new Blob([buffer], { type: 'image/png' });
                formData.append(`image${i}`, blob, fileName);
            }
        }

        const response = await fetch(process.env.IMAGE_ASSINATURA_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            logger.error(`Servidor de imagem assinatura retornou erro: ${response.status}`, 'asimagem');
            return { error: true };
        }

        const text = await response.text();
        try {
            const result = JSON.parse(text);
            logger.info(`Upload de imagens da assinatura finalizado para ID: ${idAssinaturaPacote}`, 'asimagem');
        } catch (e) {
            logger.info(`Upload de imagens da assinatura finalizado (res: ${text.substring(0, 50)}...)`, 'asimagem');
        }
        return { error: false };
    } catch (error) {
        logger.error(`Erro no upload de imagens da assinatura: ${error.message}`, 'asimagem');
        return { error: true };
    }
};


const checkLinkExists = (link) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM `clientes` WHERE empresa = ? and ativo = 1;";
        db.query(sql, [link], (error, results) => {
            if (error) return reject(error);
            resolve(results.length > 0);
        });
    });
};

const checkPhoneExists = (telefone) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM `senhas` WHERE telefone = ? and status = 1;";
        db.query(sql, [telefone], (error, results) => {
            if (error) return reject(error);
            resolve(results.length > 0);
        });
    });
};

const buscarProximoIdCliente = () => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT id_cliente FROM clientes WHERE ativo = 1 and link_cadastro = 0 ORDER BY clientes.id_cliente ASC LIMIT 1;";
        db.query(sql, (error, results) => {
            if (error) {
                logger.error(`Erro ao buscar o próximo ID do cliente: ${error.message}`, 'banco');
                return reject(error);
            }
            if (results.length > 0) {
                resolve(results[0].id_cliente);
            } else {
                reject(new Error("Nenhum cliente disponível para atualização (ativo = 1 and link_cadastro = 0)."));
            }
        });
    });
};

const validarDados = async (dados, callback) => {
    const { tipo, valor } = dados;

    try {
        if (tipo === 'link') {
            const exists = await checkLinkExists(valor);
            if (exists) {
                logger.error(`Este link já está em uso por outra empresa: ${valor}`, 'req');
                return callback(null, { ok: false, message: 'Este link já está em uso por outra empresa.' });
            }
        } else if (tipo === 'telefone') {
            const exists = await checkPhoneExists(valor);
            if (exists) {
                logger.error(`Telefone ja esta cadastrado: ${valor}`, 'req');
                return callback(null, { ok: false, message: 'Telefone já cadastrado.' });
            }
        }
        callback(null, { ok: true });
    } catch (error) {
        callback(error);
    }
};

const atualizarDadosCliente = async (dados, callback) => {
    const { id_cliente, id_banco_cliente, nome, nome_empresa, telefone, link, tempo_listagem, cores, servicos, logo, google, instagram } = dados;
    const bancoSecundario = id_banco_cliente;
    const criarCategoria = process.env.CRIAR_CATEGORIA !== 'false';
    const criarAssinatura = process.env.CRIAR_ASSINATURA !== 'false';
    const camposParaAtualizar = [];
    const valores = [];
    const mapaCampos = {
        nome: 'nome_cliente',
        nome_empresa: 'nome_empresa',
        empresa1: 'empresa',
        telefone: 'telefone',
        cpf_cnpj: 'cpf_cnpj',
        link: 'link'
    };

    for (const [campo, coluna] of Object.entries(mapaCampos)) {
        if (dados[campo] !== undefined && coluna != 'link') {
            camposParaAtualizar.push(`${coluna} = ?`);
            valores.push(dados[campo]);
        } else if (coluna == 'empresa') {
            camposParaAtualizar.push(`${coluna} = ?`);
            valores.push(dados['link']);
        } else if (coluna == 'link') {
            camposParaAtualizar.push(`${coluna} = ?`);
            valores.push('https://agendaservico.com/' + dados['link']);
        }
    }


    const agora = new Date();
    const dataFormatada = agora.getFullYear() + '-' +
        String(agora.getMonth() + 1).padStart(2, '0') + '-' +
        String(agora.getDate()).padStart(2, '0') + ' ' +
        String(agora.getHours()).padStart(2, '0') + ':' +
        String(agora.getMinutes()).padStart(2, '0') + ':' +
        String(agora.getSeconds()).padStart(2, '0');

    const id_funcionario = dados.id_consultora !== undefined ? dados.id_consultora : 0;

    camposParaAtualizar.push('link_cadastro = ?', 'data_cadastro = ?', 'final_licenca = ?', 'inicio_licenca = ?', 'id_funcionario = ?');
    valores.push(1, dataFormatada, dataFormatada, dataFormatada, id_funcionario);

    if (camposParaAtualizar.length === 0 && !logo) {
        return callback(null, { ok: false });
    }
    try {
        const linkExists = await checkLinkExists(dados['link']);
        if (linkExists) {
            logger.error(`Este link já está em uso por outra empresa: ${dados['link']}`, 'banco');
            return callback(null, { ok: false });
        }

        const phoneExists = await checkPhoneExists(dados['telefone']);
        if (phoneExists) {
            logger.error(`Telefone ja esta cadastrado: ${dados['telefone']}`, 'banco');
            return callback(null, { ok: false });
        }

        if (logo) {
            logger.info(`Iniciando upload da logo em background para cliente: ${id_cliente}`, 'asimagem');
            uploadLogoToAsImage(id_cliente, logo).then(uploadResult => {
                if (uploadResult.path) {
                    logger.info(`Logo enviada com sucesso em background: ${uploadResult.path}`, 'asimagem');
                    const sqlUpdateLogo = 'UPDATE ??.empresa SET asimage = ?';
                    db.query(sqlUpdateLogo, [bancoSecundario, uploadResult.path], (errLogo) => {
                        if (errLogo) logger.error(`Erro ao atualizar logo no banco: ${errLogo.message}`, 'banco');
                    });
                }
            }).catch(err => {
                logger.error(`Erro no upload de logo background: ${err.message}`, 'asimagem');
            });
        }

        const query1 = `UPDATE clientes SET ${camposParaAtualizar.length > 0 ? camposParaAtualizar.join(', ') : 'id_cliente = id_cliente'} WHERE id_cliente = ?`;
        const valores1 = [...valores, id_cliente];
        console.log(query1)
        db.query(query1, valores1, (error, results) => {
            if (error) return callback(error);

            if (results.affectedRows > 0) {
                const querySenha = `INSERT INTO senhas (telefone, senha, id_cliente, suporte, status) VALUES (?, ?, ?, ?, ?)`;
                const hashSenha = '$2y$10$hHIe0vp.9.OkKgSA0PkPOOV1stpBr8pw6pkL/LZ6x.7R2YiyEzaNG';
                const valoresSenha = [telefone, hashSenha, id_cliente, 0, 1];

                db.query(querySenha, valoresSenha, (errorSenha, resultsSenha) => {
                    if (errorSenha) {
                        logger.error(`Erro ao inserir na tabela senhas: ${errorSenha.message}`, 'banco');
                        return callback(errorSenha);
                    }

                    const id_senha = resultsSenha.insertId;

                    const queryUpdateFunc = `UPDATE \`${bancoSecundario}\`.funcionario SET nome = ?, telefone = ?, id_senha = ?, funcionamento = 12 WHERE id_funcionario = 3`;
                    const valoresUpdateFunc = [dados.nome, dados.telefone, id_senha];
                    console.log(queryUpdateFunc)
                    db.query(queryUpdateFunc, valoresUpdateFunc, (errorUpdateFunc) => {
                        if (errorUpdateFunc) {
                            logger.error(`Erro ao atualizar funcionário no banco secundário: ${errorUpdateFunc.message}`, 'banco');
                            return callback(errorUpdateFunc);
                        }

                        const queryFetch = `SELECT cores, mensagens FROM \`${bancoSecundario}\`.empresa LIMIT 1`;

                        db.query(queryFetch, (errFetch, rows) => {
                            if (errFetch) {
                                logger.error(`Erro ao buscar cores atuais: ${errFetch.message}`, 'banco');
                                return callback(errFetch);
                            }

                            let coresAtuais = {};
                            let novasCores = {};
                            try {
                                coresAtuais = (rows[0] && rows[0].cores) ? (typeof rows[0].cores === 'string' ? JSON.parse(rows[0].cores) : rows[0].cores) : {};
                            } catch (e) {
                                logger.error(`Erro ao parsear JSON de cores: ${e.message}`, 'banco');
                            }

                            let mensagemAtual = rows[0] && rows[0].mensagens;
                            let novaMensagem = null;
                            if (mensagemAtual) {
                                try {
                                    let msgObj = typeof mensagemAtual === 'string' ? JSON.parse(mensagemAtual) : mensagemAtual;
                                    if (msgObj && msgObj["2000"]) {
                                        const template = msgObj["2000"];
                                        delete msgObj["2000"];
                                        template.bd = `bd${id_cliente}`;

                                        const newObj = { [id_cliente]: template };
                                        Object.assign(newObj, msgObj);
                                        novaMensagem = JSON.stringify(newObj);
                                    }
                                } catch (e) {
                                    logger.error(`Erro ao processar campo mensagem: ${e.message}`, 'banco');
                                }
                            }
                            novasCores["primaria"] = cores["primaria"];
                            novasCores["secundaria"] = cores["secundaria"];
                            novasCores["sombra"] = cores["secundaria"];
                            novasCores["cartoesCor"] = cores["primaria"];
                            novasCores["textoIconesCor"] = cores["secundaria"];
                            novasCores["textoDestaquesCor"] = cores["primaria"];
                            novasCores["botoesAcaoCor"] = cores["secundaria"];
                            novasCores["menuNavCor"] = cores["primaria"];
                            novasCores["iconesMenuCor"] = cores["secundaria"];
                            novasCores["opacidadeCor"] = cores["secundaria"];
                            novasCores["valorOpacidade"] = 50;


                            const coresJsonString = JSON.stringify(novasCores);

                            let camposEmpresa = ['razao_social = ?', 'telefone = ?', 'link = ?', 'amostragem = ?', 'bd = ?', 'cores = ?', 'maps = ?', 'instagram = ?', 'ordenar_categoria = 1'];
                            let valores2 = [nome_empresa, telefone, `https://agendaservico.com/${link}`, tempo_listagem, id_cliente, coresJsonString, google || null, instagram || null];

                            if (novaMensagem) {
                                camposEmpresa.push('mensagens = ?');
                                valores2.push(novaMensagem);
                            }

                            const query2 = `UPDATE \`${bancoSecundario}\`.empresa SET ${camposEmpresa.join(', ')}`;

                            db.query(query2, valores2, (error2) => {
                                if (error2) {
                                    logger.error(`Erro ao atualizar banco secundário (${bancoSecundario}): ${error2.message}`, 'banco');
                                    return callback(error2);
                                }

                                const sql = `UPDATE  \`${bancoSecundario}\`.servico SET status = '0';`;
                                db.query(sql, [], (error3, results3) => {
                                    if (error3) {
                                        logger.error(`Erro ao inserir serviços no banco secundário (${bancoSecundario}): ${error3.message}`, 'banco');
                                        return callback(error3);
                                    }

                                    const processarServicos = async () => {
                                        const valores3 = servicos.map(s => [s.nome, s.valor, s.tempo, s.descricao, null, 0]);

                                        const query3 = `INSERT INTO \`${bancoSecundario}\`.servico (nome_servico, valor_servico, tempo, descricao_servico, image, id_categoria) VALUES ?`;

                                        db.query(query3, [valores3], (error3, results3) => {
                                            if (error3) {
                                                logger.error(`Erro ao inserir serviços no banco secundário (${bancoSecundario}): ${error3.message}`, 'banco');
                                                return callback(error3);
                                            }

                                            const firstInsertId = results3.insertId;
                                            const affectedRows = results3.affectedRows;
                                            const lastInsertId = firstInsertId + affectedRows - 1;

                                            // Dispara upload das fotos dos serviços em background
                                            servicos.forEach((s, index) => {
                                                const mappedImage = SERVICE_IMAGE_MAPPING[s.nome];
                                                if (mappedImage) {
                                                    const currentServiceId = firstInsertId + index;
                                                    uploadLocalImageToAsImage(id_cliente, mappedImage).then(result => {
                                                        if (result.path) {
                                                            logger.info(`Foto do serviço "${s.nome}" enviada com sucesso: ${result.path}`, 'asimagem');
                                                            const sqlUpdateImg = `UPDATE \`${bancoSecundario}\`.servico SET image = ? WHERE id_servico = ?`;
                                                            db.query(sqlUpdateImg, [result.path, currentServiceId], (errUpd) => {
                                                                if (errUpd) logger.error(`Erro ao vincular imagem ao serviço ${currentServiceId}: ${errUpd.message}`, 'banco');
                                                            });
                                                        }
                                                    }).catch(err => {
                                                        logger.error(`Erro no upload background do serviço ${s.nome}: ${err.message}`, 'asimagem');
                                                    });
                                                }
                                            });

                                            const finalizarProcessamento = () => {
                                                const queryDelete = `DELETE FROM \`${bancoSecundario}\`.funcionario_servico_funcionamento`;

                                                db.query(queryDelete, (errorDelete) => {
                                                    if (errorDelete) {
                                                        logger.error(`Erro ao limpar vínculos no banco secundário (${bancoSecundario}): ${errorDelete.message}`, 'banco');
                                                        return callback(errorDelete);
                                                    }

                                                    const query4 = `
                                                                        INSERT INTO \`${bancoSecundario}\`.funcionario_servico_funcionamento 
                                                                        (id_funcionamento, id_funcionario, id_servico, tempo, valor, comissao, status_variacao, existe_variacao)
                                                                        SELECT 
                                                                            f.id_funcionamento,
                                                                            3 AS id_funcionario,
                                                                            s.id_servico,
                                                                            s.tempo,
                                                                            s.valor_servico,
                                                                            0 AS comissao,
                                                                            0 AS status_variacao,
                                                                            0 AS existe_variacao
                                                                        FROM \`${bancoSecundario}\`.funcionamento f
                                                                        CROSS JOIN \`${bancoSecundario}\`.servico s
                                                                        WHERE f.status = 1 
                                                                        AND s.id_servico BETWEEN ? AND ?
                                                                    `;

                                                    db.query(query4, [firstInsertId, lastInsertId], (error4) => {
                                                        if (error4) {
                                                            logger.error(`Erro ao inserir vínculos de funcionamento no banco secundário (${bancoSecundario}): ${error4.message}`, 'banco');
                                                            return callback(error4);
                                                        }

                                                        const servicesMatchedA = [];
                                                        const servicesMatchedB = [];

                                                        servicos.forEach((s, index) => {
                                                            if (GROUP_A_SERVICES.includes(s.nome)) servicesMatchedA.push(index);
                                                            if (GROUP_B_SERVICES.includes(s.nome)) servicesMatchedB.push(index);
                                                        });

                                                        const registrarAssinatura = (matchedIndices, pattern) => {
                                                            return new Promise((resolve, reject) => {
                                                                if (matchedIndices.length === 0) return resolve();

                                                                const subscriptionServices = matchedIndices.map(idx => ({
                                                                    id: (firstInsertId + idx).toString(),
                                                                    quantidade: "0"
                                                                }));

                                                                let imagesToUpload = matchedIndices
                                                                    .map(idx => SERVICE_IMAGE_MAPPING[servicos[idx].nome])
                                                                    .filter(Boolean);


                                                                const group = pattern === 'A' ? GROUP_A_SERVICES : GROUP_B_SERVICES;
                                                                for (const serviceName of group) {
                                                                    if (imagesToUpload.length >= 3) break;
                                                                    const img = SERVICE_IMAGE_MAPPING[serviceName];
                                                                    if (img && !imagesToUpload.includes(img)) {
                                                                        imagesToUpload.push(img);
                                                                    }
                                                                }
                                                                imagesToUpload = imagesToUpload.slice(0, 3);

                                                                const template = pattern === 'A' ? {
                                                                    nome: 'Cabelo + Barba Ilimitado',
                                                                    descricao: 'Corte + barba ilimitados por R$149,90/mês.\r\nCuide do visual sempre que precisar, sem se preocupar com cada visita. Tenha liberdade para manter o corte em dia e a barba alinhada o mês inteiro, com economia e praticidade em um único plano.',
                                                                    subtitulo: 'Cabelo + Barba Ilimitado',
                                                                    link: 'cabelo-barba-ilimitado'
                                                                } : {
                                                                    nome: 'Beleza & Estética Ilimitada',
                                                                    descricao: 'Transforme seu visual e mantenha sua autoestima sempre em alta. Com nosso plano ilimitado, você tem acesso aos melhores cuidados capilares e tratamentos estéticos sempre que desejar. Praticidade e elegância reunidas em uma assinatura exclusiva para você.',
                                                                    subtitulo: 'Beleza & Estética Ilimitada',
                                                                    link: 'beleza-estetica-ilimitada'
                                                                };

                                                                const sqlAssinatura = `
                                                                        INSERT INTO \`${bancoSecundario}\`.assinatura_pacote 
                                                                        (tipo, nome, valor, descricao, servicos, subtitulo, termino, forma_pagamento, regra, metodo_pagamento, versao_termos_cliente, link, status, etiqueta, recorrencia, utilizacao, imagem, data_cadastro, ocultar) 
                                                                        VALUES ('1', ?, '14990', ?, ?, ?, '0', '1', '0', '2', '3', ?, '1', '1', '1', '1', '3', NOW(), '0')
                                                                    `;

                                                                const valuesAssinatura = [
                                                                    template.nome, template.descricao, JSON.stringify(subscriptionServices),
                                                                    template.subtitulo, template.link
                                                                ];

                                                                db.query(sqlAssinatura, valuesAssinatura, (errAss, resultsAss) => {
                                                                    if (errAss) {
                                                                        logger.error(`Erro ao inserir assinatura (${pattern}): ${errAss.message}`, 'banco');
                                                                        return reject(errAss);
                                                                    }

                                                                    const idAssinatura = resultsAss.insertId;
                                                                    resolve({
                                                                        success: true,
                                                                        id: idAssinatura,
                                                                        images: imagesToUpload
                                                                    });
                                                                });
                                                            });
                                                        };

                                                        if (!criarAssinatura) {
                                                            return callback(null, {
                                                                ok: true,
                                                                imageError: false,
                                                                assinaturas: [],
                                                                message: "Site criado com sucesso!"
                                                            });
                                                        }

                                                        const sqlResetAss = `UPDATE \`${bancoSecundario}\`.assinatura_pacote SET status = '0'`;
                                                        db.query(sqlResetAss, (errResetAss) => {
                                                            if (errResetAss) {
                                                                logger.error(`Erro ao resetar status das assinaturas no banco secundário (${bancoSecundario}): ${errResetAss.message}`, 'banco');
                                                                return callback(errResetAss);
                                                            }

                                                            Promise.all([
                                                                registrarAssinatura(servicesMatchedA, 'A'),
                                                                registrarAssinatura(servicesMatchedB, 'B')
                                                            ]).then((results) => {
                                                                const assinaturas = results.filter(r => r && r.success);
                                                                callback(null, {
                                                                    ok: true,
                                                                    imageError: false,
                                                                    assinaturas,
                                                                    message: "Site criado com sucesso!"
                                                                });
                                                            }).catch(err => {
                                                                logger.error(`Erro no processamento das assinaturas: ${err.message}`, 'banco');
                                                                callback(err);
                                                            });
                                                        });
                                                    });
                                                });
                                            };

                                            if (servicos.length > 1 && criarCategoria) {
                                                const queryResetCat = `UPDATE \`${bancoSecundario}\`.categoria_servico SET status = 0`;
                                                db.query(queryResetCat, (errReset) => {
                                                    if (errReset) {
                                                        logger.error(`Erro ao resetar status das categorias no banco secundário (${bancoSecundario}): ${errReset.message}`, 'banco');
                                                        return callback(errReset);
                                                    }


                                                    const queryCat = `INSERT INTO \`${bancoSecundario}\`.categoria_servico (descricao, status, ordem) VALUES ('Categoria', 1, 1)`;
                                                    db.query(queryCat, (errCat, resCat) => {
                                                        if (errCat) {
                                                            logger.error(`Erro ao criar categoria no banco secundário (${bancoSecundario}): ${errCat.message}`, 'banco');
                                                            return callback(errCat);
                                                        }

                                                        const id_categoria = resCat.insertId;
                                                        const queryUpdateServ = `UPDATE \`${bancoSecundario}\`.servico SET id_categoria = ? WHERE id_servico BETWEEN ? AND ?`;

                                                        db.query(queryUpdateServ, [id_categoria, firstInsertId + 1, lastInsertId], (errUpdate) => {
                                                            if (errUpdate) {
                                                                logger.error(`Erro ao vincular serviços à categoria no banco secundário (${bancoSecundario}): ${errUpdate.message}`, 'banco');
                                                                return callback(errUpdate);
                                                            }

                                                            const queryVinculo = `
                                                                                INSERT INTO \`${bancoSecundario}\`.vinculo_servico_categoria_servico (id_servico, id_categoria_servico)
                                                                                SELECT id_servico, ? FROM \`${bancoSecundario}\`.servico WHERE id_servico BETWEEN ? AND ?
                                                                            `;

                                                            db.query(queryVinculo, [id_categoria, firstInsertId + 1, lastInsertId], (errVinculo) => {
                                                                if (errVinculo) {
                                                                    logger.error(`Erro ao inserir na tabela vinculo_servico_categoria_servico: ${errVinculo.message}`, 'banco');
                                                                    return callback(errVinculo);
                                                                }
                                                                finalizarProcessamento();
                                                            });
                                                        });
                                                    });
                                                });
                                            } else {
                                                finalizarProcessamento();
                                            }
                                        });
                                    };

                                    if (servicos && Array.isArray(servicos) && servicos.length > 0) {
                                        processarServicos().catch(err => {
                                            logger.error(`Erro ao processar imagens dos serviços: ${err.message}`, 'asimagem');
                                            return callback(err);
                                        });
                                    } else {
                                        callback(null, { ok: true, message: "Site criado com sucesso!" });
                                    }
                                })
                            });
                        });
                    });
                });
            } else {
                callback(null, { ok: false });
            }
        });
    } catch (error) {
        callback(error);
    }
};

module.exports = {
    atualizarDadosCliente,
    validarDados,
    uploadSubscriptionImages,
    buscarProximoIdCliente
};
