import { json } from '@sveltejs/kit';
import errorString from './error-string';

export default function why(status: number, why: string, caught?: any) {
    return json(
        { why: caught ? errorString(why, caught) : why },
        { status }
    );
}