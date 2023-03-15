/* eslint-disable camelcase */
import { en_GB } from 'ng-zorro-antd/i18n';

// es_ES,
// fr_FR,
// it_IT,
// ko_KR,
// nl_NL,
// zh_CN
// de_DE,

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
  // de: {
  //   ngZorro: de_DE,
  //   title: 'DE',
  //   firebase: 'de',
  // },
  // es: {
  //   ngZorro: es_ES,
  //   title: 'ES',
  //   firebase: 'es',
  // },
  // fr: {
  //   ngZorro: fr_FR,
  //   title: 'FR',
  //   firebase: 'fr',
  // },
  // it: {
  //   ngZorro: it_IT,
  //   title: 'IT',
  //   firebase: 'it',
  // },
  // ko: {
  //   ngZorro: ko_KR,
  //   title: 'KO',
  //   firebase: 'ko',
  // },
  // nl: {
  //   ngZorro: nl_NL,
  //   title: 'NL',
  //   firebase: 'nl',
  // },
  // zh_cn: {
  //   ngZorro: zh_CN,
  //   title: '简中',
  //   firebase: 'cn',
  // }
};
