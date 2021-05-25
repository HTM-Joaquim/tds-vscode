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
import {
  BuildVersion,
  TLSServerDebugger,
  TLSServerMonitor,
  LSServerType,
  ILSServerAttributes,
  IUserData,
} from '@totvs/tds-languageclient';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { TDSConfiguration } from './configurations';
import { IRpoToken } from './rpoToken';
import stripJsonComments = require('strip-json-comments');
import path = require('path');
import ini = require('ini');
import { ServerDebugger } from './serverDebugger';
import { ServerMonitor } from './serverMonitor';
import { serverJsonFileWatcher } from './serverJsonWatcher';
import {
  defaultServerConfiguration,
  IServerConfiguration,
  ServerConfiguration,
} from './serverConfiguration';
import Utils from './utils';
import { FolderTreeItem } from './serverItemProvider';

const localize = nls.loadMessageBundle();
const _homedir: string = require('os').homedir();
const globalFolder: string = path.join(_homedir, '.totvsls');

export interface ICompileKey {
  path: string;
  machineId: string;
  issued: string;
  expire: string;
  buildType: string;
  tokenKey: string;
  authorizationToken: string;
  userId: string;
}

export interface IAuthorization {
  id: string;
  generation: string;
  validation: string;
  permission: string;
  key: string;
}

export interface IServerManager {
  userFile: string;
  enableEvents: boolean;
  folders: string[];
  //servers: Array<IServerDebugger>;
  currentServer: IServerDebugger;
  //smartClientBin: string;

  readonly onDidChange: vscode.Event<EventData>;

  deletePermissionsInfos(): void;
  savePermissionsInfos(infos: ICompileKey): void;
  getPermissionsInfos(): ICompileKey;
  saveRpoTokenInfos(rpoToken: IRpoToken): void;
  getRpoTokenInfos(): IRpoToken;
  deleteRpoTokenInfos(): void;
  isSafeRPO(server: IServerDebugger): boolean;
  fireEvent(name: EventName, property: EventProperty, value: any): void;
  addServersDefinitionFile(file: vscode.Uri): void;
  getConfigurations(folder: string): IServerConfiguration;
  isConnected(server: IServerDebugger): boolean;
  saveToFile(file: string, content: IServerConfiguration): void;
  isIgnoreResource(file: string): boolean;
  getServerDebugger(
    folder: string,
    debuggerServer: Partial<IServerDebugger>
  ): IServerDebugger;
  getServerMonitor(debuggerServer: Partial<IServerDebugger>): IServerMonitor;
  readCompileKeyFile(path: string): IAuthorization;
  getIncludes(folder: string, absolute: boolean): string[];
  setIncludes(folder: string, includePath: string[]): void;
}

export declare type EventName = 'load' | 'change' | 'add' | 'remove';
export declare type EventProperty =
  | 'servers'
  | 'currentServer'
  | 'rpoToken'
  | 'compileKey'
  | 'includePath'
  | 'smartClientBin';

export interface EventData {
  name: EventName;
  property: EventProperty;
  value: any;
}

interface _IServerDebugger {
  isConnected(): boolean;
  removeEnvironment(name: string): boolean;
  addEnvironment(name: string): boolean;
  generateWsl(url: string);
  getAuthorizationToken(): string;
}

export interface IServerDebuggerAttributes {
  parent: IServerConfiguration;
  includes: string[];
  environments: string[];
  username: string;
  smartclientBin: string;
  patchGenerateDir: string;
}

export interface IServerMonitorAttributes {}

export interface IGetUsersData {
  servers: any[];
  users: IUserData[];
}

interface _IServerMonitor {
  getUsersData(): Promise<IGetUsersData>;
}

export declare type IServerDebugger = TLSServerDebugger &
  IServerDebuggerAttributes &
  _IServerDebugger;

export declare type IServerMonitor = TLSServerMonitor &
  IServerMonitorAttributes &
  _IServerMonitor;

class ServerManager implements IServerManager {
  private _configMap: Map<string, IServerConfiguration> = new Map<
    string,
    IServerConfiguration
  >();
  private _currentServer: IServerDebugger;
  private _onDidChange: vscode.EventEmitter<EventData> = new vscode.EventEmitter<EventData>();
  private _enableEvents: boolean = true;
  private _loadInProgress: boolean;

  public get enableEvents(): boolean {
    return this._enableEvents;
  }

  public set enableEvents(value: boolean) {
    this._enableEvents = value;

    if (value) {
      this.fireEvent('load', 'servers', undefined);
    }
  }

  readonly onDidChange: vscode.Event<EventData> = this._onDidChange.event;
  readonly userFile: string;

  constructor() {
    this.userFile = path.join(globalFolder, Utils.SERVER_DEFINITION_FILE);
    this.addServersDefinitionFile(
      vscode.Uri.joinPath(
        vscode.Uri.parse('file:///' + globalFolder),
        Utils.SERVER_DEFINITION_FILE
      )
    );
  }
  getRpoTokenInfos(): IRpoToken {
    throw new Error('Method not implemented.');
  }
  deleteRpoTokenInfos(): void {
    throw new Error('Method not implemented.');
  }

  getIncludes(folder: string, absolute: boolean): string[] {
    return this.getConfigurations(folder).includes;
  }

  setIncludes(folder: string, includePath: string[]): void {
    this.getConfigurations(folder).includes = includePath;
  }

  fireEvent(name: EventName, property: EventProperty, value: any) {
    if (this._enableEvents) {
      this._onDidChange.fire({
        name: name,
        property: property,
        value: value,
      });
    }
  }

  deletePermissionsInfos() {
    this.savePermissionsInfos(undefined);
  }

  getPermissionsInfos(): ICompileKey {
    const config: IServerConfiguration = this.getConfigurations(this.userFile);
    return config.getPermissions();
  }

  savePermissionsInfos(infos: ICompileKey) {
    const config: IServerConfiguration = this.getConfigurations(this.userFile);
    config.savePermissions(infos);
  }

  saveRpoTokenInfos(infos: IRpoToken) {
    const config: IServerConfiguration = this.getConfigurations(this.userFile);
    config.saveRpoToken(infos);
  }

  isIgnoreResource(file: string): boolean {
    return processIgnoreList(ignoreListExpressions, path.basename(file));
  }

  isConnected(server: IServerDebugger) {
    return (
      this.currentServer !== undefined && this.currentServer.id === server.id
    );
  }

  get folders(): string[] {
    const result: string[] = [];

    for (let key of this._configMap.keys()) {
      result.push(key);
    }

    return result;
  }

  getConfigurations(folder: string): IServerConfiguration {
    return this._configMap.get(folder);
  }

  get currentServer(): IServerDebugger {
    return this._currentServer;
  }

  set currentServer(value: IServerDebugger) {
    if (this._currentServer !== value) {
      const oldValue: IServerDebugger = this._currentServer;

      this._currentServer = value;

      //this.doSave();
      this.fireEvent('change', 'currentServer', { old: oldValue, new: value });
    }
  }

  isSafeRPO(server: IServerDebugger): boolean {
    if (server && server.build) {
      return server.build.localeCompare('7.00.191205P') > 0;
    }

    return false;
  }

  readCompileKeyFile(path: string): IAuthorization {
    if (fs.existsSync(path)) {
      const parseIni = ini.parse(fs.readFileSync(path, 'utf-8').toLowerCase()); // XXX toLowerCase??
      return parseIni.authorization;
    }

    return undefined;
  }

  addServersDefinitionFile(file: vscode.Uri): void {
    this.doLoad(file);
    serverJsonFileWatcher.addFile(file.fsPath, (fileUri: vscode.Uri) => {
      this.doLoad(fileUri);
    });
  }

  /**
   * Retorna todo o conteudo do servers.json
   */
  private doLoad(file: vscode.Uri): void {
    if (!this._loadInProgress) {
      this._loadInProgress = true;
      const folder: string = path.dirname(file.fsPath);

      const config: any = this.loadFromFile(file);
      const serverConfig: IServerConfiguration = new ServerConfiguration(
        this,
        file.fsPath,
        config
      );
      this._configMap.set(folder, serverConfig);
      this._loadInProgress = false;

      this.fireEvent('load', 'servers', {
        old: undefined,
        new: this._configMap[folder],
      });
    }
  }

  private loadFromFile(file: vscode.Uri): any {
    let config: any = {};

    if (!fs.existsSync(file.fsPath)) {
      this.initializeServerConfigFile(file.fsPath);
    }

    const content: string = fs.readFileSync(file.fsPath).toString();
    if (content) {
      try {
        config = JSON.parse(stripJsonComments(content));
      } catch (e) {
        console.exception(e);
        vscode.window.showErrorMessage(e.message);
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
    if (config.hasOwnProperty('configurations')) {
      config.configurations.forEach((element: any, index: number) => {
        const server: IServerDebugger = this.getServerDebugger(
          file.fsPath,
          element,
          true
        );
        config.configurations[index] = server;
      });
    } else {
      config = undefined;
    }

    return config;
  }

  /**
   * Grava no arquivo servers.json uma nova configuracao de servers
   * @param JSONServerInfo
   */
  saveToFile(file: string, content: IServerConfiguration) {
    if (!this._loadInProgress) {
      fs.writeFileSync(file, JSON.stringify(content, null, '\t'));
    }
  }

  /**
   * Cria uma nova configuracao de servidor debugger
   */
  private createServerDebugger(
    folder: string,
    id: string,
    type: LSServerType.LS_SERVER_TYPE,
    serverName: string,
    port: number,
    address: string,
    buildVersion: string,
    secure: boolean,
    includes: string[]
  ): IServerDebugger {
    if (this._configMap[folder]) {
      const servers = this._configMap[folder].configurations;

      if (
        servers.some((element: IServerDebugger) => {
          return element.name === serverName;
        })
      ) {
        vscode.window.showErrorMessage(
          localize(
            'tds.webview.serversView.serverNameDuplicated',
            'Server name already exists'
          )
        );

        throw new Error('Server name already exists');
      }
    }

    let validate_includes: string[] = [];

    includes.forEach((element) => {
      if (element !== undefined && element.length > 0) {
        validate_includes.push(element);
      }
    });

    const serverOptions: Partial<ILSServerAttributes> = {
      type: type,
      address: address,
      port: port,
      build: buildVersion as BuildVersion,
      secure: secure,
    };

    const newServer: ServerDebugger = new ServerDebugger(
      this._configMap[folder],
      id || this.generateUUID(),
      serverName,
      serverOptions
    );
    newServer.includes = validate_includes;

    return <any>newServer;
  }

  /**
   * Cria uma nova configuracao de servidor debugger
   */
  private createServerMonitor(
    id: string,
    type: LSServerType.LS_SERVER_TYPE,
    serverName: string,
    port: number,
    address: string,
    buildVersion: string,
    secure: boolean
  ): IServerMonitor {
    const serverOptions: Partial<ILSServerAttributes> = {
      type: type,
      address: address,
      port: port,
      build: buildVersion as BuildVersion,
      secure: secure,
    };

    const newServer: ServerMonitor = new ServerMonitor(
      id || this.generateUUID(),
      serverName,
      serverOptions
    );

    return <any>newServer;
  }

  getServerDebugger(
    folder: string,
    debuggerServer: Partial<IServerDebuggerAttributes>,
    load: boolean = false
  ): IServerDebugger {
    const target: ILSServerAttributes = (debuggerServer as unknown) as ILSServerAttributes;
    let server: IServerDebugger = undefined;

    if (!load) {
      // const servers = this._configMap[globalFolder].configurations;
      // server = servers.some((element: IServerDebugger) => {
      //   return target.id
      //     ? element.id === target.id
      //     : element.name === target.name;
      // });
    }

    if (!server) {
      server = this.createServerDebugger(
        folder,
        target.id,
        target.type,
        target.name,
        target.port,
        target.address,
        target.build,
        target.secure,
        debuggerServer.includes
      );
    }

    return server;
  }

  getServerMonitor(debuggerServer: Partial<IServerDebugger>): IServerMonitor {
    const server: IServerMonitor = this.createServerMonitor(
      debuggerServer.id + '_monitor',
      debuggerServer.type,
      debuggerServer.name + '_monitor',
      debuggerServer.port,
      debuggerServer.address,
      debuggerServer.build,
      debuggerServer.secure
    );

    return server;
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
        JSON.stringify(defaultServerConfiguration(), null, '\t')
      );
    } catch (err) {
      console.error(err);
    }
  }

  // set smartClientBin(smartClient: string) {
  //   const oldValue: string = this._configMap[globalFolder].smartClientBin;
  //   this._configMap[globalFolder].smartClientBin = smartClient;

  //   this.fireEvent('change', 'smartClientBin', {
  //     old: oldValue,
  //     new: this._configMap[globalFolder].smartClientBin,
  //   });
  // }

  // get smartClientBin(): string {
  //   return this._configMap[globalFolder].smartClientBin;
  // }

  reconnectLastServer() {
    if (TDSConfiguration.isReconnectLastServer()) {
      if (this._configMap[globalFolder].lastConnectedServer) {
        // this.servers.some((element: IServerDebugger) => {
        //   if (
        //     element.id === this._configMap[globalFolder].lastConnectedServer
        //   ) {
        //     return element.reconnect();
        //   }
        // });
      }
    }
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
