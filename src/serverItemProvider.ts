import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as nls from 'vscode-nls';
import Utils from './utils';
import {
  EventData,
  IServerItem,
  ServerItem,
  serverManager,
} from './serverManager';
import { ILSServer } from '../../tds-languageclient/typings/src';

declare type ServerTreeItens = ServerTreeItem | EnvironmentTreeItem;

class ServerTreeItemProvider
  implements vscode.TreeDataProvider<ServerTreeItens> {
  private _serverTreeItems: ServerTreeItem[];
  private _connectedServer: ServerTreeItem;

  isCurrentEnvironment(environment: EnvironmentTreeItem) {
    return (
      serverManager.isConnected(environment.ServerTreeItemParent._server) &&
      environment.ServerTreeItemParent.environment === environment.label
    );
  }

  constructor() {
    // check if there is an open folder
    if (vscode.workspace.workspaceFolders === undefined) {
      vscode.window.showErrorMessage('No folder opened.');
      return;
    }

    vscode.workspace.workspaceFolders.forEach((folder) => {
      if (!fs.existsSync(folder.uri.fsPath)) {
        vscode.window.showWarningMessage(
          `Folder not exist or access unavailable. Check it to avoid unwanted behavior. Path: ${folder.uri.fsPath}`
        );
      }
    });

    serverManager.onDidChange((event: EventData) => {
      console.log(this);

      if (event.name == 'load') {
        console.log(event.name);
      } else if (event.name == 'connected') {
        console.log(event.name);
      } else if (event.name == 'add') {
        console.log(event.name);
      } else if (event.name == 'change') {
        console.log(event.name);
      } else if (event.name == 'remove') {
        console.log(event.name);
      }
    }, this);
  }

  get serverTreeItems(): Array<ServerTreeItem> {
    return this._serverTreeItems;
  }

  getTreeItem(element: ServerTreeItens): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: ServerTreeItem
  ): Thenable<ServerTreeItem[] | EnvironmentTreeItem[]> {
    if (element) {
      if (element.server.environments) {
        return Promise.resolve([] /*element.server.environments*/);
      } else {
        const servers: IServerItem[] = serverManager.servers;
        const listOfEnvironments = servers[element.id].environments;

        if (listOfEnvironments.size > 0) {
          this.serverTreeItems[
            element.id
          ].environments = listOfEnvironments.map(
            (env: string) =>
              new EnvironmentTreeItem(
                element,
                env,
                vscode.TreeItemCollapsibleState.None,
                {
                  command: 'totvs-developer-studio.environmentSelection',
                  title: '',
                  arguments: [env],
                }
              )
          );
          this.serverTreeItems[element.id].collapsibleState =
            vscode.TreeItemCollapsibleState.Expanded;
          //Workaround: Bug que nao muda visualmente o collapsibleState se o label permanecer intalterado
          this.serverTreeItems[element.id].label = this.serverTreeItems[
            element.id
          ].label.endsWith(' ')
            ? this.serverTreeItems[element.id].label.trim()
            : this.serverTreeItems[element.id].label + ' ';
          //element.environments = listOfEnvironments;

          //					this.refresh();

          // Promise.resolve(
          //   new EnvironmentTreeItem(
          //     element.name,
          //     element,
          //     element.collapsibleState,
          //     undefined,
          //     listOfEnvironments
          //   )
          //);
        } else {
          return Promise.resolve([]);
        }
      }
    } else {
      if (!this.serverTreeItems) {
        this.populateServerTree();
      }
    }

    return Promise.resolve(
      this.serverTreeItems.sort((srv1, srv2) => {
        const label1 = srv1.label;
        const label2 = srv2.label;
        if (label1 > label2) {
          return 1;
        }
        if (label1 < label2) {
          return -1;
        }
        return 0;
      })
    );
  }

  // private checkServersConfigListener(refresh: boolean): void {
  //   let serversJson: string = Utils.getServerConfigFile();

  //   if (this.configFilePath !== serversJson) {
  //     if (this.configFilePath) {
  //       fs.unwatchFile(this.configFilePath);
  //     }

  //     if (!fs.existsSync(serversJson)) {
  //       Utils.createServerConfig();
  //     }

  //     fs.watch(serversJson, { encoding: 'buffer' }, (eventType, filename) => {
  //       if (filename && eventType === 'change') {
  //         this.serverTreeItems = this.populateServerTree();
  //         this.refresh();
  //       }
  //     });

  //     this.configFilePath = serversJson;

  //     if (refresh) {
  //       this.serverTreeItems = this.populateServerTree();
  //       this.refresh();
  //     }
  //   }
  // }

  /**
   * Cria os itens da arvore de servidores
   */
  private populateServerTree(): Array<ServerTreeItem> {
    const servers: IServerItem[] = serverManager.servers;
    const listServer = new Array<ServerTreeItem>();

    servers.forEach((element: IServerItem) => {
      const sti: ServerTreeItem = new ServerTreeItem(element, {
        command: '',
        title: '',
        arguments: [element],
      });
      let environmentsServer = new Array<EnvironmentTreeItem>();

      if (element.environments) {
        element.environments.forEach((environment) => {
          const env = new EnvironmentTreeItem(
            sti,
            environment,
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'totvs-developer-studio.environmentSelection',
              title: '',
              arguments: [environment],
            }
          );

          environmentsServer.push(env);
        });
      }

      sti.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      listServer.push(sti);
    });

    return listServer;
  }
}

export type ServerType = 'totvs_server_protheus' | 'totvs_server_logix';

export class ServerTreeItem extends vscode.TreeItem {
  public _server: IServerItem;
  environment: string;

  public get isConnected(): boolean {
    return this.server.isConnected();
  }

  constructor(
    public readonly server: IServerItem,
    public readonly command?: vscode.Command
  ) {
    super(server.serverName);
  }

  public getTooltip(): string {
    return `Server=${this.server.address} | Port=${this.server.port}`;
  }

  description = `${this.server.address}:${this.server.port}`;

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      this.isConnected
        ? 'server.connected.svg'
        : this.server.serverType == 'totvs_server_protheus'
        ? 'protheus_server.svg'
        : 'logix_server.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      this.isConnected
        ? 'server.connected.svg'
        : this.server.typeServer == 'totvs_server_protheus'
        ? 'protheus_server.svg'
        : 'logix_server.svg'
    ),
  };

  contextValue = this.isConnected
    ? 'ServerTreeItem'
    : 'ServerTreeItemNotConnected';
}

export class EnvironmentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly ServerTreeItemParent: ServerTreeItem,
    public label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }

  public get isCurrent(): boolean {
    return serverProvider.isCurrentEnvironment(this);
  }

  public getTooltip(): string {
    return `${this.label} @ ${this.ServerTreeItemParent.label}`;
  }

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      this.isCurrent ? 'environment.connected.svg' : 'environment.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      this.isCurrent ? 'environment.connected.svg' : 'environment.svg'
    ),
  };

  contextValue = this.isCurrent ? 'envSection' : 'envSectionNotCurrent';
}

const serverProvider = new ServerTreeItemProvider();
export default serverProvider;
