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

import path = require('path');
import * as vscode from 'vscode';
import { IRpoToken } from './rpoToken';

const homedir = require('os').homedir();

export namespace TDSConfiguration {
  export interface ITDSConfiguration {
    version: string;
    includes: string[];
    permissions: {
      authorizationtoken: any;
    };
    configurations: any[];
    savedTokens: string[];
    lastConnectedServer: string;
    rpoToken?: IRpoToken;
  }

  export const defaultConfiguration: ITDSConfiguration = {
    version: '0.2.1',
    includes: [''],
    permissions: {
      authorizationtoken: '',
    },
    configurations: [],
    savedTokens: [],
    lastConnectedServer: '',
  };

  const config = vscode.workspace.getConfiguration('totvsLanguageServer');

  /**
   * Retorna o path completo do servers.json
   */
  export function getServerConfigFile(): string {
    return path.join(getServerConfigPath(), 'servers.json');
  }

  /**
   * Retorna o path de onde deve ficar o servers.json
   */
  function getServerConfigPath(): string {
    return config.get('workspaceServerConfig')
      ? getVSCodePath()
      : path.join(homedir, '/.totvsls');
  }

  /**
   * Retorna o path da pasta .vscode dentro do workspace
   */
  function getVSCodePath(): string {
    let rootPath: string = vscode.workspace.rootPath || process.cwd();

    return path.join(rootPath, '.vscode');
  }

  /**
   * Troca o local da salva de servers.json
   */
  export function toggleWorkspaceServerConfig() {
    config.update(
      'workspaceServerConfig',
      !config.get('workspaceServerConfig')
    );
  }
}
