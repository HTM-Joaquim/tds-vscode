import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as fs from 'fs';
import path = require('path');
import { BuildVersion, LSServerType } from '@totvs/tds-languageclient';
import { ResponseError } from 'vscode-languageclient/node';
import { FolderTreeItem } from '../serverItemProvider';
import { IServerDebugger, serverManager } from '../serverManager';
import Utils from '../utils';

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

export function createAddServerPanel(
  context: vscode.ExtensionContext,
  folder: FolderTreeItem
) {
  const currentPanel = vscode.window.createWebviewPanel(
    'totvs-developer-studio.add',
    localize('tds.webview.newServer.title', 'New Server'),
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'src', 'server')),
      ],
      retainContextWhenHidden: true,
    }
  );

  currentPanel.webview.html = getWebViewContent(
    context,
    localizeHTML,
    folder.folder
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

  return currentPanel;
}

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

  const server: IServerDebugger = serverManager.getServerDebugger(attributes);

  if (server) {
    server.validate().then(
      (result: boolean) => {
        if (result) {
          serverManager.getConfigurations().addServer(server);
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
