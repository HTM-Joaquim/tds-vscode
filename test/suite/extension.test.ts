import * as assert from 'assert';
import * as vscode from 'vscode';
//import * as tdsVscode from '../../';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Should start extension', async () => {
    const started: boolean =
      vscode.extensions.getExtension('@totvs/tds-vscode')?.isActive || false;

	assert.strictEqual(started, false, "Extensão TDS-VSCode não ativada.");
  });
});
