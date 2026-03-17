export default function getCookies(response: Response): string {

    const cookies: string[] = [];

    response.headers.forEach((value, key) => {

        if (key.toLowerCase() === 'set-cookie') {
            const cookiePair = value.split(';')[0]!.trim();
            cookies.push(cookiePair);
        }

    });

    return cookies.join('; ');

}