const db = require('./database');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

const SERVICE_IMAGE_MAPPING = {
    'Corte + Barba': '01.png',
    'Corte de cabelo': '02.png',
    'Sobrancelha': '03.png',
    'Barba completa': '04.png',
    'Pigmentação': '05.png'
};

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

const validarDados = async (dados, callback) => {
    const { tipo, valor } = dados;

    try {
        if (tipo === 'link') {
            const exists = await checkLinkExists(valor);
            if (exists) {
                logger.error(`Este link já está em uso por outra empresa: ${valor}`, 'req');
                return callback(null, { ok: false, message: 'Este link já está em uso por outra empresa' });
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
    const { id_cliente, nome_empresa, telefone, link, tempo_listagem, cores, servicos, logo } = dados;
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
            console.log("dados => ", coluna, campo, dados[campo])
            camposParaAtualizar.push(`${coluna} = ?`);
            valores.push('https://agendaservico.com/' + dados['link']);
        }
    }

    if (camposParaAtualizar.length === 0 && !logo) {
        return callback(null, { ok: false });
    }

    let logoPath = null;
    let imageError = false;
    if (logo) {
        try {
            const uploadResult = await uploadLogoToAsImage(id_cliente, logo);
            logoPath = uploadResult.path;
            imageError = uploadResult.error;
            if (logoPath) {
                logger.info(`Logo enviada com sucesso: ${logoPath}`, 'asimagem');
            }
        } catch (uploadError) {
            logger.error(`Erro ao processar logo: ${uploadError.message}`, 'asimagem');
            imageError = true;
        }
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
                    // const bancoSecundario = id_cliente;
                    const bancoSecundario = '0663';

                    const queryUpdateFunc = `UPDATE \`${bancoSecundario}\`.funcionario SET nome = ?, telefone = ?, id_senha = ?, funcionamento = 12 WHERE id_funcionario = 3`;
                    const valoresUpdateFunc = [dados.nome, dados.telefone, id_senha];
                    console.log(queryUpdateFunc)
                    db.query(queryUpdateFunc, valoresUpdateFunc, (errorUpdateFunc) => {
                        if (errorUpdateFunc) {
                            logger.error(`Erro ao atualizar funcionário no banco secundário: ${errorUpdateFunc.message}`, 'banco');
                            return callback(errorUpdateFunc);
                        }

                        const queryFetch = `SELECT cores FROM \`${bancoSecundario}\`.empresa LIMIT 1`;

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

                            const camposEmpresa = ['razao_social = ?', 'telefone = ?', 'link = ?', 'amostragem = ?', 'bd = ?', 'cores = ?'];
                            const valores2 = [nome_empresa, telefone, `https://agendaservico.com/${link}`, tempo_listagem, id_cliente, coresJsonString];

                            if (logoPath) {
                                camposEmpresa.push('asimage = ?');
                                valores2.push(logoPath);
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

                                    if (servicos && Array.isArray(servicos) && servicos.length > 0) {
                                        const processarServicos = async () => {
                                            const valores3 = [];
                                            for (const s of servicos) {
                                                let serviceImagePath = null;
                                                const mappedImage = SERVICE_IMAGE_MAPPING[s.nome];

                                                if (mappedImage) {
                                                    logger.info(`Associando serviço ${s.nome} com imagem ${mappedImage}`, 'asimagem');
                                                    const uploadResult = await uploadLocalImageToAsImage(id_cliente, mappedImage);
                                                    serviceImagePath = uploadResult.path;
                                                }


                                                valores3.push([s.nome, s.valor, s.tempo, s.descricao, serviceImagePath]);
                                            }

                                            const query3 = `INSERT INTO \`${bancoSecundario}\`.servico (nome_servico, valor_servico, tempo, descricao_servico, image) VALUES ?`;

                                            db.query(query3, [valores3], (error3, results3) => {
                                                if (error3) {
                                                    logger.error(`Erro ao inserir serviços no banco secundário (${bancoSecundario}): ${error3.message}`, 'banco');
                                                    return callback(error3);
                                                }

                                                const firstInsertId = results3.insertId;
                                                const affectedRows = results3.affectedRows;
                                                const lastInsertId = firstInsertId + affectedRows - 1;

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
                                                        callback(null, { ok: true, imageError, message: imageError ? "Site criado com sucesso! (Erro ao salvar imagem)" : "Site criado com sucesso!" });
                                                    });
                                                });
                                            });
                                        };

                                        processarServicos().catch(err => {
                                            logger.error(`Erro ao processar imagens dos serviços: ${err.message}`, 'asimagem');
                                            return callback(err);
                                        });
                                    } else {
                                        callback(null, { ok: true, imageError, message: imageError ? "Site criado com sucesso! (Erro ao salvar imagem)" : "Site criado com sucesso!" });
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
    validarDados
};
