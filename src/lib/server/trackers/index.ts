import type { SettingsField, TrackerSettings } from '$lib/types';
import Aither, { aitherSettings } from './aither';
import type Tracker from '../tracker';
import LST, { lstSettings } from './lst';

export const trackers: Record<string, { class: new (settings: TrackerSettings) => Tracker, fields: SettingsField[] }> = {
    'Aither': { class: Aither, fields: aitherSettings },
    'LST': { class: LST, fields: lstSettings },
};