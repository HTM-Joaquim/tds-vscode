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
import * as fs from 'fs';
import { extensions, window, Uri, ViewColumn } from 'vscode';
import * as nls from 'vscode-nls';
import Utils from '../utils';
import { ResponseError } from 'vscode-languageclient/node';
import { _debugEvent } from '../debug';
import { IServerDebugger, serverManager } from '../serverManager';
import {
  IDeleteProgramResult,
  IResponseStatus,
} from '@totvs/tds-languageclient';

let localize = nls.loadMessageBundle();
const compile = require('template-literal');

const localizeHTML = {
  'tds.webview.deleteFile.title': localize(
    'tds.webview.deleteFile.title',
    'Deleting source/resource from RPO'
  ),
  'tds.webview.deleteFile.line1': localize(
    'tds.webview.deleteFile.line1',
    'In order to delete a source/resource from RPO follow these steps:'
  ),
  'tds.webview.deleteFile.line2': localize(
    'tds.webview.deleteFile.line2',
    'Find source/resource in workspace'
  ),
  'tds.webview.deleteFile.line3': localize(
    'tds.webview.deleteFile.line3',
    'Select source/recourse with rigth mouse buttom'
  ),
  'tds.webview.deleteFile.line4': localize(
    'tds.webview.deleteFile.line4',
    "Select the option 'Delete source/resource from RPO' on popup menu"
  ),
  'tds.webview.deleteFile.line5': localize(
    'tds.webview.deleteFile.line5',
    "Confirm file deletion selecting the option 'YES' in the form displayed on the bottom right corner."
  ),
};

export function deleteFileFromRPO(context: any, selectedFiles): void {
  const files = changeToArrayString(selectedFiles);

  if (context.contextValue === 'serverItem') {
    const currentPanel = window.createWebviewPanel(
      'totvs-developer-studio.delete.file.fromRPO',
      localize('tds.vscode.deleteFile', 'Delete File From RPO'),
      ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );
    let ext = extensions.getExtension('TOTVS.tds-vscode');
    if (ext) {
      currentPanel.webview.html = getWebViewContent(ext, localizeHTML);
    }
  } else {
    let allFiles: string[];
    if (!files) {
      if (context.fsPath && context.fsPath !== undefined) {
        //A ação veio pelo menu de contexto por exemplo, e/ou com o fsPath preenchido corretamente
        allFiles = [context.fsPath];
      }
    }
    allFiles = Utils.getAllFilesRecursive(files);

    if (allFiles) {
      window
        .showWarningMessage(
          localize(
            'tds.vscode.delete_prw_file',
            'Are you sure you want to delete {0} files from RPO?',
            allFiles.length
          ),
          localize('tds.vscode.yes', 'Yes'),
          localize('tds.vscode.no', 'No')
        )
        .then((clicked) => {
          if (clicked === localize('tds.vscode.yes', 'Yes')) {
            deletePrograms(allFiles);
          }
        });
    }
  }

  function getWebViewContent(context, localizeHTML) {
    const htmlOnDiskPath = Uri.file(
      path.join(
        context.extensionPath,
        'src',
        'server',
        'deleteFileFromRPO.html'
      )
    );
    const cssOniskPath = Uri.file(
      path.join(context.extensionPath, 'resources', 'css', 'form.css')
    );

    const htmlContent = fs.readFileSync(
      htmlOnDiskPath.with({ scheme: 'vscode-resource' }).fsPath
    );
    const cssContent = fs.readFileSync(
      cssOniskPath.with({ scheme: 'vscode-resource' }).fsPath
    );

    let runTemplate = compile(htmlContent);

    return runTemplate({ css: cssContent, localize: localizeHTML });
  }
}

function changeToArrayString(allFiles) {
  let arrayFiles: string[] = [];

  if (allFiles !== undefined) {
    allFiles.forEach((element) => {
      if (element.fsPath) {
        arrayFiles.push(element.fsPath);
      } else {
        if (fs.existsSync(element)) {
          arrayFiles.push(element);
        }
      }
    });
  }

  return arrayFiles;
}

export function deletePrograms(programs: string[]) {
  if (_debugEvent) {
    vscode.window.showWarningMessage(
      'Esta operação não é permitida durante uma depuração.'
    );
    return;
  }

  const server: IServerDebugger = serverManager.currentServer;
  if (server) {
    server.deletePrograms(programs).then(
      (response: IDeleteProgramResult) => {
        if (response.returnCode === 40840) {
          // AuthorizationTokenExpiredError
          //TODO serverManager.removeExpiredAuthorization();
        }
        vscode.window.showInformationMessage(
          'Delete programs from RPO succesfully.'
        );
      },
      (err: ResponseError<IResponseStatus>) => {
        vscode.window.showErrorMessage(err.message);
      }
    );
  } else {
    vscode.window.showErrorMessage(
      localize('tds.webview.tdsBuild.noServer', 'No server connected')
    );
  }
}
