import type { SettingsField } from '$lib/types';
import type ImageHost from '../image-host';
import { catbox } from './catbox';
import { freeimageHost, freeimageHostFields } from './freeimage-host';
import { imgBB, imgBBSettings as imgBBFields } from './imgbb';
import { imgbox } from './imgbox';
import { pixhost } from './pixhost';

export const imageHosts: Record<string, { object: ImageHost, fields: SettingsField[] }> = {
    'Catbox': { object: catbox, fields: [] },
    'Freeimage.host': { object: freeimageHost, fields: freeimageHostFields },
    'ImgBB': { object: imgBB, fields: imgBBFields },
    'imgbox': { object: imgbox, fields: [] },
    'PiXhost': { object: pixhost, fields: [] },
};