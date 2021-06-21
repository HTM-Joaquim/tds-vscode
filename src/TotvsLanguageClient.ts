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
  commands,
  DecorationRangeBehavior,
  DecorationRenderOptions,
  ExtensionContext,
  ThemeColor,
  window,
  workspace,
} from 'vscode';
import {
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
} from 'vscode-languageclient/node';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { syncSettings } from './server/languageServerSettings';
import {
  IStartLSOptions,
  getTDSLanguageServer,
  ITdsLanguageClient,
} from '@totvs/tds-languageclient';
import { TotvsLanguageClientA } from './TotvsLanguageClientA';

let localize = nls.loadMessageBundle();
export let sessionKey: string;
export let isLSInitialized = false;

export function getLanguageClient(
  context: ExtensionContext
): TotvsLanguageClientA {
  let clientConfig = getClientConfig(context);

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(() => {
      for (let key in clientConfig) {
        if (!clientConfig.hasOwnProperty(key)) {
          continue;
        }
        if (
          !clientConfig ||
          JSON.stringify(clientConfig[key]) !==
            JSON.stringify(clientConfig[key])
        ) {
          const kReload = localize(
            'tds.webview.totvsLanguegeClient.reload',
            'Reload'
          );
          const message = localize(
            'tds.webview.totvsLanguegeClient.pleaseReload',
            "Please reload to apply the 'TOTVS.{0}' configuration change.",
            key
          );
          window.showInformationMessage(message, kReload).then((selected) => {
            if (selected === kReload) {
              commands.executeCommand('workbench.action.reloadWindow');
            }
          });
          break;
        }
        syncSettings();
      }
    })
  );

  const serverOptions: ServerOptions = () => {
    const options: Partial<IStartLSOptions> = {
      logging: true,
      trace: 'off',
      verbose: 'warn'
    };
    const lsServer: ITdsLanguageClient = getTDSLanguageServer(options);
    return Promise.resolve(lsServer.lsProcess);
  };
  // Inline code lens.
  let decorationOpts: DecorationRenderOptions = {
    after: {
      fontStyle: 'italic',
      color: new ThemeColor('editorCodeLens.foreground'),
    },
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  };
  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'advpl' }, { language: '4gl' }],
    // synchronize: {
    // 	configurationSection: 'cquery',
    // 	fileEvents: workspace.createFileSystemWatcher('**/.cc')
    // },
    diagnosticCollectionName: 'AdvPL',
    outputChannelName: 'TOTVS LS',
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    initializationOptions: clientConfig,
    middleware: {
      // provideCodeLenses: provideCodeLens,
      //provideOnTypeFormattingEdits: provideOnTypeFormatting,
    },
    // initializationFailedHandler: (e) => {
    // 	console.log(e);
    // 	return false;
    // },
    //errorHandler: new CqueryErrorHandler(workspace.getConfiguration('cquery'))
  };
  let languageClient: TotvsLanguageClientA = new TotvsLanguageClientA(serverOptions, clientOptions);
  languageClient
    .onReady()
    .then(() => {
      isLSInitialized = true;
      syncSettings();
      // if (TDSConfiguration.isReconnectLastServer()) {
      //   reconnectLastServer();
      // }
    })
    .catch((e) => {
      // TODO: remove cquery.launch.workingDirectory after July 2018
      window.showErrorMessage(e);
    });
  return languageClient;
}
//Internal Functions
function getClientConfig(context: ExtensionContext) {
  function resolveVariablesInString(value: string) {
    let rootPath: string = vscode.workspace.rootPath || process.cwd();
    return value.replace('${workspaceFolder}', rootPath);
  }
  function resolveVariablesInArray(value: any[]) {
    return value.map((v) => resolveVariables(v));
  }
  function resolveVariables(value: any) {
    if (typeof value === 'string') {
      return resolveVariablesInString(value);
    }
    if (Array.isArray(value)) {
      return resolveVariablesInArray(value);
    }
    return value;
  }
  let configMapping = [['launchArgs', 'launch.args']];
  let clientConfig = {};
  let config = workspace.getConfiguration('totvsLanguageServer');
  for (let prop of configMapping) {
    let value = config.get(prop[1]);
    if (value !== undefined && value !== null) {
      //if(prop[1] === 'launch.command') {
      //	if (process.platform ==== "win32"){
      //		value = dir + "/node_modules/@totvs/tds-ls/bin/windows/" + value + ".exe";
      //	}
      //	else if (process.platform ==== "linux"){
      //		value = dir + "/node_modules/@totvs/tds-ls/bin/linux/" + value;
      //		chmodSync(value.toString(),'755');
      //	}
      //}
      let subprops = prop[0].split('.');
      let subconfig = clientConfig;
      for (let subprop of subprops.slice(0, subprops.length - 1)) {
        if (!subconfig.hasOwnProperty(subprop)) {
          subconfig[subprop] = {};
        }
        subconfig = subconfig[subprop];
      }
      subconfig[subprops[subprops.length - 1]] = resolveVariables(value);
    }
  }
  // Provide a default cache directory if it is not present. Insert next to
  // the project since if the user has an SSD they most likely have their
  // source files on the SSD as well.
  //let cacheDir = '${workspaceFolder}/.vscode/cquery_cached_index/';
  //Processo de cache desabilitado até que seja corretamente implementado pelo LS
  //let cacheDir = '${workspaceFolder}/.vscode/totvs_cached_index/';
  //clientConfig.cacheDirectory = resolveVariables(cacheDir);
  //config.update(kCacheDirPrefName, cacheDir, false /*global*/);
  return clientConfig;
}