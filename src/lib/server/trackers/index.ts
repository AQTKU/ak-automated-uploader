import type { SettingsField, TrackerField, TrackerSettings } from '$lib/types';
import Aither, { settings as aitherSettings, fields as aitherFields } from './aither';
import type Tracker from '../tracker';
import LST, { settings as lstSettings, fields as lstFields } from './lst';
import Seedpool, { settings as seedpoolSettings, fields as seedpoolFields } from './seedpool';

export const trackers: Record<string, { class: new (settings: TrackerSettings) => Tracker, settings: SettingsField[], fields: TrackerField[] }> = {
    'Aither': { class: Aither, settings: aitherSettings, fields: aitherFields },
    'LST': { class: LST, settings: lstSettings, fields: lstFields },
    'Seedpool': { class: Seedpool, settings: seedpoolSettings, fields: seedpoolFields },
};
