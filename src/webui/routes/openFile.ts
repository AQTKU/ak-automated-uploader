import { FastifyInstance, FastifyRequest } from "fastify";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export default async function openFile(fastify: FastifyInstance) {

  fastify.get('/browse-file/*', async (request: FastifyRequest<{ Params: { '*': string }}>, reply) => {

    console.log(request.params['*']);

    try {

      const stats = await stat(request.params['*']);

      if (stats.isDirectory()) {
        const files = await readdir(request.params['*']);
        return files;
      } else {
        return request.params['*'];
      }

    } catch (error) {
      reply.code(404);
      return { error: 'File or directory not found' };
    }

  });

}