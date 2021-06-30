import path = require('path');
import { Uri } from 'vscode';
import { noKeyCompile } from './compileKey/compileKey';
import { EventData, EventGroup, eventManager, EventName, EventProperty } from './event';
import { IRpoToken, noRpoToken } from './rpoToken';
import { ICompileKey, IServerDebugger, IServerManager } from './serverManager';

export interface IServerConfigurationAttributes {
  version: string;
  includes: string[];
  permissions: {
    authorizationtoken: ICompileKey;
  };
  configurations: IServerDebugger[];
  savedTokens: string[];
  lastConnectedServer: string;
  rpoToken: IRpoToken;
  smartClientBin: string;
}

interface IServerConfigurationMethods {
  getServers(): IServerDebugger[];

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
      authorizationtoken: noKeyCompile(),
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
    authorizationtoken: ICompileKey;
  };
  configurations: IServerDebugger[];
  savedTokens: string[];
  lastConnectedServer: string;
  rpoToken: IRpoToken;
  smartClientBin: string;

  private _includes: string[] = [];
  private readonly parent: IServerManager;
  private readonly file: Uri;

  constructor(
    manager: IServerManager,
    file: Uri,
    attributes: IServerConfigurationAttributes
  ) {
    this.parent = manager;
    this.file = file;

    Object.assign(this, defaultServerConfiguration && attributes);

    eventManager.onDidChange((event: EventData) => {
      if ((event.sender === this) && (event.name == EventName.needSave)) {
        this.doSave();
      }
    })
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
    this.parent.saveToFile(this.file, this);
  }

  _fireEvent(
    name: EventName,
    property: EventProperty,
    value: any
  ) {
    //eventManager.fireEvent(EventGroup.configuration, name, property, value);
  }

  getServers(): IServerDebugger[] {
    return this.configurations;
  }

  addServer(server: IServerDebugger): boolean {
    let result: boolean = false;

    if (
      !this.getServers().some((element: IServerDebugger) => {
        return element.name == server.name;
      })
    ) {
      this.getServers().push(server);
      this._fireEvent(EventName.add, EventProperty.servers, server);
      result = true;
      this.doSave();
    }

    return result;
  }

  deleteServer(server: IServerDebugger): boolean {
    return this.getServers().some((element: IServerDebugger, index: number) => {
      if (element.id === server.id) {
        const elements: IServerDebugger[] = this.getServers().splice(index, 1);
        this._fireEvent(EventName.remove, EventProperty.servers, { old: elements, new: [] });
        this.doSave();
        return true;
      }
    });
  }

  renameServer(server: IServerDebugger, newName: string): boolean {
    return this.getServers().some((element: IServerDebugger, index: number) => {
      if (element.id === server.id) {
        const oldValue: string = this.getServers()[index].name;
        this.getServers()[index].name = newName;

        this._fireEvent(EventName.change, EventProperty.servers, {
          old: oldValue,
          new: this.getServers()[index],
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

    this._fireEvent(EventName.change, EventProperty.compileKey, {
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

    this._fireEvent(EventName.change, EventProperty.rpoToken, { old: oldInfos, new: infos });
  }
}
