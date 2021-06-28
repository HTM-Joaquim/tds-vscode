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
import * as path from 'path';
import Utils from './utils';
import * as nls from 'vscode-nls';
import { inputConnectionParameters } from './inputConnectionParameters';
import { ResponseError } from 'vscode-languageclient/node';
import serverProvider, {
  EnvironmentTreeItem,
  FolderTreeItem,
  ServerTreeItem,
  ServerTreeItens,
} from './serverItemProvider';
import { IServerDebugger, serverManager } from './serverManager';
import { LS_CONNECTION_TYPE } from '@totvs/tds-languageclient';
import { createAddServerPanel } from './server/addServer';

let localize = nls.loadMessageBundle();

export class ServersExplorer {
  constructor(context: vscode.ExtensionContext) {
    const options: vscode.TreeViewOptions<ServerTreeItens> = {
      treeDataProvider: serverProvider,
      canSelectMany: false,
      showCollapseAll: false,
    };
    context.subscriptions.push(
      vscode.window.createTreeView('totvs_server', options),
      vscode.window.registerTreeDataProvider('totvs_server', serverProvider)
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.togleVisibleFolder',
      (arg: any) => {
        console.log('aaaa');
      }
    ));

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.add',
      (folder: FolderTreeItem) => {
        createAddServerPanel(context, folder);
      }
    ));

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.config',
      (element: FolderTreeItem) => {
        vscode.window.showTextDocument(serverManager.getServerFile());
      }
    ));

    // check if there is an open folder
    if (vscode.workspace.workspaceFolders === undefined) {
      vscode.window.showErrorMessage('No folder opened.');
      return;
    }

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.connect',
      (serverItem: ServerTreeItem) => {
        processConnect(context, serverItem);
      }
    ));

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.reconnect',
      (serverItem: ServerTreeItem) => {
        processReconnect(context, serverItem);
      }
    ));

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.disconnect',
      (serverItem: ServerTreeItem) => {
        processDisconnect(context, serverItem);
      }
    ));

    context.subscriptions.push(
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
    ));

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.delete',
      (serverItem: ServerTreeItem) => {
        const server: IServerDebugger = serverItem.server;
        const folder: FolderTreeItem = serverItem.parent;
        serverManager.getConfigurations(folder.folder).deleteServer(server);
      }
    ));

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.delete.environment',
      (environmentItem: EnvironmentTreeItem) => {
        environmentItem.parent.server.removeEnvironment(environmentItem.label);
      }
    ));

    context.subscriptions.push(
      vscode.commands.registerCommand(
      'totvs-developer-studio.rename',
      (serverItem: ServerTreeItem) => {
        processRename(context, serverItem);
      }
    ));
  }
}

function processConnect(context: vscode.ExtensionContext, serverItem: ServerTreeItem) {
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

function processReconnect(context: vscode.ExtensionContext, serverItem: ServerTreeItem) {
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

function processDisconnect(context: vscode.ExtensionContext, serverItem: ServerTreeItem) {
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

function processRename(context: vscode.ExtensionContext, serverItem: ServerTreeItem) {
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
