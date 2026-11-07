const input = await Bun.stdin.text();

const bannedTrackers = [{
    name: 'Aither',
    filename: 'aither.ts',
}];

for (const bannedTracker of bannedTrackers) {
    const base = bannedTracker.filename.replace(/\.ts$/, '');
    const pattern = new RegExp(`${bannedTracker.filename}|trackers[\\\\/]+${base}`, 'i');
    if (pattern.test(input)) {
        console.error(`${bannedTracker.name}'s rules don't allow AI to learn its API. AI agents must not attempt to read src/lib/server/trackers/${bannedTracker.filename}. AI agents must not look for another way to read this file or learn the API surface. Other work can continue, and if the user requires help editing this file, AI can assist as long as the API surface or any other tracker details are never revealed to it.`);
        process.exit(2);
    }
}
