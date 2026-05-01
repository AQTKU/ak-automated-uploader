import type { SettingsField, TrackerField, TrackerSettings } from '$lib/types';
import Aither, { settings as aitherSettings, fields as aitherFields } from './aither';
import type Tracker from '../tracker';
import LST, { settings as lstSettings, fields as lstFields } from './lst';
import MidnightScene, { settings as midnightsceneSettings, fields as midnightsceneFields } from './midnightscene';
import Seedpool, { settings as seedpoolSettings, fields as seedpoolFields } from './seedpool';
import BeyondHD, { fields as beyondHdFields, settings as beyondHdSettings } from './beyondhd';

export const trackers: Record<string, { class: new (settings: TrackerSettings) => Tracker, settings: SettingsField[], fields: TrackerField[] }> = {
    'Aither': { class: Aither, settings: aitherSettings, fields: aitherFields },
    'BeyondHD': { class: BeyondHD, settings: beyondHdSettings, fields: beyondHdFields },
    'LST': { class: LST, settings: lstSettings, fields: lstFields },
    'MidnightScene': { class: MidnightScene, settings: midnightsceneSettings, fields: midnightsceneFields },
    'Seedpool': { class: Seedpool, settings: seedpoolSettings, fields: seedpoolFields },
};
