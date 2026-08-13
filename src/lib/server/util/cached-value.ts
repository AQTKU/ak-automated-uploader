import { Temporal } from '@js-temporal/polyfill';

export default class CachedValue<T> {

    private readonly ttl: number;
    private cached: { value: T, expires: number } | undefined;
    private pending: Promise<T> | undefined;

    constructor(ttl: number) {
        this.ttl = ttl;
    }

    async get(compute: () => Promise<T>): Promise<T> {

        if (this.cached && this.cached.expires > Temporal.Now.instant().epochMilliseconds) return this.cached.value;

        if (!this.pending) {
            this.pending = compute()
                .then(value => {
                    this.cached = { value, expires: Temporal.Now.instant().epochMilliseconds + this.ttl };
                    return value;
                })
                .finally(() => {
                    this.pending = undefined;
                });
        }

        return this.pending;

    }

}
