'use strict';

// Le os campos que chegam em req.query, req.params e req.body.

const { ErroValidacao } = require('../errors');

class Formulario {
  // Corpo da requisicao POST. No Express 5, req.body fica undefined quando a
  // requisicao nao tem corpo; aqui ele vira um objeto vazio.
  static corpo(req) {
    return req.body && typeof req.body === 'object' ? req.body : {};
  }

  // Texto informado, sem espacos nas pontas. Campo vazio vira null.
  static texto(valor) {
    if (valor === undefined || valor === null) return null;
    if (Array.isArray(valor)) return Formulario.texto(valor[0]);

    const texto = String(valor).trim();
    return texto === '' ? null : texto;
  }

  // Senha informada (sem remover espacos, pois fazem parte da senha).
  static senha(valor) {
    if (typeof valor !== 'string' || valor === '') return null;
    return valor;
  }

  // Checkbox HTML: o campo so e enviado quando esta marcado.
  static booleano(valor) {
    return ['on', 'true', '1', 'sim'].includes(String(valor).toLowerCase());
  }

  // Lista de valores (ex.: varios checkboxes com o mesmo name).
  static lista(valor) {
    if (valor === undefined || valor === null || valor === '') return [];

    const itens = Array.isArray(valor) ? valor : [valor];
    return itens.map((item) => String(item).trim()).filter(Boolean);
  }

  // Numero inteiro recebido por parametro GET (pagina, limite...), com valor
  // padrao e limites. Valores invalidos geram ErroValidacao.
  static inteiro(valor, campo, { padrao, min, max }) {
    const texto = Formulario.texto(valor);
    if (texto === null) return padrao;

    const numero = Number(texto);

    if (!Number.isInteger(numero) || numero < min || numero > max) {
      throw new ErroValidacao(
        `Parametro "${campo}" invalido: "${texto}"`,
        [`Parametro "${campo}" deve ser um numero inteiro entre ${min} e ${max}`],
        { operacao: 'Formulario.inteiro', detalhes: { campo, valor: texto } }
      );
    }

    return numero;
  }
}

module.exports = Formulario;
