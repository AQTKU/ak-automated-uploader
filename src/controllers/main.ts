import WebUI from 'src/webui/main';
import MainWindow from '../gui/main-window'
import TmdbConfig from '../tmdb-config';
import SettingsController from './settings';
import TorrentClients from './torrent-clients';
import UploadController from './upload';

export default class MainController {
  
  //ui: MainWindow;
  ui: WebUI;
  uploads: UploadController[];
  //settings: SettingsController;
  //tmdbConfig: TmdbConfig;
  //torrentClients: TorrentClients;

  constructor() {
    
      this.uploads = [];

      this.ui = new WebUI();

      this.ui.onOpenFile(path => this.addUpload(path));
      /*this.ui = new MainWindow();

      this.ui.onOpenFile(path => this.addUpload(path));
      this.ui.onOpenFolder(path => this.addUpload(path));

      this.tmdbConfig = new TmdbConfig();
      this.torrentClients = new TorrentClients();

      this.settings = new SettingsController(this.ui);
      this.ui.onShowSettings(() => this.settings.show());

      this.settings.onChanged(settings => {

        this.tmdbConfig.setApiKey(settings.tmdbApiKey).catch(error => {
          if (error instanceof Error) {
            console.error('Error with TMDB API key: ' + error.message);
          }
        });

        this.torrentClients.clear();
        this.torrentClients.addAll(settings.torrentClients);

      });

      this.settings.load().then(() => {
        this.ui.window.show();
      });*/

  }

  async addUpload(path: string): Promise<void> {

    //const upload = new UploadController(this.ui, this.tmdbConfig, this.settings.settings.all(), this.torrentClients);
    //await upload.setPath(path);
    //this.uploads.push(upload);

  }

}