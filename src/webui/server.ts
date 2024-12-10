import fastify from "fastify";
import routes from "./routes";

export default class Server {

  constructor() {



    const server = fastify({
      logger: true,
    });
    server.register(routes);

  }

  header() {

    return 

  }

}