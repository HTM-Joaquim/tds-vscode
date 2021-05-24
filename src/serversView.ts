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
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import Utils from './utils';
import * as nls from 'vscode-nls';
import { inputConnectionParameters } from './inputConnectionParameters';
import { inputAuthenticationParameters } from './inputAuthenticationParameters';
import { ResponseError } from 'vscode-languageclient';
import serverProvider, {
  EnvironmentTreeItem,
  FolderTreeItem,
  ServerTreeItem,
  ServerTreeItens,
} from './serverItemProvider';
import {
  EventData,
  IServerDebugger,
  IServerDebuggerAttributes,
  serverManager,
} from './serverManager';
import { BuildVersion, LS_CONNECTION_TYPE } from '@totvs/tds-languageclient';
import { LSServerType } from '../../tds-languageclient/typings/src';

let localize = nls.loadMessageBundle();
const compile = require('template-literal');

const localizeHTML = {
  'tds.webview.newServer.target': localize(
    'tds.webview.newServer.target',
    'Target'
  ),
  'tds.webview.newServer.title': localize(
    'tds.webview.newServer.title',
    'New Server'
  ),
  'tds.webview.newServer.name': localize(
    'tds.webview.newServer.name',
    'Server Name'
  ),
  'tds.webview.newServer.address': localize(
    'tds.webview.newServer.address',
    'Address'
  ),
  'tds.webview.newServer.port': localize('tds.webview.newServer.port', 'Port'),
  'tds.webview.newServer.save': localize('tds.webview.newServer.save', 'Save'),
  'tds.webview.newServer.saveClose': localize(
    'tds.webview.newServer.saveClose',
    'Save/Close'
  ),
  'tds.webview.newServer.secure': localize(
    'tds.webview.newServer.secure',
    'Secure(SSL)'
  ),
  'tds.webview.dir.include': localize(
    'tds.webview.dir.include',
    'Includes directory'
  ),
  'tds.webview.dir.target': localize('tds.webview.dir.tarfet', 'Target'),
  'tds.webview.dir.include2': localize(
    'tds.webview.dir.include2',
    'Allow multiple directories'
  ),
};

export class ServersExplorer {
  constructor(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    vscode.commands.registerCommand(
      'totvs-developer-studio.add',
      (folder: FolderTreeItem) => {
        if (currentPanel) {
          currentPanel.reveal();
        } else {
          currentPanel = vscode.window.createWebviewPanel(
            'totvs-developer-studio.add',
            localize('tds.webview.newServer.title', 'New Server'),
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              localResourceRoots: [
                vscode.Uri.file(
                  path.join(context.extensionPath, 'src', 'server')
                ),
              ],
              retainContextWhenHidden: true,
            }
          );

          currentPanel.webview.html = getWebViewContent(
            context,
            localizeHTML,
            folder.folder
          );
          currentPanel.onDidDispose(
            () => {
              currentPanel = undefined;
            },
            null,
            context.subscriptions
          );

          currentPanel.webview.onDidReceiveMessage(
            (message) => {
              switch (message.command) {
                case 'checkDir':
                  let checkedDir: string = Utils.checkDir(message.selectedDir);

                  currentPanel.webview.postMessage({
                    command: 'checkedDir',
                    checkedDir: checkedDir,
                  });
                  break;
                case 'saveServer':
                  if (message.serverName && message.port && message.address) {
                    createServer(
                      folder.folder,
                      message.serverType,
                      message.serverName,
                      message.port,
                      message.address,
                      false,
                      '',
                      message.includes
                    );
                  } else {
                    vscode.window.showErrorMessage(
                      localize(
                        'tds.webview.serversView.addServerFail',
                        'Add Server Fail. Name, port and Address are need'
                      )
                    );
                  }

                  if (currentPanel) {
                    if (message.close) {
                      currentPanel.dispose();
                    }
                  }
              }
            },
            undefined,
            context.subscriptions
          );
        }
      }
    );

    vscode.commands.registerCommand(
      'totvs-developer-studio.config',
      (element: FolderTreeItem) => {
        vscode.window.showTextDocument(
          vscode.Uri.file(
            path.join(element.folder, Utils.SERVER_DEFINITION_FILE)
          )
        );
      }
    );

    // check if there is an open folder
    if (vscode.workspace.workspaceFolders === undefined) {
      vscode.window.showErrorMessage('No folder opened.');
      return;
    }

    const options: vscode.TreeViewOptions<ServerTreeItens> = {
      treeDataProvider: serverProvider,
    };
    vscode.window.createTreeView('totvs_server', options);
    vscode.window.registerTreeDataProvider('totvs_server', serverProvider);

    vscode.commands.registerCommand(
      'totvs-developer-studio.connect',
      (serverItem: ServerTreeItem) => {
        let server: IServerDebugger = serverItem.server;
        if (server) {
          //Verifica se ha um build cadastrado.
          if (server.build) {
            inputConnectionParameters(
              context,
              serverItem,
              LS_CONNECTION_TYPE.Debugger,
              false
            );
          } else {
            vscode.window.setStatusBarMessage(
              `Validando servidor [${server.type}]`,
              server.validate().then(
                (result: boolean) => {
                  if (result) {
                    //continua a autenticacao.
                    inputConnectionParameters(
                      context,
                      serverItem,
                      LS_CONNECTION_TYPE.Debugger,
                      false
                    );
                  } else {
                    vscode.window.showErrorMessage(
                      localize(
                        'tds.webview.serversView.couldNotConn',
                        'Could not connect to server'
                      )
                    );
                  }
                  return;
                },
                (err: ResponseError<object>) => {
                  vscode.window.showErrorMessage(err.message);
                }
              )
            );
          }
        }
      }
    );

    vscode.commands.registerCommand(
      'totvs-developer-studio.reconnect',
      (serverItem: ServerTreeItem) => {
        const server: IServerDebugger = serverItem.server;
        if (server) {
          //Verifica se ha um buildVersion cadastrado.
          if (server.build) {
            inputConnectionParameters(
              context,
              serverItem,
              LS_CONNECTION_TYPE.Debugger,
              true
            );
          } else {
            vscode.window.showErrorMessage(
              localize(
                'tds.webview.serversView.couldNotReconn',
                'Could not reconnect to server'
              )
            );
          }
        }
      }
    );

    vscode.commands.registerCommand(
      'totvs-developer-studio.disconnect',
      (serverItem: ServerTreeItem) => {
        const server: IServerDebugger = serverItem.server;
        if (server && server.isConnected()) {
          vscode.window.setStatusBarMessage(
            `Desconectando do servidor [${server.name}]`,
            server.disconnect().then(
              (value: string) => {
                vscode.window.showErrorMessage(value);
              },
              (err: ResponseError<object>) => {
                vscode.window.showErrorMessage(err.message);
              }
            )
          );
        } else {
          vscode.window.showInformationMessage(
            localize(
              'tds.webview.serversView.alreadyConn',
              'Server is already disconnected'
            )
          );
        }
      }
    );

    vscode.commands.registerCommand(
      'totvs-developer-studio.selectenv',
      (environment: EnvironmentTreeItem) => {
        inputConnectionParameters(
          context,
          environment,
          LS_CONNECTION_TYPE.Debugger,
          true
        );
      }
    );

    vscode.commands.registerCommand(
      'totvs-developer-studio.delete',
      (serverItem: ServerTreeItem) => {
        const server: IServerDebugger = serverItem.server;
        const folder: FolderTreeItem = serverItem.parent;
        serverManager.getConfigurations(folder.folder).deleteServer(server);
      }
    );

    vscode.commands.registerCommand(
      'totvs-developer-studio.delete.environment',
      (environmentItem: EnvironmentTreeItem) => {
        environmentItem.parent.server.removeEnvironment(environmentItem.label);
      }
    );

    vscode.commands.registerCommand(
      'totvs-developer-studio.rename',
      (serverItem: ServerTreeItem) => {
        const server: IServerDebugger = serverItem.server;
        vscode.window
          .showInputBox({
            placeHolder: localize(
              'tds.webview.serversView.renameServer',
              'Rename the server'
            ),
            value:
              typeof serverItem.label === 'string'
                ? serverItem.label
                : (serverItem.label as vscode.TreeItemLabel).label,
          })
          .then((newName: string) => {
            //serverManager.renameServer(server, newName);
          });
      }
    );

    // context.subscriptions.push(
    //   serverManager.onDidChange((event: EventData) => {
    //     if (event.name === 'load') {
    //       console.log(this);
    //     }
    //   }, serverManager)
    // );

    function getWebViewContent(context, localizeHTML, folder: string) {
      const htmlOnDiskPath = vscode.Uri.file(
        path.join(context.extensionPath, 'src', 'server', 'addServer.html')
      );
      const cssOniskPath = vscode.Uri.file(
        path.join(context.extensionPath, 'resources', 'css', 'form.css')
      );

      const htmlContent = fs.readFileSync(
        htmlOnDiskPath.with({ scheme: 'vscode-resource' }).fsPath
      );
      const cssContent = fs.readFileSync(
        cssOniskPath.with({ scheme: 'vscode-resource' }).fsPath
      );

      let runTemplate = compile(htmlContent);

      return runTemplate({
        css: cssContent,
        localize: localizeHTML,
        target: folder,
      });
    }

    function createServer(
      folder: string,
      typeServer: LSServerType.LS_SERVER_TYPE,
      serverName: string,
      port: number,
      address: string,
      secure: boolean,
      buildVersion: string,
      includes: string[]
    ): void {
      const attributes: Partial<IServerDebugger> = {
        id: null,
        type: typeServer,
        name: serverName,
        port: port,
        address: address,
        build: buildVersion as BuildVersion,
        secure: secure,
        includes: includes,
      };

      const server: IServerDebugger = serverManager.getServerDebugger(
        folder,
        attributes
      );

      if (server) {
        server.validate().then(
          (result: boolean) => {
            if (result) {
              serverManager.getConfigurations(folder).addServer(server);
            }
            vscode.window.showInformationMessage(
              localize('tds.webview.serversView.serverSaved', 'Saved server ') +
                serverName
            );

            return;
          },
          (err: ResponseError<object>) => {
            vscode.window.showErrorMessage(err.message);
          }
        );
      }
    }
  }
}

/*

export function connectServer(
  serverItem: ServerItem,
  environment: string,
  connType: ConnTypeIds
) {
  if (serverItem.isConnected && serverItem.environment === environment) {
    vscode.window.showInformationMessage(
      localize(
        'tds.webview.serversView.alreadyConn',
        'The server selected is already connected.'
      )
    );
  } else {
    if (serverProvider.connectedServerItem !== undefined) {
      vscode.commands.executeCommand(
        'totvs-developer-studio.disconnect',
        serverProvider.connectedServerItem
      );
    }

    vscode.window.setStatusBarMessage(
      `Conectando-se ao servidor [${serverItem.name}]`,
      sendConnectRequest(serverItem, environment, connType).then(
        (result: ITokenInfo) => {
          if (result) {
            if (result.needAuthentication) {
              serverItem.token = result.token;
              inputAuthenticationParameters(serverItem, environment);
            } else {
              doFinishConnectProcess(serverItem, result.token, environment);
            }
          }
        },
        (error) => {
          vscode.window.showErrorMessage(error);
        }
      )
    );
  }
}

export function authenticate(
  serverItem: ServerItem,
  environment: string,
  username: string,
  password: string
) {
  const enconding: string =
    vscode.env.language === 'ru'
      ? ENABLE_CODE_PAGE.CP1251
      : ENABLE_CODE_PAGE.CP1252;

  vscode.window.setStatusBarMessage(
    `Autenticando usuário [${username}] no servidor [${serverItem.name}]`,
    sendAuthenticateRequest(
      serverItem,
      environment,
      username,
      password,
      enconding
    )
      .then(
        (result: IAuthenticationInfo) => {
          let token: string = result.token;
          return result.sucess ? token : '';
        },
        (error: any) => {
          vscode.window.showErrorMessage(error);
          return false;
        }
      )
      .then((token: string) => {
        if (token) {
          serverItem.username = username;
          doFinishConnectProcess(serverItem, token, environment);
        }
      })
  );
}

function doReconnect(
  serverItem: ServerItem,
  environment: string,
  connType: ConnTypeIds
): Thenable<boolean> {
  const token = Utils.getSavedTokens(serverItem.id, environment);

  if (token) {
    return sendReconnectRequest(serverItem, token, connType).then(
      (ri: IReconnectInfo) => {
        if (ri.sucess) {
          doFinishConnectProcess(serverItem, ri.token, environment);
        }
        return ri.sucess;
      }
    );
  } else {
    return Promise.resolve(false);
  }
}

export function reconnectServer(
  serverItem: ServerItem,
  environment: string,
  connType: ConnTypeIds
) {
  const connectedServerItem = serverProvider.connectedServerItem;

  if (connectedServerItem !== undefined) {
    async () =>
      await vscode.commands.executeCommand(
        'totvs-developer-studio.disconnect',
        connectedServerItem
      );
  }

  vscode.window.setStatusBarMessage(
    `$(loading) Reconectando-se ao servidor [${serverItem.name}]`,
    doReconnect(serverItem, environment, connType)
  );
}

export function reconnectLastServer() {
  const servers = Utils.getServersConfig();

  if (servers.lastConnectedServer && servers.configurations) {
    servers.configurations.forEach((element) => {
      if (element.id === servers.lastConnectedServer) {
        reconnectServer(
          element,
          element.environment,
          ConnTypeIds.CONNT_DEBUGGER
        );
      }
    });
  }
}

class NodeError {
  code: number;
  message: string;
}

function handleError(nodeError: NodeError) {
  vscode.window.showErrorMessage(nodeError.code + ': ' + nodeError.message);
}
*/
