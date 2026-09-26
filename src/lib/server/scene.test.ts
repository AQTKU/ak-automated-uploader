import { describe, expect, test } from 'bun:test';
import { findNfoStreamingService, mightBeScene } from './scene';

describe('scene candidates', () => {

    test('accepts scene names', () => {
        expect(mightBeScene('90.Day.Fiance.S12E01.1080p.WEB.h264-EDITH.mkv')).toBe(true);
        expect(mightBeScene('blood.legacy.s02e19.multi.2160p.web.h265-higgsboson.mkv')).toBe(true);
    });

    test('accepts names that fail to parse', () => {
        expect(mightBeScene('tdf-hpatcos.avi')).toBe(true);
    });

    test('rejects names with an audio codec', () => {
        expect(mightBeScene('Movie.2020.1080p.BluRay.DDP5.1.x264-GRP.mkv')).toBe(false);
    });

    test('rejects names with a streaming service', () => {
        expect(mightBeScene('Show.S01E01.1080p.AMZN.WEB-DL.H.264-GRP.mkv')).toBe(false);
    });

});

describe('NFO streaming services', () => {

    test('matches a service alias on a source line', () => {
        expect(findNfoStreamingService('Size         : 5.7 GiB\r\nSource       : AMAZON\r\nNotes        : none')).toBe('AMZN');
        expect(findNfoStreamingService('Source       : NETFLIX')).toBe('NF');
    });

    test('matches a service code among other words', () => {
        expect(findNfoStreamingService('Source ....: WEB-DL (DSNP)')).toBe('DSNP');
    });

    test('reads through box drawing and dot leaders', () => {
        expect(findNfoStreamingService('³ Source........................:   ATVP        ³')).toBe('ATVP');
    });

    test('ignores a source that only says web', () => {
        expect(findNfoStreamingService('Source: Web\nhttps://www.tvmaze.com/shows/279/real-time-with-bill-maher')).toBeNull();
    });

    test('ignores services mentioned outside a source line', () => {
        expect(findNfoStreamingService('Notes: also on Netflix')).toBeNull();
    });

});
