/* eslint-disable camelcase */
import {
  de_DE,
  en_GB,
  es_ES,
  fr_FR,
  it_IT,
  ko_KR,
  // hu_HU,
  // ja_JP,
  // pl_PL,
  // pt_BR,
  // pt_PT,
  // ru_RU,
  // tr_TR,
  // uk_UA,
  // zh_TW,
  // ar_EG,
  // cs_CZ,
  nl_NL,
  zh_CN,
} from 'ng-zorro-antd/i18n';

export interface LanguagesType {
  [key: string]: {
    ngZorro: any;
    title: string;
    firebase: string;
  };
}

export const Languages: LanguagesType = {
  en: {
    ngZorro: en_GB,
    title: 'EN',
    firebase: 'en',
  },
  de: {
    ngZorro: de_DE,
    title: 'DE',
    firebase: 'de',
  },
  es: {
    ngZorro: es_ES,
    title: 'ES',
    firebase: 'es',
  },
  fr: {
    ngZorro: fr_FR,
    title: 'FR',
    firebase: 'fr',
  },
  it: {
    ngZorro: it_IT,
    title: 'IT',
    firebase: 'it',
  },
  ko: {
    ngZorro: ko_KR,
    title: 'KO',
    firebase: 'ko',
  },
  nl: {
    ngZorro: nl_NL,
    title: 'NL',
    firebase: 'nl',
  },
  zh_cn: {
    ngZorro: zh_CN,
    title: '简中',
    firebase: 'cn',
  },
  // ar_eg: {
  //   ngZorro: ar_EG,
  //   title: 'AR-EG',
  //   firebase: 'eg',
  // },
  // ar_sa: {
  //   // There is no ar_SA in ng-zorro-antd
  //   ngZorro: ar_EG,
  //   title: 'AR-SA',
  //   firebase: 'sa',
  // },
  // cs: {
  //   ngZorro: cs_CZ,
  //   title: 'CS',
  //   firebase: 'cs',
  // },
  // hu: {
  //   ngZorro: hu_HU,
  //   title: 'HU',
  //   firebase: 'hu',
  // },
  // ja: {
  //   ngZorro: ja_JP,
  //   title: 'JA',
  //   firebase: 'ja',
  // },
  // pl: {
  //   ngZorro: pl_PL,
  //   title: 'PL',
  //   firebase: 'pl',
  // },
  // pt_br: {
  //   ngZorro: pt_BR,
  //   title: 'PT-BR',
  //   firebase: 'br',
  // },
  // pt_pt: {
  //   ngZorro: pt_PT,
  //   title: 'PT-PT',
  //   firebase: 'pt',
  // },
  // ru: {
  //   ngZorro: ru_RU,
  //   title: 'RU',
  //   firebase: 'ru',
  // },
  // tr: {
  //   ngZorro: tr_TR,
  //   title: 'TR',
  //   firebase: 'tr',
  // },
  // uk: {
  //   ngZorro: uk_UA,
  //   title: 'UK',
  //   firebase: 'uk',
  // },
  // zh_tw: {
  //   ngZorro: zh_TW,
  //   title: '繁中',
  //   firebase: 'tw',
  // },
};
