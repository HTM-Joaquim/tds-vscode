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
  IServerConfigurationAttributes,
  ServerConfiguration,
} from './serverConfiguration';
import { LS_ERROR_CODES, LS_MESSAGE_TYPE } from '@totvs/tds-languageclient';
import {
  EventData,
  EventGroup,
  eventManager,
  EventName,
  EventProperty,
} from './event';

const localize = nls.loadMessageBundle();
const _homedir: string = require('os').homedir();
const SERVER_DEFINITION_FILE: string = 'servers.json';

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
  enableEvents: boolean;
  folders: string[];
  currentServer: IServerDebugger;
  smartClientBin: string;

  setServersDefinitionFile(file: vscode.Uri): void;
  toggleWorkspaceServerConfig(): void;
  deletePermissionsInfos(): void;
  savePermissionsInfos(infos: ICompileKey): void;
  getPermissionsInfos(): ICompileKey;
  saveRpoTokenInfos(rpoToken: IRpoToken): void;
  getRpoTokenInfos(): IRpoToken;
  deleteRpoTokenInfos(): void;
  isSafeRPO(server: IServerDebugger): boolean;
  getConfigurations(): IServerConfiguration;
  isConnected(server: IServerDebugger): boolean;
  saveToFile(file: vscode.Uri, content: IServerConfigurationAttributes): void;
  isIgnoreResource(file: string): boolean;
  getServerDebugger(debuggerServer: Partial<IServerDebugger>): IServerDebugger;
  getServerMonitor(debuggerServer: Partial<IServerDebugger>): IServerMonitor;
  readCompileKeyFile(path: string): IAuthorization;
  getIncludes(absolute: boolean): string[];
  setIncludes(includePath: string[]): void;
  getServerConfigFile(): vscode.Uri;
}

interface IServerDebuggerMethods {
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

interface IServerMonitorMethods {
  getUsersData(): Promise<IGetUsersData>;
}

export declare type IServerDebugger = TLSServerDebugger &
  IServerDebuggerAttributes &
  IServerDebuggerMethods;

export declare type IServerMonitor = TLSServerMonitor &
  IServerMonitorAttributes &
  IServerMonitorMethods;

const GLOBAL_FOLDER: vscode.Uri = vscode.Uri.joinPath(
  vscode.Uri.file(_homedir),
  '.totvsls'
);

class ServerManager implements IServerManager {
  private _configMap: IServerConfiguration;
  private _currentServer: IServerDebugger;
  private _enableEvents: boolean = true;
  private _loadInProgress: boolean;

  public get enableEvents(): boolean {
    return this._enableEvents;
  }

  public set enableEvents(value: boolean) {
    this._enableEvents = value;

    if (value) {
      this.fireEvent(EventName.load, EventProperty.servers, undefined);
    }
  }

  readonly onDidChange: vscode.Event<EventData> = eventManager.onDidChange;

  constructor() {
    this.setServersDefinitionFile(this.getServerConfigFile());

    vscode.workspace.onDidChangeConfiguration((e:vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration) { //@acandido
        this.setServersDefinitionFile(this.getServerConfigFile());
      }
    })
  }

  toggleWorkspaceServerConfig(): void {
    const oldFile: vscode.Uri = this.getServerConfigFile();

    serverJsonFileWatcher.removeFile(oldFile.fsPath);

    TDSConfiguration.setWorkspaceServerConfig(
      !TDSConfiguration.isWorkspaceServerConfig()
    );

  }

  getRpoTokenInfos(): IRpoToken {
    throw new Error('Method not implemented.');
  }

  deleteRpoTokenInfos(): void {
    throw new Error('Method not implemented.');
  }

  getIncludes(absolute: boolean): string[] {
    return this.getConfigurations().includes;
  }

  setIncludes(includePath: string[]): void {
    this.getConfigurations().includes = includePath;
  }

  fireEvent(name: EventName, property: EventProperty, value: any) {
    if (this._enableEvents) {
      eventManager.fireEvent(EventGroup.manager, name, property, value);
    }
  }

  deletePermissionsInfos() {
    this.savePermissionsInfos(undefined);
  }

  getPermissionsInfos(): ICompileKey {
    const config: IServerConfiguration = this.getConfigurations();
    return config.getPermissions();
  }

  savePermissionsInfos(infos: ICompileKey) {
    const config: IServerConfiguration = this.getConfigurations();
    config.savePermissions(infos);
  }

  saveRpoTokenInfos(infos: IRpoToken) {
    const config: IServerConfiguration = this.getConfigurations();
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

    return [this.getServerConfigPath().fsPath];
  }

  getConfigurations(): IServerConfiguration {
    return this._configMap;
  }

  get currentServer(): IServerDebugger {
    return this._currentServer;
  }

  set currentServer(value: IServerDebugger) {
    if (this._currentServer !== value) {
      const oldValue: IServerDebugger = this._currentServer;

      this._currentServer = value;

      this.fireEvent(EventName.change, EventProperty.currentServer, {
        old: oldValue,
        new: value,
      });
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

  setServersDefinitionFile(file: vscode.Uri): void {
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

      const config: IServerConfigurationAttributes = this.loadFromFile(file);
      const serverConfig: IServerConfiguration = new ServerConfiguration(
        this,
        file,
        config
      );
      this._configMap = serverConfig;
      this._loadInProgress = false;

      this.fireEvent(EventName.load, EventProperty.servers, {
        old: undefined,
        new: this._configMap,
      });
    }
  }

  private loadFromFile(file: vscode.Uri): IServerConfigurationAttributes {
    let config: any = undefined;

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
        const server: IServerDebugger = this.getServerDebugger(element, true);
        config.configurations[index] = server;
      });
    } else {
      config = undefined;
    }

    return config;
  }

  /**
   * Grava no arquivo servers.json uma nova configuracao de servers
   * @param file - target file
   * @param attributes - json format attributes to save
   */
  saveToFile(file: vscode.Uri, attributes: IServerConfigurationAttributes) {
    if (!this._loadInProgress) {
      vscode.window.withProgress(
        {
          location: { viewId: 'totvs_server' }, //vscode.ProgressLocation.Notification,
          title: `Saving ${file} setting`,
          cancellable: false,
        },
        //(progress, token) => {
        () => {
          return new Promise<void>((resolve) => {
            const toSave: string[] = this.getPropsToSave(attributes);
            let content: string = JSON.stringify(attributes, toSave, '\t');
            content = content.replace(/"_/g, '"');
            fs.writeFileSync(file.fsPath, content);

            resolve();
          });
        }
      );
    }
  }

  private getPropsToSave(attributes: any): string[] {
    const result: string[] = [];

    Object.keys(attributes).forEach((key: string) => {
      if (key !== 'parent' && key !== 'file' && !key.startsWith('ro_')) {
        if (key === 'configurations') {
          if (attributes[key].length > 0) {
            const subProps: string[] = this.getPropsToSave(attributes[key][0]);
            result.push(...subProps);
          }
        }

        result.push(key);
      }
    });

    return result;
  }

  /**
   * Cria uma nova configuracao de servidor debugger
   */
  private createServerDebugger(
    id: string,
    type: LSServerType.LS_SERVER_TYPE,
    serverName: string,
    port: number,
    address: string,
    buildVersion: string,
    secure: boolean,
    includes: string[]
  ): IServerDebugger {
    const config: IServerConfiguration = this.getConfigurations();

    if (config) {
      const servers = config.getServers();

      if (!this._loadInProgress &&
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
      config,
      id || this.generateUUID(),
      serverName,
      serverOptions
    );
    newServer.includes = validate_includes;

    return <any>newServer;
  }

  /**
   * Cria indicação de erro na carga
   */
  private createServerError(serverName: string, error: any): IServerDebugger {
    const server: IServerDebugger = this.createServerDebugger(
      null,
      LSServerType.LS_SERVER_TYPE.UNDEFINED,
      serverName,
      0,
      '',
      '',
      false,
      []
    );
    server.lastError = {
      level: LS_MESSAGE_TYPE.Error,
      code: LS_ERROR_CODES.InvalidParams,
      subcode: 0,
      message: error.message,
      data: error,
    };
    return server;
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
    debuggerServer: Partial<IServerDebuggerAttributes>,
    load: boolean = false
  ): IServerDebugger {
    const target: ILSServerAttributes =
      debuggerServer as unknown as ILSServerAttributes;
    let server: IServerDebugger = undefined;

    if (!load) {
      const config: IServerConfiguration = this.getConfigurations();
      server = config.configurations
        .filter((element: IServerDebugger) => {
          return target.id
            ? element.id === target.id
            : element.name === target.name;
        })
        .values()
        .return().value;
    }

    if (!server) {
      try {
        server = this.createServerDebugger(
          target.id,
          target.type,
          target.name,
          target.port,
          target.address,
          target.build,
          target.secure,
          debuggerServer.includes
        );
      } catch (error) {
        server = this.createServerError(target.name, error);
      }
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

  set smartClientBin(smartClient: string) {
    const config: IServerConfiguration = this.getConfigurations();

    const oldValue: string = config.smartClientBin;
    config.smartClientBin = smartClient;

    this.fireEvent(EventName.change, EventProperty.all, {
      old: oldValue,
      new: config.smartClientBin,
    });
  }

  get smartClientBin(): string {
    const config: IServerConfiguration = this.getConfigurations();

    return config.smartClientBin;
  }

  reconnectLastServer() {
    if (TDSConfiguration.isReconnectLastServer()) {
      const config: IServerConfiguration = this.getConfigurations();

      if (config.lastConnectedServer) {
        config.configurations.some((element: IServerDebugger) => {
          if (element.id === config.lastConnectedServer) {
            return element.reconnect();
          }
        });
      }
    }
  }

  /**
   * Retorna o path completo do servers.json
   */
  getServerConfigFile(): vscode.Uri {
    return vscode.Uri.joinPath(
      this.getServerConfigPath(),
      SERVER_DEFINITION_FILE
    );
  }

  /**
   * Retorna o path de onde deve ficar o servers.json
   */
  getServerConfigPath(): vscode.Uri {
    return TDSConfiguration.isWorkspaceServerConfig()
      ? getVSCodePath()
      : GLOBAL_FOLDER;
  }
}

/**
 * Retorna o path da pasta .vscode dentro do workspace
 */
function getVSCodePath(): vscode.Uri {
  let rootPath: string = vscode.workspace.rootPath || process.cwd();

  return vscode.Uri.joinPath(vscode.Uri.file(rootPath), '.vscode');
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
