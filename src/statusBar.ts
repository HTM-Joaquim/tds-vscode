import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { CompileKey } from './compileKey/compileKey';
import { sendRpoToken } from './protocolMessages';
import { getRpoTokenFromFile, IRpoToken } from './rpoToken';
import { ServerItem } from './serverItemProvider';
import Utils from './utils';

const localize = nls.config({
  locale: vscode.env.language,
  bundleFormat: nls.BundleFormat.standalone,
})();

let totvsStatusBarItem: vscode.StatusBarItem;
let saveLocationBarItem: vscode.StatusBarItem;
let permissionStatusBarItem: vscode.StatusBarItem;
let settingsStatusBarItem: vscode.StatusBarItem;
let rpoTokenStatusBarItem: vscode.StatusBarItem;

const priorityTotvsStatusBarItem: number = 103;
const priorityRpoTokenStatusBarItem: number = 102;
const priorityPermissionStatusBarItem: number = 101;
const prioritySettingsStatusBarItem: number = 100;
const prioritySaveLocationBarItem: number = 100;

export function initStatusBarItems(context: vscode.ExtensionContext) {
  initStatusBarItem(context);
  initSaveLocationBarItem(context);
  initPermissionStatusBarItem(context);
  initRpoTokenStatusBarItem(context);
  initSettingsBarItem(context);
}

export function updateStatusBarItems() {
  updateStatusBarItem(undefined);
  updateSaveLocationBarItem();
  updatePermissionStatusBarItem();
  updateRpoTokenStatusBarItem();
  updateSettingsBarItem();
}

function initStatusBarItem(context: vscode.ExtensionContext) {
  totvsStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    priorityTotvsStatusBarItem
  );
  totvsStatusBarItem.command = 'totvs-developer-studio.serverSelection';
  totvsStatusBarItem.text =
    '$(server-environment-spin)' +
    localize('tds.vscode.initializing', '(initializing)');
  totvsStatusBarItem.tooltip = totvsStatusBarItem.text;

  context.subscriptions.push(totvsStatusBarItem);
  context.subscriptions.push(
    Utils.onDidSelectedServer((newServer: ServerItem) => {
      updateStatusBarItem(newServer);
    })
  );

  updateStatusBarItem(undefined);
}

function updateStatusBarItem(selectServer: ServerItem | undefined): void {
  totvsStatusBarItem.text = `$(server-environment) `;

  if (selectServer) {
    totvsStatusBarItem.text += `${selectServer.name} / ${selectServer.environment}`;
    totvsStatusBarItem.tooltip = `Address: ${selectServer.address}`;
  } else {
    totvsStatusBarItem.text += localize(
      'tds.vscode.select_server_environment',
      'Select server/environment'
    );
    totvsStatusBarItem.tooltip = localize(
      'tds.vscode.select_server_environment.tooltip',
      'Select a server and environment in the server view'
    );
  }

  totvsStatusBarItem.show();
}

function initSaveLocationBarItem(context: vscode.ExtensionContext) {
  saveLocationBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    prioritySaveLocationBarItem
  );
  saveLocationBarItem.command = 'totvs-developer-studio.toggleSaveLocation';

  context.subscriptions.push(saveLocationBarItem);

  updateSaveLocationBarItem();
}

function updateSaveLocationBarItem() {
  const workspace: boolean = Utils.isWorkspaceServerConfig();
  const location: string = Utils.getServerConfigFile();

  if (workspace) {
    saveLocationBarItem.text = '$(globe)';
  } else {
    saveLocationBarItem.text = '$(home)';
  }
  saveLocationBarItem.tooltip = location;

  saveLocationBarItem.show();
}

function initPermissionStatusBarItem(context: vscode.ExtensionContext) {
  permissionStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    priorityPermissionStatusBarItem
  );
  permissionStatusBarItem.command = 'totvs-developer-studio.compile.key';
  context.subscriptions.push(permissionStatusBarItem);
  context.subscriptions.push(
    Utils.onDidSelectedKey(updatePermissionStatusBarItem)
  );

  updatePermissionStatusBarItem();
}

function updatePermissionStatusBarItem(): void {
  const infos: CompileKey = Utils.getPermissionsInfos();

  if (infos && infos.authorizationToken && infos.buildType && infos.expire) {
    const [dd, mm, yyyy] = infos.expire.split('/');
    const expiryDate: Date = new Date(`${yyyy}-${mm}-${dd} 23:59:59`);
    if (expiryDate.getTime() >= new Date().getTime()) {
      const newLine = '\n';
      permissionStatusBarItem.text = 'Permissions: Logged in';
      if (infos.machineId) {
        permissionStatusBarItem.tooltip =
          'Machine ID: ' + infos.machineId + newLine;
      } else if (infos.userId) {
        permissionStatusBarItem.tooltip = 'User ID: ' + infos.userId + newLine;
      }
      permissionStatusBarItem.tooltip +=
        'Expires in ' + expiryDate.toLocaleString() + newLine;

      if (infos.buildType === '0') {
        permissionStatusBarItem.tooltip +=
          'Allow compile functions and overwrite default TOTVS';
      } else if (infos.buildType === '1') {
        permissionStatusBarItem.tooltip += 'Allow only compile users functions';
      } else if (infos.buildType === '2') {
        permissionStatusBarItem.tooltip += 'Allow compile functions';
      }
    } else {
      permissionStatusBarItem.text =
        'Permissions: Expired in ' + expiryDate.toLocaleString();
      permissionStatusBarItem.tooltip = '';
    }
  } else {
    permissionStatusBarItem.text = 'Permissions: NOT logged in';
    permissionStatusBarItem.tooltip = '';
  }
  permissionStatusBarItem.text = `$(key) ${permissionStatusBarItem.text}`;
  permissionStatusBarItem.show();
}

function initRpoTokenStatusBarItem(context: vscode.ExtensionContext) {
  rpoTokenStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    priorityRpoTokenStatusBarItem
  );
  rpoTokenStatusBarItem.command = 'totvs-developer-studio.rpoToken';
  rpoTokenStatusBarItem.text = 'RPO';
  rpoTokenStatusBarItem.tooltip = localize(
    'tds.vscode.rpoToken.initial.tooltip',
    'Select file with RPO token'
  );

  context.subscriptions.push(rpoTokenStatusBarItem);
  context.subscriptions.push(
    Utils.onDidSelectedServer(updateRpoTokenStatusBarItem)
  );
  context.subscriptions.push(
    Utils.onDidRpoTokenSelected(updateRpoTokenStatusBarItem)
  );

  rpoTokenStatusBarItem.show();
}

function updateRpoTokenStatusBarItem(): void {
  const server: ServerItem = Utils.getCurrentServer();
  let text: string = 'RPO ';
  let tooltip: string = '';

  if (server) {
    const rpoAux: any = Utils.getRpoTokenFileInfo(server.id);
    if (rpoAux) {
      const rpoToken: IRpoToken = getRpoTokenFromFile(rpoAux.file);
      const error: string = rpoToken.error || rpoAux.error;
      const warning: string = rpoToken.warning || rpoAux.warning;

      const rpoTokenApply: any = sendRpoToken(server, rpoToken);

      text += error ? '$(error)' : warning ? '$(alert)' : '$(check)';
      tooltip += error ? `${error}\n` : warning ? `${warning}\n` : '';
      tooltip += `Name: ${rpoToken.body.name}\n`;
      tooltip += `Subject: ${rpoToken.body.sub}\n`;
      tooltip += `Auth: ${rpoToken.body.auth}\n`;
      tooltip += `Validate: ${rpoToken.body.exp.toLocaleDateString()} at ${rpoToken.body.iat.toLocaleDateString()}\n`;
      tooltip += `Emitter: ${rpoToken.body.iss}`;
    } else {
      tooltip += localize(
        'tds.vscode.rpoToken.initial.tooltip',
        'Select file with RPO token'
      );
    }
  }

  rpoTokenStatusBarItem.text = text;
  rpoTokenStatusBarItem.tooltip = tooltip;

  rpoTokenStatusBarItem.show();
}

function initSettingsBarItem(context: vscode.ExtensionContext): void {
  settingsStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    prioritySettingsStatusBarItem
  );
  context.subscriptions.push(settingsStatusBarItem);
}

function updateSettingsBarItem(): void {
  let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'totvsLanguageServer'
  );
  let behavior = config.get('editor.toggle.autocomplete');

  settingsStatusBarItem.text = `${behavior}`;
  settingsStatusBarItem.tooltip =
    localize('tds.vscode.lssettings.auto.complete', 'Auto complete type') +
    '  ';

  settingsStatusBarItem.show();
}
