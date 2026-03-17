export function normalize(string: string) {
    return string.toLowerCase()
                 .normalize('NFD')
                 .replace(/\$/g, 's')
                 .replace(/&/g, ' and ')
                 .replace(/[.!?:_-]/g, ' ')
                 .replace(/[\/]/g, '-')
                 .replace(/[^a-zA-Z0-9 ]/g, '')
                 .replace(/ {2,}/g, ' ')
                 .trim();
}