import type { SettingsField, TrackerField, TrackerSettings } from '$lib/types';
import Aither, { settings as aitherSettings, fields as aitherFields } from './aither';
import type Tracker from '../tracker';
import LST, { settings as lstSettings, fields as lstFields } from './lst';
import MNS, { settings as mnsSettings, fields as mnsFields } from './mns';

export const trackers: Record<string, { class: new (settings: TrackerSettings) => Tracker, settings: SettingsField[], fields: TrackerField[] }> = {
    'Aither': { class: Aither, settings: aitherSettings, fields: aitherFields },
    'LST': { class: LST, settings: lstSettings, fields: lstFields },
    'MNS': { class: MNS, settings: mnsSettings, fields: mnsFields },
};
