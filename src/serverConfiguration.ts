import path = require('path');
import { IRpoToken, noRpoToken } from './rpoToken';
import { ICompileKey, IServerDebugger, IServerManager } from './serverManager';

export interface IServerConfigurationAttributes {
  version: string;
  includes: string[];
  permissions: {
    authorizationtoken: any;
  };
  configurations: any[];
  savedTokens: string[];
  lastConnectedServer: string;
  rpoToken: IRpoToken;
  smartClientBin: string;
}

interface IServerConfigurationMethods {
  file: string;
  servers: IServerDebugger[];

  addServer(serverItem: IServerDebugger): boolean;
  deleteServer(serverItem: IServerDebugger): boolean;
  renameServer(server: IServerDebugger, newName: string): boolean;

  deletePermissions(): void;
  savePermissions(infos: ICompileKey): void;
  getPermissions(): ICompileKey;

  deleteRpoToken(): void;
  saveRpoToken(infos: IRpoToken): void;
  getRpoToken(): IRpoToken;
}

export declare type IServerConfiguration = IServerConfigurationMethods &
  IServerConfigurationAttributes;

export function defaultServerConfiguration(): IServerConfigurationAttributes {
  return {
    version: '0.2.1',
    includes: [],
    permissions: {
      authorizationtoken: '',
    },
    configurations: [],
    savedTokens: [],
    lastConnectedServer: '',
    rpoToken: noRpoToken(),
    smartClientBin: '',
  };
}

export class ServerConfiguration implements IServerConfiguration {
  version: string;
  permissions: {
    authorizationtoken: any;
  };
  configurations: any[];
  savedTokens: string[];
  lastConnectedServer: string;
  rpoToken: IRpoToken;
  smartClientBin: string;

  private _includes: string[] = [];
  private readonly manager: IServerManager;
  readonly file: string;

  constructor(
    manager: IServerManager,
    file: string,
    attributes: IServerConfigurationAttributes
  ) {
    this.manager = manager;
    this.file = file;

    Object.assign(this, defaultServerConfiguration && attributes);
  }

  get includes(): string[] {
    return this._includes;
  }

  set includes(value: string[]) {
    if (value.toString() !== this._includes.toString()) {
      this._includes = value;
      this.doSave();
    }
  }

  doSave(): void {
    const attSave: IServerConfigurationAttributes = defaultServerConfiguration();
    Object.keys(attSave).forEach((key: string) => {
      attSave[key] = this[key];
    });

    this.manager.saveToFile(this.file, attSave);
  }

  get servers(): IServerDebugger[] {
    return this.configurations;
  }

  addServer(server: IServerDebugger): boolean {
    let result: boolean = false;

    if (
      !this.servers.some((element: IServerDebugger) => {
        return element.name == server.name;
      })
    ) {
      this.servers.push(server);
      this.manager.fireEvent('add', 'servers', {
        old: undefined,
        new: server,
      });
      result = true;
      this.doSave();
    }

    return result;
  }

  deleteServer(server: IServerDebugger): boolean {
    return this.servers.some((element: IServerDebugger, index: number) => {
      if (element.id === server.id) {
        const elements: IServerDebugger[] = this.servers.splice(index, 1);
        this.manager.fireEvent('remove', 'servers', { old: elements, new: [] });
        this.doSave();
        return true;
      }
    });
  }

  renameServer(server: IServerDebugger, newName: string): boolean {
    return this.servers.some((element: IServerDebugger, index: number) => {
      if (element.id === server.id) {
        const oldValue: string = this.servers[index].name;

        this.servers[index].name = newName;

        this.manager.fireEvent('change', 'servers', {
          old: oldValue,
          new: this.servers[index],
        });
        this.doSave();

        return true;
      }
    });
  }

  deletePermissions() {
    this.savePermissions(undefined);
  }

  getPermissions(): ICompileKey {
    return this.permissions.authorizationtoken;
  }

  savePermissions(infos: ICompileKey) {
    const oldValue: ICompileKey = this.permissions.authorizationtoken;
    this.permissions.authorizationtoken = infos;

    this.manager.fireEvent('change', 'compileKey', {
      old: oldValue,
      new: infos,
    });
    this.doSave();
  }

  deleteRpoToken() {
    this.saveRpoToken(noRpoToken());
  }

  getRpoToken(): IRpoToken {
    return this.rpoToken;
  }

  saveRpoToken(infos: IRpoToken) {
    const oldInfos: IRpoToken = this.rpoToken;
    this.rpoToken = infos;
    this.doSave();

    this.manager.fireEvent('change', 'rpoToken', { old: oldInfos, new: infos });
  }
}
