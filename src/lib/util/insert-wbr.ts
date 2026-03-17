export default function insertWbr(name: string) {
    if (!name) return '';

    const escaped = name
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    return escaped.replace(/\./g, '.<wbr>');
}