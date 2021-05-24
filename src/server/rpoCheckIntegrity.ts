import Utils from '../utils';
import { languageClient } from '../extension';
import * as vscode from 'vscode';
import { ResponseError } from 'vscode-languageclient';
import * as nls from 'vscode-nls';
import { _debugEvent } from '../debug';
import { IServerDebugger, serverManager } from '../serverManager';
import { IRpoChechIntegrityResult } from '@totvs/tds-languageclient';

const localize = nls.loadMessageBundle();

export function rpoCheckIntegrity() {
  const server: IServerDebugger = serverManager.currentServer;

  if (server) {
    if (_debugEvent) {
      vscode.window.showWarningMessage(
        'Esta operação não é permitida durante uma depuração.'
      );
      return;
    }
    server.rpoCheckIntegrity().then(
      (response: IRpoChechIntegrityResult) => {
        if (!response.integrity) {
          vscode.window.showErrorMessage(response.message);
        } else {
          vscode.window.showInformationMessage(response.message);
        }
      },
      (err: ResponseError<object>) => {
        vscode.window.showErrorMessage(err.message);
      }
    );
  } else {
    vscode.window.showErrorMessage(
      localize('tds.vscode.servernotconnected', 'There is no server connected')
    );
  }
}
