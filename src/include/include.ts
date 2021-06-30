import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Utils from '../utils';

import * as nls from 'vscode-nls';
import { serverManager } from '../serverManager';
import {
  FolderTreeItem,
  IncludesTreeItem,
  ServerTreeItem,
} from '../serverItemProvider';

const localize = nls.loadMessageBundle();
const compile = require('template-literal');

const localizeHTML = {
  'tds.webview.title': localize('tds.webview.title', 'Include'),
  'tds.webview.dir.include': localize(
    'tds.webview.dir.include',
    'Includes directory:'
  ),
  'tds.webview.dir.include2': localize(
    'tds.webview.dir.include2',
    'Allow multiple directories'
  ),
  'tds.webview.dir.include.info': localize(
    'tds.webview.dir.include.info',
    'These settings can also be changed in'
  ),
};

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export default function showInclude(
  context: vscode.ExtensionContext,
  target: FolderTreeItem | ServerTreeItem | IncludesTreeItem
) {
  let includes: string[] = [];

  if (currentPanel) {
    currentPanel.reveal();
  } else {
    let title: string = localize('tds.webview.title', 'Include');
    let folderStr: string;

    if (target instanceof IncludesTreeItem) {
      const ti: IncludesTreeItem = target as IncludesTreeItem;
      target = ti.parent;
    }

    if (target instanceof FolderTreeItem) {
      const ti: FolderTreeItem = target as FolderTreeItem;
      includes = serverManager.getIncludes(false);
      folderStr = ti.folder;
    } else {
      const ti: ServerTreeItem = target as ServerTreeItem;
      includes = ti.server.includes;
      folderStr = ti.parent.folder;
    }
    title = `${title}: ${folderStr}`;

    currentPanel = vscode.window.createWebviewPanel(
      'totvs-developer-studio.include',
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    currentPanel.webview.html = getWebViewContent(
      context,
      localizeHTML,
      folderStr
    );
    currentPanel.onDidDispose(
      () => {
        currentPanel = undefined;
      },
      null,
      context.subscriptions
    );

    const includeString: string = includes.toString();
    if (includeString) {
      const aux = includeString.replace(/,/g, ';');
      if (aux) {
        currentPanel.webview.postMessage({
          command: 'setCurrentInclude',
          include: aux,
        });
      }
    }
    currentPanel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'checkDir':
            let checkedDir = Utils.checkDir(message.selectedDir);
            currentPanel.webview.postMessage({
              command: 'checkedDir',
              checkedDir: checkedDir,
            });
            break;
          case 'includeClose':
            const includePath: string[] = message.include.filter((value: string) => {
              return value.trim() !== '';
            });

            if (target instanceof FolderTreeItem) {
              const fti: FolderTreeItem = target as FolderTreeItem;
              serverManager.setIncludes(includePath);
            } else {
              const sti: ServerTreeItem = target as ServerTreeItem;
              sti.server.includes = includePath;
            }

            if (currentPanel && message.close) {
              currentPanel.dispose();
            }

            break;
        }
      },
      undefined,
      context.subscriptions
    );
  }
}

function getWebViewContent(
  context: vscode.ExtensionContext,
  localizeHTML,
  folder: string
) {
  const htmlOnDiskPath = vscode.Uri.file(
    path.join(context.extensionPath, 'src', 'include', 'include.html')
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
