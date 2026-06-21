import { load } from 'cheerio';

export type XmlRpcParam =
    | { type: 'string'; value: string }
    | { type: 'base64'; value: Uint8Array };

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function buildXmlRpcRequest(method: string, params: XmlRpcParam[]): string {

    const paramsXml = params.map(param => {
        if (param.type === 'base64') {
            return `<param><value><base64>${Buffer.from(param.value).toString('base64')}</base64></value></param>`;
        }
        return `<param><value><string>${escapeXml(param.value)}</string></value></param>`;
    }).join('');

    return `<?xml version="1.0"?><methodCall><methodName>${escapeXml(method)}</methodName><params>${paramsXml}</params></methodCall>`;

}

export function parseXmlRpcResponse(xml: string): string {

    const $ = load(xml, { xmlMode: true });

    const faultString = $('fault member').filter((_, member) => $(member).children('name').text() === 'faultString');
    if (faultString.length > 0) {
        throw Error(faultString.children('value').text());
    }

    return $('params param value').first().text();

}
