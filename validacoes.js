const validarNome = (nome) => {
    if (!nome || typeof nome !== 'string') return false;
    const regex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{2,80}$/;
    return regex.test(nome.trim());
};


const validarNomeEmpresa = (nome_empresa) => {
    if (!nome_empresa || typeof nome_empresa !== 'string') return false;
    const regex = /^[A-Za-z0-9À-ÖØ-öø-ÿ\s.\-]{2,120}$/;
    return regex.test(nome_empresa.trim());
};


const validarTelefone = (telefone) => {
    if (!telefone || typeof telefone !== 'string') return false;
    const regex = /^\(\d{2}\)\d{5}-\d{4}$/;
    return regex.test(telefone);
};

const validarCpfCnpj = (valor) => {
    if (!valor || typeof valor !== 'string') return false;
    const regexCpf = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    const regexCnpj = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

    if (regexCpf.test(valor)) return valor.length === 14;
    if (regexCnpj.test(valor)) return valor.length === 18;

    return false;
};


const validarLink = (link) => {
    if (!link || typeof link !== 'string') return false;
    const regex = /^[a-z0-9-]{3,40}$/;
    return regex.test(link.trim());
};

const validarLogo = (base64String) => {
    if (!base64String || typeof base64String !== 'string') return false;

    const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;

    const tamanhoEmBytes = (base64Data.length * 3) / 4;
    const cincoMB = 5 * 1024 * 1024;

    return tamanhoEmBytes <= cincoMB;
};

const validarHex = (hex) => {
    if (!hex || typeof hex !== 'string') return false;
    const regex = /^#([A-Fa-f0-9]{3}){1,2}$/;
    return regex.test(hex);
};

const validarTempo = (tempo) => {
    if (!tempo || typeof tempo !== 'string') return false;
    const regex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    return regex.test(tempo);
};

const validarValor = (valor) => {
    return Number.isInteger(valor) && valor >= 1 && valor <= 999999;
};

const validarNomeServico = (nome) => {
    if (!nome || typeof nome !== 'string') return false;
    const regex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s+\-/]{2,80}$/;
    return regex.test(nome.trim());
};

const validarDadosCliente = (dados) => {
    const erros = [];
    const camposObrigatorios = ['id_cliente', 'nome', 'nome_empresa', 'telefone', 'cpf_cnpj', 'link', 'logo', 'cores', 'servicos', 'tempo_listagem'];

    camposObrigatorios.forEach(campo => {
        if (dados[campo] === undefined || dados[campo] === null || (typeof dados[campo] === 'string' && dados[campo].trim() === '')) {
            erros.push(`O campo '${campo}' é obrigatório.`);
        }
    });

    if (dados.nome && !validarNome(dados.nome)) {
        erros.push("O nome deve conter apenas letras e ter entre 2 e 80 caracteres.");
    }
    if (dados.nome_empresa && !validarNomeEmpresa(dados.nome_empresa)) {
        erros.push("O nome da empresa deve ter entre 2 e 120 caracteres.");
    }
    if (dados.telefone && !validarTelefone(dados.telefone)) {
        erros.push("O telefone deve seguir o formato (XX)XXXXX-XXXX.");
    }
    if (dados.cpf_cnpj && !validarCpfCnpj(dados.cpf_cnpj)) {
        erros.push("O CPF/CNPJ deve seguir o formato XXX.XXX.XXX-XX ou XX.XXX.XXX/0001-XX.");
    }
    if (dados.link && !validarLink(dados.link)) {
        erros.push("O link deve ser letras e números entre 3 e 40 caracteres.");
    }
    if (dados.logo && !validarLogo(dados.logo)) {
        erros.push("O logo deve ser uma imagem em Base64 de no máximo 5MB.");
    }

    if (dados.cores) {
        const { primaria, secundaria, sombra } = dados.cores;
        if (!primaria || !secundaria || !sombra) {
            erros.push("O objeto 'cores' deve conter 'primaria', 'secundaria' e 'sombra'.");
        } else {
            if (!validarHex(primaria)) erros.push("A cor 'primaria' deve estar no formato hexadecimal (Ex: #000000).");
            if (!validarHex(secundaria)) erros.push("A cor 'secundaria' deve estar no formato hexadecimal (Ex: #000000).");
            if (!validarHex(sombra)) erros.push("A cor 'sombra' deve estar no formato hexadecimal (Ex: #000000).");
        }
    }

    if (dados.servicos) {
        if (!Array.isArray(dados.servicos)) {
            erros.push("O campo 'servicos' deve ser um array.");
        } else if (dados.servicos.length === 0) {
            erros.push("O campo 'servicos' deve conter pelo menos um serviço.");
        } else {
            dados.servicos.forEach((servico, index) => {
                const { nome, tempo, valor, descricao } = servico;
                if (!nome || !validarNomeServico(nome)) {
                    erros.push(`Serviço [${index}]: Nome inválido.`);
                }
                if (!tempo || !validarTempo(tempo)) {
                    erros.push(`Serviço [${index}]: Tempo inválido (formato HH:MM:SS).`);
                }
                if (valor === undefined || !validarValor(valor)) {
                    erros.push(`Serviço [${index}]: Valor inválido (deve ser um inteiro entre 1 e 999999 centavos).`);
                }
                if (!descricao || typeof descricao !== 'string' || descricao.length < 1 || descricao.length > 500) {
                    erros.push(`Serviço [${index}]: Descrição inválida (1-500 caracteres).`);
                }
            });
        }
    }

    if (dados.tempo_listagem !== undefined) {
        if (!Number.isInteger(dados.tempo_listagem) || dados.tempo_listagem < 1 || dados.tempo_listagem > 1440) {
            erros.push("O campo 'tempo_listagem' deve ser um número inteiro entre 1 e 1440 minutos.");
        }
    }

    return {
        valido: erros.length === 0,
        erros
    };
};

module.exports = {
    validarDadosCliente
};
