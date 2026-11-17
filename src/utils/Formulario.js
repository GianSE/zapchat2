'use strict';

/**
 * Leitura dos parametros recebidos nas requisicoes (Projeto 2).
 *
 * Os dados chegam ao Express sempre como texto:
 *   - GET  -> req.query  (?busca=ana&pagina=2) e req.params (/usuarios/:id);
 *   - POST -> req.body   (campos do formulario HTML ou JSON).
 *
 * Esta classe apenas normaliza esses textos (remove espacos, converte campos
 * vazios em null, transforma checkbox em booleano). A validacao das regras
 * continua sendo feita pelas entidades do Model, como no Projeto 1.
 */

const { ErroValidacao } = require('../errors');

class Formulario {
  /**
   * Corpo da requisicao POST. No Express 5, req.body fica undefined quando a
   * requisicao nao tem corpo; aqui ele vira um objeto vazio.
   *
   * @param {import('express').Request} req
   * @returns {object}
   */
  static corpo(req) {
    return req.body && typeof req.body === 'object' ? req.body : {};
  }

  /**
   * Texto informado, sem espacos nas pontas. Campo vazio vira null.
   *
   * @param {*} valor Valor recebido.
   * @returns {string|null}
   */
  static texto(valor) {
    if (valor === undefined || valor === null) return null;
    if (Array.isArray(valor)) return Formulario.texto(valor[0]);

    const texto = String(valor).trim();
    return texto === '' ? null : texto;
  }

  /**
   * Senha informada (sem remover espacos, pois fazem parte da senha).
   *
   * @param {*} valor Valor recebido.
   * @returns {string|null}
   */
  static senha(valor) {
    if (typeof valor !== 'string' || valor === '') return null;
    return valor;
  }

  /**
   * Checkbox HTML: o campo so e enviado quando esta marcado.
   *
   * @param {*} valor Valor recebido.
   * @returns {boolean}
   */
  static booleano(valor) {
    return ['on', 'true', '1', 'sim'].includes(String(valor).toLowerCase());
  }

  /**
   * Lista de valores (ex.: varios checkboxes com o mesmo name).
   *
   * @param {*} valor Valor recebido.
   * @returns {string[]}
   */
  static lista(valor) {
    if (valor === undefined || valor === null || valor === '') return [];

    const itens = Array.isArray(valor) ? valor : [valor];
    return itens.map((item) => String(item).trim()).filter(Boolean);
  }

  /**
   * Numero inteiro recebido por parametro GET (pagina, limite...), com valor
   * padrao e limites. Valores invalidos geram ErroValidacao.
   *
   * @param {*} valor Valor recebido.
   * @param {string} campo Nome do parametro.
   * @param {object} opcoes
   * @param {number} opcoes.padrao Valor usado quando o parametro nao foi enviado.
   * @param {number} opcoes.min Menor valor aceito.
   * @param {number} opcoes.max Maior valor aceito.
   * @returns {number}
   * @throws {ErroValidacao}
   */
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
