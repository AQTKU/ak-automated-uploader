export default function splitList(value: string) {
    return value.split(',').map(item => item.trim()).filter(item => item !== '');
}
