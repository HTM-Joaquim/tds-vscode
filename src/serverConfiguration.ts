import path = require('path');
import { IRpoToken } from './rpoToken';
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
  rpoToken?: IRpoToken;
  smartClientBin?: string;
}

export interface IServerConfiguration {
  file: string;
  servers: IServerDebugger[];

  addServer(serverItem: IServerDebugger): boolean;
  deleteServer(serverItem: IServerDebugger): boolean;
  renameServer(server: IServerDebugger, newName: string): boolean;
  deletePermissionsInfos(): void;
  getAuthorizationToken(server: IServerDebugger): string;
  setAuthorizationToken(server: IServerDebugger, token: string): void;
  setCompileKey(compileKey: ICompileKey): void;
  getPermissionsInfos(): ICompileKey;
  savePermissionsInfos(infos: ICompileKey): void;
  saveRpoTokenInfos(infos: IRpoToken): void;
}

const defaultConfiguration: IServerConfigurationAttributes = {
  version: '0.2.1',
  includes: [''],
  permissions: {
    authorizationtoken: '',
  },
  configurations: [],
  savedTokens: [],
  lastConnectedServer: '',
};

export class ServerConfiguration
  implements IServerConfiguration, IServerConfigurationAttributes {
  version: string;
  includes: string[];
  permissions: {
    authorizationtoken: any;
  };
  configurations: any[];
  savedTokens: string[];
  lastConnectedServer: string;
  rpoToken?: IRpoToken;
  smartClientBin?: string;

  private readonly manager: IServerManager;
  readonly file: string;

  constructor(
    manager: IServerManager,
    file: string,
    attributes: IServerConfigurationAttributes
  ) {
    Object.assign(this, defaultConfiguration && attributes);

    this.manager = manager;
    this.file = file;
  }

  doSave(): void {
    this.manager.saveToFile(this.file, this);
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

  deletePermissionsInfos() {
    this.savePermissionsInfos(undefined);
  }

  getPermissionsInfos(): ICompileKey {
    return this.permissions.authorizationtoken;
  }

  savePermissionsInfos(infos: ICompileKey) {
    const oldValue: ICompileKey = this.permissions.authorizationtoken;
    this.permissions.authorizationtoken = infos;

    this.manager.fireEvent('change', 'compileKey', {
      old: oldValue,
      new: infos,
    });
    this.doSave();
  }

  getAuthorizationToken(server: IServerDebugger): string {
    const isSafeRPO: boolean = this.manager.isSafeRPO(server);
    const permissionsInfos: IRpoToken | ICompileKey = isSafeRPO
      ? this.getRpoTokenInfos()
      : this.getPermissionsInfos();
    let authorizationToken: string = '';

    if (permissionsInfos) {
      if (isSafeRPO) {
        authorizationToken = (<IRpoToken>permissionsInfos).token;
      } else {
        authorizationToken = (<ICompileKey>permissionsInfos).authorizationToken;
      }
    }

    return authorizationToken;
  }

  setAuthorizationToken(server: IServerDebugger, token: string): void {
    const isSafeRPOServer: boolean = this.manager.isSafeRPO(server);

    if (isSafeRPOServer) {
      const rpoToken: IRpoToken = undefined;
      this.saveRpoTokenInfos(rpoToken);
    } else {
      const infos: any = undefined;
      this.savePermissionsInfos(infos);
    }
    this.doSave();
  }

  setCompileKey(compileKey: ICompileKey) {
    this.savePermissionsInfos(compileKey);
  }

  private getRpoTokenInfos(): IRpoToken {
    return this.rpoToken || undefined;
  }

  saveRpoTokenInfos(infos: IRpoToken) {
    const oldInfos: IRpoToken = this.rpoToken;
    this.rpoToken = infos;
    this.doSave();

    this.manager.fireEvent('change', 'rpoToken', { old: oldInfos, new: infos });
  }
}
