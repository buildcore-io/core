/* eslint-disable camelcase */
import {
  ar_EG, cs_CZ, de_DE, en_GB, es_ES, fr_FR, hu_HU, it_IT, ja_JP, ko_KR, nl_NL, pl_PL, pt_BR, pt_PT, ru_RU, tr_TR, uk_UA, zh_CN, zh_TW
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
    firebase: 'en'
  },
  ar_eg: {
    ngZorro: ar_EG,
    title: 'AR-EG',
    firebase: 'eg'
  },
  ar_sa: {
    // There is no ar_SA in ng-zorro-antd
    ngZorro: ar_EG,
    title: 'AR-SA',
    firebase: 'sa'
  },
  cs: {
    ngZorro: cs_CZ,
    title: 'CS',
    firebase: 'cs'
  },
  de: {
    ngZorro: de_DE,
    title: 'DE',
    firebase: 'de'
  },
  es: {
    ngZorro: es_ES,
    title: 'ES',
    firebase: 'es'
  },
  fr: {
    ngZorro: fr_FR,
    title: 'FR',
    firebase: 'fr'
  },
  hu: {
    ngZorro: hu_HU,
    title: 'HU',
    firebase: 'hu'
  },
  it: {
    ngZorro: it_IT,
    title: 'IT',
    firebase: 'it'
  },
  ja: {
    ngZorro: ja_JP,
    title: 'JA',
    firebase: 'ja'
  },
  ko: {
    ngZorro: ko_KR,
    title: 'KO',
    firebase: 'ko'
  },
  nl: {
    ngZorro: nl_NL,
    title: 'NL',
    firebase: 'nl'
  },
  pl: {
    ngZorro: pl_PL,
    title: 'PL',
    firebase: 'pl'
  },
  pt_br: {
    ngZorro: pt_BR,
    title: 'PT-BR',
    // TODO we need to select right country
    firebase: 'br'
  },
  pt_pt: {
    ngZorro: pt_PT,
    title: 'PT-PT',
    // TODO we need to select right country
    firebase: 'pt'
  },
  ru: {
    ngZorro: ru_RU,
    title: 'RU',
    firebase: 'ru'
  },
  tr: {
    ngZorro: tr_TR,
    title: 'TR',
    firebase: 'tr'
  },
  uk: {
    ngZorro: uk_UA,
    title: 'UK',
    firebase: 'uk'
  },
  zh_cn: {
    ngZorro: zh_CN,
    title: 'ZH-CN',
    // TODO we need to select right country
    firebase: 'cn'
  },
  zh_tw: {
    ngZorro: zh_TW,
    title: 'ZH-TW',
    // TODO we need to select right country
    firebase: 'tw'
  },
};
