import '@angular/localize/init';
import 'zone.js';
// js-big-decimal fix
// window.global = window;
(global as any).window = window;
(global as any).document = window.document;
(global as any).Event = window.Event;
(global as any).KeyboardEvent = window.KeyboardEvent;