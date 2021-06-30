import * as vscode from 'vscode';
import { ResponseError } from 'vscode-languageclient/node';
import * as nls from 'vscode-nls';
import { serverManager } from '../serverManager';
import { _debugEvent } from '../debug';

const localize = nls.loadMessageBundle();

export function defragRpo() {
  const server = serverManager.currentServer;
  if (_debugEvent) {
    vscode.window.showWarningMessage(
      'Esta operação não é permitida durante uma depuração.'
    );
    return;
  }

  if (server) {
    vscode.window.setStatusBarMessage(
      'Desfragmentando RPO',
      server.defragRpo().then(
        (response: any) => {
          // Nothing to do
        },
        (err: ResponseError<object>) => {
          vscode.window.showErrorMessage(err.message);
        }
      )
    );
  } else {
    vscode.window.showErrorMessage(
      localize('tds.vscode.servernotconnected', 'There is no server connected')
    );
  }
}
