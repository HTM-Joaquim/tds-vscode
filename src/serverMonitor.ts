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
  LSServerMonitor,
  ILSServerAttributes,
  IUserData,
} from '@totvs/tds-languageclient';
import * as nls from 'vscode-nls';
import stripJsonComments = require('strip-json-comments');
import path = require('path');
import ini = require('ini');
import { IGetUsersData, IServerMonitor, serverManager } from './serverManager';

const localize = nls.loadMessageBundle();

export class ServerMonitor extends LSServerMonitor implements IServerMonitor {
  public constructor(
    id: string,
    serverName: string,
    options?: Partial<ILSServerAttributes>
  ) {
    super(id, { ...options, name: serverName });
  }

  isConnected(): boolean {
    return serverManager.isConnected(<any>this);
  }

  getUsersData(): Promise<IGetUsersData> {
    return new Promise<IGetUsersData>(() => {
      const result: any = super.getUsers();
      const users: IUserData[] = result.mntUsers;
      const servers: any[] = this.groupBy(users, (item: IUserData) => {
        return item.server;
      }).map((element) => element[0].server);
      return { servers: servers, users: users };
    });
  }

  private groupBy<T, K>(list: T[], getKey: (item: T) => K) {
    const map = new Map<K, T[]>();
    list.forEach((item) => {
      const key = getKey(item);
      const collection = map.get(key);
      if (!collection) {
        map.set(key, [item]);
      } else {
        collection.push(item);
      }
    });
    return Array.from(map.values());
  }
}
