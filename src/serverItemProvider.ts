import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EventData, serverManager, IServerDebugger } from './serverManager';

const HOME_DIR: string = require('os').homedir();

const FOLDER_CONTEXT = 'FolderTreeItem';
const SERVER_CONTEXT = 'ServerTreeItem';
const SERVER_CONTEXT_NOT_CONNECTED = 'ServerTreeItemNotConnected';
const ENVIRONMENT_CONTEXT = 'EnvironmentTreeItem';
const ENVIRONMENT_CONTEXT_NOT_CONNECT = 'ServerTreeItemNotConnected';
const INCLUDE_CONTEXT = 'IncludeItemServer';

export declare type ServerTreeItens =
  | FolderTreeItem
  | ServerTreeItem
  | EnvironmentTreeItem
  | IncludesTreeItem;

class ServerTreeItemProvider
  implements vscode.TreeDataProvider<ServerTreeItens> {
  private _serverTreeItems: FolderTreeItem[];

  isCurrentEnvironment(environment: EnvironmentTreeItem) {
    return (
      environment.parent.server.isConnected() &&
      environment.parent.server.environment === environment.label
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
      if (event.name === 'load') {
        this.refresh();
      } else if (event.name === 'add') {
        this.refresh();
      } else if (event.name === 'change') {
        this.refresh();
      } else if (event.name === 'remove') {
        this.refresh();
      }
    });
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    ServerTreeItens | undefined
  > = new vscode.EventEmitter<ServerTreeItens | undefined>();

  readonly onDidChangeTreeData: vscode.Event<ServerTreeItens | undefined> = this
    ._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  get serverTreeItems(): Array<FolderTreeItem> {
    return this._serverTreeItems;
  }

  getTreeItem(element: ServerTreeItens): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FolderTreeItem | ServerTreeItem): Thenable<any[]> {
    let result: any[] = [];
    let sort: boolean = true;

    if (!element) {
      this._serverTreeItems = this.populateFolderTree();
      result = this._serverTreeItems;
      sort = false;
    } else if (element.contextValue === FOLDER_CONTEXT) {
      const sti: FolderTreeItem = element as FolderTreeItem;
      sti.servers = this.populateServerTree(sti);
      result = sti.servers;
      sti.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else if (element.contextValue.startsWith(SERVER_CONTEXT)) {
      const sti: ServerTreeItem = element as ServerTreeItem;
      result = [sti.environments, sti.includes];
    }

    return !sort
      ? Promise.resolve(result)
      : Promise.resolve(
          result.sort((srv1, srv2) => {
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

  /**
   * Cria itens da arvore associados aos arquivos servers.json
   */
  private populateFolderTree(): Array<FolderTreeItem> {
    const folders: string[] = serverManager.folders;

    const listFolder = new Array<FolderTreeItem>();

    folders.forEach((folder: string) => {
      const stiFolder: FolderTreeItem = new FolderTreeItem(folder);

      stiFolder.servers = [];
      stiFolder.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

      listFolder.push(stiFolder);
    });

    return listFolder;
  }

  /**
   * Cria itens da arvore associados a servidores de um server.json
   */
  private populateServerTree(parent: FolderTreeItem): Array<ServerTreeItem> {
    const listServer: ServerTreeItem[] = [];

    serverManager
      .getConfigurations(parent.folder)
      .servers.forEach((element: IServerDebugger) => {
        const sti: ServerTreeItem = new ServerTreeItem(parent, element, {
          command: '',
          title: '',
          arguments: [element],
        });
        sti.environments = this.populateEnvironmentTree(sti);
        sti.includes = this.populateIncudeTree(sti);

        sti.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        listServer.push(sti);
      });

    return listServer;
  }

  /**
   * Cria itens da arvore associados a ambientes de um servidor
   */
  private populateEnvironmentTree(
    parent: ServerTreeItem
  ): Array<EnvironmentTreeItem> {
    const environmentsServer = new Array<EnvironmentTreeItem>();

    parent.server.environments.forEach((environment) => {
      const env = new EnvironmentTreeItem(
        parent,
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

    return environmentsServer;
  }

  /**
   * Cria itens da arvore associados aos includes de um server
   */
  private populateIncudeTree(parent: ServerTreeItem): Array<IncludesTreeItem> {
    const stiInclude = new IncludesTreeItem(
      parent,
      'Includes',
      vscode.TreeItemCollapsibleState.None,
      {
        command: '',
        title: '',
        arguments: [],
      }
    );
    stiInclude.includes = parent.server.includes;

    return [stiInclude];
  }
}

export type ServerType = 'totvs_server_protheus' | 'totvs_server_logix';

export class FolderTreeItem extends vscode.TreeItem {
  servers: ServerTreeItem[] = [];

  constructor(public readonly folder: string) {
    super(folder);
  }

  public getTooltip(): string {
    return this.folder;
  }

  label = getFolderLabel(this.folder);

  description = this.folder;

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      'folder_server.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      'folder_server.svg'
    ),
  };

  contextValue = FOLDER_CONTEXT;
}

function getFolderLabel(folder: string): string {
  return folder.toLowerCase().startsWith(HOME_DIR.toLowerCase())
    ? 'User'
    : getProjectRoot(vscode.Uri.parse('file:///' + folder));
}

function getProjectRoot(target: vscode.Uri) {
  const ws: vscode.WorkspaceFolder = vscode.workspace.getWorkspaceFolder(
    target
  );
  const fsUri: vscode.Uri = ws ? ws.uri : target;
  let segments: string[] = fsUri.fsPath.split(path.sep);

  return segments.length > 1
    ? segments[segments.length - 2]
    : segments.join(path.sep);
}

export class ServerTreeItem extends vscode.TreeItem {
  environments: EnvironmentTreeItem[] = [];
  includes: IncludesTreeItem[] = [];

  public get isConnected(): boolean {
    return this.server.isConnected();
  }

  constructor(
    public readonly parent: FolderTreeItem,
    public readonly server: IServerDebugger,
    public readonly command?: vscode.Command
  ) {
    super(server.name);
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
        : this.server.type == 'totvs_server_protheus'
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
        : this.server.type == 'totvs_server_protheus'
        ? 'protheus_server.svg'
        : 'logix_server.svg'
    ),
  };

  contextValue = this.isConnected
    ? SERVER_CONTEXT
    : SERVER_CONTEXT_NOT_CONNECTED;
}

export class EnvironmentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly parent: ServerTreeItem,
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
    return `${this.label} @ ${this.parent.label}`;
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

  contextValue = this.isCurrent
    ? ENVIRONMENT_CONTEXT
    : ENVIRONMENT_CONTEXT_NOT_CONNECT;
}

export class IncludesTreeItem extends vscode.TreeItem {
  includes: string[];

  constructor(
    public readonly parent: ServerTreeItem,
    public label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }

  public getTooltip(): string {
    return `${this.label} @ ${this.parent.label}`;
  }

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      'includes.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      'includes.svg'
    ),
  };

  contextValue = INCLUDE_CONTEXT;
}

const serverProvider = new ServerTreeItemProvider();
export default serverProvider;
