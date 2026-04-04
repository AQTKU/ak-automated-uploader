import { json, text } from '@sveltejs/kit';
import errorString from './error-string';

/**
 * Creates a JSON response with an HTTP status code and an error message in the
 * variable "why", designed to send human-readable error messages to a frontend
 * or API consumer.
 * @param status HTTP error code  
 * Some common codes:  
 * 400 Bad Request (malformed request syntax)  
 * 401 Unauthorized (lacking correct credentials)  
 * 403 Forbidden (lacking permissions)
 * 410 Gone (removed and not likely to return)  
 * 422 Unprocessable Content (request understood, request content bad)  
 * 500 Internal Server Error  
 * 501 Not Implemented  
 * @param why A description of what went wrong
 * @param caught More error details as caught by a try/catch block
 */

export default function why(status: number, why: string, caught?: any) {
    return json(
        { why: caught ? errorString(why, caught) : why },
        { status }
    );
}

/**
 * Creates a plain text response with an HTTP status code and an error message
 * as they entire body of the response, designed to send human-readable error
 * messages to an API consumer.
 * @param status HTTP error code  
 * Some common codes:  
 * 400 Bad Request (malformed request syntax)  
 * 401 Unauthorized (lacking correct credentials)  
 * 403 Forbidden (lacking permissions)
 * 410 Gone (removed and not likely to return)  
 * 422 Unprocessable Content (request understood, request content bad)  
 * 500 Internal Server Error  
 * 501 Not Implemented  
 * @param why A description of what went wrong
 * @param caught More error details as caught by a try/catch block
 */

export function plainTextWhy(status: number, why: string, caught?: any) {
    return text(
        caught ? errorString(why, caught) : why,
        {
            status,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }
    );
}

export function whyByAcceptHeader(request: Request) {
    const accept = request.headers.get('Accept');
    if (accept && accept.toLowerCase().startsWith('application/json')) return why;
    else return plainTextWhy;
}