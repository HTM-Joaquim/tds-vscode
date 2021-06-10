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
  IPatchGenerateResult,
  LSServerDebugger,
  ILSServerAttributes,
} from '@totvs/tds-languageclient';
import { EventGroup, eventManager, EventName, EventProperty } from './event';
import { IRpoToken } from './rpoToken';
import { IServerConfiguration } from './serverConfiguration';
import {
  ICompileKey,
  IServerDebugger,
  serverManager,
} from './serverManager';

export class ServerDebugger
  extends LSServerDebugger
  implements IServerDebugger
{
  private _includes: string[] = [];
  private _environments: string[] = [];
  private _username: string = '';
  private _smartclientBin: string = '';
  private _patchGenerateDir: string = '';

  validate(): Promise<boolean> {
    return super.validate();
  }
  public get patchGenerateDir(): string {
    return this._patchGenerateDir;
  }

  public set patchGenerateDir(value: string) {
    this._patchGenerateDir = value;
  }

  public get username(): string {
    return this._username;
  }
  public set username(value: string) {
    this._username = value;
  }
  public get smartclientBin(): string {
    return this._smartclientBin;
  }
  public set smartclientBin(value: string) {
    this._smartclientBin = value;
  }
  public get environments(): string[] {
    return this._environments;
  }
  public set environments(value: string[]) {
    this._environments = value;
  }
  public get includes(): string[] {
    return this._includes;
  }

  public set includes(value: string[]) {
    if (this._includes.toString() !== value.toString()) {
      this._includes = value;
      this.notifyNeedSave();
    }
  }

  notifyNeedSave() {
    eventManager.fireEvent(EventGroup.server, EventName.needSave, EventProperty.all, this);
  }

  public constructor(
    readonly parent: IServerConfiguration,
    id: string,
    serverName: string,
    options?: Partial<ILSServerAttributes>
  ) {
    super(id, { ...options, name: serverName });
  }

  generateWsl(url: string) {
    return super.generateWsdl(url);
  }

  getPatchInfo(url: string) {
    return super.getPatchInfo(url);
  }

  patchGenerate(
    patchMaster: string,
    patchDest: string,
    patchType: number,
    patchName: string,
    filesPath: string[]
  ): Promise<IPatchGenerateResult> {
    return super.patchGenerate(
      patchMaster,
      patchDest,
      patchType,
      patchName,
      filesPath
    );
  }

  isConnected(): boolean {
    return serverManager.isConnected(<any>this);
  }

  removeEnvironment(name: string): boolean {
    return this._environments.some((value: string, index: number) => {
      if (value.toLowerCase() === name.toLowerCase()) {
        this._environments.splice(index, 1);
        this.notifyNeedSave();
        return true;
      }
    });
  }

  addEnvironment(name: string): boolean {
    if (
      !this._environments.some((value: string) => {
        return value.toLowerCase() === value.toLocaleLowerCase();
      })
    ) {
      this._environments.push(name);
      this.notifyNeedSave();
      return true;
    }

    return false;
  }

  getAuthorizationToken(): string {
    const isSafeRPO: boolean = serverManager.isSafeRPO(this);
    const permissionsInfos: IRpoToken | ICompileKey = isSafeRPO
      ? serverManager.getRpoTokenInfos()
      : serverManager.getPermissionsInfos();
    let authorizationToken: string = '';

    if (permissionsInfos) {
      if (isSafeRPO) {
        authorizationToken = (permissionsInfos as IRpoToken).token;
      } else {
        authorizationToken = (permissionsInfos as ICompileKey)
          .authorizationToken;
      }
    }

    return authorizationToken;
  }
}
