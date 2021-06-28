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
import fs = require('fs');
import stripJsonComments = require('strip-json-comments');
import * as vscode from 'vscode';
import { ICompileOptions } from '@totvs/tds-languageclient';

export namespace TDSConfiguration {
  const config = vscode.workspace.getConfiguration('totvsLanguageServer');

  /**
   * Retorna o path da pasta .vscode dentro do workspace
   */
  function getVSCodePath(): string {
    let rootPath: string = vscode.workspace.rootPath || process.cwd();

    return path.join(rootPath, '.vscode');
  }

  function getExtensionsAllowed() {
    let extensionsAllowed: string[];

    if (config.get('folder.enableExtensionsFilter', true)) {
      extensionsAllowed = config.get('folder.extensionsAllowed', []); // Le a chave especifica
    }

    return extensionsAllowed;
  }

  function getGeneratePPO(): boolean {
    return config.get('compilation.generatePpoFile');
  }

  function getShowPreCompiler(): boolean {
    return config.get('compilation.showPreCompiler');
  }

  function getCommitWithErrorOrWarning(): boolean {
    return config.get('compilation.commitWithErrorOrWarning');
  }

  export function compileOptions(): ICompileOptions {
    return {
      extensionsAllowed: getExtensionsAllowed(),
      filesUris: [],
      includesUris: [],
      extraOptions: {
        recompile: false,
        debugAphInfo: true,
        gradualSending: true,
        priorVelocity: true,
        returnPpo: false,
        generatePpoFile: getGeneratePPO(),
        showPreCompiler: getShowPreCompiler(),
        commitWithErrorOrWarning: getCommitWithErrorOrWarning(),
      },
    };
  }

  export function isReconnectLastServer(): boolean {
    return config.get('reconnectLastServer');
  }

  export function isClearConsoleBeforeCompile(): boolean {
    return config.get('clearConsoleBeforeCompile');
  }

  export function isShowConsoleOnCompile(): boolean {
    return config.get('showConsoleOnCompile');
  }

  export function autocompleteBehavior(): boolean {
    return config.get('editor.toggle.autocomplete');
  }

  export function notificationLevel(): string {
    return config.get('editor.show.notification');
  }

  /**
   * Retorna o path completo do launch.json
   */
  function getLaunchConfigFile() {
    return path.join(getVSCodePath(), 'launch.json');
  }

  /**
   * Retorna todo o conteudo do launch.json
   */
  export function loadLaunchConfig(): any {
    const exist: boolean = fs.existsSync(getLaunchConfigFile());
    let config: any;

    if (exist) {
      let json: any = fs
        .readFileSync(getLaunchConfigFile(), 'utf-8')
        .toString();

      if (json) {
        try {
          config = JSON.parse(stripJsonComments(json));
        } catch (e) {
          throw e;
        }
      }
    }

    return config;
  }

  export function saveLaunchConfig(config: any) {
    fs.writeFileSync(getLaunchConfigFile(), JSON.stringify(config, null, '\t'));
  }

  /**
   * Cria o arquivo launch.json caso ele nao exista.
   */
  export function createLaunchConfig() {
    const launchConfig: any = loadLaunchConfig();

    if (!launchConfig) {
      let fs = require('fs');
      let ext = vscode.extensions.getExtension('TOTVS.tds-vscode');

      if (ext) {
        let sampleLaunch = {
          version: '0.2.0',
          configurations: [],
        };

        let pkg = ext.packageJSON;
        let contributes = pkg['contributes'];
        let debug = (contributes['debuggers'] as any[]).filter(
          (element: any) => {
            return element.type === 'totvs_language_debug';
          }
        );

        if (debug.length === 1) {
          let initCfg = (debug[0]['initialConfigurations'] as any[]).filter(
            (element: any) => {
              return element.request === 'launch';
            }
          );

          if (initCfg.length === 1) {
            sampleLaunch = {
              version: '0.2.0',
              configurations: [initCfg[0] as never],
            };
          }
        }

        if (!fs.existsSync(getVSCodePath())) {
          fs.mkdirSync(getVSCodePath());
        }

        saveLaunchConfig(sampleLaunch);
      }
    }
  }

  export function isGlobalServerFile() : boolean {
    return true;
  }
}
