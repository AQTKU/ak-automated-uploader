//import { QMainWindow, QWidget, QLabel, QPushButton, QIcon, QBoxLayout, Direction, QMessageBox, ButtonRole } from '@nodegui/nodegui';
import * as path from "node:path";
import sourceMapSupport from 'source-map-support';
import MainController from './controllers/main'
import { errorString } from './util';

sourceMapSupport.install();


function main(): void {
  
  try {

    const app = new MainController();

    (global as any).app = app;

  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message);
    } else if (typeof error === 'string') {
      console.log(error);
    } else {
      console.log('Some other type of error');
    }
  }

}
main();

/*process.on('uncaughtException', (error) => {
  if (error.stack) console.error(error.stack);
  const messageBox = new QMessageBox();
  messageBox.setWindowTitle('Unhandled exception');
  messageBox.setText(errorString('Unhandled exception', error));
  const close = new QPushButton();
  close.setText('Close');
  messageBox.addButton(close, ButtonRole.AcceptRole);
  messageBox.exec();
});

process.on('unhandledRejection', (error) => {
  if (error instanceof Error && error.stack) console.error(error.stack);
  const messageBox = new QMessageBox();
  messageBox.setWindowTitle('Unhandled rejection');
  messageBox.setText(errorString('Unhandled rejection', error));
  const close = new QPushButton();
  close.setText('Close');
  messageBox.addButton(close, ButtonRole.AcceptRole);
  messageBox.exec();
});*/