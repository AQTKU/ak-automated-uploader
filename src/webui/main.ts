import fastify, { FastifyInstance } from "fastify";
import Server from "./server";
import openFile from "./routes/openFile";

export default class WebUI {

  openFileCallbacks: Array<(selectedFile: string) => void>;

  constructor() {

    this.openFileCallbacks = [];

    const server = fastify({ logger: true, });

    server.register(openFile);

    server.listen({ port: 3000 }, (error) => {
      console.log(error);
    });

  }

  onOpenFile(callback: (selectedFile: string) => void): void {
    this.openFileCallbacks.push(callback);
  }

}