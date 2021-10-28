import '@angular/localize/init';
/* eslint-disable */
import { Buffer } from 'buffer';
import 'zone.js';

(window as any).global = window;
global.Buffer = Buffer;
global.process = {
    env: { DEBUG: undefined },
    version: '',
    nextTick: require('next-tick')
} as any;
