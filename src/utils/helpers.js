// src/utils/helpers.js

module.exports = {
    ifEquals: (a, b, options) => {
        return a == b ? options.fn(this) : options.inverse(this);
    },

    eq: function(a, b) {
        return a === b;
    },
    formatMoney(value) {
      return Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2
      });
    },
    iniciais(nome) {
      if (!nome) return '';
      return nome
        .split(' ')
        .slice(0, 2)
        .map(p => p[0])
        .join('')
        .toUpperCase();
    },
    neq: (a, b) =>{ a !== b},

    // 🆕 verifica se um id está dentro de um array (usado nos checkboxes de serviço)
    includes: (array, value) => {
        return Array.isArray(array) && array.map(Number).includes(Number(value));
    }
};