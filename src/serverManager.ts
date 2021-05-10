/*
Copyright 2021 TOTVS S.A

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http: //www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import * as fs from 'fs';
import stripJsonComments = require('strip-json-comments');
import { TDSConfiguration } from './configurations';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { IRpoToken } from './rpoToken';
import { CompileKey } from './compileKey/compileKey';
import {
  ServerTypeValues,
  LSServerInformation,
  ILSServer,
  LSOptions,
} from '@totvs/tds-languageclient';
import path = require('path');

const localize = nls.loadMessageBundle();

export interface IServerManager {
  servers: Array<IServerItem>;
  currentServer: IServerItem;

  readonly onDidChange: vscode.Event<EventData>;

  // toggleWorkspaceServerConfig();
  isConnected(server: IServerItem): boolean;
  loadFromFile(file: string): TDSConfiguration.ITDSConfiguration;
  saveToFile(file: string, content: TDSConfiguration.ITDSConfiguration): void;
  getIncludes(absolutePath: boolean, server?: IServerItem): Array<string>;
  isIgnoreResource(file: string): boolean;
  deletePermissionsInfos(): void;
}

export declare type ServerType = ServerTypeValues;
export type EventName = 'load' | 'change' | 'connected' | 'add' | 'remove';
export interface EventData {
  name: EventName;
  data: any;
}

interface _IServerItem {
  includes: string[];
  environments: string[];
  username: string;
  smartclientBin: string;

  isConnected(): boolean;
}

export type IServerItem = ILSServer & _IServerItem;

export class ServerItem extends LSServerInformation implements IServerItem {
  includes: string[];
  environments: string[] = [];
  username: string = '';
  smartclientBin: string = '';

  public constructor(
    id: string,
    serverName: string,
    options?: Partial<LSOptions>
  ) {
    super(id, serverName, options);
  }

  isConnected(): boolean {
    return serverManager.isConnected(this);
  }
}

class ServerManager implements IServerManager {
  private _config: TDSConfiguration.ITDSConfiguration;
  private _currentServer: IServerItem;
  private _onDidChange: vscode.EventEmitter<EventData> = new vscode.EventEmitter<EventData>();

  readonly onDidChange: vscode.Event<EventData> = this._onDidChange.event;

  constructor() {
    this._config = this.loadFromFile(TDSConfiguration.getServerConfigFile());

    vscode.workspace.onDidChangeConfiguration(() => {
      this._config = this.loadFromFile(TDSConfiguration.getServerConfigFile());

      this._onDidChange.fire({ name: 'load', data: this.servers });
    });
  }

  isIgnoreResource(file: string): boolean {
    return processIgnoreList(ignoreListExpressions, path.basename(file));
  }

  isConnected(server: ServerItem) {
    return (
      this.currentServer !== undefined &&
      (this.currentServer as ILSServer).id === (server as ILSServer).id
    );
  }

  get servers(): IServerItem[] {
    return this._config.configurations;
  }

  get currentServer(): IServerItem {
    return this._currentServer;
  }

  set currentServer(value: IServerItem) {
    if (this._currentServer !== value) {
      const oldValue: IServerItem = this._currentServer;

      this._currentServer = value;

      this._onDidChange.fire({
        name: 'connected',
        data: { old: oldValue, new: value },
      });
    }
  }

  private isSafeRPO(server: ILSServer): boolean {
    if (server && server.buildVersion) {
      return server.buildVersion.localeCompare('7.00.191205P') > 0;
    }

    return false;
  }

  private getRpoTokenInfos(): IRpoToken {
    return this._config ? this._config.rpoToken : undefined;
  }

  saveRpoTokenInfos(infos: IRpoToken) {
    this._config.rpoToken = infos;

    this._onDidChange.fire({
      name: 'change',
      data: { name: 'rpoToken', infos },
    });
  }

  getPermissionsInfos(): CompileKey {
    return this._config.permissions.authorizationtoken;
  }

  savePermissionsInfos(infos: CompileKey) {
    this._config.permissions.authorizationtoken = infos;

    this._onDidChange.fire({
      name: 'change',
      data: { name: 'permissions', infos },
    });
  }

  getAuthorizationToken(server: ServerItem): string {
    const isSafeRPOServer: boolean = this.isSafeRPO(server);
    const permissionsInfos: IRpoToken | CompileKey = isSafeRPOServer
      ? this.getRpoTokenInfos()
      : this.getPermissionsInfos();
    let authorizationToken: string = '';

    if (permissionsInfos) {
      if (isSafeRPOServer) {
        authorizationToken = (<IRpoToken>permissionsInfos).token;
      } else {
        authorizationToken = (<CompileKey>permissionsInfos).authorizationToken;
      }
    }

    return authorizationToken;
  }

  deletePermissionsInfos() {
    this.savePermissionsInfos(undefined);
  }

  /**
   * Retorna todo o conteudo do servers.json
   */
  loadFromFile(file: string): any {
    let config: any = {};

    if (!fs.existsSync(file)) {
      this.initializeServerConfigFile(file);
    }
    const content: string = fs.readFileSync(file).toString();
    config = TDSConfiguration.defaultConfiguration;

    if (content) {
      try {
        config = JSON.parse(stripJsonComments(content));
      } catch (e) {
        console.exception(e);
      }
    }

    //garante a existencia da sessão
    if (!config.savedTokens) {
      config.savedTokens = [];
    }

    //compatibilização com arquivos gravados com versão da extensão
    //anterior a 26/06/20
    if (
      config.hasOwnProperty('lastConnectedServer') &&
      typeof config.lastConnectedServer !== 'string'
    ) {
      if (config.lastConnectedServer.hasOwnProperty('id')) {
        config.lastConnectedServer = config.lastConnectedServer.id;
      }
    }

    //compatibilização com arquivos gravados com versão da extensão
    //anterior a 07/05/21
    if (!config.connections) {
      config.connections.forEach((element: any, index: number) => {
        if (typeof element === 'string') {
          console.log(element);
        }
      });
    }

    return config;
  }

  /**
   * Grava no arquivo servers.json uma nova configuracao de servers
   * @param JSONServerInfo
   */
  saveToFile(file: string, content: TDSConfiguration.ITDSConfiguration) {
    fs.writeFileSync(
      TDSConfiguration.getServerConfigFile(),
      JSON.stringify(content, null, '\t')
    );
  }

  /**
   * Cria uma nova configuracao de servidor no servers.json
   */
  createNewServer(
    id: string,
    typeServer: ServerType,
    serverName: string,
    port: number,
    address: string,
    buildVersion: string,
    secure: boolean,
    includes: string[]
  ): IServerItem | undefined {
    const servers = this._config.configurations;

    if (
      servers.find((element: ILSServer) => {
        return element.serverName === serverName;
      })
    ) {
      vscode.window.showErrorMessage(
        localize(
          'tds.webview.serversView.serverNameDuplicated',
          'Server name already exists'
        )
      );
      return undefined;
    }

    let validate_includes: string[] = [];

    includes.forEach((element) => {
      if (element !== undefined && element.length > 0) {
        validate_includes.push(element);
      }
    });

    const newServer: IServerItem = new ServerItem(
      id || this.generateUUID(),
      serverName,
      {
        serverType: typeServer,
        address: address,
        port: port,
        build: buildVersion,
        secure: secure,
      }
    );
    newServer.includes = validate_includes;
    this._onDidChange.fire({ name: 'add', data: this.servers });

    return newServer;
  }

  /**
   * Gera um id de servidor
   */
  private generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      let random = (Math.random() * 16) | 0; // Nachkommastellen abschneiden
      let value = char === 'x' ? random : (random % 4) + 8; // Bei x Random 0-15 (0-F), bei y Random 0-3 + 8 = 8-11 (8-b) gemäss RFC 4122

      return value.toString(16); // Hexadezimales Zeichen zurückgeben
    });
  }

  private initializeServerConfigFile(file: string) {
    try {
      fs.writeFileSync(
        file,
        JSON.stringify(TDSConfiguration.defaultConfiguration, null, '\t')
      );
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Recupera a lista de includes do arquivod servers.json
   */
  getIncludes(
    absolutePath: boolean = false,
    server?: IServerItem
  ): Array<string> {
    let includes: Array<string>;

    if (
      server !== undefined &&
      server.includes !== undefined &&
      server.includes.length > 0
    ) {
      includes = server.includes as Array<string>;
    } else {
      includes = this._config.includes as Array<string>;
    }

    if (includes.toString()) {
      if (absolutePath) {
        const ws: string = vscode.workspace.rootPath || '';
        includes.forEach((value, index, elements) => {
          if (value.startsWith('.')) {
            value = path.resolve(ws, value);
          } else {
            value = path.resolve(value.replace('${workspaceFolder}', ws));
          }

          try {
            const fi: fs.Stats = fs.lstatSync(value);
            if (!fi.isDirectory) {
              const msg: string = localize(
                'tds.webview.utils.reviewList',
                'Review the folder list in order to search for settings (.ch). Not recognized as folder: {0}',
                value
              );
              vscode.window.showWarningMessage(msg);
            } else {
              elements[index] = value;
            }
          } catch (error) {
            const msg: string = localize(
              'tds.webview.utils.reviewList2',
              'Review the folder list in order to search for settings (.ch). Invalid folder: {0}',
              value
            );
            console.log(error);
            vscode.window.showWarningMessage(msg);
            elements[index] = '';
          }
        });
      }
    } else {
      vscode.window.showWarningMessage(
        localize(
          'tds.webview.utils.listFolders',
          'List of folders to search for definitions not configured.'
        )
      );
    }

    return includes;
  }
}

//TODO: pegar a lista de arquivos a ignorar da configuração
const ignoreListExpressions: Array<RegExp> = [];
ignoreListExpressions.push(/(.*)?(\.vscode)$/gi); //.vscode
//ignoreListExpressions.push(/(\.)$/ig); // sem extensão (não é possivel determinar se é fonte ou recurso)
ignoreListExpressions.push(/(.+)(\.erx_)$/gi); // arquivos de definição e trabalho
ignoreListExpressions.push(/(.+)(\.ppx_)$/gi); // arquivos de definição e trabalho
ignoreListExpressions.push(/(.+)(\.err)$/gi); // arquivos de definição e trabalho

//lista de arquivos/pastas normalmente ignorados
ignoreListExpressions.push(/(.*)?(#.*#)$/gi);
ignoreListExpressions.push(/(.*)?(\.#*)$/gi);
ignoreListExpressions.push(/(.*)?(%.*%)$/gi);
ignoreListExpressions.push(/(.*)?(\._.*)$/gi);
ignoreListExpressions.push(/(.*)?(CVS)$/gi);
ignoreListExpressions.push(/(.*)?.*(CVS)$/gi);
ignoreListExpressions.push(/(.*)?(\.cvsignore)$/gi);
ignoreListExpressions.push(/(.*)?(SCCS)$/gi);
ignoreListExpressions.push(/(.*)?.*\/SCCS\/.*$/gi);
ignoreListExpressions.push(/(.*)?(vssver\.scc)$/gi);
ignoreListExpressions.push(/(.*)?(\.svn)$/gi);
ignoreListExpressions.push(/(.*)?(\.DS_Store)$/gi);
ignoreListExpressions.push(/(.*)?(\.git)$/gi);
ignoreListExpressions.push(/(.*)?(\.gitattributes)$/gi);
ignoreListExpressions.push(/(.*)?(\.gitignore)$/gi);
ignoreListExpressions.push(/(.*)?(\.gitmodules)$/gi);
ignoreListExpressions.push(/(.*)?(\.hg)$/gi);
ignoreListExpressions.push(/(.*)?(\.hgignore)$/gi);
ignoreListExpressions.push(/(.*)?(\.hgsub)$/gi);
ignoreListExpressions.push(/(.*)?(\.hgsubstate)$/gi);
ignoreListExpressions.push(/(.*)?(\.hgtags)$/gi);
ignoreListExpressions.push(/(.*)?(\.bzr)$/gi);
ignoreListExpressions.push(/(.*)?(\.bzrignore)$/gi);

function processIgnoreList(
  ignoreList: Array<RegExp>,
  testName: string
): boolean {
  let result: boolean = false;

  for (let index = 0; index < ignoreList.length; index++) {
    const regexp = ignoreList[index];
    if (regexp.test(testName)) {
      result = true;
      break;
    }
  }

  return result;
}

export const serverManager: IServerManager = new ServerManager();
