export default function trackerNameToId(name: string) {
    return name
        .replace(/[^a-zA-Z0-9]/, '_')
        .replace(/_{2,}/, '_')
        .toLowerCase();
}