import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { serverManager, IServerDebugger } from './serverManager';
import { EventData, eventManager, EventName } from './event';

const HOME_DIR: string = require('os').homedir();
const FOLDER_CONTEXT = 'folderTreeItem';
const SERVER_CONTEXT = 'serverTreeItem';
const SERVER_CONTEXT_NOT_CONNECTED = 'serverTreeItemNotConnected';
const ENVIRONMENT_CONTEXT = 'environmentTreeItem';
const ENVIRONMENT_CONTEXT_NOT_CONNECT = 'serverTreeItemNotConnected';
const INCLUDE_CONTEXT = 'includeItemServer';

export declare type ServerTreeItens =
  | FolderTreeItem
  | ServerTreeItem
  | EnvironmentTreeItem
  | IncludesTreeItem;

class ServerTreeItemProvider
  implements vscode.TreeDataProvider<ServerTreeItens>
{
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

    eventManager.onDidChange((event: EventData) => {
      if (event.name === EventName.load) {
         this.clear();
      }
      // } else if (event.name === 'add') {
      //   this.refresh();
      // } else if (event.name === 'change') {
      //   this.refresh();
      // } else if (event.name === 'remove') {
      // }
      this.refresh();
    });
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    ServerTreeItens | undefined
  > = new vscode.EventEmitter<ServerTreeItens | undefined>();

  readonly onDidChangeTreeData: vscode.Event<ServerTreeItens | undefined> =
    this._onDidChangeTreeData.event;

  clear(): void {
      this._serverTreeItems = undefined;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ServerTreeItens): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ServerTreeItens): Thenable<any[]> {
    let result: any[] = [];

    const sortElement = (elements: any[]): any[] => {
      return elements.sort((e1, e2) => {
        const label1: string = e1.label;
        const label2: string = e2.label;

        if (label1 > label2) {
          return 1;
        }
        if (label1 < label2) {
          return -1;
        }
        return 0;
      });
    };

    if (!element) {
      this._serverTreeItems = this.populateFolderTree();
      this._serverTreeItems.forEach((sti: FolderTreeItem) => {
        sti.servers = this.populateServerTree(sti);
        result = [sti.includes, ...sortElement(sti.servers)];
        sti.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      });
    } else if (element.contextValue.startsWith(SERVER_CONTEXT)) {
      const sti: ServerTreeItem = element as ServerTreeItem;
      result = [sti.includeList, ...sortElement(sti.environments)];
    } else if (element.contextValue.startsWith(INCLUDE_CONTEXT)) {
      const sti: IncludesTreeItem = element as IncludesTreeItem;
      result = sti.includes;
    }

    return Promise.resolve(result);
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

      stiFolder.includes = this.populateIncudeTree(stiFolder);
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
      .getConfigurations()
      .getServers()
      .forEach((element: IServerDebugger) => {
        const sti: ServerTreeItem = new ServerTreeItem(parent, element, {
          command: '',
          title: '',
          arguments: [element],
        });
        sti.environments = this.populateEnvironmentTree(sti);
        sti.includeList = this.populateIncudeTree(sti);

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
  private populateIncudeTree(
    parent: ServerTreeItem | FolderTreeItem
  ): IncludesTreeItem {
    const includeList: string[] = [];
    let isGlobal: boolean;

    if (parent.contextValue.startsWith(FOLDER_CONTEXT)) {
      const folder: FolderTreeItem = parent as FolderTreeItem;
      serverManager.getIncludes(false).forEach((value: string) => {
        includeList.push(value);
      });
    } else {
      const server: ServerTreeItem = parent as ServerTreeItem;
      server.server.includes.forEach((value: string) => {
        includeList.push(value);
      });
      if (includeList.length == 0) {
        isGlobal = true;
        serverManager.getIncludes(false).forEach((value: string) => {
          includeList.push(value);
        });
      }
    }

    const stiIncludes = new IncludesTreeItem(
      parent,
      'Includes',
      isGlobal,
      vscode.TreeItemCollapsibleState.Collapsed,
      {
        command: '',
        title: '',
        arguments: [],
      }
    );
    stiIncludes.includes = [];

    includeList.forEach((value: string) => {
      const stiInclude = new IncludeTreeItem(stiIncludes, value, {
        command: '',
        title: '',
        arguments: [],
      });
      stiIncludes.includes.push(stiInclude);
    });

    return stiIncludes;
  }
}

export type ServerType = 'totvs_server_protheus' | 'totvs_server_logix';

export class FolderTreeItem extends vscode.TreeItem {
  servers: ServerTreeItem[] = [];
  includes: IncludesTreeItem;

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
  const ws: vscode.WorkspaceFolder =
    vscode.workspace.getWorkspaceFolder(target);
  const fsUri: vscode.Uri = ws ? ws.uri : target;
  let segments: string[] = fsUri.fsPath.split(path.sep);

  return segments.length > 1
    ? segments[segments.length - 2]
    : segments.join(path.sep);
}

export class ServerTreeItem extends vscode.TreeItem {
  environments: EnvironmentTreeItem[] = [];
  includeList: IncludesTreeItem = undefined;

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

export class IncludeTreeItem extends vscode.TreeItem {
  constructor(
    public readonly parent: IncludesTreeItem,
    public label: string,
    public readonly command?: vscode.Command
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }

  public getTooltip(): string {
    // return this.global
    //   ? `${this.label} @ ${this.parent.parent.label}`
    return `${this.label} @ ${this.parent.label}`;
  }

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      'include.png'
    ),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'include.png'),
  };
  contextValue = INCLUDE_CONTEXT;
}

export class IncludesTreeItem extends vscode.TreeItem {
  includes: IncludeTreeItem[];

  constructor(
    public readonly parent: ServerTreeItem | FolderTreeItem,
    public label: string,
    public readonly global: boolean,
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
      this.global ? 'includes_global' : 'includes.png'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      this.global ? 'includes_global.png' : 'includes.png'
    ),
  };

  contextValue = INCLUDE_CONTEXT;
}

const serverProvider = new ServerTreeItemProvider();
export default serverProvider;
