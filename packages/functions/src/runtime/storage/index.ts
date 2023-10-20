import { STORAGE_TRIGGER_SCALE } from '../../scale.settings';
import { onStorageObjectFinalized } from '../../triggers/storage/resize.img.trigger';
import { WEN_STORAGE_TRIGGER } from '../common';
import { onObjectFinalized } from './storage';

exports[WEN_STORAGE_TRIGGER.onUploadFinalized] = onObjectFinalized({
  runtimeOptions: STORAGE_TRIGGER_SCALE[WEN_STORAGE_TRIGGER.onUploadFinalized],
  handler: onStorageObjectFinalized,
});
