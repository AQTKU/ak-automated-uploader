import fastify, { FastifyInstance } from "fastify";
import { readFile } from "fs/promises";

async function routes(fastify: FastifyInstance) {

  fastify.get('/', async (request, reply) => {

    reply.header('content-type', 'text/html;charset=utf-8');

    const buffer = await readFile('src/webui/static/template.html');
    let template = buffer.toString();

    template = template.replace('%content%', 'potato');

    return template;

  });

  fastify.get('/styles.css', async (request, reply) => {

    reply.header('content-type', 'text/css;charset=utf-8');
    
    const buffer = await readFile('src/webui/static/styles.css');
    let payload = buffer.toString();

    return payload;

  });

}

export default routes;